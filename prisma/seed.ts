// Taily - DB Seed
// Run with: npm run db:seed
// Creates a demo company + user + chart of accounts so you can log in immediately.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CHART_OF_ACCOUNTS } from "../src/lib/accounts";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Taily database...");

  // 0. Super Admin (Master account)
  const superAdminPasswordHash = await bcrypt.hash("admin@1234", 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@admin.com" },
    update: {
      role: "SUPER_ADMIN",
      status: "APPROVED",
      passwordHash: superAdminPasswordHash,
    },
    create: {
      email: "admin@admin.com",
      name: "Super Administrator",
      passwordHash: superAdminPasswordHash,
      phone: "9876543210",
      role: "SUPER_ADMIN",
      status: "APPROVED",
    },
  });
  console.log("👑 Super Admin created: admin@admin.com / admin@1234");

  // 1. Enterprise Tester User (VIP)
  const testerPasswordHash = await bcrypt.hash("test1234", 10);
  const testerUser = await prisma.user.upsert({
    where: { email: "test@taily.in" },
    update: {
      role: "SUPER_ADMIN",
      status: "APPROVED",
      passwordHash: testerPasswordHash,
    },
    create: {
      email: "test@taily.in",
      name: "Enterprise Master Tester",
      passwordHash: testerPasswordHash,
      phone: "9876543210",
      role: "SUPER_ADMIN",
      status: "APPROVED",
    },
  });
  console.log("🌟 Master Tester created: test@taily.in / test1234");

  // 1b. Demo user
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const user = await prisma.user.upsert({
    where: { email: "demo@taily.in" },
    update: {
      status: "APPROVED",
    },
    create: {
      email: "demo@taily.in",
      name: "Demo User",
      passwordHash,
      phone: "9999999999",
      role: "USER",
      status: "APPROVED",
    },
  });
  console.log("✅ User created: demo@taily.in / demo1234");

  // 2. Demo company
  const company = await prisma.company.upsert({
    where: { id: "demo-company-1" },
    update: { status: "ACTIVE" },
    create: {
      id: "demo-company-1",
      name: "Taily Enterprise ERP",
      legalName: "Taily Enterprise Solutions Pvt Ltd",
      email: "store@taily.in",
      phone: "9876543210",
      address: "123 Market Road, BKC",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400051",
      gstin: "27ABCDE1234F1Z5",
      pan: "ABCDE1234F",
      currency: "INR",
      financialYear: "2026-27",
      status: "ACTIVE",
    },
  });
  console.log("✅ Company created: Taily Enterprise ERP");

  // 3. Link users to company as ADMIN
  await prisma.companyMember.upsert({
    where: { userId_companyId: { userId: superAdmin.id, companyId: company.id } },
    update: { isActive: true, role: "COMPANY_ADMIN" },
    create: { userId: superAdmin.id, companyId: company.id, role: "COMPANY_ADMIN", isActive: true },
  });
  await prisma.companyMember.upsert({
    where: { userId_companyId: { userId: testerUser.id, companyId: company.id } },
    update: { isActive: true, role: "COMPANY_ADMIN" },
    create: { userId: testerUser.id, companyId: company.id, role: "COMPANY_ADMIN", isActive: true },
  });
  await prisma.companyMember.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: { isActive: true },
    create: { userId: user.id, companyId: company.id, role: "ADMIN", isActive: true },
  });

  // 3b. Unlock all feature switches in CompanySettings
  await prisma.companySettings.upsert({
    where: { companyId: company.id },
    update: {
      inventoryEnabled: true,
      gstEnabled: true,
      warehouseEnabled: true,
      multiWarehouseEnabled: true,
      barcodeEnabled: true,
      batchEnabled: true,
      expiryEnabled: true,
      serialEnabled: true,
      manufacturingEnabled: true,
      quotationEnabled: true,
      salesOrderEnabled: true,
      purchaseOrderEnabled: true,
      deliveryChallanEnabled: true,
      goodsReceiptEnabled: true,
      salespersonEnabled: true,
      priceListsEnabled: true,
      negativeStockAllowed: true,
      roundOffEnabled: true,
    },
    create: {
      companyId: company.id,
      inventoryEnabled: true,
      gstEnabled: true,
      warehouseEnabled: true,
      multiWarehouseEnabled: true,
      barcodeEnabled: true,
      batchEnabled: true,
      expiryEnabled: true,
      serialEnabled: true,
      manufacturingEnabled: true,
      quotationEnabled: true,
      salesOrderEnabled: true,
      purchaseOrderEnabled: true,
      deliveryChallanEnabled: true,
      goodsReceiptEnabled: true,
      salespersonEnabled: true,
      priceListsEnabled: true,
      negativeStockAllowed: true,
      roundOffEnabled: true,
    },
  });

  // 3c. Assign Enterprise Plan with 100 years validity
  try {
    const { assignSubscriptionToCompany } = await import("../src/lib/plans");
    await assignSubscriptionToCompany({
      companyId: company.id,
      planCode: "ENTERPRISE",
      status: "ACTIVE",
      periodDays: 36500,
    });
  } catch (err) {
    console.log("Enterprise subscription assignment note:", err);
  }

  // 4. Chart of accounts
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({
      where: { companyId_code: { companyId: company.id, code: acc.code } },
      update: {},
      create: {
        companyId: company.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        groupId: acc.groupId,
      },
    });
  }
  console.log(`✅ Chart of accounts created (${DEFAULT_CHART_OF_ACCOUNTS.length} accounts)`);

  // 5. A couple of demo parties
  await prisma.party.createMany({
    data: [
      { companyId: company.id, name: "Ramesh Traders", type: "CUSTOMER", phone: "9123456789", city: "Pune", state: "Maharashtra", gstin: "27AAACR1234L1Z2" },
      { companyId: company.id, name: "Wholesale Mart", type: "CUSTOMER", phone: "9876501234", city: "Mumbai", state: "Maharashtra" },
      { companyId: company.id, name: "Sharma Suppliers", type: "VENDOR", phone: "9000011222", city: "Nashik", state: "Maharashtra", gstin: "27AAACS5678P1Z3" },
    ],
  });
  console.log("✅ Demo parties created");

  // 6. A couple of demo items
  await prisma.item.createMany({
    data: [
      { companyId: company.id, name: "Notebook (200 pg)", sku: "NB200", hsn: "4820", unit: "PCS", salePrice: 80, purchasePrice: 55, gstRate: 12, stock: 500, minStock: 50 },
      { companyId: company.id, name: "Ball Pen (Blue)", sku: "BP-BLUE", hsn: "9608", unit: "PCS", salePrice: 10, purchasePrice: 6, gstRate: 18, stock: 1000, minStock: 100 },
      { companyId: company.id, name: "A4 Paper Ream", sku: "A4-500", hsn: "4802", unit: "PCS", salePrice: 250, purchasePrice: 200, gstRate: 18, stock: 100, minStock: 20 },
    ],
  });
  console.log("✅ Demo items created");

  console.log("\n🎉 Seed complete!");
  console.log("Login with: demo@taily.in / demo1234");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
