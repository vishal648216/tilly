import { NextResponse } from "next/server";
import { requirePermission, validateEntityBelongsToCompany, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { roundTo2 } from "@/lib/currency";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_VIEW, req);

    const returns = await prisma.invoice.findMany({
      where: { companyId: context.company.id, type: "SALES_RETURN" },
      include: {
        party: true,
        lines: { include: { item: true } },
        voucher: true,
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ ok: true, returns });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_RETURN, req);
    const companyId = context.company.id;

    const body = await req.json();
    const {
      partyId,
      originalInvoiceId,
      originalInvoiceNo,
      date,
      reason,
      notes,
      lines,
      isInterState,
    } = body;

    if (!partyId) {
      return NextResponse.json({ error: "Please select a customer / party." }, { status: 400 });
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "At least one return item is required." }, { status: 400 });
    }

    // IDOR Check: Verify Party belongs to active company
    await validateEntityBelongsToCompany("party", partyId, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const party = await prisma.party.findUnique({
      where: { id: partyId },
    });
    if (!party) {
      return NextResponse.json({ error: "Party not found." }, { status: 404 });
    }

    // Lookup original invoice if provided
    let originalInvoice: any = null;
    if (originalInvoiceId) {
      originalInvoice = await prisma.invoice.findFirst({
        where: { id: originalInvoiceId, companyId },
        include: { lines: true },
      });
    } else if (originalInvoiceNo && String(originalInvoiceNo).trim()) {
      originalInvoice = await prisma.invoice.findFirst({
        where: { companyId, invoiceNo: String(originalInvoiceNo).trim() },
        include: { lines: true },
      });
    }

    const returnDate = date ? new Date(date) : new Date();

    // 1. Calculate Subtotal, GST, RoundOff, Grand Total & Validate Return Limits
    let subTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const validatedLines: Array<{
      itemId?: string;
      originalLineId?: string;
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

      if (l.itemId) {
        // IDOR Check: Ensure item belongs to company
        await validateEntityBelongsToCompany("item", l.itemId, companyId, req, {
          userId: context.user.id,
          userEmail: context.user.email,
        });
      }

      // Check return quantity against original line if original invoice exists
      let matchedOriginalLine: any = null;
      if (originalInvoice && originalInvoice.lines) {
        if (l.originalLineId) {
          matchedOriginalLine = originalInvoice.lines.find((ol: any) => ol.id === l.originalLineId);
        } else {
          matchedOriginalLine = originalInvoice.lines.find(
            (ol: any) =>
              (l.itemId && ol.itemId === l.itemId) ||
              ol.name.trim().toLowerCase() === name.toLowerCase()
          );
        }

        if (matchedOriginalLine) {
          const soldQty = Number(matchedOriginalLine.qty);
          const alreadyReturned = Number(matchedOriginalLine.returnedQty || 0);
          const availableReturnable = Math.max(0, roundTo2(soldQty - alreadyReturned));

          if (qty > availableReturnable + 0.001) {
            return NextResponse.json(
              {
                error: `Return quantity (${qty}) exceeds returnable quantity (${availableReturnable}) for "${name}". (Sold: ${soldQty}, Already returned: ${alreadyReturned})`,
              },
              { status: 400 }
            );
          }
        }
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
        originalLineId: matchedOriginalLine?.id || l.originalLineId || undefined,
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

    // 2. Generate Next Credit Note Number (CN-YYYY-0001)
    const currentYear = returnDate.getFullYear();
    const count = await prisma.invoice.count({
      where: { companyId, type: "SALES_RETURN" },
    });
    const creditNoteNo = `CN-${currentYear}-${String(count + 1).padStart(4, "0")}`;

    // 3. Resolve Chart of Accounts for Double Entry
    let salesReturnAcc = await prisma.account.findFirst({
      where: { companyId, code: "4002" },
    });
    if (!salesReturnAcc) {
      salesReturnAcc = await prisma.account.findFirst({
        where: { companyId, code: "4001" },
      });
    }
    if (!salesReturnAcc) {
      salesReturnAcc = await prisma.account.create({
        data: {
          companyId,
          code: "4002",
          name: "Sales Return",
          type: "INCOME",
          groupId: "Sales-Accounts",
        },
      });
    }

    const [cgstAcc, sgstAcc, igstAcc, debtorAcc] = await Promise.all([
      prisma.account.findFirst({ where: { companyId, code: "2100" } }),
      prisma.account.findFirst({ where: { companyId, code: "2101" } }),
      prisma.account.findFirst({ where: { companyId, code: "2102" } }),
      prisma.account.findFirst({ where: { companyId, code: "1100" } }),
    ]);

    // 4. Save Sales Return + Adjust Inventory + Stock Movements + Post Balanced Voucher
    const creditNote = await prisma.$transaction(async (tx) => {
      // Restore physical item inventory (stock increase)
      for (const line of validatedLines) {
        if (line.itemId) {
          const { recordStockMovement } = await import("@/lib/inventory");
          await recordStockMovement(
            {
              companyId,
              itemId: line.itemId,
              movementType: "SALE_RETURN",
              referenceType: "INVOICE",
              referenceId: creditNoteNo,
              qtyIn: line.qty,
              qtyOut: 0,
              unitCost: line.rate,
              totalCost: line.amount,
              date: returnDate,
              notes: `Customer return restocked via Credit Note ${creditNoteNo} (${reason || "Goods Returned"})`,
              createdBy: context.user.id,
              allowNegative: true,
            },
            tx
          );
        }
      }

      // Build balanced voucher entries
      const voucherEntries: Array<{ accountId: string; debit: Decimal; credit: Decimal }> = [];

      voucherEntries.push({
        accountId: salesReturnAcc!.id,
        debit: new Decimal(subTotal),
        credit: new Decimal(0),
      });

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

      if (debtorAcc) {
        voucherEntries.push({
          accountId: debtorAcc.id,
          debit: new Decimal(0),
          credit: new Decimal(grandTotal),
        });
      }

      const voucherNo = `V-CN-${currentYear}-${String(count + 1).padStart(4, "0")}`;
      const voucher = await tx.voucher.create({
        data: {
          companyId,
          voucherNo,
          type: "JOURNAL",
          date: returnDate,
          partyId: party.id,
          narration: `Credit Note / Sales Return: ${creditNoteNo} for ${party.name} (${reason || "Goods Returned"})`,
          entries: {
            create: voucherEntries,
          },
        },
      });

      // Atomically increment returnedQty on original invoice lines
      for (const line of validatedLines) {
        if (line.originalLineId) {
          await tx.invoiceLine.update({
            where: { id: line.originalLineId },
            data: { returnedQty: { increment: line.qty } },
          });
        }
      }

      const inv = await tx.invoice.create({
        data: {
          companyId,
          invoiceNo: creditNoteNo,
          type: "SALES_RETURN",
          partyId: party.id,
          date: returnDate,
          originalInvoiceId: originalInvoice?.id || null,
          subTotal: new Decimal(subTotal),
          cgstTotal: new Decimal(cgstTotal),
          sgstTotal: new Decimal(sgstTotal),
          igstTotal: new Decimal(igstTotal),
          roundOff: new Decimal(roundOff),
          grandTotal: new Decimal(grandTotal),
          paidAmount: new Decimal(grandTotal),
          status: "PAID",
          notes: `${reason ? `Reason: ${reason}. ` : ""}${notes || ""}${originalInvoice ? ` [Ref: ${originalInvoice.invoiceNo}]` : ""}`,
          voucherId: voucher.id,
          lines: {
            create: validatedLines.map((l) => ({
              itemId: l.itemId,
              originalLineId: l.originalLineId || null,
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

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "CREATE_SALES_RETURN",
      entity: "Invoice",
      entityId: creditNote.id,
      afterValue: { invoiceNo: creditNote.invoiceNo, grandTotal: creditNote.grandTotal },
      details: `Created sales return credit note ${creditNote.invoiceNo}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, success: true, creditNote });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
