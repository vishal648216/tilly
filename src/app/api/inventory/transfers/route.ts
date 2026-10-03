import { NextResponse } from "next/server";
import { requirePermission, validateEntityBelongsToCompany, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { transferStock } from "@/lib/inventory";
import { getCompanySettings } from "@/lib/featureFlags";
import { getClientMetadata } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/inventory/transfers
 * List stock transfer transactions.
 */
export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.STOCK_VIEW, req);
    const companyId = context.company.id;

    // Transfers are paired: TRANSFER_OUT and TRANSFER_IN with same referenceId
    const transfersOut = await prisma.stockMovement.findMany({
      where: { companyId, movementType: "TRANSFER_OUT" },
      include: {
        item: { select: { id: true, name: true, sku: true, unit: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const refIds = transfersOut.map((t) => t.referenceId).filter(Boolean) as string[];
    const transfersIn = await prisma.stockMovement.findMany({
      where: { companyId, movementType: "TRANSFER_IN", referenceId: { in: refIds } },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    const inMap = new Map(transfersIn.map((t) => [t.referenceId, t]));

    const transfers = transfersOut.map((out) => {
      const matchingIn = inMap.get(out.referenceId);
      return {
        id: out.id,
        transferRef: out.referenceId,
        date: out.date,
        createdAt: out.createdAt,
        itemId: out.itemId,
        item: out.item.name,
        sku: out.item.sku,
        unit: out.item.unit,
        quantity: out.qtyOut,
        fromWarehouse: out.warehouse ? out.warehouse.name : "Unknown",
        fromWarehouseId: out.warehouseId,
        toWarehouse: matchingIn?.warehouse ? matchingIn.warehouse.name : "Unknown",
        toWarehouseId: matchingIn?.warehouseId,
        notes: out.notes,
        createdBy: out.createdBy,
      };
    });

    return NextResponse.json({ ok: true, transfers });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

/**
 * POST /api/inventory/transfers
 * Atomically transfer stock from one warehouse to another.
 */
export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.STOCK_TRANSFER, req);
    const companyId = context.company.id;

    const body = await req.json();
    const { fromWarehouseId, toWarehouseId, itemId, variantId, quantity, notes, date } = body;

    if (!fromWarehouseId || !toWarehouseId) {
      return NextResponse.json({ error: "Please specify both source and destination warehouses." }, { status: 400 });
    }
    if (fromWarehouseId === toWarehouseId) {
      return NextResponse.json({ error: "Source and destination warehouses cannot be the same." }, { status: 400 });
    }
    if (!itemId) {
      return NextResponse.json({ error: "Please select an item to transfer." }, { status: 400 });
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: "Transfer quantity must be greater than zero." }, { status: 400 });
    }

    // IDOR checks
    await validateEntityBelongsToCompany("warehouse", fromWarehouseId, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });
    await validateEntityBelongsToCompany("warehouse", toWarehouseId, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });
    await validateEntityBelongsToCompany("item", itemId, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const settings = await getCompanySettings(companyId);
    const meta = getClientMetadata(req);

    const result = await transferStock({
      companyId,
      fromWarehouseId,
      toWarehouseId,
      itemId,
      variantId: variantId || null,
      quantity: qty,
      notes: notes?.trim() || null,
      createdBy: context.user.id,
      date: date ? new Date(date) : new Date(),
      allowNegative: settings.negativeStockAllowed,
      clientMetadata: meta,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
