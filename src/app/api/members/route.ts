import { NextResponse } from "next/server";
import { requirePermission, handleAuthError, AuthError } from "@/lib/auth";
import { PERMISSIONS, ROLES, Role } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";
import { checkCompanyStatus, canCreateUser } from "@/lib/subscriptionEnforcement";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.USER_MANAGE, req);

    const members = await prisma.companyMember.findMany({
      where: { companyId: context.company.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ ok: true, members });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.USER_MANAGE, req);
    const companyId = context.company.id;

    // Phase 8: Server-side status & user plan limit enforcement
    await checkCompanyStatus(companyId);
    const userPerm = await canCreateUser(companyId);
    if (!userPerm.allowed) {
      return NextResponse.json(
        { error: userPerm.reason || "Maximum users limit reached for your plan.", code: "PLAN_LIMIT_EXCEEDED" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, role, customPermissions } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const assignedRole = (role || ROLES.VIEWER).toUpperCase();
    if (!Object.values(ROLES).includes(assignedRole as Role)) {
      return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const targetUser = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User with this email not found. The user must register first." },
        { status: 404 }
      );
    }

    const existingMember = await prisma.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId: targetUser.id,
          companyId,
        },
      },
    });

    if (existingMember) {
      if (existingMember.isActive) {
        return NextResponse.json(
          { error: "User is already an active member of this company." },
          { status: 400 }
        );
      }
      // Re-activate member
      const reactivated = await prisma.companyMember.update({
        where: { id: existingMember.id },
        data: {
          isActive: true,
          role: assignedRole,
          customPermissions: customPermissions ? JSON.stringify(customPermissions) : null,
        },
      });

      const meta = getClientMetadata(req);
      await recordAuditLog({
        companyId,
        userId: context.user.id,
        userEmail: context.user.email,
        action: "ADD_MEMBER",
        entity: "CompanyMember",
        entityId: reactivated.id,
        details: `Re-activated membership for ${targetUser.email} as ${assignedRole}`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return NextResponse.json({ ok: true, member: reactivated });
    }

    const member = await prisma.companyMember.create({
      data: {
        userId: targetUser.id,
        companyId,
        role: assignedRole,
        isActive: true,
        customPermissions: customPermissions ? JSON.stringify(customPermissions) : null,
      },
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "ADD_MEMBER",
      entity: "CompanyMember",
      entityId: member.id,
      details: `Added ${targetUser.email} as ${assignedRole} in ${context.company.name}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, member });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.ROLE_MANAGE, req);
    const companyId = context.company.id;

    const body = await req.json();
    const { memberId, role, customPermissions, isActive } = body;

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required." }, { status: 400 });
    }

    const member = await prisma.companyMember.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!member || member.companyId !== companyId) {
      throw new AuthError("Member not found in this company.", 404, "NOT_FOUND");
    }

    const updateData: any = {};
    if (role) {
      const assignedRole = role.toUpperCase();
      if (!Object.values(ROLES).includes(assignedRole as Role)) {
        return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
      }
      updateData.role = assignedRole;
    }

    if (customPermissions !== undefined) {
      updateData.customPermissions = customPermissions ? JSON.stringify(customPermissions) : null;
    }

    if (typeof isActive === "boolean") {
      updateData.isActive = isActive;
    }

    const updated = await prisma.companyMember.update({
      where: { id: memberId },
      data: updateData,
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "UPDATE_MEMBER_ROLE",
      entity: "CompanyMember",
      entityId: memberId,
      beforeValue: { role: member.role, isActive: member.isActive },
      afterValue: { role: updated.role, isActive: updated.isActive },
      details: `Updated role for ${member.user.email} to ${updated.role}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, member: updated });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.USER_MANAGE, req);
    const companyId = context.company.id;

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required." }, { status: 400 });
    }

    const member = await prisma.companyMember.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!member || member.companyId !== companyId) {
      throw new AuthError("Member not found in this company.", 404, "NOT_FOUND");
    }

    // Do not allow removing oneself
    if (member.userId === context.user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the company." },
        { status: 400 }
      );
    }

    await prisma.companyMember.delete({ where: { id: memberId } });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "REMOVE_MEMBER",
      entity: "CompanyMember",
      entityId: memberId,
      details: `Removed ${member.user.email} from company ${context.company.name}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, message: "Member removed successfully." });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
