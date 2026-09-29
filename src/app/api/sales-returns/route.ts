import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { roundTo2 } from "@/lib/currency";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

    const returns = await prisma.invoice.findMany({
      where: { companyId: company.id, type: "SALES_RETURN" },
      include: {
        party: true,
        lines: { include: { item: true } },
        voucher: true,
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ returns });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

    const body = await req.json();
    const {
      partyId,
      originalInvoiceNo,
      date,
      reason,
      notes,
      lines,
      isInterState,
    } = body;

    if (!partyId) {
      return NextResponse.json({ error: "Kripya Customer / Party select karein." }, { status: 400 });
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "Kam se kam ek return item add karein." }, { status: 400 });
    }

    const returnDate = date ? new Date(date) : new Date();

    // Verify Party belongs to company
    const party = await prisma.party.findFirst({
      where: { id: partyId, companyId: company.id },
    });
    if (!party) {
      return NextResponse.json({ error: "Selected party nahi mili." }, { status: 400 });
    }

    // 1. Calculate Subtotal, GST, RoundOff, Grand Total
    let subTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const validatedLines: Array<{
      itemId?: string;
      name: string;
      hsn?: string;
      qty: number;
      rate: number;
      gstRate: number;
      amount: number;
      cgst: number;
      sgst: number;
      igst: number;
    }> = [];

    for (const l of lines) {
      const qty = parseFloat(l.qty);
      const rate = parseFloat(l.rate);
      const gstRate = parseFloat(l.gstRate) || 0;
      const name = l.name?.trim();

      if (!name || isNaN(qty) || qty <= 0 || isNaN(rate) || rate < 0) {
        continue;
      }

      const lineAmt = roundTo2(qty * rate);
      const lineGst = roundTo2((lineAmt * gstRate) / 100);

      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;

      if (isInterState) {
        lineIgst = lineGst;
        igstTotal += lineGst;
      } else {
        lineCgst = roundTo2(lineGst / 2);
        lineSgst = roundTo2(lineGst / 2);
        cgstTotal += lineCgst;
        sgstTotal += lineSgst;
      }

      subTotal += lineAmt;

      validatedLines.push({
        itemId: l.itemId || undefined,
        name,
        hsn: l.hsn ? String(l.hsn).trim() : undefined,
        qty,
        rate,
        gstRate,
        amount: lineAmt,
        cgst: lineCgst,
        sgst: lineSgst,
        igst: lineIgst,
      });
    }

    if (validatedLines.length === 0) {
      return NextResponse.json({ error: "Kripya valid return quantity aur rate daalein." }, { status: 400 });
    }

    const totalBeforeRound = roundTo2(subTotal + cgstTotal + sgstTotal + igstTotal);
    const grandTotal = Math.round(totalBeforeRound);
    const roundOff = roundTo2(grandTotal - totalBeforeRound);

    // 2. Generate Next Credit Note Number (CN-YYYY-0001)
    const currentYear = returnDate.getFullYear();
    const count = await prisma.invoice.count({
      where: { companyId: company.id, type: "SALES_RETURN" },
    });
    const creditNoteNo = `CN-${currentYear}-${String(count + 1).padStart(4, "0")}`;

    // 3. Resolve Chart of Accounts for Double Entry
    // Dr. Sales Return Account (4002 or 4001)
    let salesReturnAcc = await prisma.account.findFirst({
      where: { companyId: company.id, code: "4002" },
    });
    if (!salesReturnAcc) {
      salesReturnAcc = await prisma.account.findFirst({
        where: { companyId: company.id, code: "4001" },
      });
    }
    if (!salesReturnAcc) {
      salesReturnAcc = await prisma.account.create({
        data: {
          companyId: company.id,
          code: "4002",
          name: "Sales Return",
          type: "INCOME",
          groupId: "Sales-Accounts",
        },
      });
    }

    // Dr. Tax Accounts (Output GST reversal)
    const [cgstAcc, sgstAcc, igstAcc, debtorAcc] = await Promise.all([
      prisma.account.findFirst({ where: { companyId: company.id, code: "2100" } }),
      prisma.account.findFirst({ where: { companyId: company.id, code: "2101" } }),
      prisma.account.findFirst({ where: { companyId: company.id, code: "2102" } }),
      prisma.account.findFirst({ where: { companyId: company.id, code: "1100" } }),
    ]);

    // 4. Save Sales Return + Adjust Inventory + Post Balanced Journal Voucher
    const creditNote = await prisma.$transaction(async (tx) => {
      // Restore physical item inventory (stock increase)
      for (const line of validatedLines) {
        if (line.itemId) {
          await tx.item.update({
            where: { id: line.itemId },
            data: { stock: { increment: line.qty } },
          }).catch(() => {});
        }
      }

      // Build balanced voucher entries
      const voucherEntries: Array<{ accountId: string; debit: Decimal; credit: Decimal }> = [];

      // Dr. Sales Return (Subtotal)
      voucherEntries.push({
        accountId: salesReturnAcc!.id,
        debit: new Decimal(subTotal),
        credit: new Decimal(0),
      });

      // Dr. GST Reversals
      if (cgstTotal > 0 && cgstAcc) {
        voucherEntries.push({
          accountId: cgstAcc.id,
          debit: new Decimal(cgstTotal),
          credit: new Decimal(0),
        });
      }
      if (sgstTotal > 0 && sgstAcc) {
        voucherEntries.push({
          accountId: sgstAcc.id,
          debit: new Decimal(sgstTotal),
          credit: new Decimal(0),
        });
      }
      if (igstTotal > 0 && igstAcc) {
        voucherEntries.push({
          accountId: igstAcc.id,
          debit: new Decimal(igstTotal),
          credit: new Decimal(0),
        });
      }

      // Cr. Customer (Grand Total reduces customer receivable)
      if (debtorAcc) {
        voucherEntries.push({
          accountId: debtorAcc.id,
          debit: new Decimal(0),
          credit: new Decimal(grandTotal),
        });
      }

      // Create Voucher
      const voucherNo = `V-CN-${currentYear}-${String(count + 1).padStart(4, "0")}`;
      const voucher = await tx.voucher.create({
        data: {
          companyId: company.id,
          voucherNo,
          type: "JOURNAL",
          date: returnDate,
          partyId: party.id,
          narration: `Credit Note / Sales Return: ${creditNoteNo} for ${party.name} (${reason || "Goods Returned"}) ${originalInvoiceNo ? `[Ref Inv: ${originalInvoiceNo}]` : ""}`,
          entries: {
            create: voucherEntries,
          },
        },
      });

      // Create Sales Return Invoice
      const inv = await tx.invoice.create({
        data: {
          companyId: company.id,
          invoiceNo: creditNoteNo,
          type: "SALES_RETURN",
          partyId: party.id,
          date: returnDate,
          subTotal: new Decimal(subTotal),
          cgstTotal: new Decimal(cgstTotal),
          sgstTotal: new Decimal(sgstTotal),
          igstTotal: new Decimal(igstTotal),
          roundOff: new Decimal(roundOff),
          grandTotal: new Decimal(grandTotal),
          paidAmount: new Decimal(grandTotal), // Settles credit balance
          status: "PAID",
          notes: `${reason ? `Reason: ${reason}. ` : ""}${notes || ""}${originalInvoiceNo ? ` [Ref: ${originalInvoiceNo}]` : ""}`,
          voucherId: voucher.id,
          lines: {
            create: validatedLines.map((l) => ({
              itemId: l.itemId,
              name: l.name,
              hsn: l.hsn,
              qty: new Decimal(l.qty),
              rate: new Decimal(l.rate),
              amount: new Decimal(l.amount),
              gstRate: new Decimal(l.gstRate),
              cgst: new Decimal(l.cgst),
              sgst: new Decimal(l.sgst),
              igst: new Decimal(l.igst),
            })),
          },
        },
        include: {
          party: true,
          lines: true,
          voucher: true,
        },
      });

      return inv;
    });

    return NextResponse.json({ success: true, creditNote });
  } catch (err: any) {
    console.error("Sales return creation error:", err);
    return NextResponse.json({ error: err.message || "Failed to create sales return" }, { status: 500 });
  }
}
