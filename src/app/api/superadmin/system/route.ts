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

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.action !== "purge_all_except_superadmin") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (body.confirmation !== "PURGE") {
      return NextResponse.json({ error: "Confirmation code 'PURGE' is required" }, { status: 400 });
    }

    // Identify super admins (exclude temporary platform_admin test accounts)
    const superAdmins = await prisma.user.findMany({
      where: {
        role: "SUPER_ADMIN",
        NOT: { email: { startsWith: "platform_admin_" } },
      },
      select: { id: true, email: true },
    });

    const superAdminIds = superAdmins.map((u) => u.id);

    // 1. Transactional & manufacturing records
    await prisma.productionWastage.deleteMany().catch(() => {});
    await prisma.productionConsumption.deleteMany().catch(() => {});
    await prisma.productionOrder.deleteMany().catch(() => {});
    await prisma.bomItem.deleteMany().catch(() => {});
    await prisma.billOfMaterials.deleteMany().catch(() => {});

    await prisma.paymentAllocation.deleteMany().catch(() => {});
    await prisma.payment.deleteMany().catch(() => {});
    await prisma.invoiceLine.deleteMany().catch(() => {});
    await prisma.invoice.deleteMany().catch(() => {});
    await prisma.expense.deleteMany().catch(() => {});
    await prisma.voucherEntry.deleteMany().catch(() => {});
    await prisma.voucher.deleteMany().catch(() => {});

    await prisma.deliveryChallanLine.deleteMany().catch(() => {});
    await prisma.deliveryChallan.deleteMany().catch(() => {});
    await prisma.goodsReceiptLine.deleteMany().catch(() => {});
    await prisma.goodsReceipt.deleteMany().catch(() => {});
    await prisma.salesOrderLine.deleteMany().catch(() => {});
    await prisma.salesOrder.deleteMany().catch(() => {});
    await prisma.purchaseOrderLine.deleteMany().catch(() => {});
    await prisma.purchaseOrder.deleteMany().catch(() => {});
    await prisma.quotationLine.deleteMany().catch(() => {});
    await prisma.quotation.deleteMany().catch(() => {});

    await prisma.stockMovement.deleteMany().catch(() => {});
    await prisma.warehouseStock.deleteMany().catch(() => {});
    await prisma.serialNumber.deleteMany().catch(() => {});
    await prisma.batch.deleteMany().catch(() => {});
    await prisma.productVariant.deleteMany().catch(() => {});
    await prisma.item.deleteMany().catch(() => {});
    await prisma.warehouse.deleteMany().catch(() => {});

    await prisma.party.deleteMany().catch(() => {});
    await prisma.account.deleteMany().catch(() => {});
    await prisma.customFieldDefinition.deleteMany().catch(() => {});
    await prisma.subscriptionUsage.deleteMany().catch(() => {});
    await prisma.subscription.deleteMany().catch(() => {});
    await prisma.invoiceCustomization.deleteMany().catch(() => {});
    await prisma.ocrScanRecord.deleteMany().catch(() => {});
    await prisma.importJob.deleteMany().catch(() => {});
    await prisma.backupLog.deleteMany().catch(() => {});
    await prisma.platformAuditLog.deleteMany().catch(() => {});
    await prisma.activityLog.deleteMany().catch(() => {});
    await prisma.notification.deleteMany().catch(() => {});

    await prisma.companySettings.deleteMany().catch(() => {});
    await prisma.companyMember.deleteMany().catch(() => {});
    await prisma.company.deleteMany().catch(() => {});

    // Remove sessions of non-super-admins
    await prisma.session.deleteMany({
      where: { userId: { notIn: superAdminIds } },
    }).catch(() => {});

    // Delete all regular users
    const deletedUsers = await prisma.user.deleteMany({
      where: { id: { notIn: superAdminIds } },
    });

    await logActivity({
      userId: user.id,
      userEmail: user.email,
      action: "PLATFORM_FACTORY_RESET",
      details: `Super Admin executed full platform wipe. Preserved super admin accounts: ${superAdmins.map((s) => s.email).join(", ")}. Removed ${deletedUsers.count} non-admin users.`,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      message: "Platform wiped successfully. All tenant data and non-admin users removed.",
      deletedUsersCount: deletedUsers.count,
      preservedSuperAdmins: superAdmins.map((s) => s.email),
    });
  } catch (err: any) {
    console.error("Super Admin system purge error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
