import { NextResponse } from "next/server";
import { requirePermission, validateEntityBelongsToCompany, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * PUT /api/warehouses/[id]
 * Edit warehouse name, code, address, active status, or default status.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requirePermission(PERMISSIONS.STOCK_ADJUST, req);
    const companyId = context.company.id;
    const warehouseId = params.id;

    // IDOR validation
    await validateEntityBelongsToCompany("warehouse", warehouseId, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const body = await req.json();
    const { name, code, address, isDefault, active } = body;

    const cleanName = name?.trim();
    if (name !== undefined && (!cleanName || cleanName.length < 2)) {
      return NextResponse.json({ error: "Warehouse name must be at least 2 characters long." }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.warehouse.findUnique({
        where: { id: warehouseId },
      });
      if (!existing || existing.companyId !== companyId) {
        throw new Error("Warehouse not found.");
      }

      if (cleanName && cleanName !== existing.name) {
        const dup = await tx.warehouse.findFirst({
          where: { companyId, name: cleanName, id: { not: warehouseId } },
        });
        if (dup) {
          throw new Error(`A warehouse named '${cleanName}' already exists.`);
        }
      }

      if (isDefault) {
        await tx.warehouse.updateMany({
          where: { companyId, isDefault: true, id: { not: warehouseId } },
          data: { isDefault: false },
        });
      }

      return await tx.warehouse.update({
        where: { id: warehouseId },
        data: {
          ...(cleanName ? { name: cleanName } : {}),
          ...(code !== undefined ? { code: code ? code.trim().toUpperCase() : null } : {}),
          ...(address !== undefined ? { address: address ? address.trim() : null } : {}),
          ...(isDefault !== undefined ? { isDefault: Boolean(isDefault) } : {}),
          ...(active !== undefined ? { active: Boolean(active) } : {}),
        },
      });
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "UPDATE_WAREHOUSE",
      entity: "Warehouse",
      entityId: updated.id,
      afterValue: JSON.stringify(updated),
      details: `Updated warehouse '${updated.name}' (Active: ${updated.active}, Default: ${updated.isDefault})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, warehouse: updated });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

/**
 * DELETE /api/warehouses/[id]
 * Deactivate warehouse (soft delete to preserve stock movement history).
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requirePermission(PERMISSIONS.STOCK_ADJUST, req);
    const companyId = context.company.id;
    const warehouseId = params.id;

    await validateEntityBelongsToCompany("warehouse", warehouseId, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const existing = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json({ error: "Warehouse not found." }, { status: 404 });
    }

    if (existing.isDefault) {
      return NextResponse.json(
        { error: "Cannot deactivate the default warehouse. Please set another warehouse as default first." },
        { status: 400 }
      );
    }

    // Soft delete: mark active = false
    const deactivated = await prisma.warehouse.update({
      where: { id: warehouseId },
      data: { active: false },
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "DEACTIVATE_WAREHOUSE",
      entity: "Warehouse",
      entityId: warehouseId,
      details: `Deactivated warehouse '${existing.name}'`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, warehouse: deactivated });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
