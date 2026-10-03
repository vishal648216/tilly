import { NextResponse } from "next/server";
import { requirePermission, validateEntityBelongsToCompany, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { adjustStock, StockAdjustmentReason } from "@/lib/inventory";
import { getCompanySettings } from "@/lib/featureFlags";
import { getClientMetadata } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/inventory/adjustments
 * List stock adjustment records.
 */
export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.STOCK_VIEW, req);
    const companyId = context.company.id;

    const adjustments = await prisma.stockMovement.findMany({
      where: {
        companyId,
        movementType: { in: ["STOCK_ADJUSTMENT", "DAMAGE", "WASTAGE", "OPENING"] },
        referenceType: "ADJUSTMENT",
      },
      include: {
        item: { select: { id: true, name: true, sku: true, unit: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        variant: { select: { id: true, attributes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formatted = adjustments.map((adj) => ({
      id: adj.id,
      referenceId: adj.referenceId,
      date: adj.date,
      createdAt: adj.createdAt,
      itemId: adj.itemId,
      item: adj.item.name,
      sku: adj.item.sku,
      unit: adj.item.unit,
      variant: adj.variant?.attributes || null,
      warehouse: adj.warehouse ? adj.warehouse.name : "Default Warehouse",
      warehouseId: adj.warehouseId,
      movementType: adj.movementType,
      qtyIn: adj.qtyIn,
      qtyOut: adj.qtyOut,
      quantity: adj.qtyIn > 0 ? adj.qtyIn : adj.qtyOut,
      direction: adj.qtyIn > 0 ? "INCREASE" : "DECREASE",
      notes: adj.notes,
      createdBy: adj.createdBy,
    }));

    return NextResponse.json({ ok: true, adjustments: formatted });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

/**
 * POST /api/inventory/adjustments
 * Record a manual stock adjustment.
 */
export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.STOCK_ADJUST, req);
    const companyId = context.company.id;

    const body = await req.json();
    const { warehouseId, itemId, variantId, quantity, direction, reason, notes, date } = body;

    if (!warehouseId) {
      return NextResponse.json({ error: "Please select a warehouse." }, { status: 400 });
    }
    if (!itemId) {
      return NextResponse.json({ error: "Please select an item." }, { status: 400 });
    }
    if (!direction || !["INCREASE", "DECREASE"].includes(direction)) {
      return NextResponse.json({ error: "Direction must be either INCREASE or DECREASE." }, { status: 400 });
    }

    const validReasons: StockAdjustmentReason[] = [
      "Physical Count",
      "Damage",
      "Lost",
      "Expired",
      "Opening Correction",
      "Other",
    ];
    if (!reason || !validReasons.includes(reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${validReasons.join(", ")}` },
        { status: 400 }
      );
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: "Adjustment quantity must be greater than zero." }, { status: 400 });
    }

    // IDOR checks
    await validateEntityBelongsToCompany("warehouse", warehouseId, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });
    await validateEntityBelongsToCompany("item", itemId, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const settings = await getCompanySettings(companyId);
    const meta = getClientMetadata(req);

    const result = await adjustStock({
      companyId,
      warehouseId,
      itemId,
      variantId: variantId || null,
      quantity: qty,
      direction,
      reason,
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
