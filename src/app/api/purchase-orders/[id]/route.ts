import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.PURCHASE_VIEW, req);

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id: params.id, companyId: context.company.id },
      include: {
        party: true,
        warehouse: true,
        lines: { include: { item: true } },
        grns: { include: { lines: true } },
        invoices: true,
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { ok: false, error: "Purchase order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, purchaseOrder });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.PURCHASE_EDIT, req);
    const body = await req.json();

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id: params.id, companyId: context.company.id },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Purchase order not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: params.id },
      data: {
        status: body.status || existing.status,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        terms: body.terms !== undefined ? body.terms : existing.terms,
      },
    });

    return NextResponse.json({ ok: true, purchaseOrder: updated });
  } catch (error) {
    return handleAuthError(error);
  }
}
