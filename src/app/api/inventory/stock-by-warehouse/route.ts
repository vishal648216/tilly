import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/inventory/stock-by-warehouse
 * Returns stock balance partitioned by warehouse.
 * Query: ?itemId=<id>
 */
export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.STOCK_VIEW, req);
    const companyId = context.company.id;

    const url = new URL(req.url);
    const itemId = url.searchParams.get("itemId");

    const where: any = { companyId };
    if (itemId) {
      where.itemId = itemId;
    }

    const warehouseStocks = await prisma.warehouseStock.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, code: true, isDefault: true, active: true } },
        item: { select: { id: true, name: true, sku: true, unit: true, purchasePrice: true } },
        variant: { select: { id: true, attributes: true } },
      },
      orderBy: [{ item: { name: "asc" } }, { warehouse: { name: "asc" } }],
    });

    const formatted = warehouseStocks.map((ws) => ({
      id: ws.id,
      warehouseId: ws.warehouseId,
      warehouseName: ws.warehouse.name,
      warehouseCode: ws.warehouse.code,
      isDefaultWarehouse: ws.warehouse.isDefault,
      itemId: ws.itemId,
      itemName: ws.item.name,
      sku: ws.item.sku,
      unit: ws.item.unit,
      unitCost: Number(ws.item.purchasePrice || 0),
      variant: ws.variant?.attributes || null,
      quantity: ws.quantity,
      valuation: ws.quantity * Number(ws.item.purchasePrice || 0),
      updatedAt: ws.updatedAt,
    }));

    return NextResponse.json({ ok: true, stockByWarehouse: formatted });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
