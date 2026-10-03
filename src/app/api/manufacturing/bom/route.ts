import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBillOfMaterials } from "@/lib/manufacturing";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const boms = await prisma.billOfMaterials.findMany({
      where: { companyId },
      include: {
        finishedItem: { select: { id: true, name: true, sku: true, unit: true } },
        items: {
          include: {
            item: { select: { id: true, name: true, sku: true, unit: true, purchasePrice: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, boms });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const body = await req.json();
    const bom = await createBillOfMaterials({
      companyId,
      name: body.name,
      code: body.code,
      finishedItemId: body.finishedItemId,
      outputQty: Number(body.outputQty) || 1,
      laborCost: Number(body.laborCost) || 0,
      overheadCost: Number(body.overheadCost) || 0,
      notes: body.notes,
      rawMaterials: body.rawMaterials || [],
    });

    return NextResponse.json({ ok: true, bom });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
