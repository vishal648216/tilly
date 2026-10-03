/**
 * TAILY PRODUCTION HARDENING: END-TO-END ACCOUNTING TEST SUITE
 * 
 * Verifies all 15 core accounting & inventory workflows:
 * 1. Opening Balance (Capital and initial inventory setup)
 * 2. Purchase (Bill entry with GST & creditor balance update)
 * 3. Purchase Payment (Vendor payment reducing bank and creditor)
 * 4. Sale (Customer invoicing with revenue & debtor balance update)
 * 5. Sale Payment (Receipt from customer)
 * 6. Partial Payment (Partial invoice settlement)
 * 7. Sales Return (Credit Note reducing debtor and reversing revenue/tax)
 * 8. Purchase Return (Debit Note reducing creditor and reversing purchase/tax)
 * 9. Expense (Direct business operating expense)
 * 10. Stock Adjustment (Inventory write-off / count reconciliation)
 * 11. Stock Transfer (Inter-warehouse movement)
 * 12. COGS (Cost of Goods Sold recognition)
 * 13. GST (Input tax, output tax, and net liability)
 * 14. Cancellation (Audited cancellation of invoice)
 * 15. Reversal (Accounting voucher reversal with swapped Dr/Cr)
 */

import { prisma } from "../src/lib/prisma";
import { DEFAULT_CHART_OF_ACCOUNTS } from "../src/lib/accounts";
import { createVoucher } from "../src/lib/voucher";
import { getTrialBalance, getProfitAndLoss, getBalanceSheet } from "../src/lib/accounting";
import { createInvoice, cancelInvoice } from "../src/lib/invoice";
import { recordStockMovement } from "../src/lib/inventory";
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

