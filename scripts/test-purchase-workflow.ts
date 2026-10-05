import { prisma } from "../src/lib/prisma";
import {
  createPurchaseOrder,
  createGoodsReceipt,
  convertGoodsReceiptToPurchaseInvoice,
} from "../src/lib/workflow";
import { createInvoice } from "../src/lib/invoice";
import { getDefaultWarehouse } from "../src/lib/inventory";

async function main() {
  console.log("=================================================");
  console.log("TESTING END-TO-END PROCUREMENT PIPELINE");
  console.log("Purchase Order -> Goods Receipt (GRN) -> Purchase Bill");
  console.log("=================================================");

  const company = await prisma.company.findFirst({
    include: { warehouses: true },
  });
  if (!company) throw new Error("No company found");

  console.log(`Active Company: ${company.name} (${company.id})`);
  const warehouse = company.warehouses[0] || (await getDefaultWarehouse(company.id));

  // Find or create test supplier
  let vendor = await prisma.party.findFirst({
    where: { companyId: company.id, type: { in: ["VENDOR", "BOTH"] } },
  });
  if (!vendor) {
    vendor = await prisma.party.create({
      data: {
        companyId: company.id,
        name: "Test Vendor Supplies Ltd",
        type: "VENDOR",
        state: "Gujarat",
      },
    });
  }
  console.log(`Active Supplier: ${vendor.name} (${vendor.id})`);

  // Create test item
  const testItemName = `Procurement Test Item ${Date.now()}`;
  const item = await prisma.item.create({
    data: {
      companyId: company.id,
      name: testItemName,
      unit: "KG",
      salePrice: 500,
      purchasePrice: 300,
      gstRate: 18,
    },
  });

  const getStock = async () => {
    const movements = await prisma.stockMovement.findMany({
      where: { companyId: company.id, itemId: item.id },
    });
    return movements.reduce((acc, m) => acc + Number(m.qtyIn) - Number(m.qtyOut), 0);
  };

  const initialStock = await getStock();
  console.log(`Initial Stock of "${testItemName}": ${initialStock} KG (Should be 0)`);
  if (initialStock !== 0) throw new Error("Expected initial stock to be 0");

  // -------------------------------------------------------------
  // TEST STEP 1: CREATE PURCHASE ORDER
  // -------------------------------------------------------------
  console.log("\n--- STEP 1: CREATE PURCHASE ORDER ---");
  const po = await createPurchaseOrder({
    companyId: company.id,
    partyId: vendor.id,
    warehouseId: warehouse.id,
    date: new Date(),
    items: [
      {
        itemId: item.id,
        name: item.name,
        qty: 50,
        rate: 300,
        gstRate: 18,
      },
    ],
    notes: "Raw material bulk procurement",
    status: "CONFIRMED",
    createdBy: "test@taily.in",
  });

  console.log(`✓ Purchase Order Issued: ${po.poNo} (Grand Total: ₹${po.grandTotal})`);
  const stockAfterPO = await getStock();
  console.log(`Stock after PO: ${stockAfterPO} KG (Must be unchanged at 0 KG)`);
  if (stockAfterPO !== 0) throw new Error("Stock should NOT change when issuing a PO!");

  // -------------------------------------------------------------
  // TEST STEP 2: INWARD GOODS RECEIPT NOTE (GRN)
  // -------------------------------------------------------------
  console.log("\n--- STEP 2: INWARD GOODS RECEIPT (GRN) ---");
  const poWithLines = await prisma.purchaseOrder.findUnique({
    where: { id: po.id },
    include: { lines: true },
  });
  const poLine = poWithLines!.lines[0];

  const grn = await createGoodsReceipt({
    companyId: company.id,
    purchaseOrderId: po.id,
    partyId: vendor.id,
    warehouseId: warehouse.id,
    date: new Date(),
    receiveNow: true,
    createdBy: "test@taily.in",
    lines: [
      {
        purchaseOrderLineId: poLine.id,
        itemId: item.id,
        name: item.name,
        orderedQty: 50,
        receivedQty: 50,
        rate: 300,
      },
    ],
  });

  console.log(`✓ Goods Receipt Note Created: ${grn.grnNo} (Status: ${grn.status})`);
  const stockAfterGRN = await getStock();
  console.log(`Stock after GRN: ${stockAfterGRN} KG (Must be 50 KG inwarded)`);
  if (stockAfterGRN !== 50) throw new Error(`Stock should be 50, got ${stockAfterGRN}`);

  const refreshedPO = await prisma.purchaseOrder.findUnique({
    where: { id: po.id },
    include: { lines: true },
  });
  console.log(`✓ PO Status: ${refreshedPO?.status} (Received: ${refreshedPO?.lines[0].receivedQty}/50)`);
  if (refreshedPO?.status !== "RECEIVED") throw new Error("PO status should be RECEIVED!");

  // -------------------------------------------------------------
  // TEST STEP 3: CONVERT GRN TO PURCHASE BILL
  // -------------------------------------------------------------
  console.log("\n--- STEP 3: CONVERT GRN TO PURCHASE BILL ---");
  const purchaseBill = await convertGoodsReceiptToPurchaseInvoice(grn.id, company.id, {
    createdBy: "test@taily.in",
  });

  console.log(`✓ Purchase Bill Created: ${purchaseBill.invoiceNo} (Grand Total: ₹${purchaseBill.grandTotal})`);
  console.log(`✓ Bill skipStockMovement flag: ${purchaseBill.skipStockMovement}`);

  const stockAfterBill = await getStock();
  console.log(`Stock after Purchase Bill: ${stockAfterBill} KG (Must still be 50 KG, NO DOUBLE ADDITION)`);
  if (stockAfterBill !== 50) {
    throw new Error(`CRITICAL BUG: Stock added twice! Expected 50, got ${stockAfterBill}`);
  }

  const refreshedGRN = await prisma.goodsReceipt.findUnique({ where: { id: grn.id } });
  console.log(`✓ GRN Linked Bill: ${refreshedGRN?.invoiceId}`);
  if (!refreshedGRN?.invoiceId) throw new Error("GRN should be linked to Purchase Bill!");

  console.log("\n=================================================");
  console.log("ALL PROCUREMENT TESTS PASSED WITH 100% ACCURACY!");
  console.log("Zero double stock additions, full GRN & PO linkages confirmed.");
  console.log("=================================================");
}

main()
  .catch((e) => {
    console.error("Test failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
