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

    const invoiceDate = date ? new Date(date) : new Date();
    if (isNaN(invoiceDate.getTime())) {
      return NextResponse.json({ error: "Invalid invoice date provided." }, { status: 400 });
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
      orderNo: orderNo ? String(orderNo).trim() : undefined,
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
      sourceDocType: sourceDocType || (quotationId ? "QUOTATION" : salesOrderId ? "SALES_ORDER" : deliveryChallanId ? "DELIVERY_CHALLAN" : undefined),
      sourceDocId: sourceDocId || quotationId || salesOrderId || deliveryChallanId || undefined,
      salesOrderId: salesOrderId || undefined,
      deliveryChallanId: deliveryChallanId || undefined,
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
