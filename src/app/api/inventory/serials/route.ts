import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerSerialNumbers } from "@/lib/batchSerial";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    const status = searchParams.get("status");

    const serials = await prisma.serialNumber.findMany({
      where: {
        companyId,
        ...(itemId ? { itemId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        item: { select: { id: true, name: true, sku: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, serials });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const body = await req.json();
    const { itemId, serialNumbers = [], warranty, purchaseReference, purchaseInvoiceId } = body;

    if (!itemId || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return NextResponse.json(
        { error: "itemId and an array of serialNumbers are required." },
        { status: 400 }
      );
    }

    const inputs = serialNumbers.map((sn: string) => ({
      companyId,
      itemId,
      serialNumber: sn,
      warranty,
      purchaseReference,
      purchaseInvoiceId,
    }));

    const registered = await registerSerialNumbers(inputs);

    return NextResponse.json({ ok: true, registered });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
