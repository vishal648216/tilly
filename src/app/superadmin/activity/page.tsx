import { prisma } from "@/lib/prisma";
import ActivityClient from "./ActivityClient";

export const dynamic = "force-dynamic";

export default async function SuperAdminActivityPage() {
  const activities = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  const formattedActivities = activities.map((a) => ({
    id: a.id,
    userId: a.userId,
    userEmail: a.userEmail,
    companyId: a.companyId,
    action: a.action,
    details: a.details,
    ipAddress: a.ipAddress,
    createdAt: a.createdAt.toISOString(),
  }));

  return <ActivityClient initialActivities={formattedActivities} />;
}
