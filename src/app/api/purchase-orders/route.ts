import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createPurchaseOrder } from "@/lib/workflow";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PURCHASE_VIEW, req);

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { companyId: context.company.id },
      include: {
        party: true,
        warehouse: true,
        lines: { include: { item: true } },
        grns: true,
        invoices: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, purchaseOrders });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PURCHASE_CREATE, req);
    const body = await req.json();

    const purchaseOrder = await createPurchaseOrder({
      companyId: context.company.id,
      partyId: body.partyId,
      date: body.date ? new Date(body.date) : new Date(),
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
      poNo: body.poNo,
      warehouseId: body.warehouseId,
      items: body.items || [],
      notes: body.notes,
      terms: body.terms,
      status: body.status || "CONFIRMED",
      createdBy: context.user.email || context.user.id,
      isInterState: Boolean(body.isInterState),
    });

    return NextResponse.json({ ok: true, purchaseOrder });
  } catch (error) {
    return handleAuthError(error);
  }
}
