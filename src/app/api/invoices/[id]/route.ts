import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError, AuthError } from "@/lib/auth";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireCompanyAccess(req);
    const invoiceId = params.id;

    // Strict multi-tenant isolation filter
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: context.company.id,
      },
      include: {
        party: true,
        lines: true,
        voucher: {
          include: { entries: { include: { account: true } } },
        },
      },
    });

    if (!invoice) {
      const meta = getClientMetadata(req);
      await recordAuditLog({
        companyId: context.company.id,
        userId: context.user.id,
        userEmail: context.user.email,
        action: "IDOR_ATTEMPT_BLOCKED",
        entity: "Invoice",
        entityId: invoiceId,
        details: `Unauthorized attempt to access invoice ${invoiceId} not belonging to active company.`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return NextResponse.json(
        { error: "Invoice not found or does not belong to your company.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const requiredPerm =
      invoice.type === "PURCHASE" ? PERMISSIONS.PURCHASE_VIEW : PERMISSIONS.SALES_VIEW;

    if (!hasPermission(context.role, requiredPerm, context.membership.customPermissions)) {
      throw new AuthError(`Missing required permission: ${requiredPerm}`, 403, "FORBIDDEN");
    }

    return NextResponse.json({ ok: true, invoice });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireCompanyAccess(req);
    const invoiceId = params.id;

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: context.company.id,
      },
      include: { lines: true, party: true },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Invoice not found or does not belong to your company.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      partyId,
      date,
      dueDate,
      billingAddress,
      shippingAddress,
      placeOfSupply,
      salesperson,
      orderNo,
      paymentTerms,
      notes,
      lines,
      status,
      discount = 0,
      freight = 0,
      otherCharges = 0,
      paidAmount,
    } = body;

    // Check party if supplied
    if (partyId) {
      const party = await prisma.party.findFirst({
        where: { id: partyId, companyId: context.company.id },
      });
      if (!party) {
        return NextResponse.json({ error: "Selected party not found." }, { status: 400 });
      }
    }

    const { roundTo2 } = await import("@/lib/currency");
    const { Decimal } = await import("@prisma/client/runtime/library");

    const isInterState = parseFloat(existingInvoice.igstTotal.toString()) > 0;
    let linesSubTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const builtLines = (lines || []).map((line: any) => {
      const qty = parseFloat(line.qty) || 0;
      const rate = parseFloat(line.rate) || 0;
      const gstRate = parseFloat(line.gstRate) || 0;
      const baseAmt = roundTo2(qty * rate);
      const lineDiscount = roundTo2(parseFloat(line.discount) || 0);
      const taxableAmount = Math.max(0, roundTo2(baseAmt - lineDiscount));
      const gstAmt = roundTo2((taxableAmount * gstRate) / 100);

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

      linesSubTotal += taxableAmount;

      return {
        itemId: line.itemId || null,
        name: line.name || "Item",
        sku: line.sku || null,
        barcode: line.barcode || null,
        unit: line.unit || "PCS",
        hsn: line.hsn || null,
        qty: new Decimal(qty),
        rate: new Decimal(rate),
        discount: new Decimal(lineDiscount),
        taxableAmount: new Decimal(taxableAmount),
        amount: new Decimal(taxableAmount + gstAmt),
        gstRate: new Decimal(gstRate),
        cgst: new Decimal(cgst),
        sgst: new Decimal(sgst),
        igst: new Decimal(igst),
      };
    });

    const netBeforeTaxes = Math.max(0, linesSubTotal - Number(discount || 0) + Number(freight || 0) + Number(otherCharges || 0));
    const totalWithTax = roundTo2(netBeforeTaxes + cgstTotal + sgstTotal + igstTotal);
    const roundedGrandTotal = Math.round(totalWithTax);
    const roundOff = roundTo2(roundedGrandTotal - totalWithTax);

    const { getCompanySettings } = await import("@/lib/featureFlags");
    const { getAvailableStock, recordStockMovement } = await import("@/lib/inventory");
    const settings = await getCompanySettings(context.company.id);

    const isSales = existingInvoice.type === "SALES";
    const isPosted = (status || existingInvoice.status) !== "DRAFT";

    // Track previous quantities per item in this invoice
    const previousItemQtyMap = new Map<string, number>();
    for (const pl of existingInvoice.lines) {
      if (pl.itemId) {
        const cur = previousItemQtyMap.get(pl.itemId) || 0;
        previousItemQtyMap.set(pl.itemId, cur + Number(pl.qty));
      }
    }

    // Track new requested quantities per item
    const newItemQtyMap = new Map<string, { name: string; qty: number }>();
    if (lines && lines.length > 0) {
      for (const nl of lines) {
        if (nl.itemId) {
          const cur = newItemQtyMap.get(nl.itemId) || { name: nl.name || "Item", qty: 0 };
          cur.qty += parseFloat(nl.qty) || 0;
          newItemQtyMap.set(nl.itemId, cur);
        }
      }
    }

    // Strict Stock Validation when Editing Sales Invoices
    if (isSales && isPosted && settings.inventoryEnabled && !settings.negativeStockAllowed && lines && lines.length > 0) {
      for (const [itemId, info] of newItemQtyMap.entries()) {
        const prevQty = previousItemQtyMap.get(itemId) || 0;
        const currentAvail = await getAvailableStock({
          companyId: context.company.id,
          itemId,
          warehouseId: existingInvoice.warehouseId,
        });
        const maxAllowed = currentAvail + prevQty;
        if (info.qty > maxAllowed) {
          return NextResponse.json(
            {
              error: `Insufficient stock for "${info.name}". Available stock in store: ${maxAllowed}, Requested: ${info.qty}. Cannot bill more than available stock.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If lines provided, adjust stock movements and replace lines
      if (lines && lines.length > 0) {
        // Adjust stock deltas for modified lines
        if (isSales && isPosted && settings.inventoryEnabled && !settings.negativeStockAllowed) {
          const allItemIds = new Set([...previousItemQtyMap.keys(), ...newItemQtyMap.keys()]);
          for (const itemId of allItemIds) {
            const prevQty = previousItemQtyMap.get(itemId) || 0;
            const newQty = newItemQtyMap.get(itemId)?.qty || 0;
            const delta = newQty - prevQty;

            if (delta > 0) {
              await recordStockMovement(
                {
                  companyId: context.company.id,
                  itemId,
                  warehouseId: existingInvoice.warehouseId,
                  movementType: "SALE",
                  referenceType: "INVOICE",
                  referenceId: existingInvoice.invoiceNo,
                  qtyIn: 0,
                  qtyOut: delta,
                  notes: `Stock reduction on edited bill #${existingInvoice.invoiceNo}`,
                  createdBy: context.user.id,
                  allowNegative: false,
                },
                tx
              );
            } else if (delta < 0) {
              await recordStockMovement(
                {
                  companyId: context.company.id,
                  itemId,
                  warehouseId: existingInvoice.warehouseId,
                  movementType: "SALE_RETURN",
                  referenceType: "INVOICE",
                  referenceId: existingInvoice.invoiceNo,
                  qtyIn: Math.abs(delta),
                  qtyOut: 0,
                  notes: `Stock restored on edited bill #${existingInvoice.invoiceNo}`,
                  createdBy: context.user.id,
                  allowNegative: true,
                },
                tx
              );
            }
          }
        }

        await tx.invoiceLine.deleteMany({ where: { invoiceId: existingInvoice.id } });
        await tx.invoiceLine.createMany({
          data: builtLines.map((l: any) => ({
            ...l,
            invoiceId: existingInvoice.id,
          })),
        });
      }

      const inv = await tx.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          ...(partyId !== undefined ? { partyId } : {}),
          ...(date ? { date: new Date(date) } : {}),
          ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
          ...(billingAddress !== undefined ? { billingAddress } : {}),
          ...(shippingAddress !== undefined ? { shippingAddress } : {}),
          ...(placeOfSupply !== undefined ? { placeOfSupply } : {}),
          ...(salesperson !== undefined ? { salesperson } : {}),
          ...(orderNo !== undefined ? { orderNo } : {}),
          ...(paymentTerms !== undefined ? { paymentTerms } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(status ? { status } : {}),
          ...(paidAmount !== undefined ? { paidAmount: new Decimal(paidAmount) } : {}),
          ...(lines && lines.length > 0
            ? {
                subTotal: new Decimal(linesSubTotal),
                cgstTotal: new Decimal(cgstTotal),
                sgstTotal: new Decimal(sgstTotal),
                igstTotal: new Decimal(igstTotal),
                roundOff: new Decimal(roundOff),
                grandTotal: new Decimal(roundedGrandTotal),
              }
            : {}),
        },
        include: { lines: true, party: true },
      });

      return inv;
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId: context.company.id,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "UPDATE_INVOICE",
      entity: "Invoice",
      entityId: existingInvoice.id,
      beforeValue: { invoiceNo: existingInvoice.invoiceNo, grandTotal: existingInvoice.grandTotal },
      afterValue: { invoiceNo: updated.invoiceNo, grandTotal: updated.grandTotal },
      details: `Updated ${existingInvoice.type} bill #${existingInvoice.invoiceNo}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, invoice: updated });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireCompanyAccess(req);
    const invoiceId = params.id;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: context.company.id,
      },
      include: {
        lines: true,
        voucher: { include: { entries: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found or does not belong to your company.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") !== "false"; // default to true when user deletes
    const reason = searchParams.get("reason") || "Deleted by user";

    // Complete atomic deletion with stock and voucher reversal
    await prisma.$transaction(async (tx) => {
      const { recordStockMovement } = await import("@/lib/inventory");
      const isSales = invoice.type === "SALES" || invoice.type === "PURCHASE_RETURN";

      // 1. Reverse Stock Movements if any
      for (const line of invoice.lines) {
        if (line.itemId) {
          await recordStockMovement(
            {
              companyId: context.company.id,
              itemId: line.itemId,
              warehouseId: invoice.warehouseId,
              movementType: isSales ? "SALE_RETURN" : "PURCHASE_RETURN",
              referenceType: "INVOICE",
              referenceId: invoice.invoiceNo,
              qtyIn: isSales ? Number(line.qty) : 0,
              qtyOut: isSales ? 0 : Number(line.qty),
              unitCost: Number(line.rate),
              totalCost: Number(line.amount),
              date: new Date(),
              notes: `Stock reversal for deleted bill #${invoice.invoiceNo} (${reason})`,
              createdBy: context.user.id,
              allowNegative: true,
            },
            tx
          ).catch(() => {});
        }
      }

      // 2. Unlink any returns pointing to this invoice
      await tx.invoice.updateMany({
        where: { originalInvoiceId: invoice.id },
        data: { originalInvoiceId: null },
      });

      // 3. Remove payment allocations
      await tx.paymentAllocation.deleteMany({
        where: { invoiceId: invoice.id },
      });

      // 4. Unlink delivery challans & goods receipts
      await tx.deliveryChallan.updateMany({
        where: { invoiceId: invoice.id },
        data: { invoiceId: null },
      });
      await tx.goodsReceipt.updateMany({
        where: { invoiceId: invoice.id },
        data: { invoiceId: null },
      });

      // 5. Unlink and delete voucher
      if (invoice.voucherId) {
        await tx.voucherEntry.deleteMany({
          where: { voucherId: invoice.voucherId },
        });
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { voucherId: null },
        });
        await tx.voucher.delete({
          where: { id: invoice.voucherId },
        }).catch(() => {});
      }

      // 6. Delete lines and delete invoice record
      await tx.invoiceLine.deleteMany({
        where: { invoiceId: invoice.id },
      });
      await tx.invoice.delete({
        where: { id: invoice.id },
      });
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId: context.company.id,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "DELETE_INVOICE",
      entity: "Invoice",
      entityId: invoice.id,
      beforeValue: { invoiceNo: invoice.invoiceNo, grandTotal: invoice.grandTotal, type: invoice.type },
      details: `Permanently deleted ${invoice.type} bill #${invoice.invoiceNo} (Total: ₹${invoice.grandTotal}) after confirmation.`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      ok: true,
      message: `Bill #${invoice.invoiceNo} deleted successfully.`,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
