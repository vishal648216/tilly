import { NextResponse } from "next/server";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/superadmin/audit
 * Retrieve immutable platform audit trail for Super Admins.
 */
export async function GET(req: Request) {
  try {
    await requireSuperAdmin(req);

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const companyId = searchParams.get("companyId");
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

    const where: any = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (companyId) where.companyId = companyId;

    const logs = await prisma.platformAuditLog.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const parsedLogs = logs.map((l) => {
      let detailsObj = null;
      if (l.details) {
        try {
          detailsObj = JSON.parse(l.details);
        } catch {
          detailsObj = l.details;
        }
      }
      return {
        id: l.id,
        userId: l.userId,
        userEmail: l.userEmail,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        company: l.company ? { id: l.company.id, name: l.company.name } : null,
        details: detailsObj,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt,
      };
    });

    return NextResponse.json({ ok: true, logs: parsedLogs });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
