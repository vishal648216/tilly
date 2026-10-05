import { prisma } from "../src/lib/prisma";
import {
  createQuotation,
  convertQuotationToSalesOrder,
  createDeliveryChallan,
  convertDeliveryChallanToInvoice,
} from "../src/lib/workflow";
import { createInvoice } from "../src/lib/invoice";
import { recordStockMovement, getDefaultWarehouse } from "../src/lib/inventory";

async function main() {
  console.log("=================================================");
  console.log("TESTING END-TO-END SALES & BILLING PIPELINE");
  console.log("Quotation -> Sales Order -> Delivery Challan -> Sales Invoice");
  console.log("=================================================");

  // Find demo company
  const company = await prisma.company.findFirst({
    include: { warehouses: true },
  });
  if (!company) {
    throw new Error("No company found to test against");
  }
  console.log(`\nActive Company: ${company.name} (${company.id})`);

  // Warehouse
  const warehouse = company.warehouses[0] || (await getDefaultWarehouse(company.id));

  // Find or create test customer
  let party = await prisma.party.findFirst({
    where: { companyId: company.id, type: { in: ["CUSTOMER", "BOTH"] } },
  });
  if (!party) {
    party = await prisma.party.create({
      data: {
        companyId: company.id,
        name: "Test Customer Pvt Ltd",
        type: "CUSTOMER",
        state: "Maharashtra",
      },
    });
  }
  console.log(`Active Customer: ${party.name} (${party.id})`);

  // Find or create test item
  const testItemName = `Workflow Test Widget ${Date.now()}`;
  const item = await prisma.item.create({
    data: {
      companyId: company.id,
      name: testItemName,
      unit: "PCS",
      salePrice: 1000,
      purchasePrice: 600,
      gstRate: 18,
    },
  });

  // Initial stock: 100 units
  await recordStockMovement({
    companyId: company.id,
    itemId: item.id,
    warehouseId: warehouse.id,
    movementType: "OPENING",
    referenceType: "MANUAL",
    qtyIn: 100,
    qtyOut: 0,
    unitCost: 600,
    totalCost: 60000,
    date: new Date(),
    notes: "Opening test stock",
  });

  const getStock = async () => {
    const movements = await prisma.stockMovement.findMany({
      where: { companyId: company.id, itemId: item.id },
    });
    return movements.reduce((acc, m) => acc + Number(m.qtyIn) - Number(m.qtyOut), 0);
  };

  const initialStock = await getStock();
  console.log(`Initial Stock of "${testItemName}": ${initialStock} PCS`);
  if (initialStock !== 100) throw new Error("Stock initialization failed");

  // -------------------------------------------------------------
  // TEST STEP 1: CREATE QUOTATION
  // -------------------------------------------------------------
  console.log("\n--- STEP 1: CREATE QUOTATION ---");
  const quotation = await createQuotation({
    companyId: company.id,
    partyId: party.id,
    date: new Date(),
    items: [
      {
        itemId: item.id,
        name: item.name,
        qty: 10,
        rate: 1000,
        gstRate: 18,
      },
    ],
    notes: "Test quotation for 10 units",
    status: "DRAFT",
    createdBy: "test@taily.in",
  });

  console.log(`✓ Quotation Created: ${quotation.quotationNo} (Grand Total: ₹${quotation.grandTotal})`);
  const stockAfterQuote = await getStock();
  console.log(`Stock after Quotation: ${stockAfterQuote} PCS (Should be unchanged at 100)`);
  if (stockAfterQuote !== 100) throw new Error("Stock should NOT change when quotation is created!");

  // -------------------------------------------------------------
  // TEST STEP 2: CONVERT QUOTATION TO SALES ORDER
  // -------------------------------------------------------------
  console.log("\n--- STEP 2: CONVERT QUOTATION TO SALES ORDER ---");
  const salesOrder = await convertQuotationToSalesOrder(quotation.id, company.id, {
    warehouseId: warehouse.id,
    createdBy: "test@taily.in",
  });

  console.log(`✓ Sales Order Created: ${salesOrder.orderNo} (Status: ${salesOrder.status})`);
  const refreshedQuote = await prisma.quotation.findUnique({ where: { id: quotation.id } });
  console.log(`✓ Quotation Status: ${refreshedQuote?.status} (convertedToOrderId: ${refreshedQuote?.convertedToOrderId})`);
  if (refreshedQuote?.status !== "CONVERTED") throw new Error("Quotation status must be CONVERTED!");

  const stockAfterSO = await getStock();
  console.log(`Stock after Sales Order: ${stockAfterSO} PCS (Should be unchanged at 100)`);
  if (stockAfterSO !== 100) throw new Error("Stock should NOT change when sales order is created!");

  // -------------------------------------------------------------
  // TEST STEP 3: DISPATCH DELIVERY CHALLAN
  // -------------------------------------------------------------
  console.log("\n--- STEP 3: DISPATCH DELIVERY CHALLAN ---");
  const soWithLines = await prisma.salesOrder.findUnique({
    where: { id: salesOrder.id },
    include: { lines: true },
  });
  const soLine = soWithLines!.lines[0];

  const deliveryChallan = await createDeliveryChallan({
    companyId: company.id,
    salesOrderId: salesOrder.id,
    partyId: party.id,
    warehouseId: warehouse.id,
    date: new Date(),
    dispatchNow: true,
    createdBy: "test@taily.in",
    lines: [
      {
        salesOrderLineId: soLine.id,
        itemId: item.id,
        name: item.name,
        orderedQty: 10,
        deliveredQty: 10,
        rate: 1000,
      },
    ],
  });

  console.log(`✓ Delivery Challan Created: ${deliveryChallan.dcNo} (Status: ${deliveryChallan.status})`);
  const stockAfterDC = await getStock();
  console.log(`Stock after Delivery Challan: ${stockAfterDC} PCS (Must be 90 PCS)`);
  if (stockAfterDC !== 90) throw new Error(`Stock should be 90, got ${stockAfterDC}`);

  const refreshedSO = await prisma.salesOrder.findUnique({
    where: { id: salesOrder.id },
    include: { lines: true },
  });
  console.log(`✓ Sales Order Updated Status: ${refreshedSO?.status} (Delivered: ${refreshedSO?.lines[0].deliveredQty}/10)`);
  if (refreshedSO?.status !== "DELIVERED") throw new Error("SO status should be DELIVERED!");

  // -------------------------------------------------------------
  // TEST STEP 4: CONVERT DELIVERY CHALLAN TO TAX INVOICE
  // -------------------------------------------------------------
  console.log("\n--- STEP 4: CONVERT DELIVERY CHALLAN TO TAX INVOICE ---");
  const invoice = await convertDeliveryChallanToInvoice(deliveryChallan.id, company.id, {
    createdBy: "test@taily.in",
  });

  console.log(`✓ Sales Invoice Created: ${invoice.invoiceNo} (Grand Total: ₹${invoice.grandTotal})`);
  console.log(`✓ Invoice Linked DC: ${invoice.deliveryChallanId}, SO: ${invoice.salesOrderId}`);
  console.log(`✓ Invoice skipStockMovement flag: ${invoice.skipStockMovement}`);

  const stockAfterInv = await getStock();
  console.log(`Stock after Invoice: ${stockAfterInv} PCS (Must still be 90 PCS, NO DOUBLE DEDUCTION)`);
  if (stockAfterInv !== 90) {
    throw new Error(`CRITICAL BUG: Stock deducted twice! Expected 90, got ${stockAfterInv}`);
  }

  const refreshedDC = await prisma.deliveryChallan.findUnique({ where: { id: deliveryChallan.id } });
  console.log(`✓ Delivery Challan Status: ${refreshedDC?.status} (Linked Invoice: ${refreshedDC?.invoiceId})`);
  if (refreshedDC?.status !== "DELIVERED" || !refreshedDC?.invoiceId) {
    throw new Error("Challan should be marked DELIVERED and linked to invoice");
  }

  // -------------------------------------------------------------
  // TEST STEP 5: DIRECT QUOTATION TO INVOICE CONVERSION
  // -------------------------------------------------------------
  console.log("\n--- STEP 5: DIRECT 1-CLICK QUOTATION -> INVOICE TEST ---");
  const quoteDirect = await createQuotation({
    companyId: company.id,
    partyId: party.id,
    date: new Date(),
    items: [
      {
        itemId: item.id,
        name: item.name,
        qty: 5,
        rate: 1000,
        gstRate: 18,
      },
    ],
    status: "ACCEPTED",
    createdBy: "test@taily.in",
  });

  // Direct Invoice from Quotation (normal sales invoice which moves stock)
  const directInvoice = await createInvoice({
    companyId: company.id,
    type: "SALES",
    partyId: party.id,
    warehouseId: warehouse.id,
    date: new Date(),
    quotationId: quoteDirect.id,
    sourceDocType: "QUOTATION",
    sourceDocId: quoteDirect.id,
    lines: [
      {
        itemId: item.id,
        name: item.name,
        qty: 5,
        rate: 1000,
        gstRate: 18,
      },
    ],
    status: "POSTED",
    createdBy: "test@taily.in",
  });

  console.log(`✓ Direct Invoice from Quote Created: ${directInvoice.invoiceNo}`);
  const stockAfterDirect = await getStock();
  console.log(`Stock after Direct Invoice: ${stockAfterDirect} PCS (Expected 85 PCS)`);
  if (stockAfterDirect !== 85) {
    throw new Error(`Expected 85 stock after direct quote invoice, got ${stockAfterDirect}`);
  }

  console.log("\n=================================================");
  console.log("ALL TESTS PASSED WITH 100% ACCURACY & DATA INTEGRITY!");
  console.log("No double stock deductions, full document linkage confirmed.");
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
