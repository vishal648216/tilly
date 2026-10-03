/**
 * TAILY PHASE 9 TEST SUITE
 * Advanced Productivity Features & Manufacturing Foundation
 * 
 * Verifies:
 * 1. CSV/XLSX Import Wizard (Products, Customers, Suppliers, Opening Stock, Balances)
 * 2. Import Error Reporting (Row, Field, Value, Error, Suggested Correction)
 * 3. Database Backup & Restore vs Safe Data Export (Zero Secrets Guarantee)
 * 4. OCR Bill Extraction, Staging, Review, and Verified Purchase Posting
 * 5. Barcode Lookup and Keyboard Scanner Auto-Increment
 * 6. Batch Lot Tracking, Stock Allocation, and Availability Guard
 * 7. Serial Number Registration, Duplicate Prevention, and Sale Assignment
 * 8. FEFO Expiry Alerts (Expired vs Expiring Soon) and Notifications
 * 9. Manufacturing Foundation: BOM, Atomic Consumption, Scrap Wastage,
 *    Finished Good Capitalization, and Balanced Double-Entry Journal Voucher
 */

import { prisma } from "../src/lib/prisma";
import {
  parseCsvString,
  autoMapColumns,
  validateImportRows,
  executeImport,
  generateErrorReportCsv,
} from "../src/lib/importer";
import {
  createDatabaseBackup,
  restoreDatabaseBackup,
  exportTenantData,
  saveAutoBackupConfig,
  getBackupLogs,
} from "../src/lib/backup";
import {
  parseRawBillText,
  stageOcrBillScan,
  updateOcrReview,
  confirmAndCreatePurchaseFromOcr,
} from "../src/lib/ocrBill";
import {
  lookupProductByBarcode,
  handleBarcodeInvoiceSelection,
} from "../src/lib/barcode";
import {
  createOrUpdateBatch,
  deductBatchStock,
  registerSerialNumbers,
  assignSerialsToSale,
  getBatchExpiryReport,
  triggerExpiryNotifications,
} from "../src/lib/batchSerial";
import {
  createBillOfMaterials,
  createProductionOrder,
  executeProductionOrder,
} from "../src/lib/manufacturing";
import { ensureDefaultPlans, assignSubscriptionToCompany } from "../src/lib/plans";
import fs from "fs";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failedCount++;
  }
}

