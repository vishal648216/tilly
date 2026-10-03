// Taily - Phase 8: Unified Audit Log Engine
// Handles both Platform-Level Super Admin audit events and Tenant Business audit logs.
import { prisma } from "./prisma";

export interface LogPlatformActionParams {
  userId?: string;
  userEmail?: string;
  companyId?: string;
  action:
    | "PLAN_CREATED"
    | "PLAN_UPDATED"
    | "PLAN_DELETED"
    | "COMPANY_STATUS_UPDATED"
    | "COMPANY_SUSPENDED"
    | "COMPANY_ACTIVATED"
    | "SUBSCRIPTION_ASSIGNED"
    | "SUBSCRIPTION_STATUS_CHANGED"
    | "SUBSCRIPTION_TIER_UPGRADE"
    | "FEATURE_FLAG_MODIFIED"
    | "PLATFORM_SETTING_UPDATED"
    | "USER_ROLE_ESCALATED"
    | "USER_STATUS_UPDATED"
    | "INVOICE_TEMPLATE_CUSTOMIZED";
  entityType: "COMPANY" | "PLAN" | "SUBSCRIPTION" | "USER" | "PLATFORM";
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Persists an immutable platform-level audit event.
 */
export async function logPlatformAction(params: LogPlatformActionParams) {
  const { userId, userEmail, companyId, action, entityType, entityId, details, ipAddress } = params;

  return await prisma.platformAuditLog.create({
    data: {
      userId,
      userEmail,
      companyId,
      action,
      entityType,
      entityId,
      details: details ? JSON.stringify(details) : null,
      ipAddress,
    },
  });
}

/**
 * Retrieves paginated platform audit logs with optional filters.
 */
export async function getPlatformAuditLogs(params: {
  companyId?: string;
  action?: string;
  page?: number;
  limit?: number;
}) {
  const { companyId, action, page = 1, limit = 50 } = params;

  const where: any = {};
  if (companyId) where.companyId = companyId;
  if (action) where.action = action;

  const [total, logs] = await Promise.all([
    prisma.platformAuditLog.count({ where }),
    prisma.platformAuditLog.findMany({
      where,
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l.id,
      date: l.createdAt,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      userEmail: l.userEmail || "System Admin",
      companyName: l.company?.name || "Global / Platform",
      details: l.details ? JSON.parse(l.details) : null,
      ipAddress: l.ipAddress,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export interface AuditLogInput {
  companyId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  beforeValue?: any;
  afterValue?: any;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Extracts client IP and user agent metadata from an HTTP request.
 */
export function getClientMetadata(req?: Request) {
  if (!req) return { ipAddress: null, userAgent: null };
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") || null;
  const userAgent = req.headers.get("user-agent") || null;
  return { ipAddress, userAgent };
}

/**
 * Records tenant-level operational audit logs.
 */
export async function recordAuditLog(input: AuditLogInput) {
  try {
    return await prisma.platformAuditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId || null,
        userEmail: input.userEmail || null,
        action: input.action,
        entityType: input.entity || "RECORD",
        entityId: input.entityId || null,
        details:
          typeof input.details === "string"
            ? input.details
            : JSON.stringify({
                details: input.details,
                beforeValue: input.beforeValue,
                afterValue: input.afterValue,
              }),
        ipAddress: input.ipAddress || null,
      },
    });
  } catch (err) {
    // Audit logging should not crash the primary operational transaction
    console.error("Non-fatal: failed to record audit log:", err);
    return null;
  }
}
