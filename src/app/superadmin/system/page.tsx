import { prisma } from "@/lib/prisma";
import SystemClient from "./SystemClient";

export const dynamic = "force-dynamic";

export default async function SuperAdminSystemPage() {
  const [
    totalUsers,
    approvedUsers,
    pendingUsers,
    totalCompanies,
    totalInvoices,
    totalExpenses,
    totalItems,
    totalParties,
    totalAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "APPROVED" } }),
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.company.count(),
    prisma.invoice.count(),
    prisma.expense.count(),
    prisma.item.count(),
    prisma.party.count(),
    prisma.activityLog.count(),
  ]);

  const dbStats = {
    totalUsers,
    approvedUsers,
    pendingUsers,
    totalCompanies,
    totalInvoices,
    totalExpenses,
    totalItems,
    totalParties,
    totalAuditLogs,
  };

  return <SystemClient dbStats={dbStats} />;
}