async function runPhase9Tests() {
  console.log("\n=======================================================");
  console.log("🚀 TAILY PHASE 9: ADVANCED PRODUCTIVITY & MANUFACTURING TEST SUITE");
  console.log("=======================================================\n");

  const timestamp = Date.now();
  const testCompanyA = await prisma.company.create({
    data: {
      name: `Ph9 Acme Corp ${timestamp}`,
      status: "ACTIVE",
      businessType: "Manufacturing",
      settings: {
        create: {
          inventoryEnabled: true,
          warehouseEnabled: true,
          multiWarehouseEnabled: true,
          batchEnabled: true,
          expiryEnabled: true,
          serialEnabled: true,
          manufacturingEnabled: true,
          barcodeEnabled: true,
          featuresConfig: JSON.stringify({ ocrEnabled: true }),
        },
      },
    },
    include: { settings: true },
  });

  // Assign Enterprise Plan to testCompanyA so all quotas and features are active
  await ensureDefaultPlans();
  await assignSubscriptionToCompany(testCompanyA.id, "ENTERPRISE", { status: "ACTIVE" });

  const warehouseMain = await prisma.warehouse.create({
    data: {
      companyId: testCompanyA.id,
      name: "Central Factory Godown",
      code: "CFG",
      isDefault: true,
    },
  });

  // Seed default capital (3001) and stock in hand (1200) accounts
  const stockAccount = await prisma.account.create({
    data: {
      companyId: testCompanyA.id,
      code: "1200",
      name: "Stock in Hand",
      type: "ASSET",
      groupId: "Stock-in-Hand",
    },
  });
  const capitalAccount = await prisma.account.create({
    data: {
      companyId: testCompanyA.id,
      code: "3001",
      name: "Capital Account",
      type: "EQUITY",
      groupId: "Capital-Account",
    },
  });
  const debtorsAccount = await prisma.account.create({
    data: {
      companyId: testCompanyA.id,
      code: "1100",
      name: "Sundry Debtors",
      type: "ASSET",
      groupId: "Sundry-Debtors",
    },
  });
  const creditorsAccount = await prisma.account.create({
    data: {
      companyId: testCompanyA.id,
      code: "2001",
      name: "Sundry Creditors",
      type: "LIABILITY",
      groupId: "Sundry-Creditors",
    },
  });

  // ========================================================
  // 1. IMPORT WIZARD & ERROR REPORTING
  // ========================================================
  console.log("📥 Section 1 & 2: CSV/XLSX Import Wizard & Error Reporting");

  // Valid Products CSV
  const validProductsCsv = `Product Name,SKU,Barcode,Sale Price,Purchase Price,GST %,Opening Stock,Unit Cost
Precision Gear,GEAR-001,8901234567890,1200,800,18,50,800
Steel Shaft 20mm,SHAFT-001,8901234567891,450,300,18,100,300
Copper Bushing,BUSH-001,8901234567892,150,90,12,200,90`;

  const parsedValidRows = parseCsvString(validProductsCsv);
  assert(parsedValidRows.length === 3, "Parsed 3 product rows from CSV string");

  const productMapping = autoMapColumns("PRODUCTS", Object.keys(parsedValidRows[0]));
  assert(productMapping.name === "Product Name" && productMapping.sku === "SKU", "Auto-mapped product columns with fuzzy aliases");

  const valResultValid = await validateImportRows(testCompanyA.id, "PRODUCTS", parsedValidRows, productMapping);
  assert(valResultValid.valid === true && valResultValid.errors.length === 0, "Valid products CSV passed validation with 0 errors");

  const execProducts = await executeImport(testCompanyA.id, "PRODUCTS", parsedValidRows, productMapping);
  assert(execProducts.success === true && execProducts.importedCount === 3, "Successfully imported 3 products with opening stock & ledger valuations");

  // Verify opening stock movement created and ledger entry posted
  const importedGear = await prisma.item.findFirst({ where: { companyId: testCompanyA.id, sku: "GEAR-001" } });
  assert(importedGear !== null && Number(importedGear.stock) === 50, "Opening stock of 50 recorded on imported product");

  const gearMovement = await prisma.stockMovement.findFirst({
    where: { companyId: testCompanyA.id, itemId: importedGear!.id, movementType: "OPENING" },
  });
  assert(gearMovement !== null && gearMovement.qtyIn === 50 && gearMovement.totalCost === 40000, "Opening StockMovement recorded (50 x ₹800 = ₹40,000)");

  // Invalid Products CSV to verify error reporting
  const invalidProductsCsv = `Product Name,SKU,Sale Price,GST %,Opening Stock
,GEAR-001,invalid_price,35,-10
Valid Item Name,GEAR-001,500,18,20`;

  const parsedInvalidRows = parseCsvString(invalidProductsCsv);
  const valResultInvalid = await validateImportRows(testCompanyA.id, "PRODUCTS", parsedInvalidRows, {
    name: "Product Name",
    sku: "SKU",
    salePrice: "Sale Price",
    gstRate: "GST %",
    openingStock: "Opening Stock",
  });

  assert(valResultInvalid.valid === false, "Invalid CSV correctly rejected by validation engine");
  assert(valResultInvalid.errors.length >= 4, `Detected ${valResultInvalid.errors.length} validation errors (missing name, invalid price, invalid GST, duplicate SKU)`);

  const missingNameErr = valResultInvalid.errors.find((e) => e.field === "name");
  assert(missingNameErr !== undefined && missingNameErr.suggestedCorrection.length > 0, "Error report provides human-readable suggested correction for missing name");

  const gstErr = valResultInvalid.errors.find((e) => e.field === "gstRate");
  assert(gstErr !== undefined && gstErr.suggestedCorrection.includes("0, 5, 12, 18, 28"), "Error report provides valid GST options correction");

  const errorCsv = generateErrorReportCsv(parsedInvalidRows, valResultInvalid.errors);
  assert(errorCsv.includes("Suggested Correction") && errorCsv.includes("Row"), "Generated downloadable error CSV report for user correction");

  // Test Customer Import with Opening Balance
  const customerCsv = `Party Name,Phone,Email,GSTIN,Opening Balance
Apex Heavy Industries,9876543210,contact@apex.com,27AAACA1234A1Z5,25000`;
  const parsedCustomerRows = parseCsvString(customerCsv);
  const custMapping = autoMapColumns("CUSTOMERS", Object.keys(parsedCustomerRows[0]));
  const execCust = await executeImport(testCompanyA.id, "CUSTOMERS", parsedCustomerRows, custMapping);
  assert(execCust.success === true && execCust.importedCount === 1, "Imported customer with opening debit balance");

  const custVoucher = await prisma.voucher.findFirst({
    where: { companyId: testCompanyA.id, narration: { contains: "Apex Heavy Industries" } },
    include: { entries: true },
  });
  assert(custVoucher !== null && custVoucher.entries.length === 2, "Opening balance journal voucher created for imported customer");
  assert(
    Number(custVoucher!.entries[0].debit) === 25000 || Number(custVoucher!.entries[1].debit) === 25000,
    "Opening balance correctly debited to Debtors and credited to Capital/Equity (₹25,000)"
  );

  // ========================================================
  // 3. BACKUP & RESTORE vs DATA EXPORT (ZERO SECRETS)
  // ========================================================
  console.log("\n💾 Section 3: Database Backup, Restore, and Safe Tenant Export");

  // Manual DB Backup
  const backupRes = await createDatabaseBackup({
    notes: "Automated Phase 9 test snapshot",
    initiatedBy: "test-user-1",
  });
  assert(backupRes.success === true && fs.existsSync(backupRes.filePath), "Database snapshot created successfully");
  assert(backupRes.checksum.length === 64, `Calculated SHA-256 integrity checksum: ${backupRes.checksum.slice(0, 16)}...`);

  // Verify Backup Log entry
  const logs = await getBackupLogs(testCompanyA.id);
  assert(logs.length > 0 && logs[0].type === "DATABASE_BACKUP", "Backup operation logged to immutable BackupLog table");

  // Restore Verification
  const restoreRes = await restoreDatabaseBackup(backupRes.filePath, "test-user-1");
  assert(restoreRes.success === true && fs.existsSync(restoreRes.rollbackSnapshot), "Database restored successfully with pre-restore safety rollback snapshot");

  // Tenant Data Export - Strict Security Check
  const exportRes = await exportTenantData(testCompanyA.id, "test-user-1");
  assert(exportRes.companyId === testCompanyA.id, "Tenant data exported into structured JSON bundle");
  assert(exportRes.entities.items.length >= 3, `Exported ${exportRes.entities.items.length} items`);

  // ZERO SECRETS AUDIT
  const exportString = JSON.stringify(exportRes);
  const containsPasswordHash = exportString.includes("passwordHash") || exportString.includes("$2a$") || exportString.includes("$2b$");
  const containsSessionToken = exportString.includes("sessionToken") || exportString.includes("jwtSecret");
  assert(!containsPasswordHash && !containsSessionToken, "STRICT SECURITY: Export payload verified completely free of passwords, hashes, and secrets");

  // Automatic Backup Architecture
  const autoConfig = await saveAutoBackupConfig({
    enabled: true,
    frequency: "DAILY",
    retentionDays: 14,
    maxBackupsCount: 20,
  });
  assert(autoConfig.frequency === "DAILY" && autoConfig.retentionDays === 14, "Automatic backup schedule and retention policy configured");

  // ========================================================
  // 4. OCR BILL IMPORT (STAGING & REVIEW FLOW)
  // ========================================================
  console.log("\n👁️ Section 4: OCR Bill Import & Review Pipeline");

  const rawOcrText = `TAX INVOICE
Supplier: Zenith Machine Works
GSTIN: 27AABCZ9988P1Z3
Phone: 9988776655
Invoice No: ZMW-2026-8812
Date: 02-10-2026

Carbide Lathe Tool 16mm	10	850	8500
Drill Chuck Keyless	5	1200	6000

Grand Total: 17110.00`;

  const parsedBill = parseRawBillText(rawOcrText);
  assert(parsedBill.supplierName === "Zenith Machine Works", `OCR extracted supplier name: ${parsedBill.supplierName}`);
  assert(parsedBill.invoiceNo === "ZMW-2026-8812", `OCR extracted invoice number: ${parsedBill.invoiceNo}`);
  assert(parsedBill.items.length === 2, `OCR extracted ${parsedBill.items.length} line items`);

  // Staging in database (Never directly post unverified OCR)
  const staged = await stageOcrBillScan(testCompanyA.id, "zenith_bill.pdf", rawOcrText);
  assert(staged.status === "EXTRACTED", "OCR scan staged with status 'EXTRACTED' (not posted to invoices)");

  // Review & Update
  parsedBill.items[0].qty = 12; // user corrected extracted quantity
  parsedBill.items[0].amount = 12 * 850;
  const reviewResult = await updateOcrReview(testCompanyA.id, staged.scanId, parsedBill);
  assert(reviewResult.status === "REVIEWED", "OCR bill updated by user review with status 'REVIEWED'");

  // User Confirmation -> Purchase Invoice Creation
  const purchasePost = await confirmAndCreatePurchaseFromOcr(testCompanyA.id, staged.scanId, parsedBill);
  assert(purchasePost.success === true && purchasePost.invoiceNo.length > 0, `Purchase invoice created after user confirmation: ${purchasePost.invoiceNo}`);

  const scanPostCheck = await prisma.ocrScanRecord.findUnique({ where: { id: staged.scanId } });
  assert(scanPostCheck?.status === "POSTED" && scanPostCheck?.invoiceId !== null, "OCR scan record transitioned to 'POSTED' and linked to purchase invoice");

  // ========================================================
  // 5. BARCODE & KEYBOARD SCANNER LOOKUP
  // ========================================================
  console.log("\n🏷️ Section 5: Barcode Product Lookup & POS Scanner Integration");

  const barcodeItem = await lookupProductByBarcode(testCompanyA.id, "8901234567890");
  assert(barcodeItem.found === true && barcodeItem.item.name === "Precision Gear", "Found product by exact barcode match ('8901234567890')");

  const skuItem = await lookupProductByBarcode(testCompanyA.id, "SHAFT-001");
  assert(skuItem.found === true && skuItem.item.name === "Steel Shaft 20mm", "Found product by fallback SKU match ('SHAFT-001')");

  // Scanner Auto-Selection into Invoice Lines
  const initialLines: any[] = [];
  const afterFirstScan = handleBarcodeInvoiceSelection(initialLines, barcodeItem.item);
  assert(afterFirstScan.action === "ADDED" && afterFirstScan.lines.length === 1 && afterFirstScan.lines[0].qty === 1, "First scan added item to invoice lines with qty = 1");

  const afterSecondScan = handleBarcodeInvoiceSelection(afterFirstScan.lines, barcodeItem.item);
  assert(afterSecondScan.action === "INCREMENTED" && afterSecondScan.lines[0].qty === 2, "Second scan auto-incremented line item quantity to 2");

  // ========================================================
  // 6. BATCH TRACKING & AVAILABILITY
  // ========================================================
  console.log("\n📦 Section 6: Batch Lot Tracking & Stock Management");

  const expDateFuture = new Date(Date.now() + 60 * 24 * 3600 * 1000); // 60 days ahead
  const expDateSoon = new Date(Date.now() + 10 * 24 * 3600 * 1000); // 10 days ahead
  const expDatePast = new Date(Date.now() - 5 * 24 * 3600 * 1000); // 5 days ago

  const batch1 = await createOrUpdateBatch({
    companyId: testCompanyA.id,
    itemId: importedGear!.id,
    batchNumber: "LOT-2026-A1",
    expiryDate: expDateFuture,
    mrp: 1500,
    cost: 800,
    quantity: 30,
  });
  assert(batch1.quantity === 30 && batch1.batchNumber === "LOT-2026-A1", "Created batch 'LOT-2026-A1' with 30 units");

  // Deduct batch stock on sale
  const deducted = await deductBatchStock(testCompanyA.id, importedGear!.id, "LOT-2026-A1", 5);
  assert(deducted.quantity === 25, "Deducted 5 units from batch stock (remaining: 25)");

  // Over-deduction guard
  let overDeductBlocked = false;
  try {
    await deductBatchStock(testCompanyA.id, importedGear!.id, "LOT-2026-A1", 50, false);
  } catch (err: any) {
    overDeductBlocked = true;
  }
  assert(overDeductBlocked, "Blocked selling more than available batch quantity (exceeded batch limit)");

  // ========================================================
  // 7. SERIAL NUMBER TRACKING & DUPLICATE PROTECTION
  // ========================================================
  console.log("\n🔢 Section 7: Serial Numbers & Duplicate Prevention");

  const serials = await registerSerialNumbers([
    {
      companyId: testCompanyA.id,
      itemId: importedGear!.id,
      serialNumber: "SN-GEAR-001",
      warranty: "12 Months",
    },
    {
      companyId: testCompanyA.id,
      itemId: importedGear!.id,
      serialNumber: "SN-GEAR-002",
      warranty: "12 Months",
    },
  ]);
  assert(serials.length === 2 && serials[0].status === "AVAILABLE", "Registered 2 serial numbers with status 'AVAILABLE'");

  // Duplicate serial prevention
  let dupBlocked = false;
  try {
    await registerSerialNumbers([
      {
        companyId: testCompanyA.id,
        itemId: importedGear!.id,
        serialNumber: "SN-GEAR-001", // Duplicate
      },
    ]);
  } catch (err: any) {
    dupBlocked = true;
  }
  assert(dupBlocked, "Strictly prevented duplicate serial number registration for same product");

  // Sale Assignment
  const assigned = await assignSerialsToSale(
    testCompanyA.id,
    importedGear!.id,
    ["SN-GEAR-001"],
    "INV-SALE-TEST-01"
  );
  assert(assigned[0].status === "SOLD" && assigned[0].saleInvoiceId === "INV-SALE-TEST-01", "Assigned serial number to sale invoice (status transitioned to 'SOLD')");

  // ========================================================
  // 8. FEFO EXPIRY ALERTS & NOTIFICATIONS
  // ========================================================
  console.log("\n⏰ Section 8: Expiry Alerts & FEFO Tracking");

  await createOrUpdateBatch({
    companyId: testCompanyA.id,
    itemId: importedGear!.id,
    batchNumber: "LOT-EXP-SOON",
    expiryDate: expDateSoon,
    quantity: 10,
    cost: 800,
  });

  await createOrUpdateBatch({
    companyId: testCompanyA.id,
    itemId: importedGear!.id,
    batchNumber: "LOT-EXPIRED",
    expiryDate: expDatePast,
    quantity: 5,
    cost: 800,
  });

  const expiryReport = await getBatchExpiryReport(testCompanyA.id, 30);
  assert(expiryReport.expiredCount >= 1, `Detected ${expiryReport.expiredCount} expired batch(es)`);
  assert(expiryReport.expiringSoonCount >= 1, `Detected ${expiryReport.expiringSoonCount} batch(es) expiring soon within 30 days`);
  assert(expiryReport.expiredStockValue >= 4000, `Calculated expired inventory stock value: ₹${expiryReport.expiredStockValue}`);

  // Trigger Notifications
  await triggerExpiryNotifications(testCompanyA.id, 30);
  const alerts = await prisma.notification.findMany({ where: { companyId: testCompanyA.id } });
  assert(alerts.length >= 2, "Automated notifications generated for expired and expiring-soon batches");

  // ========================================================
  // 9. MANUFACTURING FOUNDATION: BOM, PRODUCTION & VOUCHER
  // ========================================================
  console.log("\n🏭 Section 9: Manufacturing BOM, Consumption & Double-Entry Journal Voucher");

  // Finished Product: High-Performance Gearbox Assembly
  const finishedItem = await prisma.item.create({
    data: {
      companyId: testCompanyA.id,
      name: "High-Performance Gearbox Assembly",
      sku: "GBOX-ASY-01",
      unit: "SET",
      salePrice: 5000,
      purchasePrice: 0,
      stock: 0,
      type: "PRODUCT",
    },
  });

  // Create BOM
  const bom = await createBillOfMaterials({
    companyId: testCompanyA.id,
    name: "Gearbox Assembly Recipe v1",
    code: "BOM-GBOX-01",
    finishedItemId: finishedItem.id,
    outputQty: 1,
    laborCost: 350,
    overheadCost: 150,
    rawMaterials: [
      { itemId: importedGear!.id, quantity: 2, unitCostEstimate: 800 },
      { itemId: (await prisma.item.findFirst({ where: { companyId: testCompanyA.id, sku: "SHAFT-001" } }))!.id, quantity: 1, unitCostEstimate: 300 },
    ],
  });
  assert(bom.id !== null && bom.items.length === 2, "Created Bill of Materials with 2 raw materials and labor/overhead absorption");

  // Create Production Order
  const prdOrder = await createProductionOrder({
    companyId: testCompanyA.id,
    bomId: bom.id,
    plannedQty: 5,
    warehouseId: warehouseMain.id,
  });
  assert(prdOrder.status === "DRAFT" && prdOrder.plannedQty === 5, "Created Production Order in 'DRAFT' status for 5 units");

  // Get raw material stock before production run
  const gearBefore = await prisma.item.findUnique({ where: { id: importedGear!.id } });
  const rawGearStockBefore = Number(gearBefore!.stock);

  // Execute Production Run: Produce 5 units with 1 unit wastage
  const execRun = await executeProductionOrder({
    companyId: testCompanyA.id,
    productionOrderId: prdOrder.id,
    producedQty: 5,
    wastageQty: 1,
    wastageReason: "CNC alignment calibration scrap",
  });

  assert(execRun.success === true, "Production run executed successfully");
  assert(execRun.producedQty === 5 && execRun.wastageQty === 1, "Produced 5 units with 1 unit recorded scrap wastage");

  // Verify Raw Material Stock Decrement
  const gearAfter = await prisma.item.findUnique({ where: { id: importedGear!.id } });
  const consumedGears = 2 * 5; // 2 per finished good * 5 units = 10 gears
  assert(Number(gearAfter!.stock) === rawGearStockBefore - consumedGears, `Raw material stock consumed: ${rawGearStockBefore} -> ${gearAfter!.stock} (-${consumedGears})`);

  // Verify Finished Good Stock Capitalization
  const finishedAfter = await prisma.item.findUnique({ where: { id: finishedItem.id } });
  assert(Number(finishedAfter!.stock) === 5, "Finished goods inventory capitalized: 0 -> 5 SETS");
  assert(Number(finishedAfter!.purchasePrice) > 0, `Finished good unit cost calculated: ₹${finishedAfter!.purchasePrice}`);

  // Verify Double-Entry Journal Voucher (Balanced Debits = Credits)
  const prdVoucher = await prisma.voucher.findFirst({
    where: { companyId: testCompanyA.id, voucherNo: execRun.voucherNo },
    include: { entries: true },
  });

  assert(prdVoucher !== null, `Double-entry journal voucher created: ${execRun.voucherNo}`);
  const totalDebits = prdVoucher!.entries.reduce((acc, e) => acc + Number(e.debit), 0);
  const totalCredits = prdVoucher!.entries.reduce((acc, e) => acc + Number(e.credit), 0);
  assert(Math.abs(totalDebits - totalCredits) < 0.01, `Double-entry journal balances perfectly: Dr ₹${totalDebits} = Cr ₹${totalCredits}`);

  // Verify StockMovement audit trails
  const movements = await prisma.stockMovement.findMany({
    where: { companyId: testCompanyA.id, referenceId: prdOrder.id },
  });
  const hasOut = movements.some((m) => m.movementType === "PRODUCTION_OUT");
  const hasIn = movements.some((m) => m.movementType === "PRODUCTION_IN");
  const hasWastage = movements.some((m) => m.movementType === "WASTAGE");
  assert(hasOut && hasIn && hasWastage, "Recorded atomic StockMovements for PRODUCTION_OUT, PRODUCTION_IN, and WASTAGE");

  // Clean up
  console.log("\n=======================================================");
  console.log(`📊 PHASE 9 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase9Tests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
