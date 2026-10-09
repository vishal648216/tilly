import { NextResponse } from "next/server";
import { requirePermission, validateEntityBelongsToCompany, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createInvoice } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "SALES";
    const requiredPerm = type === "PURCHASE" ? PERMISSIONS.PURCHASE_VIEW : PERMISSIONS.SALES_VIEW;

    const context = await requirePermission(requiredPerm, req);

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: context.company.id,
        type,
      },
      include: {
        party: true,
        lines: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, invoices });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      type,
      partyId,
      date,
      dueDate,
      supplierInvoiceNo,
      supplierInvoiceDate,
      billingAddress,
      shippingAddress,
      placeOfSupply,
      salesperson,
      warehouseId,
      orderNo,
      paymentTerms,
      discount,
      freight,
      otherCharges,
      paidAmount,
      paymentMode,
      paymentReference,
      status,
      quickAction,
      notes,
      isInterState,
      customFields,
      lines,
      sourceDocType,
      sourceDocId,
      quotationId,
      salesOrderId,
      deliveryChallanId,
      purchaseOrderId,
      goodsReceiptId,
      grnId,
      skipStockMovement,
    } = body;

    const invoiceType = type === "PURCHASE" ? "PURCHASE" : "SALES";
    const requiredPerm =
      invoiceType === "PURCHASE" ? PERMISSIONS.PURCHASE_CREATE : PERMISSIONS.SALES_CREATE;

    // 1. Authenticate, resolve active company, verify permission
    const context = await requirePermission(requiredPerm, req);
    const companyId = context.company.id;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "At least one line item is required." }, { status: 400 });
    }

    // 2. Validate partyId ownership (IDOR check)
    if (partyId) {
      await validateEntityBelongsToCompany("party", partyId, companyId, req, {
        userId: context.user.id,
        userEmail: context.user.email,
      });
    }

    // 3. Validate line items & itemId ownership (IDOR check)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.name || typeof line.name !== "string" || !line.name.trim()) {
        return NextResponse.json({ error: `Line ${i + 1}: Item name is required.` }, { status: 400 });
      }
      const qty = Number(line.qty);
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json(
          { error: `Line ${i + 1} (${line.name}): Quantity must be greater than 0.` },
          { status: 400 }
        );
      }
      const rate = Number(line.rate);
      if (isNaN(rate) || rate < 0) {
        return NextResponse.json(
          { error: `Line ${i + 1} (${line.name}): Rate cannot be negative.` },
          { status: 400 }
        );
      }

      if (line.itemId) {
        await validateEntityBelongsToCompany("item", line.itemId, companyId, req, {
          userId: context.user.id,
          userEmail: context.user.email,
        });
      }
    }

    // 3b. Validate available stock for sales invoices (Strict inventory protection)
    if (invoiceType === "SALES" && status !== "DRAFT") {
      const { getCompanySettings } = await import("@/lib/featureFlags");
      const { getAvailableStock } = await import("@/lib/inventory");
      const settings = await getCompanySettings(companyId);

      if (settings.inventoryEnabled && !settings.negativeStockAllowed) {
        const itemQtyMap = new Map<string, { name: string; qty: number }>();
        for (const line of lines) {
          if (line.itemId) {
            const cur = itemQtyMap.get(line.itemId) || { name: line.name || "Item", qty: 0 };
            cur.qty += Number(line.qty || 0);
            itemQtyMap.set(line.itemId, cur);
          }
        }

        for (const [itemId, info] of itemQtyMap.entries()) {
          const available = await getAvailableStock({
            companyId,
            itemId,
            warehouseId: warehouseId || undefined,
          });
          if (available < info.qty) {
            return NextResponse.json(
              {
                error: `Insufficient stock for "${info.name}". Available stock in store: ${available}, Requested: ${info.qty}. You cannot bill more than available stock.`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    const invoiceDate = date ? new Date(date) : new Date();
    if (isNaN(invoiceDate.getTime())) {
      return NextResponse.json({ error: "Invalid invoice date provided." }, { status: 400 });
    }

    const currentYear = new Date().getFullYear();
    let cleanOrderNo = orderNo && typeof orderNo === "string" ? String(orderNo).trim().toUpperCase() : undefined;

    if (cleanOrderNo) {
      const poPattern = /^(?:PO|SO)-(\d{4})-(\d{3,})$/i;
      const match = cleanOrderNo.match(poPattern);
      if (!match) {
        return NextResponse.json(
          {
            error: `Invalid Order Ref format: "${cleanOrderNo}". Format must be PO-YYYY-XXX (e.g. PO-${currentYear}-001). The format cannot be changed.`,
          },
          { status: 400 }
        );
      }
      const poYear = parseInt(match[1], 10);
      if (poYear !== currentYear) {
        return NextResponse.json(
          {
            error: `Year in PO number must be the current year (${currentYear}). Year ${poYear} is not allowed.`,
          },
          { status: 400 }
        );
      }
      const existing = await prisma.invoice.findFirst({
        where: {
          companyId,
          type: invoiceType,
          orderNo: { equals: cleanOrderNo },
          status: { notIn: ["CANCELLED", "REVERSED"] },
        },
        select: { id: true, invoiceNo: true },
      });
      if (existing) {
        return NextResponse.json(
          {
            error: `Order Reference "${cleanOrderNo}" already exists in ${invoiceType === "PURCHASE" ? "purchase bill" : "sales invoice"} ${existing.invoiceNo}! Duplicate references are not allowed.`,
          },
          { status: 400 }
        );
      }
    }

    const invoice = await createInvoice({
      companyId,
      type: invoiceType,
      partyId: partyId || undefined,
      date: invoiceDate,
      dueDate: dueDate && !isNaN(new Date(dueDate).getTime()) ? new Date(dueDate) : undefined,
      supplierInvoiceNo: supplierInvoiceNo ? String(supplierInvoiceNo).trim() : undefined,
      supplierInvoiceDate:
        supplierInvoiceDate && !isNaN(new Date(supplierInvoiceDate).getTime())
          ? new Date(supplierInvoiceDate)
          : undefined,
      billingAddress: billingAddress ? String(billingAddress).trim() : undefined,
      shippingAddress: shippingAddress ? String(shippingAddress).trim() : undefined,
      placeOfSupply: placeOfSupply ? String(placeOfSupply).trim() : undefined,
      salesperson: salesperson ? String(salesperson).trim() : undefined,
      warehouseId: warehouseId || undefined,
      orderNo: cleanOrderNo,
      paymentTerms: paymentTerms ? String(paymentTerms).trim() : undefined,
      discount: discount ? Number(discount) : 0,
      freight: freight ? Number(freight) : 0,
      otherCharges: otherCharges ? Number(otherCharges) : 0,
      paidAmount: paidAmount ? Number(paidAmount) : 0,
      paymentMode: paymentMode || "CASH",
      paymentReference: paymentReference ? String(paymentReference).trim() : undefined,
      status: status === "DRAFT" ? "DRAFT" : "POSTED",
      quickAction: quickAction || undefined,
      createdBy: context.user.id,
      userEmail: context.user.email,
      lines: lines.map((l: any) => ({
        itemId: l.itemId || undefined,
        name: l.name.trim(),
        sku: l.sku ? String(l.sku).trim() : undefined,
        barcode: l.barcode ? String(l.barcode).trim() : undefined,
        unit: l.unit ? String(l.unit).trim() : "PCS",
        hsn: l.hsn ? String(l.hsn).trim() : undefined,
        qty: Number(l.qty),
        rate: Number(l.rate),
        purchasePrice: l.purchasePrice !== undefined ? Number(l.purchasePrice) : Number(l.rate),
        salePrice: l.salePrice !== undefined ? Number(l.salePrice) : undefined,
        discount: l.discount ? Number(l.discount) : 0,
        gstRate: Number(l.gstRate) || 0,
      })),
      notes: notes ? String(notes).trim() : undefined,
      customFields: customFields
        ? typeof customFields === "string"
          ? customFields
          : JSON.stringify(customFields)
        : undefined,
      isInterState: !!isInterState,
      sourceDocType:
        sourceDocType ||
        (quotationId
          ? "QUOTATION"
          : salesOrderId
          ? "SALES_ORDER"
          : deliveryChallanId
          ? "DELIVERY_CHALLAN"
          : purchaseOrderId
          ? "PURCHASE_ORDER"
          : (goodsReceiptId || grnId)
          ? "GOODS_RECEIPT"
          : undefined),
      sourceDocId:
        sourceDocId ||
        quotationId ||
        salesOrderId ||
        deliveryChallanId ||
        purchaseOrderId ||
        goodsReceiptId ||
        grnId ||
        undefined,
      salesOrderId: salesOrderId || undefined,
      deliveryChallanId: deliveryChallanId || undefined,
      purchaseOrderId: purchaseOrderId || undefined,
      goodsReceiptId: goodsReceiptId || grnId || undefined,
      skipStockMovement: Boolean(skipStockMovement),
    });

    // Update workflow status on linked documents
    if (quotationId) {
      await prisma.quotation.update({
        where: { id: quotationId },
        data: { status: "CONVERTED" },
      }).catch(() => {});
    }

    if (deliveryChallanId) {
      await prisma.deliveryChallan.update({
        where: { id: deliveryChallanId },
        data: { invoiceId: invoice.id, status: "DELIVERED" },
      }).catch(() => {});
    }

    if (salesOrderId) {
      await prisma.salesOrder.update({
        where: { id: salesOrderId },
        data: { status: "DELIVERED" },
      }).catch(() => {});
    }

    if (goodsReceiptId || grnId) {
      await prisma.goodsReceipt.update({
        where: { id: goodsReceiptId || grnId },
        data: { invoiceId: invoice.id },
      }).catch(() => {});
    }

    if (purchaseOrderId) {
      await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: "RECEIVED" },
      }).catch(() => {});
    }

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "CREATE_INVOICE",
      entity: "Invoice",
      entityId: invoice.id,
      afterValue: { invoiceNo: invoice.invoiceNo, grandTotal: invoice.grandTotal },
      details: `Created ${invoiceType} invoice ${invoice.invoiceNo} for company ${context.company.name}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, invoice });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
