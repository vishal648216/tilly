import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { convertGoodsReceiptToPurchaseInvoice } from "@/lib/workflow";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.PURCHASE_CREATE, req);
    const body = await req.json().catch(() => ({}));

    const invoice = await convertGoodsReceiptToPurchaseInvoice(
      params.id,
      context.company.id,
      {
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        supplierInvoiceNo: body.supplierInvoiceNo,
        supplierInvoiceDate: body.supplierInvoiceDate ? new Date(body.supplierInvoiceDate) : undefined,
        isInterState: Boolean(body.isInterState),
        paidAmount: body.paidAmount,
        paymentMode: body.paymentMode,
        notes: body.notes,
        createdBy: context.user.email || context.user.id,
      }
    );

    return NextResponse.json({ ok: true, invoice });
  } catch (error) {
    return handleAuthError(error);
  }
}
