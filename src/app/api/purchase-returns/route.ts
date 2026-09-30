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
      where: { companyId: company.id, type: "PURCHASE_RETURN" },
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
    if (!user) return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company selected" }, { status: 400 });

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
      return NextResponse.json({ error: "Please select a vendor / supplier." }, { status: 400 });
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "At least one return item is required." }, { status: 400 });
    }

    const returnDate = date ? new Date(date) : new Date();

    // Verify Vendor belongs to company
    const party = await prisma.party.findFirst({
      where: { id: partyId, companyId: company.id },
    });
    if (!party) {
      return NextResponse.json({ error: "Selected vendor not found." }, { status: 400 });
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
      return NextResponse.json({ error: "Please enter valid return quantity and rate." }, { status: 400 });
    }

    const totalBeforeRound = roundTo2(subTotal + cgstTotal + sgstTotal + igstTotal);
    const grandTotal = Math.round(totalBeforeRound);
    const roundOff = roundTo2(grandTotal - totalBeforeRound);

    // 2. Generate Next Debit Note Number (DN-YYYY-0001)
    const currentYear = returnDate.getFullYear();
    const count = await prisma.invoice.count({
      where: { companyId: company.id, type: "PURCHASE_RETURN" },
    });
    const debitNoteNo = `DN-${currentYear}-${String(count + 1).padStart(4, "0")}`;

    // 3. Resolve Chart of Accounts for Double Entry
    // Cr. Purchase Return Account (5002 or 5001)
    let purchaseReturnAcc = await prisma.account.findFirst({
      where: { companyId: company.id, code: "5002" },
    });
    if (!purchaseReturnAcc) {
      purchaseReturnAcc = await prisma.account.findFirst({
        where: { companyId: company.id, code: "5001" },
      });
    }
    if (!purchaseReturnAcc) {
      purchaseReturnAcc = await prisma.account.create({
        data: {
          companyId: company.id,
          code: "5002",
          name: "Purchase Return",
          type: "EXPENSE",
          groupId: "Purchase-Accounts",
        },
      });
    }

    // Cr. Input GST Reversal Accounts
    const [cgstAcc, sgstAcc, igstAcc, creditorAcc, roundOffAcc] = await Promise.all([
      prisma.account.findFirst({ where: { companyId: company.id, code: "1300" } }),
      prisma.account.findFirst({ where: { companyId: company.id, code: "1301" } }),
      prisma.account.findFirst({ where: { companyId: company.id, code: "1302" } }),
      prisma.account.findFirst({ where: { companyId: company.id, code: "2001" } }),
      prisma.account.findFirst({ where: { companyId: company.id, code: "4900" } }),
    ]);

    // 4. Save Purchase Return + Deduct Inventory + Post Balanced Journal Voucher
    const debitNote = await prisma.$transaction(async (tx) => {
      // Deduct physical item inventory (stock reduction since goods are sent back to vendor)
      for (const line of validatedLines) {
        let matchedId = line.itemId;
        if (!matchedId) {
          const companyItems = await tx.item.findMany({ where: { companyId: company.id } });
          const match = companyItems.find(
            (i) => i.name.trim().toLowerCase() === line.name.trim().toLowerCase()
          );
          if (match) matchedId = match.id;
        }

        if (matchedId) {
          await tx.item.update({
            where: { id: matchedId },
            data: {
              stock: {
                decrement: line.qty,
              },
            },
          });
          line.itemId = matchedId;
        }
      }

      // Generate unique voucher number
      const datePrefix = returnDate.toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const vCount = await tx.voucher.count({ where: { companyId: company.id } });
      const voucherNo = `V-DN-${datePrefix}-${String(vCount + 1).padStart(4, "0")}-${randomSuffix}`;

      // Build balanced double-entry voucher
      // Dr. Sundry Creditors (2001) for grandTotal (reducing accounts payable to vendor)
      // Cr. Purchase Return (5002) for subTotal
      // Cr. Input Tax Reversal (1300, 1301, 1302)
      const voucherEntries: Array<{ accountId: string; debit: Decimal; credit: Decimal }> = [];

      if (creditorAcc) {
        voucherEntries.push({
          accountId: creditorAcc.id,
          debit: new Decimal(grandTotal),
          credit: new Decimal(0),
        });
      }

      voucherEntries.push({
        accountId: purchaseReturnAcc.id,
        debit: new Decimal(0),
        credit: new Decimal(subTotal),
      });

      if (cgstTotal > 0 && cgstAcc) {
        voucherEntries.push({
          accountId: cgstAcc.id,
          debit: new Decimal(0),
          credit: new Decimal(cgstTotal),
        });
      }

      if (sgstTotal > 0 && sgstAcc) {
        voucherEntries.push({
          accountId: sgstAcc.id,
          debit: new Decimal(0),
          credit: new Decimal(sgstTotal),
        });
      }

      if (igstTotal > 0 && igstAcc) {
        voucherEntries.push({
          accountId: igstAcc.id,
          debit: new Decimal(0),
          credit: new Decimal(igstTotal),
        });
      }

      if (roundOff !== 0 && roundOffAcc) {
        if (roundOff < 0) {
          voucherEntries.push({
            accountId: roundOffAcc.id,
            debit: new Decimal(0),
            credit: new Decimal(Math.abs(roundOff)),
          });
        } else {
          voucherEntries.push({
            accountId: roundOffAcc.id,
            debit: new Decimal(roundOff),
            credit: new Decimal(0),
          });
        }
      }

      // Create Voucher
      const voucher = await tx.voucher.create({
        data: {
          companyId: company.id,
          voucherNo,
          type: "PURCHASE",
          date: returnDate,
          partyId,
          narration: `Debit Note ${debitNoteNo} for Vendor Return${originalInvoiceNo ? ` against Bill ${originalInvoiceNo}` : ""}${reason ? ` (${reason})` : ""}`,
          entries: {
            create: voucherEntries,
          },
        },
      });

      // Create Invoice record with type PURCHASE_RETURN
      const inv = await tx.invoice.create({
        data: {
          companyId: company.id,
          invoiceNo: debitNoteNo,
          type: "PURCHASE_RETURN",
          partyId,
          date: returnDate,
          subTotal: new Decimal(subTotal),
          cgstTotal: new Decimal(cgstTotal),
          sgstTotal: new Decimal(sgstTotal),
          igstTotal: new Decimal(igstTotal),
          roundOff: new Decimal(roundOff),
          grandTotal: new Decimal(grandTotal),
          paidAmount: new Decimal(grandTotal), // Settled against credit
          status: "PAID",
          notes: notes ? `${notes}${reason ? ` | Reason: ${reason}` : ""}` : (reason ? `Reason: ${reason}` : null),
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

    return NextResponse.json({ ok: true, return: debitNote });
  } catch (err: any) {
    console.error("Purchase return creation error:", err);
    return NextResponse.json({ error: err.message || "Failed to create debit note" }, { status: 500 });
  }
}
