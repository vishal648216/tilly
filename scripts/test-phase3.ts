/**
 * TAILY PHASE 3: TRANSACTION-BASED INVENTORY ENGINE TEST SUITE
 * 
 * Tests the complete lifecycle specified in user prompt:
 * 1. Opening: 100
 * 2. Purchase: +50 (with Weighted Average Cost recalculation)
 * 3. Sale: -20
 * 4. Sales Return: +5
 * 5. Purchase Return: -3
 * 6. Stock Adjustment: -2
 * 7. Stock Transfer: 10 from Warehouse A to Warehouse B
 * 8. Verify final balances (Overall = 130, WH-A = 120, WH-B = 10)
 * 9. Test warehouse isolation
 * 10. Test insufficient stock rejection (Negative Stock rule)
 * 11. Test Stock Ledger audit trail & running balance integrity
 */

import { prisma } from "../src/lib/prisma";
import {
  recordStockMovement,
  getAvailableStock,
  transferStock,
  adjustStock,
  getStockLedger,
} from "../src/lib/inventory";
import { createInvoice } from "../src/lib/invoice";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error("     Details:", details);
    failedCount++;
  }
}

async function runPhase3Tests() {
  console.log("\n=======================================================");
  console.log("📦  TAILY PHASE 3: TRANSACTION-BASED INVENTORY ENGINE");
  console.log("=======================================================\n");

  const runId = Math.floor(1000 + Math.random() * 9000);
  const companyName = `Phase3 Logistics Hub ${runId}`;

  // 1. Setup Company with Inventory and Multi-Warehouse Enabled
  const company = await prisma.company.create({
    data: {
      name: companyName,
      legalName: `${companyName} Pvt Ltd`,
      businessType: "Distributor",
      currency: "INR",
      settings: {
        create: {
          inventoryEnabled: true,
          warehouseEnabled: true,
          multiWarehouseEnabled: true,
          negativeStockAllowed: false, // Strict negative stock guard
        },
      },
    },
    include: { settings: true },
  });

  console.log(`--- SETUP: Created Test Company '${company.name}' ---`);

  // 2. Setup Warehouses
  const warehouseA = await prisma.warehouse.create({
    data: {
      companyId: company.id,
      name: "Ahmedabad Central Godown",
      code: "WH-AHD",
      isDefault: true,
      active: true,
    },
  });

  const warehouseB = await prisma.warehouse.create({
    data: {
      companyId: company.id,
      name: "Surat Regional Hub",
      code: "WH-SURAT",
      isDefault: false,
      active: true,
    },
  });

  assert(warehouseA.isDefault === true, "Warehouse A created as Default Godown");
  assert(warehouseB.isDefault === false, "Warehouse B created as Secondary Godown");

  // 3. Create Item
  const item = await prisma.item.create({
    data: {
      companyId: company.id,
      name: `Industrial Pump P-${runId}`,
      sku: `SKU-PUMP-${runId}`,
      barcode: `BC${runId}889`,
      unit: "PCS",
      type: "PRODUCT",
      purchasePrice: 200,
      salePrice: 350,
      stock: 0,
    },
  });

  assert(Number(item.stock) === 0, "Item initialized with 0 stock");

  // ==========================================================
  // TRANSACTION STEP 1: OPENING STOCK = 100 @ ₹200
  // ==========================================================
  console.log("\n--- STEP 1: Opening Stock (100 units @ ₹200) ---");
  const openingMv = await recordStockMovement({
    companyId: company.id,
    warehouseId: warehouseA.id,
    itemId: item.id,
    movementType: "OPENING",
    referenceType: "MANUAL",
    referenceId: "OPENING-INIT",
    qtyIn: 100,
    qtyOut: 0,
    unitCost: 200,
    notes: "Initial inventory takeover",
    allowNegative: true,
  });

  assert(openingMv !== null, "Opening movement created successfully");

  const stockAfterOpeningA = await getAvailableStock({
    companyId: company.id,
    warehouseId: warehouseA.id,
    itemId: item.id,
  });
  const stockAfterOpeningTotal = await getAvailableStock({
    companyId: company.id,
    itemId: item.id,
  });
  const itemAfterOpening = await prisma.item.findUnique({ where: { id: item.id } });

  assert(stockAfterOpeningA === 100, "Warehouse A available stock is 100", { got: stockAfterOpeningA });
  assert(stockAfterOpeningTotal === 100, "Aggregate company stock is 100", { got: stockAfterOpeningTotal });
  assert(Number(itemAfterOpening?.purchasePrice) === 200, "Weighted average cost after opening is ₹200");

  // ==========================================================
  // TRANSACTION STEP 2: PURCHASE BILL = +50 @ ₹260
  // ==========================================================
  console.log("\n--- STEP 2: Purchase Bill (+50 units @ ₹260) ---");
  // Expected WAC: (100 * 200 + 50 * 260) / 150 = (20000 + 13000) / 150 = 33000 / 150 = 220
  await createInvoice({
    companyId: company.id,
    type: "PURCHASE",
    warehouseId: warehouseA.id,
    date: new Date(),
    isInterState: false,
    lines: [
      {
        itemId: item.id,
        name: item.name,
        qty: 50,
        rate: 260,
        gstRate: 18,
      },
    ],
  });

  const stockAfterPurchaseA = await getAvailableStock({
    companyId: company.id,
    warehouseId: warehouseA.id,
    itemId: item.id,
  });
  const itemAfterPurchase = await prisma.item.findUnique({ where: { id: item.id } });

  assert(stockAfterPurchaseA === 150, "Warehouse A available stock after purchase is 150 (100 + 50)", {
    got: stockAfterPurchaseA,
  });
  assert(
    Math.round(Number(itemAfterPurchase?.purchasePrice)) === 220,
    "Weighted Average Cost accurately computed to ₹220",
    { got: Number(itemAfterPurchase?.purchasePrice) }
  );

  // ==========================================================
  // TRANSACTION STEP 3: SALE INVOICE = -20
  // ==========================================================
  console.log("\n--- STEP 3: Sale Invoice (-20 units) ---");
  await createInvoice({
    companyId: company.id,
    type: "SALES",
    warehouseId: warehouseA.id,
    date: new Date(),
    isInterState: false,
    lines: [
      {
        itemId: item.id,
        name: item.name,
        qty: 20,
        rate: 350,
        gstRate: 18,
      },
    ],
  });

  const stockAfterSaleA = await getAvailableStock({
    companyId: company.id,
    warehouseId: warehouseA.id,
    itemId: item.id,
  });
  assert(stockAfterSaleA === 130, "Warehouse A stock after sale is 130 (150 - 20)", { got: stockAfterSaleA });

  // ==========================================================
  // TRANSACTION STEP 4: SALES RETURN = +5
  // ==========================================================
  console.log("\n--- STEP 4: Sales Return (+5 units) ---");
  await recordStockMovement({
    companyId: company.id,
    warehouseId: warehouseA.id,
    itemId: item.id,
    movementType: "SALE_RETURN",
    referenceType: "INVOICE",
    referenceId: "CN-RETURN-001",
    qtyIn: 5,
    qtyOut: 0,
    unitCost: 350,
    notes: "Customer returned 5 unused units",
    allowNegative: true,
  });

  const stockAfterSaleReturnA = await getAvailableStock({
    companyId: company.id,
    warehouseId: warehouseA.id,
    itemId: item.id,
  });
  assert(stockAfterSaleReturnA === 135, "Warehouse A stock after sales return is 135 (130 + 5)", {
    got: stockAfterSaleReturnA,
  });

  // ==========================================================
  // TRANSACTION STEP 5: PURCHASE RETURN = -3
  // ==========================================================
  console.log("\n--- STEP 5: Purchase Return (-3 units) ---");
  await recordStockMovement({
    companyId: company.id,
    warehouseId: warehouseA.id,
    itemId: item.id,
    movementType: "PURCHASE_RETURN",
    referenceType: "PURCHASE",
    referenceId: "DN-RETURN-001",
    qtyIn: 0,
    qtyOut: 3,
    unitCost: 260,
    notes: "Vendor return: 3 units defective",
    allowNegative: true,
  });

  const stockAfterPurchaseReturnA = await getAvailableStock({
    companyId: company.id,
    warehouseId: warehouseA.id,
    itemId: item.id,
  });
  assert(stockAfterPurchaseReturnA === 132, "Warehouse A stock after purchase return is 132 (135 - 3)", {
    got: stockAfterPurchaseReturnA,
  });

  // ==========================================================
  // TRANSACTION STEP 6: STOCK ADJUSTMENT = -2
  // ==========================================================
  console.log("\n--- STEP 6: Stock Adjustment (-2 units damage) ---");
  const adjResult = await adjustStock({
    companyId: company.id,
    warehouseId: warehouseA.id,
    itemId: item.id,
    quantity: 2,
    direction: "DECREASE",
    reason: "Damage",
    notes: "Water damage during heavy rain",
  });

  const stockAfterAdjA = await getAvailableStock({
    companyId: company.id,
    warehouseId: warehouseA.id,
    itemId: item.id,
  });
  assert(adjResult.movement?.movementType === "DAMAGE", "Adjustment logged with DAMAGE movementType");
  assert(stockAfterAdjA === 130, "Warehouse A stock after adjustment is 130 (132 - 2)", { got: stockAfterAdjA });

  // ==========================================================
  // TRANSACTION STEP 7: STOCK TRANSFER = 10 (WH-A -> WH-B)
  // ==========================================================
  console.log("\n--- STEP 7: Inter-Godown Stock Transfer (10 units WH-A -> WH-B) ---");
  const transferResult = await transferStock({
    companyId: company.id,
    fromWarehouseId: warehouseA.id,
    toWarehouseId: warehouseB.id,
    itemId: item.id,
    quantity: 10,
    notes: "Stock rebalancing for Surat depot",
  });

  assert(transferResult.transferRef.startsWith("TRF-"), "Generated standardized transfer reference");
  assert(transferResult.outMovement?.qtyOut === 10, "Outward transfer movement logged 10 units");
  assert(transferResult.inMovement?.qtyIn === 10, "Inward transfer movement logged 10 units");

  // ==========================================================
  // STEP 8: FINAL BALANCES & WAREHOUSE ISOLATION
  // ==========================================================
  console.log("\n--- STEP 8: Final Balances & Multi-Godown Isolation ---");
  const finalWhA = await getAvailableStock({
    companyId: company.id,
    warehouseId: warehouseA.id,
    itemId: item.id,
  });
  const finalWhB = await getAvailableStock({
    companyId: company.id,
    warehouseId: warehouseB.id,
    itemId: item.id,
  });
  const finalItem = await prisma.item.findUnique({ where: { id: item.id } });

  assert(finalWhA === 120, "Warehouse A final balance is exactly 120 (130 - 10)", { got: finalWhA });
  assert(finalWhB === 10, "Warehouse B final balance is exactly 10 (0 + 10)", { got: finalWhB });
  assert(Number(finalItem?.stock) === 130, "Company total stock agrees with sum (120 + 10 = 130)", {
    got: Number(finalItem?.stock),
  });

  // Verify Warehouse Isolation
  assert(finalWhA !== finalWhB, "Warehouse isolation confirmed: WH-A stock is distinct from WH-B stock");

  // ==========================================================
  // STEP 9: NEGATIVE STOCK ENFORCEMENT
  // ==========================================================
  console.log("\n--- STEP 9: Negative Stock Enforcement (Backend Guard) ---");
  let rejectedAsExpected = false;
  try {
    // Warehouse B only has 10 units. Attempt to sell 15 units from WH-B!
    await createInvoice({
      companyId: company.id,
      type: "SALES",
      warehouseId: warehouseB.id,
      date: new Date(),
      isInterState: false,
      lines: [
        {
          itemId: item.id,
          name: item.name,
          qty: 15,
          rate: 350,
          gstRate: 18,
        },
      ],
    });
  } catch (err: any) {
    rejectedAsExpected = true;
    assert(
      err.message.includes("Insufficient stock"),
      "Sale rejected with clear 'Insufficient stock' error message",
      err.message
    );
  }

  assert(rejectedAsExpected === true, "Negative stock was strictly blocked by backend service");

  // Verify WH-B stock remained at 10 after failed attempt
  const stockWhBAfterFailedSale = await getAvailableStock({
    companyId: company.id,
    warehouseId: warehouseB.id,
    itemId: item.id,
  });
  assert(stockWhBAfterFailedSale === 10, "Warehouse B balance remained intact at 10 after rejected sale");

  // ==========================================================
  // STEP 10: STOCK LEDGER AUDIT TRAIL
  // ==========================================================
  console.log("\n--- STEP 10: Stock Ledger Audit Trail Integrity ---");
  const ledger = await getStockLedger(company.id, { itemId: item.id });

  assert(ledger.length >= 7, "Stock ledger captured all 7 sequential transaction events", {
    count: ledger.length,
  });

  const finalLedgerRow = ledger[ledger.length - 1];
  assert(finalLedgerRow.balance === 130, "Ledger running balance accurately equals final stock of 130", {
    finalBalance: finalLedgerRow.balance,
  });

  // Verify Weighted Average Cost Preservation
  const purchaseMovements = ledger.filter((m) => m.movementType === "PURCHASE");
  assert(purchaseMovements.length > 0, "Purchase movement preserved in ledger history");
  assert(purchaseMovements[0].unitCost === 260, "Historical purchase unitCost preserved at ₹260");

  console.log("\n=======================================================");
  console.log(`🏁 PHASE 3 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase3Tests()
  .catch((err) => {
    console.error("Fatal test runner error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
