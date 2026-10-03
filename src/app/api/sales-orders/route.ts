import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createSalesOrder } from "@/lib/workflow";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_VIEW, req);

    const salesOrders = await prisma.salesOrder.findMany({
      where: { companyId: context.company.id },
      include: {
        party: true,
        warehouse: true,
        quotation: true,
        lines: { include: { item: true } },
        deliveryChallans: true,
        invoices: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, salesOrders });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_CREATE, req);
    const body = await req.json();

    const salesOrder = await createSalesOrder({
      companyId: context.company.id,
      partyId: body.partyId,
      date: body.date ? new Date(body.date) : new Date(),
      expectedDelivery: body.expectedDelivery ? new Date(body.expectedDelivery) : undefined,
      orderNo: body.orderNo,
      warehouseId: body.warehouseId,
      quotationId: body.quotationId,
      items: body.items || [],
      notes: body.notes,
      terms: body.terms,
      status: body.status || "CONFIRMED",
      createdBy: context.user.email || context.user.id,
      isInterState: Boolean(body.isInterState),
    });

    return NextResponse.json({ ok: true, salesOrder });
  } catch (error) {
    return handleAuthError(error);
  }
}
