import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { reversePayment } from "@/lib/paymentAllocation";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.PAYMENT_CREATE, req);
    const companyId = context.company.id;
    const paymentId = params.id;

    const body = await req.json().catch(() => ({}));
    const reason = body.reason || "Reversed by user";

    const reversed = await reversePayment({
      paymentId,
      companyId,
      reason,
      userId: context.user.id,
      userEmail: context.user.email,
    });

    return NextResponse.json({
      ok: true,
      message: `Payment ${reversed.paymentNo} reversed successfully.`,
      payment: reversed,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
