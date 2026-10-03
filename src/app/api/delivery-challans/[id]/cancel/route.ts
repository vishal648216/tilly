import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { cancelDeliveryChallan } from "@/lib/workflow";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_CANCEL, req);
    const body = await req.json().catch(() => ({}));

    const result = await cancelDeliveryChallan(
      params.id,
      context.company.id,
      body.reason
    );

    return NextResponse.json({ ok: true, deliveryChallan: result });
  } catch (error) {
    return handleAuthError(error);
  }
}
