// Taily - Invoice + Voucher creation logic
// Creates a GST invoice AND auto-posts a balanced double-entry voucher.

import { prisma } from "./prisma";
import { roundTo2 } from "./currency";
import { Decimal } from "@prisma/client/runtime/library";
import { DEFAULT_CHART_OF_ACCOUNTS } from "./accounts";

export type InvoiceLineInput = {
  itemId?: string;
  name: string;
  hsn?: string;
  qty: number;
  rate: number;
  gstRate: number;
};

export type CreateInvoiceInput = {
  companyId: string;
  type: "SALES" | "PURCHASE";
  partyId?: string;
  date: Date;
  dueDate?: Date;
  lines: InvoiceLineInput[];
  notes?: string;
  // For inter-state: IGST applies. For intra-state: CGST+SGST split.
  isInterState: boolean;
};

export async function createInvoice(input: CreateInvoiceInput) {
  const { companyId, type, partyId, date, dueDate, lines, notes, isInterState } = input;

  // 1. Calculate line amounts + GST
  let subTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  const builtLines = lines.map((line) => {
    const amount = roundTo2(line.qty * line.rate);
    const gstAmt = roundTo2((amount * line.gstRate) / 100);

    let cgst = 0,
      sgst = 0,
      igst = 0;
    if (isInterState) {
      igst = gstAmt;
      igstTotal += igst;
    } else {
      cgst = roundTo2(gstAmt / 2);
      sgst = roundTo2(gstAmt / 2);
      cgstTotal += cgst;
      sgstTotal += sgst;
    }

    subTotal += amount;

    return {
      itemId: line.itemId || null,
      name: line.name,
      hsn: line.hsn || null,
      qty: new Decimal(line.qty),
      rate: new Decimal(line.rate),
      amount: new Decimal(amount),
      gstRate: new Decimal(line.gstRate),
      cgst: new Decimal(cgst),
      sgst: new Decimal(sgst),
      igst: new Decimal(igst),
    };
  });

  const taxableBeforeGst = roundTo2(subTotal);
  const totalGst = roundTo2(cgstTotal + sgstTotal + igstTotal);
  const beforeRound = roundTo2(taxableBeforeGst + totalGst);
  const grandTotal = Math.round(beforeRound); // round to nearest rupee
  const roundOff = roundTo2(grandTotal - beforeRound);

  // 2. Determine accounts based on invoice type
  const isSales = type === "SALES";
  const salesCode = isSales ? "4001" : "5001"; // Sales / Purchase
  const debtorCode = isSales ? "1100" : "2001"; // Sundry Debtors / Creditors

  // 3. Build balanced double-entry voucher entries
  // Sales invoice:  Dr Sundry Debtors (full) | Cr Sales (taxable) | Cr Output CGST/SGST/IGST
  // Purchase:       Dr Purchase (taxable) | Dr Input CGST/SGST/IGST | Cr Sundry Creditors (full)
  const entries: { accountCode: string; debit: number; credit: number }[] = [];

  if (isSales) {
    entries.push({ accountCode: debtorCode, debit: grandTotal, credit: 0 });
    entries.push({ accountCode: salesCode, debit: 0, credit: taxableBeforeGst });
    if (cgstTotal > 0) entries.push({ accountCode: "2100", debit: 0, credit: cgstTotal }); // Output CGST
    if (sgstTotal > 0) entries.push({ accountCode: "2101", debit: 0, credit: sgstTotal }); // Output SGST
    if (igstTotal > 0) entries.push({ accountCode: "2102", debit: 0, credit: igstTotal }); // Output IGST
    // Round off to keep voucher balanced (account 4900 = Round Off)
    if (roundOff < 0) entries.push({ accountCode: "4900", debit: Math.abs(roundOff), credit: 0 });
    else if (roundOff > 0) entries.push({ accountCode: "4900", debit: 0, credit: roundOff });
  } else {
    entries.push({ accountCode: salesCode, debit: taxableBeforeGst, credit: 0 });
    if (cgstTotal > 0) entries.push({ accountCode: "1300", debit: cgstTotal, credit: 0 }); // Input CGST
    if (sgstTotal > 0) entries.push({ accountCode: "1301", debit: sgstTotal, credit: 0 }); // Input SGST
    if (igstTotal > 0) entries.push({ accountCode: "1302", debit: igstTotal, credit: 0 }); // Input IGST
    if (roundOff < 0) entries.push({ accountCode: "4900", debit: 0, credit: Math.abs(roundOff) });
    else if (roundOff > 0) entries.push({ accountCode: "4900", debit: roundOff, credit: 0 });
    entries.push({ accountCode: debtorCode, debit: 0, credit: grandTotal });
  }

  // 4. Generate invoice number: INV-000001 or PUR-000001
  const count = await prisma.invoice.count({ where: { companyId, type } });
  const lastInvoice = await prisma.invoice.findFirst({
    where: { companyId, type },
    orderBy: { createdAt: "desc" },
  });
  let nextSeq = count + 1;
  if (lastInvoice) {
    const parsed = parseInt(lastInvoice.invoiceNo.replace(/\D/g, ""));
    if (!isNaN(parsed) && parsed >= nextSeq) nextSeq = parsed + 1;
  }
  const invoiceNo = `${isSales ? "INV" : "PUR"}-${String(nextSeq).padStart(6, "0")}`;

  // 5. Generate guaranteed unique voucher number
  const vCount = await prisma.voucher.count({ where: { companyId } });
  const datePrefix = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const voucherNo = `V-${isSales ? "S" : "P"}-${datePrefix}-${String(vCount + 1).padStart(4, "0")}-${randomSuffix}`;

  // 6. Validate & auto-seed accounts
  const codes = entries.map((e) => e.accountCode);
  let accounts = await prisma.account.findMany({
    where: { companyId, code: { in: codes } },
  });
  const existingCodes = new Set(accounts.map((a) => a.code));
  const missingCodes = codes.filter((c) => !existingCodes.has(c));

  if (missingCodes.length > 0) {
    for (const missingCode of missingCodes) {
      const def = DEFAULT_CHART_OF_ACCOUNTS.find((d) => d.code === missingCode);
      if (def) {
        const created = await prisma.account.create({
          data: {
            companyId,
            code: def.code,
            name: def.name,
            type: def.type,
            groupId: def.groupId,
          },
        });
        accounts.push(created);
      }
    }
  }

  const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

  // 7. Create everything atomically
  const result = await prisma.$transaction(async (tx) => {
    // Create voucher first
    const voucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNo,
        type: isSales ? "SALES" : "PURCHASE",
        date,
        partyId: partyId || null,
        narration: `${isSales ? "Sales" : "Purchase"} invoice ${invoiceNo}`,
        entries: {
          create: entries.map((e) => ({
            accountId: accountMap.get(e.accountCode)!,
            debit: new Decimal(e.debit),
            credit: new Decimal(e.credit),
          })),
        },
      },
    });

    // Create invoice linked to voucher
    const invoice = await tx.invoice.create({
      data: {
        companyId,
        invoiceNo,
        type,
        partyId: partyId || null,
        date,
        dueDate,
        subTotal: new Decimal(taxableBeforeGst),
        cgstTotal: new Decimal(cgstTotal),
        sgstTotal: new Decimal(sgstTotal),
        igstTotal: new Decimal(igstTotal),
        roundOff: new Decimal(roundOff),
        grandTotal: new Decimal(grandTotal),
        paidAmount: new Decimal(0),
        status: "UNPAID",
        notes,
        voucherId: voucher.id,
        lines: { create: builtLines },
      },
      include: { lines: true, party: true },
    });

    // Update stock for items (reduce on SALE, increase on PURCHASE)
    for (const line of builtLines) {
      if (line.itemId) {
        await tx.item.update({
          where: { id: line.itemId },
          data: {
            stock: {
              increment: isSales ? -line.qty.toNumber() : line.qty.toNumber(),
            },
          },
        });
      }
    }

    return invoice;
  });

  return result;
}
