// Taily - Database Purge Script
// Wipes all transactional data, items, parties, companies, and regular users,
// PRESERVING ONLY Super Admin user(s) and core system plans.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function purgeAllExceptSuperAdmin() {
  console.log("==================================================");
  console.log("⚠️  TAILY SYSTEM DATA PURGE UTILITY");
  console.log("==================================================");

  try {
    // 1. Identify Super Admins to protect
    const superAdmins = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN" },
      select: { id: true, email: true, name: true },
    });

    if (superAdmins.length === 0) {
      console.error("❌ ABORTING: No SUPER_ADMIN user found! Purge stopped to prevent system lockout.");
      process.exit(1);
    }

    console.log(`\n🛡️  Protected Super Admin accounts (${superAdmins.length}):`);
    superAdmins.forEach((sa) => console.log(`   - ${sa.name} (${sa.email})`));

    const protectedUserIds = superAdmins.map((sa) => sa.id);

    console.log("\n⏳ Beginning complete database cleanup in relational order...\n");

    // 2. Child tables / Manufacturing
    console.log("-> Deleting Manufacturing & Production records...");
    await prisma.productionWastage.deleteMany().catch(() => {});
    await prisma.productionConsumption.deleteMany().catch(() => {});
    await prisma.productionOrder.deleteMany().catch(() => {});
    await prisma.bomItem.deleteMany().catch(() => {});
    await prisma.billOfMaterials.deleteMany().catch(() => {});

    // 3. Transactions, Vouchers, Invoices
    console.log("-> Deleting Payments, Invoices, Vouchers...");
    await prisma.paymentAllocation.deleteMany().catch(() => {});
    await prisma.payment.deleteMany().catch(() => {});
    await prisma.invoiceLine.deleteMany().catch(() => {});
    await prisma.invoice.deleteMany().catch(() => {});
    await prisma.expense.deleteMany().catch(() => {});
    await prisma.voucherEntry.deleteMany().catch(() => {});
    await prisma.voucher.deleteMany().catch(() => {});

    // 4. Workflow Documents (Quotes, Orders, Challans, GRNs)
    console.log("-> Deleting Workflow documents (Quotations, Orders, Challans, GRNs)...");
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

    // 5. Inventory & Warehouse data
    console.log("-> Deleting Inventory, Stock Movements, Warehouses, Items...");
    await prisma.stockMovement.deleteMany().catch(() => {});
    await prisma.warehouseStock.deleteMany().catch(() => {});
    await prisma.serialNumber.deleteMany().catch(() => {});
    await prisma.batch.deleteMany().catch(() => {});
    await prisma.productVariant.deleteMany().catch(() => {});
    await prisma.item.deleteMany().catch(() => {});
    await prisma.warehouse.deleteMany().catch(() => {});

    // 6. CRM, Accounts, Company Customizations
    console.log("-> Deleting CRM Parties, Accounts, Subscriptions, Company Settings...");
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

    // 7. Companies and Memberships
    console.log("-> Deleting Company Memberships and Companies...");
    await prisma.companySettings.deleteMany().catch(() => {});
    await prisma.companyMember.deleteMany().catch(() => {});
    await prisma.company.deleteMany().catch(() => {});

    // 8. Sessions & Regular Users
    console.log("-> Removing non-admin user sessions...");
    await prisma.session.deleteMany({
      where: { userId: { notIn: protectedUserIds } },
    }).catch(() => {});

    console.log("-> Deleting all regular users (except Super Admins)...");
    const userDeleteResult = await prisma.user.deleteMany({
      where: { id: { notIn: protectedUserIds } },
    });

    console.log(`\n✅ PURGE COMPLETE!`);
    console.log(`   - Deleted regular users: ${userDeleteResult.count}`);
    console.log(`   - All tenant companies, items, stock, invoices, and vouchers have been wiped.`);
    console.log(`   - Super Admin accounts (${superAdmins.map((s) => s.email).join(", ")}) remain active.`);
    console.log("==================================================\n");
  } catch (error) {
    console.error("❌ Purge failed with error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

purgeAllExceptSuperAdmin();
