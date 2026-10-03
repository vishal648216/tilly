import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { cancelGoodsReceipt } from "@/lib/workflow";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.PURCHASE_CANCEL, req);
    const body = await req.json().catch(() => ({}));

    const result = await cancelGoodsReceipt(
      params.id,
      context.company.id,
      body.reason
    );

    return NextResponse.json({ ok: true, goodsReceipt: result });
  } catch (error) {
    return handleAuthError(error);
  }
}
