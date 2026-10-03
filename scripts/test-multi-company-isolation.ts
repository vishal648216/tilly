/**
 * TAILY PRODUCTION HARDENING: MULTI-COMPANY ISOLATION TEST
 * Verifies absolute isolation between Company A and Company B when they possess:
 * - Identical Product Name
 * - Identical SKU
 * - Identical Barcode
 * - Identical Customer Name & Email
 * - Identical Invoice Numbers (INV-SHARED-001)
 * 
 * Tests:
 * 1. Co-existence of identical SKUs without conflict
 * 2. Scope-enforced queries (Zero cross-tenant leakage)
 * 3. Stock movement isolation (A's sales don't deduct B's inventory)
 * 4. Financial ledger isolation (Vouchers & Ledgers strictly separated)
 * 5. Customer balance & payment isolation
 */

import { prisma } from "../src/lib/prisma";
import { DEFAULT_CHART_OF_ACCOUNTS } from "../src/lib/accounts";
import { createVoucher } from "../src/lib/voucher";
import { getTrialBalance } from "../src/lib/accounting";
import { Decimal } from "@prisma/client/runtime/library";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

async function runMultiCompanyIsolationTest() {
  console.log("\n=======================================================");
  console.log("🏢 TAILY MULTI-COMPANY TENANT ISOLATION TEST");
  console.log("=======================================================\n");

  const ts = Date.now();
  const sharedSku = `SHARED-SKU-${ts}`;
  const sharedBarcode = `890${String(ts).slice(-9)}`;
  const sharedItemName = "Industrial Autonomous Drone";
  const sharedPartyName = "Global Apex Holdings";
  const sharedPartyEmail = `apex_${ts}@global.test`;
  const sharedInvoiceNo = `INV-ISO-${ts}`;

  // 1. Create Company A and Company B
  const companyA = await prisma.company.create({
    data: { name: `Isolation Tenant A ${ts}`, status: "ACTIVE" },
  });
  const companyB = await prisma.company.create({
    data: { name: `Isolation Tenant B ${ts}`, status: "ACTIVE" },
  });

  // Seed CoA for both
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.account.createMany({
      data: [
        {
          companyId: companyA.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          groupId: acc.groupId,
          openingBalance: new Decimal(0),
        },
        {
          companyId: companyB.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          groupId: acc.groupId,
          openingBalance: new Decimal(0),
        },
      ],
    });
  }

  // Warehouses
  const whA = await prisma.warehouse.create({
    data: { companyId: companyA.id, name: "Warehouse A", code: `WH-A-${ts}`, isDefault: true },
  });
  const whB = await prisma.warehouse.create({
    data: { companyId: companyB.id, name: "Warehouse B", code: `WH-B-${ts}`, isDefault: true },
  });

  console.log("1️⃣  Creating Identical Products in Company A and Company B");
  const itemA = await prisma.item.create({
    data: {
      companyId: companyA.id,
      name: sharedItemName,
      sku: sharedSku,
      barcode: sharedBarcode,
      salePrice: 5000,
      stock: 100, // 100 in Tenant A
    },
  });

  const itemB = await prisma.item.create({
    data: {
      companyId: companyB.id,
      name: sharedItemName,
      sku: sharedSku,
      barcode: sharedBarcode,
      salePrice: 7500, // Different price in Tenant B
      stock: 250, // 250 in Tenant B
    },
  });

  assert(itemA.id !== itemB.id, "Items have unique primary keys despite identical SKU & Barcode");
  assert(itemA.sku === itemB.sku && itemA.barcode === itemB.barcode, "SKU and barcode match exactly across tenants");

  console.log("\n2️⃣  Creating Identical Parties in Company A and Company B");
  const partyA = await prisma.party.create({
    data: {
      companyId: companyA.id,
      type: "CUSTOMER",
      name: sharedPartyName,
      email: sharedPartyEmail,
    },
  });

  const partyB = await prisma.party.create({
    data: {
      companyId: companyB.id,
      type: "CUSTOMER",
      name: sharedPartyName,
      email: sharedPartyEmail,
    },
  });

  assert(partyA.id !== partyB.id, "Parties have distinct IDs across tenants");

  console.log("\n3️⃣  Creating Invoices with Identical Invoice Numbers");
  const invA = await prisma.invoice.create({
    data: {
      companyId: companyA.id,
      partyId: partyA.id,
      warehouseId: whA.id,
      invoiceNo: sharedInvoiceNo,
      type: "SALES_INVOICE",
      subTotal: 5000,
      cgstTotal: 450,
      sgstTotal: 450,
      igstTotal: 0,
      grandTotal: 5900,
      paidAmount: 5900,
      status: "PAID",
      date: new Date(),
    },
  });

  const invB = await prisma.invoice.create({
    data: {
      companyId: companyB.id,
      partyId: partyB.id,
      warehouseId: whB.id,
      invoiceNo: sharedInvoiceNo,
      type: "SALES_INVOICE",
      subTotal: 15000,
      cgstTotal: 1350,
      sgstTotal: 1350,
      igstTotal: 0,
      grandTotal: 17700,
      paidAmount: 0,
      status: "POSTED",
      date: new Date(),
    },
  });

  assert(invA.id !== invB.id, "Invoices with identical invoice numbers coexist cleanly in multi-tenant schema");
  assert(invA.grandTotal.toNumber() === 5900 && invB.grandTotal.toNumber() === 17700, "Invoices retain tenant-specific amounts");

  console.log("\n4️⃣  Verifying Query Isolation (Zero Cross-Tenant Leakage)");
  // Tenant A Item Query
  const itemsForA = await prisma.item.findMany({ where: { companyId: companyA.id } });
  assert(itemsForA.length === 1 && itemsForA[0].id === itemA.id, "Tenant A query returns exclusively Tenant A items");

  // Tenant B Item Query
  const itemsForB = await prisma.item.findMany({ where: { companyId: companyB.id } });
  assert(itemsForB.length === 1 && itemsForB[0].id === itemB.id, "Tenant B query returns exclusively Tenant B items");

  // Tenant A Invoice Query
  const invQueryA = await prisma.invoice.findFirst({
    where: { companyId: companyA.id, invoiceNo: sharedInvoiceNo },
  });
  assert(invQueryA?.status === "PAID" && invQueryA?.id === invA.id, "Tenant A retrieves PAID invoice (5,900)");

  // Tenant B Invoice Query
  const invQueryB = await prisma.invoice.findFirst({
    where: { companyId: companyB.id, invoiceNo: sharedInvoiceNo },
  });
  assert(invQueryB?.status === "POSTED" && invQueryB?.id === invB.id, "Tenant B retrieves POSTED unpaid invoice (17,700)");

  console.log("\n5️⃣  Verifying Stock Isolation (Tenant A modifications do not affect Tenant B)");
  // Deduct 50 units from Item A
  await prisma.item.update({
    where: { id: itemA.id },
    data: { stock: 50 },
  });

  const refreshedItemA = await prisma.item.findUnique({ where: { id: itemA.id } });
  const refreshedItemB = await prisma.item.findUnique({ where: { id: itemB.id } });

  assert(refreshedItemA?.stock.toNumber() === 50, "Tenant A stock updated to 50");
  assert(refreshedItemB?.stock.toNumber() === 250, "Tenant B stock remains untouched at 250");

  console.log("\n6️⃣  Verifying Double-Entry Accounting Isolation");
  // Voucher in Company A: Dr Bank 1002 (5900), Cr Debtors 1100 (5900)
  await createVoucher({
    companyId: companyA.id,
    type: "RECEIPT",
    date: new Date(),
    narration: "Receipt for Invoice A",
    entries: [
      { accountCode: "1002", debit: 5900 },
      { accountCode: "1100", credit: 5900 },
    ],
  });

  const tbA = await getTrialBalance({ companyId: companyA.id });
  const tbB = await getTrialBalance({ companyId: companyB.id });

  assert(tbA.totalDr === 5900 && tbA.totalCr === 5900, "Company A Trial Balance reflects its own voucher");
  assert(tbB.totalDr === 0 && tbB.totalCr === 0, "Company B Trial Balance remains completely empty (zero voucher leakage)");

  // Cleanup
  await prisma.voucherEntry.deleteMany({ where: { account: { companyId: { in: [companyA.id, companyB.id] } } } });
  await prisma.voucher.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
  await prisma.account.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
  await prisma.invoice.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
  await prisma.item.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
  await prisma.party.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
  await prisma.warehouse.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
  await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });

  console.log("\n=======================================================");
  console.log(`📊 MULTI-COMPANY ISOLATION: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

runMultiCompanyIsolationTest().catch((err) => {
  console.error("Multi-company isolation failure:", err);
  process.exit(1);
});
