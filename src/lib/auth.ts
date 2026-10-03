// Taily - Centralized Server-Side Authorization & IDOR Guard
// Enforces: Authentication -> Active Company Context -> Membership -> Permission -> Entity Ownership

import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany, getCurrentMembership } from "./session";
import { Permission, hasPermission, getRolePermissions } from "./permissions";
import { recordAuditLog, getClientMetadata } from "./audit";
import { prisma } from "./prisma";
import { verifyCsrfOrigin } from "./csrf";

export class AuthError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 403, code = "FORBIDDEN") {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Ensures the request is from an authenticated, approved user.
 */
export async function requireAuth(req?: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    throw new AuthError("Authentication required. Please log in.", 401, "UNAUTHORIZED");
  }
  return user;
}

/**
 * Ensures user is authenticated AND resolves their active company context and role.
 */
export async function requireCompanyAccess(req?: Request) {
  if (req) {
    verifyCsrfOrigin(req);
  }

  const user = await requireAuth(req);
  const company = await getCurrentCompany(req);

  if (!company) {
    throw new AuthError("No active business company resolved for this account.", 403, "NO_ACTIVE_COMPANY");
  }

  const membership = await getCurrentMembership(req);
  if (!membership || !membership.isActive) {
    throw new AuthError(
      "Your membership in this company is inactive or suspended.",
      403,
      "MEMBERSHIP_INACTIVE"
    );
  }

  const role = membership.role;
  const permissions = getRolePermissions(role, membership.customPermissions);

  return {
    user,
    company,
    membership,
    role,
    permissions,
  };
}

/**
 * Ensures user has a specific permission in their active company.
 */
export async function requirePermission(permission: Permission, req?: Request) {
  const context = await requireCompanyAccess(req);

  const allowed = hasPermission(context.role, permission, context.membership.customPermissions);

  if (!allowed) {
    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId: context.company.id,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "PERMISSION_DENIED",
      details: `User with role '${context.role}' attempted action requiring '${permission}'`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    throw new AuthError(
      `Access denied: You do not have permission '${permission}' in company '${context.company.name}'.`,
      403,
      "FORBIDDEN"
    );
  }

  return context;
}

/**
 * Super Admin Security Guard:
 * Super Admin must be completely separate from normal company users.
 * Never allow normal company admin to become Super Admin via client-side modification.
 * Verifies the database user record has role === 'SUPER_ADMIN'.
 */
export async function requireSuperAdmin(req?: Request) {
  const user = await requireAuth(req);
  if (user.role !== "SUPER_ADMIN") {
    throw new AuthError(
      "Access denied: Super Admin authorization is required for platform operations.",
      403,
      "SUPER_ADMIN_REQUIRED"
    );
  }
  return user;
}

/**
 * Validates that an existing database entity belongs to the tenant's active company.
 * Throws 404/403 and records an IDOR attempt if violated.
 */
export async function validateEntityBelongsToCompany(
  entityType: "item" | "party" | "invoice" | "expense" | "voucher" | "warehouse" | "account",
  entityId: string,
  companyId: string,
  req?: Request,
  userContext?: { userId: string; userEmail: string }
) {
  let record: { id: string; companyId: string } | null = null;

  switch (entityType) {
    case "item":
      record = await prisma.item.findUnique({ where: { id: entityId }, select: { id: true, companyId: true } });
      break;
    case "party":
      record = await prisma.party.findUnique({ where: { id: entityId }, select: { id: true, companyId: true } });
      break;
    case "invoice":
      record = await prisma.invoice.findUnique({ where: { id: entityId }, select: { id: true, companyId: true } });
      break;
    case "expense":
      record = await prisma.expense.findUnique({ where: { id: entityId }, select: { id: true, companyId: true } });
      break;
    case "voucher":
      record = await prisma.voucher.findUnique({ where: { id: entityId }, select: { id: true, companyId: true } });
      break;
    case "warehouse":
      record = await prisma.warehouse.findUnique({ where: { id: entityId }, select: { id: true, companyId: true } });
      break;
    case "account":
      record = await prisma.account.findUnique({ where: { id: entityId }, select: { id: true, companyId: true } });
      break;
  }

  if (!record || record.companyId !== companyId) {
    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: userContext?.userId || null,
      userEmail: userContext?.userEmail || null,
      action: "IDOR_ATTEMPT_BLOCKED",
      entity: entityType,
      entityId,
      details: `Attempted cross-tenant access to ${entityType} ${entityId} belonging to another tenant or non-existent.`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    throw new AuthError(
      `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found or does not belong to active company.`,
      404,
      "NOT_FOUND_OR_CROSS_TENANT"
    );
  }

  return record;
}

/**
 * Standard error response formatter for API routes
 */
export function handleAuthError(error: any) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  if (error?.name === "SubscriptionError" || (error?.status && error?.code)) {
    return NextResponse.json(
      { error: error.message, code: error.code || "SUBSCRIPTION_RESTRICTION" },
      { status: error.status || 403 }
    );
  }
  return NextResponse.json(
    { error: error.message || "An unexpected error occurred" },
    { status: 500 }
  );
}
