import { NextResponse } from "next/server";
import { requireCompanyAccess, requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType");

    const where: any = {
      companyId: context.company.id,
      isActive: true,
    };
    if (entityType) {
      where.entityType = entityType.toUpperCase();
    }

    const fields = await prisma.customFieldDefinition.findMany({
      where,
      orderBy: [{ entityType: "asc" }, { displayOrder: "asc" }],
    });

    return NextResponse.json({ ok: true, customFields: fields });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SETTINGS_MANAGE, req);
    const body = await req.json();
    const { entityType, fieldName, fieldLabel, fieldType, isRequired, options, defaultValue, displayOrder } = body;

    const allowedEntities = ["CUSTOMER", "SUPPLIER", "PRODUCT", "INVOICE", "EXPENSE"];
    if (!entityType || !allowedEntities.includes(entityType.toUpperCase())) {
      return NextResponse.json({ error: "Invalid entity type. Must be CUSTOMER, SUPPLIER, PRODUCT, INVOICE, or EXPENSE." }, { status: 400 });
    }

    const cleanLabel = fieldLabel?.trim();
    if (!cleanLabel || cleanLabel.length < 2) {
      return NextResponse.json({ error: "Field label must be at least 2 characters long." }, { status: 400 });
    }

    const cleanName = (fieldName || cleanLabel.toLowerCase().replace(/[^a-z0-9_]/g, "_")).trim();

    const allowedTypes = ["TEXT", "NUMBER", "DATE", "SELECT", "BOOLEAN"];
    const cleanType = (fieldType || "TEXT").toUpperCase();
    if (!allowedTypes.includes(cleanType)) {
      return NextResponse.json({ error: "Invalid field type. Must be TEXT, NUMBER, DATE, SELECT, or BOOLEAN." }, { status: 400 });
    }

    const created = await prisma.customFieldDefinition.create({
      data: {
        companyId: context.company.id,
        entityType: entityType.toUpperCase(),
        fieldName: cleanName,
        fieldLabel: cleanLabel,
        fieldType: cleanType,
        isRequired: Boolean(isRequired),
        options: options ? (typeof options === "string" ? options : JSON.stringify(options)) : null,
        defaultValue: defaultValue ? String(defaultValue) : null,
        displayOrder: parseInt(displayOrder) || 0,
      },
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId: context.company.id,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "CREATE_CUSTOM_FIELD",
      entity: "CustomFieldDefinition",
      entityId: created.id,
      details: `Created custom field '${created.fieldLabel}' for ${created.entityType}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, customField: created });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "A custom field with this name already exists for this entity." }, { status: 400 });
    }
    return handleAuthError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SETTINGS_MANAGE, req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Custom field ID is required." }, { status: 400 });
    }

    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id, companyId: context.company.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Custom field not found." }, { status: 404 });
    }

    await prisma.customFieldDefinition.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ ok: true, message: "Custom field deleted." });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
