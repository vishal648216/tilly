import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AuditClient from "./AuditClient";

export const dynamic = "force-dynamic";

export default async function SuperAdminAuditPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") redirect("/login");

  const logs = await prisma.platformAuditLog.findMany({
    include: {
      company: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
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
      createdAt: l.createdAt.toISOString(),
    };
  });

  return <AuditClient initialLogs={parsedLogs} />;
}
