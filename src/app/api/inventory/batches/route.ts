import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOrUpdateBatch, getBatchesForItem } from "@/lib/batchSerial";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");

    if (itemId) {
      const batches = await getBatchesForItem(companyId, itemId);
      return NextResponse.json({ ok: true, batches });
    }

    const batches = await prisma.batch.findMany({
      where: { companyId },
      include: {
        item: { select: { id: true, name: true, sku: true, unit: true } },
      },
      orderBy: { expiryDate: "asc" },
    });

    return NextResponse.json({ ok: true, batches });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const body = await req.json();
    const { itemId, batchNumber, manufacturingDate, expiryDate, mrp, cost, quantity } = body;

    if (!itemId || !batchNumber) {
      return NextResponse.json(
        { error: "itemId and batchNumber are required." },
        { status: 400 }
      );
    }

    const batch = await createOrUpdateBatch({
      companyId,
      itemId,
      batchNumber,
      manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      mrp: mrp ? Number(mrp) : undefined,
      cost: cost ? Number(cost) : undefined,
      quantity: Number(quantity) || 0,
    });

    return NextResponse.json({ ok: true, batch });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
