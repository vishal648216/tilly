import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createDeliveryChallan } from "@/lib/workflow";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_VIEW, req);

    const deliveryChallans = await prisma.deliveryChallan.findMany({
      where: { companyId: context.company.id },
      include: {
        party: true,
        warehouse: true,
        salesOrder: true,
        invoice: true,
        lines: { include: { item: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, deliveryChallans });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_CREATE, req);
    const body = await req.json();

    const deliveryChallan = await createDeliveryChallan({
      companyId: context.company.id,
      salesOrderId: body.salesOrderId,
      partyId: body.partyId,
      warehouseId: body.warehouseId,
      date: body.date ? new Date(body.date) : new Date(),
      dcNo: body.dcNo,
      lines: body.lines || [],
      notes: body.notes,
      createdBy: context.user.email || context.user.id,
      dispatchNow: body.dispatchNow !== false,
    });

    return NextResponse.json({ ok: true, deliveryChallan });
  } catch (error) {
    return handleAuthError(error);
  }
}
