import { NextResponse } from "next/server";
import { requirePermission, validateEntityBelongsToCompany, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";
import { checkCompanyStatus, canCreateWarehouse } from "@/lib/subscriptionEnforcement";

export const dynamic = "force-dynamic";

/**
 * GET /api/warehouses
 * List all warehouses for the active company with item counts and total stock.
 */
export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.STOCK_VIEW, req);
    const companyId = context.company.id;

    const warehouses = await prisma.warehouse.findMany({
      where: { companyId },
      include: {
        _count: { select: { warehouseStocks: true, stockMovements: true } },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    // Compute aggregate stock per warehouse
    const stockAggregates = await prisma.warehouseStock.groupBy({
      by: ["warehouseId"],
      where: { companyId },
      _sum: { quantity: true },
    });

    const stockMap = new Map(stockAggregates.map((s) => [s.warehouseId, s._sum.quantity || 0]));

    const result = warehouses.map((wh) => ({
      id: wh.id,
      name: wh.name,
      code: wh.code,
      address: wh.address,
      isDefault: wh.isDefault,
      active: wh.active,
      itemCount: wh._count.warehouseStocks,
      movementCount: wh._count.stockMovements,
      totalQuantity: stockMap.get(wh.id) || 0,
      createdAt: wh.createdAt,
    }));

    return NextResponse.json({ ok: true, warehouses: result });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

/**
 * POST /api/warehouses
 * Create a new warehouse.
 */
export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.STOCK_ADJUST, req);
    const companyId = context.company.id;

    // Phase 8: Server-side status & warehouse limit enforcement
    await checkCompanyStatus(companyId);
    const whPerm = await canCreateWarehouse(companyId);
    if (!whPerm.allowed) {
      return NextResponse.json(
        { error: whPerm.reason || "Maximum warehouses limit reached for your plan.", code: "PLAN_LIMIT_EXCEEDED" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, code, address, isDefault } = body;

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Warehouse name must be at least 2 characters long." }, { status: 400 });
    }

    const cleanCode = code?.trim().toUpperCase() || null;
    const shouldBeDefault = Boolean(isDefault);

    const warehouse = await prisma.$transaction(async (tx) => {
      // Check for duplicate name
      const existing = await tx.warehouse.findFirst({
        where: { companyId, name: cleanName },
      });
      if (existing) {
        throw new Error(`A warehouse named '${cleanName}' already exists.`);
      }

      // If this is set as default, unset other default warehouses
      if (shouldBeDefault) {
        await tx.warehouse.updateMany({
          where: { companyId, isDefault: true },
          data: { isDefault: false },
        });
      }

      // If this is the company's first warehouse, ensure it is default
      const totalWh = await tx.warehouse.count({ where: { companyId } });
      const makeDefault = shouldBeDefault || totalWh === 0;

      const created = await tx.warehouse.create({
        data: {
          companyId,
          name: cleanName,
          code: cleanCode,
          address: address?.trim() || null,
          isDefault: makeDefault,
          active: true,
        },
      });

      return created;
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "CREATE_WAREHOUSE",
      entity: "Warehouse",
      entityId: warehouse.id,
      afterValue: JSON.stringify(warehouse),
      details: `Created warehouse '${warehouse.name}' (${warehouse.code || "No Code"})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, warehouse }, { status: 201 });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
