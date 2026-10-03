import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProductionOrder } from "@/lib/manufacturing";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const orders = await prisma.productionOrder.findMany({
      where: { companyId },
      include: {
        finishedItem: { select: { id: true, name: true, sku: true, unit: true } },
        bom: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true } },
        voucher: { select: { id: true, voucherNo: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, orders });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const body = await req.json();
    const order = await createProductionOrder({
      companyId,
      orderNo: body.orderNo,
      bomId: body.bomId,
      plannedQty: Number(body.plannedQty) || 1,
      warehouseId: body.warehouseId,
      rawWarehouseId: body.rawWarehouseId,
      notes: body.notes,
      createdBy: context.user.id,
    });

    return NextResponse.json({ ok: true, order });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
