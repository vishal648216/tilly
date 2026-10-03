import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createGoodsReceipt } from "@/lib/workflow";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PURCHASE_VIEW, req);

    const goodsReceipts = await prisma.goodsReceipt.findMany({
      where: { companyId: context.company.id },
      include: {
        party: true,
        warehouse: true,
        purchaseOrder: true,
        invoice: true,
        lines: { include: { item: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, goodsReceipts });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PURCHASE_CREATE, req);
    const body = await req.json();

    const goodsReceipt = await createGoodsReceipt({
      companyId: context.company.id,
      purchaseOrderId: body.purchaseOrderId,
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
