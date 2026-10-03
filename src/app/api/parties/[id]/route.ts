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
    const context = await requirePermission(PERMISSIONS.PARTY_VIEW, req);
    const id = params.id;

    await validateEntityBelongsToCompany("party", id, context.company.id, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const party = await prisma.party.findUnique({
      where: { id },
      include: {
        invoices: { orderBy: { date: "desc" }, take: 50 },
      },
    });

    return NextResponse.json({ ok: true, party });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.PARTY_EDIT, req);
    const id = params.id;

    await validateEntityBelongsToCompany("party", id, context.company.id, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const body = await req.json();
    const { name, type, phone, email, gstin, address, city, state, pincode, openingBalance } = body;

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Party name must be at least 2 characters long." }, { status: 400 });
    }

    const updated = await prisma.party.update({
      where: { id },
      data: {
        name: cleanName,
        type: type || "CUSTOMER",
        phone: phone ? phone.trim() : null,
        email: email ? email.trim().toLowerCase() : null,
        gstin: gstin ? gstin.trim().toUpperCase() : null,
        address: address ? address.trim() : null,
        city: city ? city.trim() : null,
        state: state ? state.trim() : null,
        pincode: pincode ? pincode.trim() : null,
        openingBalance: openingBalance !== undefined ? parseFloat(openingBalance) : undefined,
      },
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId: context.company.id,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "UPDATE_PARTY",
      entity: "Party",
      entityId: id,
      afterValue: { name: updated.name, type: updated.type },
      details: `Updated party '${updated.name}'`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, party: updated });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.PARTY_EDIT, req);
    const id = params.id;

    await validateEntityBelongsToCompany("party", id, context.company.id, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    await prisma.party.delete({ where: { id } });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId: context.company.id,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "DELETE_PARTY",
      entity: "Party",
      entityId: id,
      details: `Deleted party id ${id}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, message: "Party deleted successfully." });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
