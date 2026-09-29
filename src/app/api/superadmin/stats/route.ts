import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const [
      totalCompanies,
      totalUsers,
      pendingApprovals,
      approvedUsers,
      totalInvoices,
      allInvoices,
      recentActivities,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.user.count({ where: { status: "PENDING" } }),
      prisma.user.count({ where: { status: "APPROVED" } }),
      prisma.invoice.count(),
      prisma.invoice.findMany({ select: { grandTotal: true } }),
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

    const totalTurnover = allInvoices.reduce(
      (sum, inv) => sum + parseFloat(inv.grandTotal.toString() || "0"),
      0
    );

    return NextResponse.json({
      stats: {
        totalCompanies,
        totalUsers,
        pendingApprovals,
        approvedUsers,
        totalInvoices,
        totalTurnover,
      },
      recentActivities,
    });
  } catch (err: any) {
    console.error("Super Admin stats error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
