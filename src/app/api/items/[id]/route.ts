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
    const id = params.id;

    await validateEntityBelongsToCompany("item", id, context.company.id, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const item = await prisma.item.findUnique({
      where: { id },
    });

    return NextResponse.json({ ok: true, item });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.PRODUCT_EDIT, req);
    const id = params.id;

    await validateEntityBelongsToCompany("item", id, context.company.id, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const body = await req.json();
    const { name, sku, barcode, category, type, hsn, unit, salePrice, purchasePrice, gstRate, stock, minStock } = body;

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Item name must be at least 2 characters long." }, { status: 400 });
    }

    const updated = await prisma.item.update({
      where: { id },
      data: {
        name: cleanName,
        sku: sku ? sku.trim() : null,
        barcode: barcode ? barcode.trim() : null,
        category: category ? category.trim() : null,
        type: type || "PRODUCT",
        hsn: hsn ? hsn.trim() : null,
        unit: unit || "PCS",
        salePrice: parseFloat(salePrice) || 0,
        purchasePrice: parseFloat(purchasePrice) || 0,
        gstRate: parseFloat(gstRate) || 0,
        stock: type === "SERVICE" ? 0 : Math.max(0, parseFloat(stock) || 0),
        minStock: type === "SERVICE" ? 0 : Math.max(0, parseFloat(minStock) || 0),
      },
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId: context.company.id,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "UPDATE_ITEM",
      entity: "Item",
      entityId: id,
      afterValue: { name: updated.name, stock: updated.stock },
      details: `Updated item '${updated.name}'`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, item: updated });
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
    const id = params.id;

    await validateEntityBelongsToCompany("item", id, context.company.id, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    await prisma.item.delete({ where: { id } });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId: context.company.id,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "DELETE_ITEM",
      entity: "Item",
      entityId: id,
      details: `Deleted item id ${id}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, message: "Item deleted successfully." });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
