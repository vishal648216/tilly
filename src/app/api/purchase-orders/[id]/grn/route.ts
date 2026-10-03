import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createGoodsReceipt } from "@/lib/workflow";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.PURCHASE_CREATE, req);
    const body = await req.json();

    const goodsReceipt = await createGoodsReceipt({
      companyId: context.company.id,
      purchaseOrderId: params.id,
      partyId: body.partyId,
      warehouseId: body.warehouseId,
      date: body.date ? new Date(body.date) : new Date(),
      grnNo: body.grnNo,
      lines: body.lines || [],
      notes: body.notes,
      createdBy: context.user.email || context.user.id,
      receiveNow: body.receiveNow !== false,
    });

    return NextResponse.json({ ok: true, goodsReceipt });
  } catch (error) {
    return handleAuthError(error);
  }
}
