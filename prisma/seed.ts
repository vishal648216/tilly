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

  // 4b. Default Warehouse
  const defaultWarehouse = await prisma.warehouse.upsert({
    where: { id: "wh-main-demo" },
    update: { active: true, isDefault: true },
    create: {
      id: "wh-main-demo",
      companyId: company.id,
      name: "Main Central Warehouse",
      code: "MAIN",
      address: "123 Market Road, BKC, Mumbai",
      isDefault: true,
      active: true,
    },
  });

  // 5. Demo parties (Customers & Vendors)
  const customer1 = await prisma.party.upsert({
    where: { id: "demo-cust-1" },
    update: {},
    create: {
      id: "demo-cust-1",
      companyId: company.id,
      name: "Ramesh Traders",
      type: "CUSTOMER",
      phone: "9123456789",
      city: "Pune",
      state: "Maharashtra",
      gstin: "27AAACR1234L1Z2",
    },
  });

  const customer2 = await prisma.party.upsert({
    where: { id: "demo-cust-2" },
    update: {},
    create: {
      id: "demo-cust-2",
      companyId: company.id,
      name: "Bangalore Tech Solutions",
      type: "CUSTOMER",
      phone: "9876543211",
      city: "Bengaluru",
      state: "Karnataka",
      gstin: "29AADCB2233M1Z4",
    },
  });

  const vendor1 = await prisma.party.upsert({
    where: { id: "demo-vend-1" },
    update: {},
    create: {
      id: "demo-vend-1",
      companyId: company.id,
      name: "Sharma Electronics Ltd",
      type: "VENDOR",
      phone: "9000011222",
      city: "Nashik",
      state: "Maharashtra",
      gstin: "27AAACS5678P1Z3",
    },
  });

  const vendor2 = await prisma.party.upsert({
    where: { id: "demo-vend-2" },
    update: {},
    create: {
      id: "demo-vend-2",
      companyId: company.id,
      name: "Metro Paper Mills",
      type: "VENDOR",
      phone: "9112233445",
      city: "Ahmedabad",
      state: "Gujarat",
      gstin: "24AABCM9988Q1Z1",
    },
  });
  console.log("✅ Demo parties created (Customers & Vendors)");

  // 6. Demo items with inventory
  const laptop = await prisma.item.upsert({
    where: { id: "item-demo-lap" },
    update: { stock: 50 },
    create: {
      id: "item-demo-lap",
      companyId: company.id,
      name: "Laptop Core i5 16GB SSD",
      sku: "LAP-I5",
      hsn: "8471",
      unit: "PCS",
      salePrice: 48000,
      purchasePrice: 38000,
      gstRate: 18,
      stock: 50,
      minStock: 5,
    },
  });

  const mouse = await prisma.item.upsert({
    where: { id: "item-demo-wm" },
    update: { stock: 200 },
    create: {
      id: "item-demo-wm",
      companyId: company.id,
      name: "Wireless Optical Mouse",
      sku: "WM-01",
      hsn: "8471",
      unit: "PCS",
      salePrice: 450,
      purchasePrice: 250,
      gstRate: 18,
      stock: 200,
      minStock: 20,
    },
  });

  const paper = await prisma.item.upsert({
    where: { id: "item-demo-a4" },
    update: { stock: 150 },
    create: {
      id: "item-demo-a4",
      companyId: company.id,
      name: "A4 Copier Paper Ream (500s)",
      sku: "A4-500",
      hsn: "4802",
      unit: "PCS",
      salePrice: 290,
      purchasePrice: 210,
      gstRate: 12,
      stock: 150,
      minStock: 25,
    },
  });
  console.log("✅ Demo products & inventory created");

  // 7. Seed Real Test Invoices & Vouchers via Invoice Engine
  const { createInvoice } = await import("../src/lib/invoice");

  const existingInv1 = await prisma.invoice.findFirst({
    where: { companyId: company.id, invoiceNo: "INV-000001" },
  });
  if (!existingInv1) {
    await createInvoice({
      companyId: company.id,
      type: "SALES",
      partyId: customer1.id,
      warehouseId: defaultWarehouse.id,
      date: new Date(),
      orderNo: "PO-2026-001",
      isInterState: false,
      status: "POSTED",
      lines: [
        {
          itemId: laptop.id,
          name: laptop.name,
          sku: laptop.sku || undefined,
          unit: laptop.unit,
          qty: 2,
          rate: 48000,
          purchasePrice: 38000,
          gstRate: 18,
          discount: 0,
        },
        {
          itemId: mouse.id,
          name: mouse.name,
          sku: mouse.sku || undefined,
          unit: mouse.unit,
          qty: 5,
          rate: 450,
          purchasePrice: 250,
          gstRate: 18,
          discount: 0,
        },
      ],
      paidAmount: 50000,
      notes: "Sample Seed Sales Invoice (Intra-State CGST + SGST)",
    });
    console.log("✅ Sample Sales Invoice INV-000001 created with balanced vouchers");
  }

  const existingPur1 = await prisma.invoice.findFirst({
    where: { companyId: company.id, invoiceNo: "PUR-000001" },
  });
  if (!existingPur1) {
    await createInvoice({
      companyId: company.id,
      type: "PURCHASE",
      partyId: vendor1.id,
      warehouseId: defaultWarehouse.id,
      date: new Date(),
      orderNo: "PO-2026-001",
      isInterState: false,
      status: "POSTED",
      lines: [
        {
          itemId: paper.id,
          name: paper.name,
          sku: paper.sku || undefined,
          unit: paper.unit,
          qty: 50,
          rate: 210,
          purchasePrice: 210,
          gstRate: 12,
          discount: 0,
        },
      ],
      paidAmount: 11760,
      notes: "Sample Seed Purchase Bill (Input Tax Credit recorded)",
    });
    console.log("✅ Sample Purchase Bill PUR-000001 created with balanced vouchers");
  }

  console.log("\n🎉 Seed complete! Real transactions & vouchers populated successfully.");
  console.log("Super Admin: admin@admin.com / admin@1234");
  console.log("Master Tester: test@taily.in / test1234");
  console.log("Demo User: demo@taily.in / demo1234");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
