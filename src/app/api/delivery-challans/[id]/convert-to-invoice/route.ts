import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { convertDeliveryChallanToInvoice } from "@/lib/workflow";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_CREATE, req);
    const body = await req.json().catch(() => ({}));

    const invoice = await convertDeliveryChallanToInvoice(
      params.id,
      context.company.id,
      {
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
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
