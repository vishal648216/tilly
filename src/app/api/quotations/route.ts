import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createQuotation } from "@/lib/workflow";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_VIEW, req);

    const quotations = await prisma.quotation.findMany({
      where: { companyId: context.company.id },
      include: {
        party: true,
        lines: { include: { item: true } },
        salesOrders: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, quotations });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_CREATE, req);
    const body = await req.json();

    const quotation = await createQuotation({
      companyId: context.company.id,
      partyId: body.partyId,
      date: body.date ? new Date(body.date) : new Date(),
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      quotationNo: body.quotationNo,
      items: body.items || [],
      notes: body.notes,
      terms: body.terms,
      status: body.status || "DRAFT",
      createdBy: context.user.email || context.user.id,
      isInterState: Boolean(body.isInterState),
    });

    return NextResponse.json({ ok: true, quotation });
  } catch (error) {
    return handleAuthError(error);
  }
}
