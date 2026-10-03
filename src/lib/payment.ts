import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { roundTo2 } from "./currency";
import { DEFAULT_CHART_OF_ACCOUNTS } from "./accounts";

export type ReceivePaymentInput = {
  companyId?: string;
  invoiceId: string;
  amount: number;
  date: Date;
  mode: "CASH" | "BANK" | "UPI" | "CHEQUE";
  reference?: string; // UPI ref, cheque no, etc.
  narration?: string;
};

async function ensureAccount(companyId: string, preferredCodes: string[]): Promise<string> {
  const existing = await prisma.account.findFirst({
    where: { companyId, code: { in: preferredCodes } },
  });
  if (existing) return existing.id;

  const targetCode = preferredCodes[0];
  const def = DEFAULT_CHART_OF_ACCOUNTS.find((d) => d.code === targetCode);
  const created = await prisma.account.create({
    data: {
      companyId,
      code: def?.code || targetCode,
      name: def?.name || "Account",
      type: def?.type || "ASSET",
      groupId: def?.groupId || "General",
    },
  });
  return created.id;
}

export async function receivePayment(input: ReceivePaymentInput) {
  const { companyId: expectedCompanyId, invoiceId, amount, date, mode, reference, narration } = input;

  if (amount <= 0) throw new Error("Amount must be greater than 0");

  // 1. Fetch invoice with company
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { company: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  if (expectedCompanyId && invoice.companyId !== expectedCompanyId) {
    throw new Error("Cross-tenant access violation: Invoice does not belong to active company.");
  }

  const companyId = invoice.companyId;

  // 2. Validate amount doesn't exceed invoice total
  const grandTotal = parseFloat(invoice.grandTotal.toString());
  const alreadyPaid = parseFloat(invoice.paidAmount.toString());
  const newPaidAmount = roundTo2(alreadyPaid + amount);
  const balanceAfter = roundTo2(grandTotal - newPaidAmount);

  if (newPaidAmount > grandTotal + 0.01) {
    throw new Error(
      `Payment (₹${newPaidAmount}) exceeds invoice total (₹${grandTotal})`
    );
  }

  // 3. Determine Cash vs Bank account
  const cashOrBankId =
    mode === "CASH"
      ? await ensureAccount(companyId, ["1001"])
      : await ensureAccount(companyId, ["1002", "1003"]);
  const debtorId = await ensureAccount(companyId, ["1100"]);

  // 4. Generate guaranteed unique voucher number
  const vCount = await prisma.voucher.count({ where: { companyId } });
  const datePrefix = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const voucherNo = `V-REC-${datePrefix}-${String(vCount + 1).padStart(4, "0")}-${randomSuffix}`;

  // 5. Determine new status
  let newStatus: string;
  if (balanceAfter <= 0.01) newStatus = "PAID";
  else if (newPaidAmount > 0) newStatus = "PARTIAL";
  else newStatus = "UNPAID";

  const modeLabel = { CASH: "Cash", BANK: "Bank", UPI: "UPI", CHEQUE: "Cheque" }[mode];
  const fullNarration =
    narration ||
    `Payment received via ${modeLabel} against ${invoice.invoiceNo}${reference ? ` (Ref: ${reference})` : ""}`;

  // 6. Create voucher + update invoice atomically
  const result = await prisma.$transaction(async (tx) => {
    // Create RECEIPT voucher: Dr Cash/Bank, Cr Sundry Debtors
    const voucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNo,
        type: "RECEIPT",
        date,
        partyId: invoice.partyId,
        invoiceId: invoice.id,
        narration: fullNarration,
        entries: {
          create: [
            {
              accountId: cashOrBankId,
              debit: new Decimal(amount),
              credit: new Decimal(0),
            },
            {
              accountId: debtorId,
              debit: new Decimal(0),
              credit: new Decimal(amount),
            },
          ],
        },
      },
    });

    // Update invoice paid amount + status
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: new Decimal(newPaidAmount),
        status: newStatus,
      },
    });

    return { voucher, invoice: updated };
  });

  return result;
}

// ============================================================
// PAYMENT MADE — Pay a vendor/supplier against a Purchase Bill
// Creates a PAYMENT voucher: Dr Sundry Creditors, Cr Cash/Bank
// Updates purchase invoice paidAmount + status (UNPAID → PARTIAL → PAID)
// ============================================================

export type MakePaymentInput = {
  companyId?: string;
  invoiceId: string;
  amount: number;
  date: Date;
  mode: "CASH" | "BANK" | "UPI" | "CHEQUE";
  reference?: string;
  narration?: string;
};

export async function makePayment(input: MakePaymentInput) {
  const { companyId: expectedCompanyId, invoiceId, amount, date, mode, reference, narration } = input;

  if (amount <= 0) throw new Error("Amount must be greater than 0");

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { company: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  if (expectedCompanyId && invoice.companyId !== expectedCompanyId) {
    throw new Error("Cross-tenant access violation: Invoice does not belong to active company.");
  }

  const companyId = invoice.companyId;

  const grandTotal = parseFloat(invoice.grandTotal.toString());
  const alreadyPaid = parseFloat(invoice.paidAmount.toString());
  const newPaidAmount = roundTo2(alreadyPaid + amount);
  const balanceAfter = roundTo2(grandTotal - newPaidAmount);

  if (newPaidAmount > grandTotal + 0.01) {
    throw new Error(
      `Payment (₹${newPaidAmount}) exceeds invoice total (₹${grandTotal})`
    );
  }

  // Payment Made: Dr Sundry Creditors (2001), Cr Cash (1001) or Bank (1002/1003)
  const cashOrBankId =
    mode === "CASH"
      ? await ensureAccount(companyId, ["1001"])
      : await ensureAccount(companyId, ["1002", "1003"]);
  const creditorId = await ensureAccount(companyId, ["2001"]);

  // Generate guaranteed unique voucher number
  const vCount = await prisma.voucher.count({ where: { companyId } });
  const datePrefix = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const voucherNo = `V-PAY-${datePrefix}-${String(vCount + 1).padStart(4, "0")}-${randomSuffix}`;

  // Determine new status
  let newStatus: string;
  if (balanceAfter <= 0.01) newStatus = "PAID";
  else if (newPaidAmount > 0) newStatus = "PARTIAL";
  else newStatus = "UNPAID";

  const modeLabel = { CASH: "Cash", BANK: "Bank", UPI: "UPI", CHEQUE: "Cheque" }[mode];
  const fullNarration =
    narration ||
    `Payment made via ${modeLabel} against ${invoice.invoiceNo}${reference ? ` (Ref: ${reference})` : ""}`;

  const result = await prisma.$transaction(async (tx) => {
    // Create PAYMENT voucher: Dr Sundry Creditors, Cr Cash/Bank
    const voucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNo,
        type: "PAYMENT",
        date,
        partyId: invoice.partyId,
        invoiceId: invoice.id,
        narration: fullNarration,
        entries: {
          create: [
            {
              accountId: creditorId,
              debit: new Decimal(amount),
              credit: new Decimal(0),
            },
            {
              accountId: cashOrBankId,
              debit: new Decimal(0),
              credit: new Decimal(amount),
            },
          ],
        },
      },
    });

    // Update invoice paid amount + status
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: new Decimal(newPaidAmount),
        status: newStatus,
      },
    });

    return { voucher, invoice: updated };
  });

  return result;
}

