import { NextResponse } from "next/server";
import { requirePermission, validateEntityBelongsToCompany, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.PRODUCT_VIEW, req);
    const companyId = context.company.id;
    const itemId = params.id;

    await validateEntityBelongsToCompany("item", itemId, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const variants = await prisma.productVariant.findMany({
      where: { itemId, companyId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ ok: true, variants });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.PRODUCT_EDIT, req);
    const companyId = context.company.id;
    const itemId = params.id;

    await validateEntityBelongsToCompany("item", itemId, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const body = await req.json();
    const { sku, barcode, price, wholesalePrice, stock, options, attributes } = body;

    if (!options || typeof options !== "object") {
      return NextResponse.json({ error: "Options object (e.g. { Size: 'M', Color: 'Red' }) is required." }, { status: 400 });
    }

    const attrDisplay =
      attributes ||
      Object.entries(options)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" / ");

    const variant = await prisma.productVariant.create({
      data: {
        companyId,
        itemId,
        sku: sku ? sku.trim() : null,
        barcode: barcode ? barcode.trim() : null,
        price: parseFloat(price) || 0,
        wholesalePrice: parseFloat(wholesalePrice) || 0,
        stock: parseFloat(stock) || 0,
        options: JSON.stringify(options),
        attributes: attrDisplay,
      },
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "CREATE_VARIANT",
      entity: "ProductVariant",
      entityId: variant.id,
      details: `Created variant '${attrDisplay}' for item ${itemId}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, variant });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.PRODUCT_EDIT, req);
    const companyId = context.company.id;
    const itemId = params.id;
    const { searchParams } = new URL(req.url);
    const variantId = searchParams.get("variantId");

    if (!variantId) {
      return NextResponse.json({ error: "variantId query param is required." }, { status: 400 });
    }

    await validateEntityBelongsToCompany("item", itemId, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, itemId, companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Variant not found." }, { status: 404 });
    }

    await prisma.productVariant.delete({ where: { id: existing.id } });

    return NextResponse.json({ ok: true, message: "Variant deleted." });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
