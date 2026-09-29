import { NextResponse } from "next/server";
import { getCurrentUser, logActivity } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "backup") {
      // Platform Full JSON Export
      const [companies, users, invoices, expenses, items, parties] = await Promise.all([
        prisma.company.findMany(),
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            status: true,
            approvedAt: true,
            approvedBy: true,
            createdAt: true,
          },
        }),
        prisma.invoice.findMany({ include: { lines: true } }),
        prisma.expense.findMany(),
        prisma.item.findMany(),
        prisma.party.findMany(),
      ]);

      await logActivity({
        userId: user.id,
        userEmail: user.email,
        action: "PLATFORM_BACKUP",
        details: "Super Admin exported full platform JSON backup",
      });

      return NextResponse.json({
        exportDate: new Date().toISOString(),
        exportedBy: user.email,
        stats: {
          companiesCount: companies.length,
          usersCount: users.length,
          invoicesCount: invoices.length,
          expensesCount: expenses.length,
          itemsCount: items.length,
          partiesCount: parties.length,
        },
        data: { companies, users, invoices, expenses, items, parties },
      });
    }

    // Default System Diagnostics
    const [
      totalUsers,
      totalCompanies,
      totalInvoices,
      totalExpenses,
      totalItems,
      totalParties,
      totalAuditLogs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.invoice.count(),
      prisma.expense.count(),
      prisma.item.count(),
      prisma.party.count(),
      prisma.activityLog.count(),
    ]);

    return NextResponse.json({
      dbStats: {
        totalUsers,
        totalCompanies,
        totalInvoices,
        totalExpenses,
        totalItems,
        totalParties,
        totalAuditLogs,
      },
      nodeEnv: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Super Admin system API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