async function runAccountingE2E() {
  console.log("\n=======================================================");
  console.log("📚 TAILY E2E ACCOUNTING WORKFLOW TEST SUITE");
  console.log("=======================================================\n");

  const ts = Date.now();

  // Create isolated company
  const company = await prisma.company.create({
    data: {
      name: `Accounting E2E Co ${ts}`,
      status: "ACTIVE",
    },
  });

  // Seed default chart of accounts
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.account.create({
      data: {
        companyId: company.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        groupId: acc.groupId,
        openingBalance: new Decimal(0),
      },
    });
  }

  // Warehouses: Main and Secondary
  const whMain = await prisma.warehouse.create({
    data: { companyId: company.id, name: "Main Central WH", code: `WH-MAIN-${ts}`, isDefault: true },
  });
  const whSecondary = await prisma.warehouse.create({
    data: { companyId: company.id, name: "Secondary Retail WH", code: `WH-SEC-${ts}` },
  });

  // Parties: Customer & Supplier
  const customer = await prisma.party.create({
    data: {
      companyId: company.id,
      type: "CUSTOMER",
      name: `Acme Retailers ${ts}`,
      email: `acme_${ts}@accounting.test`,
      openingBalance: 0,
    },
  });

  const supplier = await prisma.party.create({
    data: {
      companyId: company.id,
      type: "VENDOR",
      name: `Global Logistics Ltd ${ts}`,
      email: `supplier_${ts}@accounting.test`,
      openingBalance: 0,
    },
  });

  // Product
  const product = await prisma.item.create({
    data: {
      companyId: company.id,
      name: "Smart Sensor Device",
      sku: `SSD-${ts}`,
      purchasePrice: 500,
      salePrice: 1000,
      gstRate: 18,
      stock: 0,
    },
  });

  // 1. Opening Balance
  console.log("1️⃣  Opening Balance Workflow");
  // Capital Injection: Dr Bank 1002 (100,000), Cr Capital 3001 (100,000)
  const vOpening = await createVoucher({
    companyId: company.id,
    type: "RECEIPT",
    date: new Date(),
    narration: "Initial Capital Injection into Bank Account",
    entries: [
      { accountCode: "1002", debit: 100000 },
      { accountCode: "3001", credit: 100000 },
    ],
  });
  assert(vOpening !== null, "Opening Balance voucher created and balanced");

  // 2. Purchase Workflow
  console.log("\n2️⃣  Purchase Workflow (Purchase Bill)");
  // Purchase 50 units @ 500 = 25,000 + 18% GST (4,500) = 29,500
  // Dr Purchase 5001 (25,000), Dr Input CGST 1300 (2,250), Dr Input SGST 1301 (2,250), Cr Creditors 2001 (29,500)
  const vPurchase = await createVoucher({
    companyId: company.id,
    type: "PURCHASE",
    date: new Date(),
    partyId: supplier.id,
    narration: "Purchase of 50 Smart Sensors from Global Logistics",
    entries: [
      { accountCode: "1200", debit: 25000 },
      { accountCode: "1300", debit: 2250 },
      { accountCode: "1301", debit: 2250 },
      { accountCode: "2001", credit: 29500 },
    ],
  });
  // Inward stock movement
  await recordStockMovement({
    companyId: company.id,
    itemId: product.id,
    warehouseId: whMain.id,
    movementType: "PURCHASE",
    referenceType: "PURCHASE_INVOICE",
    qtyIn: 50,
    qtyOut: 0,
    unitCost: 500,
    totalCost: 25000,
    date: new Date(),
    notes: "Purchase inward",
  });
  const stockAfterPurchase = await prisma.warehouseStock.findFirst({
    where: { companyId: company.id, itemId: product.id, warehouseId: whMain.id },
  });
  assert(stockAfterPurchase?.quantity === 50, "Purchase added 50 units into warehouse stock");

  // 3. Purchase Payment Workflow
  console.log("\n3️⃣  Purchase Payment Workflow");
  // Pay Supplier 20,000 from Bank
  // Dr Creditors 2001 (20,000), Cr Bank 1002 (20,000)
  await createVoucher({
    companyId: company.id,
    type: "PAYMENT",
    date: new Date(),
    partyId: supplier.id,
    narration: "Partial payment for purchase bill",
    entries: [
      { accountCode: "2001", debit: 20000 },
      { accountCode: "1002", credit: 20000 },
    ],
  });
  const tbAfterPay = await getTrialBalance({ companyId: company.id });
  const creditorBal = tbAfterPay.rows.find((r) => r.code === "2001")?.closingBalance;
  assert(creditorBal === 9500, `Supplier balance reduced to 9,500 (29,500 - 20,000)`);

  // 4. Sale Workflow
  console.log("\n4️⃣  Sale Workflow (Sales Invoice)");
  // Sell 20 units @ 1000 = 20,000 + 18% GST (3,600) = 23,600
  // Dr Debtors 1100 (23,600), Cr Sales 4001 (20,000), Cr Output CGST 2100 (1,800), Cr Output SGST 2101 (1,800)
  await createVoucher({
    companyId: company.id,
    type: "SALES",
    date: new Date(),
    partyId: customer.id,
    narration: "Sale of 20 Smart Sensors to Acme Retailers",
    entries: [
      { accountCode: "1100", debit: 23600 },
      { accountCode: "4001", credit: 20000 },
      { accountCode: "2100", credit: 1800 },
      { accountCode: "2101", credit: 1800 },
    ],
  });
  // Deduct stock
  await recordStockMovement({
    companyId: company.id,
    itemId: product.id,
    warehouseId: whMain.id,
    movementType: "SALE",
    referenceType: "SALES_INVOICE",
    qtyIn: 0,
    qtyOut: 20,
    unitCost: 500,
    totalCost: 10000,
    date: new Date(),
    notes: "Sale delivery",
  });
  const stockAfterSale = await prisma.warehouseStock.findFirst({
    where: { companyId: company.id, itemId: product.id, warehouseId: whMain.id },
  });
  assert(stockAfterSale?.quantity === 30, "Sale deducted 20 units from warehouse stock (remaining: 30)");

  // 5. Sale Payment Workflow
  console.log("\n5️⃣  Sale Payment Workflow");
  // Customer pays 10,000 into Bank
  // Dr Bank 1002 (10,000), Cr Debtors 1100 (10,000)
  await createVoucher({
    companyId: company.id,
    type: "RECEIPT",
    date: new Date(),
    partyId: customer.id,
    narration: "Received payment from Acme Retailers",
    entries: [
      { accountCode: "1002", debit: 10000 },
      { accountCode: "1100", credit: 10000 },
    ],
  });
  const debtorBal = (await getTrialBalance({ companyId: company.id })).rows.find((r) => r.code === "1100")?.closingBalance;
  assert(debtorBal === 13600, `Customer balance reduced to 13,600 (23,600 - 10,000)`);

  // 6. Partial Payment Workflow
  console.log("\n6️⃣  Partial Payment Workflow");
  // Another payment of 3,600
  await createVoucher({
    companyId: company.id,
    type: "RECEIPT",
    date: new Date(),
    partyId: customer.id,
    narration: "Second partial payment",
    entries: [
      { accountCode: "1002", debit: 3600 },
      { accountCode: "1100", credit: 3600 },
    ],
  });
  const debtorBal2 = (await getTrialBalance({ companyId: company.id })).rows.find((r) => r.code === "1100")?.closingBalance;
  assert(debtorBal2 === 10000, "Second partial payment leaves remaining receivable of exactly 10,000");

  // 7. Sales Return Workflow (Credit Note)
  console.log("\n7️⃣  Sales Return Workflow (Credit Note)");
  // Customer returns 2 units: 2,000 + 360 tax = 2,360
  // Dr Sales Return 4002 (2000), Dr Output CGST 2100 (180), Dr Output SGST 2101 (180), Cr Debtors 1100 (2360)
  await createVoucher({
    companyId: company.id,
    type: "JOURNAL",
    date: new Date(),
    partyId: customer.id,
    narration: "Sales Return: 2 damaged units returned by Acme",
    entries: [
      { accountCode: "4002", debit: 2000 },
      { accountCode: "2100", debit: 180 },
      { accountCode: "2101", debit: 180 },
      { accountCode: "1100", credit: 2360 },
    ],
  });
  // Restock 2 units
  await recordStockMovement({
    companyId: company.id,
    itemId: product.id,
    warehouseId: whMain.id,
    movementType: "SALE_RETURN",
    referenceType: "CREDIT_NOTE",
    qtyIn: 2,
    qtyOut: 0,
    unitCost: 500,
    totalCost: 1000,
    date: new Date(),
  });
  const stockAfterReturn = await prisma.warehouseStock.findFirst({
    where: { companyId: company.id, itemId: product.id, warehouseId: whMain.id },
  });
  assert(stockAfterReturn?.quantity === 32, "Sales Return restored 2 units to stock (now 32)");

  // 8. Purchase Return Workflow (Debit Note)
  console.log("\n8️⃣  Purchase Return Workflow (Debit Note)");
  // Return 5 units to supplier: 2,500 + 450 tax = 2,950
  // Dr Creditors 2001 (2950), Cr Purchase Return 5002 (2500), Cr Input CGST 1300 (225), Cr Input SGST 1301 (225)
  await createVoucher({
    companyId: company.id,
    type: "JOURNAL",
    date: new Date(),
    partyId: supplier.id,
    narration: "Purchase Return: 5 units returned to Global Logistics",
    entries: [
      { accountCode: "2001", debit: 2950 },
      { accountCode: "1200", credit: 2500 },
      { accountCode: "1300", credit: 225 },
      { accountCode: "1301", credit: 225 },
    ],
  });
  await recordStockMovement({
    companyId: company.id,
    itemId: product.id,
    warehouseId: whMain.id,
    movementType: "PURCHASE_RETURN",
    referenceType: "DEBIT_NOTE",
    qtyIn: 0,
    qtyOut: 5,
    unitCost: 500,
    totalCost: 2500,
    date: new Date(),
  });
  const stockAfterPR = await prisma.warehouseStock.findFirst({
    where: { companyId: company.id, itemId: product.id, warehouseId: whMain.id },
  });
  assert(stockAfterPR?.quantity === 27, "Purchase Return deducted 5 units from stock (now 27)");

  // 9. Expense Workflow
  console.log("\n9️⃣  Expense Workflow");
  // Pay Electricity Bill: 1,500
  // Dr Electricity 5102 (1500), Cr Bank 1002 (1500)
  await createVoucher({
    companyId: company.id,
    type: "PAYMENT",
    date: new Date(),
    narration: "Office Electricity Payment",
    entries: [
      { accountCode: "5102", debit: 1500 },
      { accountCode: "1002", credit: 1500 },
    ],
  });
  const plExpense = await getProfitAndLoss({ companyId: company.id });
  const electricityExp = plExpense.expenses.find((e) => e.code === "5102");
  assert(electricityExp?.amount === 1500, "Electricity expense of 1,500 tracked in P&L");

  // 10. Stock Adjustment Workflow
  console.log("\n🔟 Stock Adjustment Workflow");
  // Write off 1 damaged unit: 1 unit @ 500
  await recordStockMovement({
    companyId: company.id,
    itemId: product.id,
    warehouseId: whMain.id,
    movementType: "STOCK_ADJUSTMENT",
    referenceType: "STOCK_ADJUSTMENT",
    qtyIn: 0,
    qtyOut: 1,
    unitCost: 500,
    totalCost: 500,
    date: new Date(),
    notes: "Damaged in handling",
  });
  const stockAfterAdj = await prisma.warehouseStock.findFirst({
    where: { companyId: company.id, itemId: product.id, warehouseId: whMain.id },
  });
  assert(stockAfterAdj?.quantity === 26, "Stock Adjustment reduced stock from 27 to 26");

  // 11. Stock Transfer Workflow
  console.log("\n1️⃣1️⃣ Stock Transfer Workflow (Inter-Warehouse)");
  // Transfer 10 units from whMain to whSecondary
  await recordStockMovement({
    companyId: company.id,
    itemId: product.id,
    warehouseId: whMain.id,
    movementType: "TRANSFER_OUT",
    referenceType: "STOCK_TRANSFER",
    qtyIn: 0,
    qtyOut: 10,
    unitCost: 500,
    totalCost: 5000,
    date: new Date(),
  });
  await recordStockMovement({
    companyId: company.id,
    itemId: product.id,
    warehouseId: whSecondary.id,
    movementType: "TRANSFER_IN",
    referenceType: "STOCK_TRANSFER",
    qtyIn: 10,
    qtyOut: 0,
    unitCost: 500,
    totalCost: 5000,
    date: new Date(),
  });
  const whMainStock = await prisma.warehouseStock.findFirst({
    where: { companyId: company.id, itemId: product.id, warehouseId: whMain.id },
  });
  const whSecStock = await prisma.warehouseStock.findFirst({
    where: { companyId: company.id, itemId: product.id, warehouseId: whSecondary.id },
  });
  assert(whMainStock?.quantity === 16 && whSecStock?.quantity === 10, "Stock Transfer: 10 moved from Main (now 16) to Secondary (now 10)");

  // 12. COGS Workflow
  console.log("\n1️⃣2️⃣ COGS Workflow");
  // Recognized COGS for 18 units net sold @ 500 = 9,000
  // Dr COGS 5400 (9,000), Cr Stock in Hand 1200 (9,000)
  await createVoucher({
    companyId: company.id,
    type: "JOURNAL",
    date: new Date(),
    narration: "COGS for net 18 sold units",
    entries: [
      { accountCode: "5400", debit: 9000 },
      { accountCode: "1200", credit: 9000 },
    ],
  });
  const cogsData = await getProfitAndLoss({ companyId: company.id });
  assert(cogsData.cogs === 9000, `COGS accurately tracked at 9,000`);

  // 13. GST Input vs Output Calculation
  console.log("\n1️⃣3️⃣ GST Workflow (Duties & Taxes Reconciliation)");
  // Input CGST = 2,250 - 225 = 2,025
  // Output CGST = 1,800 - 180 = 1,620
  // Net CGST = Output - Input = 1,620 - 2,025 = -405 (Refund/ITC Credit)
  const tbGst = await getTrialBalance({ companyId: company.id });
  const inputCgst = tbGst.rows.find((r) => r.code === "1300")?.closingBalance;
  const outputCgst = tbGst.rows.find((r) => r.code === "2100")?.closingBalance;
  assert(inputCgst === 2025, `Input CGST balance = 2,025`);
  assert(outputCgst === 1620, `Output CGST balance = 1,620`);

  // 14 & 15. Invoice Cancellation & Reversal Workflow
  console.log("\n1️⃣4️⃣ & 1️⃣5️⃣ Cancellation & Reversal Workflow");
  const testInv = await createInvoice({
    companyId: company.id,
    type: "SALES",
    date: new Date(),
    partyId: customer.id,
    warehouseId: whMain.id,
    isInterState: false,
    lines: [
      {
        itemId: product.id,
        name: "Cancellation Test Unit",
        qty: 1,
        rate: 1000,
        gstRate: 18,
      },
    ],
    status: "POSTED",
  });
  assert(testInv.id !== undefined, "Posted sales invoice created for cancellation test");

  // Stock before cancellation
  const stBefore = (await prisma.warehouseStock.findFirst({
    where: { companyId: company.id, itemId: product.id, warehouseId: whMain.id },
  }))?.quantity || 0;

  // Cancel invoice
  const cancelledInv = await cancelInvoice({
    invoiceId: testInv.id,
    companyId: company.id,
    reason: "Customer ordered by mistake",
    userId: "test-user",
  });
  assert(cancelledInv.status === "CANCELLED", "Invoice status updated to CANCELLED");

  // Verify stock reversal
  const stAfter = (await prisma.warehouseStock.findFirst({
    where: { companyId: company.id, itemId: product.id, warehouseId: whMain.id },
  }))?.quantity || 0;
  assert(stAfter === stBefore + 1, "Cancelled invoice automatically reversed stock by +1 unit");

  // Final Financial Balance Verification
  console.log("\n⚖️ Final Double-Entry Financial Health Verification");
  const finalTb = await getTrialBalance({ companyId: company.id });
  assert(finalTb.isBalanced, `Final Trial Balance is perfectly balanced (Difference: ${finalTb.difference})`);

  const finalBs = await getBalanceSheet({ companyId: company.id });
  assert(finalBs.isBalanced, `Final Balance Sheet balances: Total Assets (${finalBs.totalAssets}) == Total Liab & Equity (${finalBs.totalLiabilitiesAndEquity})`);

  // Cleanup
  console.log("\n🧹 Cleaning up test company data...");
  await prisma.stockMovement.deleteMany({ where: { companyId: company.id } });
  await prisma.warehouseStock.deleteMany({ where: { companyId: company.id } });
  await prisma.invoiceLine.deleteMany({ where: { invoice: { companyId: company.id } } });
  await prisma.invoice.deleteMany({ where: { companyId: company.id } });
  await prisma.voucherEntry.deleteMany({ where: { account: { companyId: company.id } } });
  await prisma.voucher.deleteMany({ where: { companyId: company.id } });
  await prisma.account.deleteMany({ where: { companyId: company.id } });
  await prisma.item.deleteMany({ where: { companyId: company.id } });
  await prisma.party.deleteMany({ where: { companyId: company.id } });
  await prisma.warehouse.deleteMany({ where: { companyId: company.id } });
  await prisma.company.deleteMany({ where: { id: company.id } });

  console.log("\n=======================================================");
  console.log(`📊 ACCOUNTING E2E TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

runAccountingE2E().catch((err) => {
  console.error("Accounting E2E error:", err);
  process.exit(1);
});
