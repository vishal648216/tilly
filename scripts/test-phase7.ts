import { prisma } from "../src/lib/prisma";
import {
  getSalesRegisterReport,
  getCustomerWiseSalesReport,
  getItemWiseSalesReport,
  getSalespersonSalesReport,
  getDiscountReport,
  getTaxReport,
  getSalesProfitabilityReport,
  getPurchaseRegisterReport,
  getSupplierWisePurchaseReport,
  getItemWisePurchaseReport,
  getPurchaseRateHistoryReport,
  getTaxPurchaseReport,
  getStockSummaryReport,
  getStockValuationReport,
  getLowStockReport,
  getInventoryMovementVelocityReport,
  getStockLedgerReport,
  getStockAdjustmentReport,
  getStockTransferReport,
  getItemProfitabilityReport,
  getPartyAgingReport,
  getPartyOverdueReport,
  getPartyPaymentHistoryReport,
  getSupplierPurchaseHistoryReport,
  getJournalRegisterReport,
  getDashboardAnalytics,
} from "../src/lib/reports";
import { performGlobalSearch } from "../src/lib/search";
import {
  getCompanyNotifications,
  createSystemNotification,
  markNotificationAsRead,
} from "../src/lib/notifications";
import { generateCsv, generateExcelXml } from "../src/lib/export";
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
} from "../src/lib/accounting";

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  }
}

async function runPhase7Tests() {
  console.log("==================================================");
  console.log("TAILY PHASE 7: PRODUCTION REPORTING & DASHBOARD TESTS");
  console.log("==================================================\n");

  // 1. Setup Test Company
  const companyName = "Phase 7 Reporting Enterprise";
  let company = await prisma.company.findFirst({
    where: { name: companyName },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: companyName,
        gstin: "27AABCT7777Q1Z5",
        businessType: "Retail",
        currency: "INR",
        state: "Maharashtra",
        country: "India",
      },
    });
  }
  const companyId = company.id;
  console.log(`[SETUP] Active Test Company ID: ${companyId}`);

  // Clean previous test data
  await prisma.paymentAllocation.deleteMany({ where: { companyId } });
  await prisma.payment.deleteMany({ where: { companyId } });
  await prisma.invoiceLine.deleteMany({ where: { invoice: { companyId } } });
  await prisma.invoice.deleteMany({ where: { companyId } });
  await prisma.stockMovement.deleteMany({ where: { companyId } });
  await prisma.item.deleteMany({ where: { companyId } });
  await prisma.party.deleteMany({ where: { companyId } });
  await prisma.voucherEntry.deleteMany({ where: { voucher: { companyId } } });
  await prisma.voucher.deleteMany({ where: { companyId } });
  await prisma.notification.deleteMany({ where: { companyId } });

  // 2. Seed Parties
  const customer = await prisma.party.create({
    data: {
      companyId,
      name: "Acme Retailers Pvt Ltd",
      type: "CUSTOMER",
      phone: "9876543210",
      gstin: "27AAAAA0000A1Z5",
      city: "Mumbai",
      code: "CUST-001",
    },
  });

  const supplier = await prisma.party.create({
    data: {
      companyId,
      name: "Apex Wholesalers Ltd",
      type: "VENDOR",
      phone: "9123456780",
      gstin: "27BBBBB1111B1Z2",
      city: "Pune",
      code: "SUPP-001",
    },
  });

  // 3. Seed Items
  const itemA = await prisma.item.create({
    data: {
      companyId,
      name: "Premium Basmati Rice",
      sku: "RICE-BAS-01",
      barcode: "8901234567890",
      unit: "KG",
      purchasePrice: 100,
      salePrice: 150,
      stock: 50,
      minStock: 20,
      reorderLevel: 30,
      type: "PRODUCT",
      active: true,
    },
  });

  const itemB = await prisma.item.create({
    data: {
      companyId,
      name: "Organic Olive Oil 1L",
      sku: "OIL-OLV-01",
      barcode: "8909876543211",
      unit: "LTR",
      purchasePrice: 500,
      salePrice: 800,
      stock: 5, // Below reorder level 15! Low stock!
      minStock: 10,
      reorderLevel: 15,
      type: "PRODUCT",
      active: true,
    },
  });

  // 4. Seed Known Transactions
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const overdueDate = new Date(today);
  overdueDate.setDate(today.getDate() - 15);

  // Invoice 1: 10 units Item A @ 150 = 1500 taxable, 18% GST (270), Total = 1770, Paid = 1000, Balance = 770
  const inv1 = await prisma.invoice.create({
    data: {
      companyId,
      invoiceNo: "INV-P7-001",
      type: "SALES",
      partyId: customer.id,
      date: yesterday,
      dueDate: overdueDate, // Past due date!
      subTotal: 1500,
      cgstTotal: 135,
      sgstTotal: 135,
      igstTotal: 0,
      grandTotal: 1770,
      paidAmount: 1000,
      salesperson: "Rahul Sharma",
      status: "PARTIALLY_PAID",
      lines: {
        create: [
          {
            itemId: itemA.id,
            name: itemA.name,
            sku: itemA.sku,
            unit: itemA.unit,
            qty: 10,
            rate: 150,
            taxableAmount: 1500,
            gstRate: 18,
            cgst: 135,
            sgst: 135,
            amount: 1770,
          },
        ],
      },
    },
  });

  // Invoice 2: 2 units Item B @ 800 = 1600 taxable, 12% GST (192), Total = 1792, Unpaid
  const inv2 = await prisma.invoice.create({
    data: {
      companyId,
      invoiceNo: "INV-P7-002",
      type: "SALES",
      partyId: customer.id,
      date: today,
      subTotal: 1600,
      cgstTotal: 96,
      sgstTotal: 96,
      igstTotal: 0,
      grandTotal: 1792,
      paidAmount: 0,
      salesperson: "Rahul Sharma",
      status: "POSTED",
      lines: {
        create: [
          {
            itemId: itemB.id,
            name: itemB.name,
            sku: itemB.sku,
            unit: itemB.unit,
            qty: 2,
            rate: 800,
            taxableAmount: 1600,
            gstRate: 12,
            cgst: 96,
            sgst: 96,
            amount: 1792,
          },
        ],
      },
    },
  });

  // Purchase Bill 1: 20 units Item A @ 100 = 2000 taxable, 18% GST (360), Total = 2360, Paid = 1000, Balance = 1360
  const bill1 = await prisma.invoice.create({
    data: {
      companyId,
      invoiceNo: "BILL-P7-001",
      supplierInvoiceNo: "APEX-9988",
      type: "PURCHASE",
      partyId: supplier.id,
      date: yesterday,
      subTotal: 2000,
      cgstTotal: 180,
      sgstTotal: 180,
      igstTotal: 0,
      grandTotal: 2360,
      paidAmount: 1000,
      status: "PARTIALLY_PAID",
      lines: {
        create: [
          {
            itemId: itemA.id,
            name: itemA.name,
            sku: itemA.sku,
            unit: itemA.unit,
            qty: 20,
            rate: 100,
            taxableAmount: 2000,
            gstRate: 18,
            cgst: 180,
            sgst: 180,
            amount: 2360,
          },
        ],
      },
    },
  });

  // Payment Receipt: 1000 for Invoice 1
  const payment1 = await prisma.payment.create({
    data: {
      companyId,
      paymentNo: "RCPT-P7-001",
      type: "RECEIPT",
      partyId: customer.id,
      date: yesterday,
      amount: 1000,
      mode: "UPI",
      status: "COMPLETED",
      allocations: {
        create: [
          {
            companyId,
            invoiceId: inv1.id,
            amount: 1000,
          },
        ],
      },
    },
  });

  // Stock Movement for Item A & Item B
  await prisma.stockMovement.create({
    data: {
      companyId,
      itemId: itemA.id,
      movementType: "PURCHASE",
      qtyIn: 20,
      qtyOut: 0,
      unitCost: 100,
      totalCost: 2000,
      date: yesterday,
    },
  });
  await prisma.stockMovement.create({
    data: {
      companyId,
      itemId: itemA.id,
      movementType: "SALE",
      qtyIn: 0,
      qtyOut: 10,
      unitCost: 100,
      totalCost: 1000,
      date: yesterday,
    },
  });

  // Date range for testing
  const dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
  const dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

  console.log("\n--- TEST GROUP 1: SALES REPORTS & RECONCILIATIONS ---");
  // 1. Sales Register
  const salesRegister = await getSalesRegisterReport({
    companyId,
    from: dateFrom,
    to: dateTo,
  });
  assert(salesRegister.total === 2, "Sales Register returned 2 invoices");
  assert(
    salesRegister.summary?.totalTaxable === 3100,
    `Sales Register Taxable reconciled: Expected 3100, Got ${salesRegister.summary?.totalTaxable}`
  );
  assert(
    salesRegister.summary?.totalGrand === 3562,
    `Sales Register Grand Total reconciled: Expected 3562, Got ${salesRegister.summary?.totalGrand}`
  );
  assert(
    salesRegister.summary?.totalBalanceDue === 2562,
    `Sales Register Balance Due reconciled: Expected 2562, Got ${salesRegister.summary?.totalBalanceDue}`
  );

  // 2. Customer-wise Sales
  const custSales = await getCustomerWiseSalesReport({
    companyId,
    from: dateFrom,
    to: dateTo,
  });
  assert(custSales.total === 1, "Customer-wise sales grouped to 1 customer");
  assert(
    custSales.data[0].customerName === "Acme Retailers Pvt Ltd",
    "Customer name matches"
  );
  assert(
    custSales.data[0].grandTotal === 3562,
    `Customer total sales matches 3562 (got ${custSales.data[0].grandTotal})`
  );

  // 3. Item-wise Sales
  const itemSales = await getItemWiseSalesReport({
    companyId,
    from: dateFrom,
    to: dateTo,
  });
  assert(itemSales.total === 2, "Item-wise sales covers 2 items");
  const riceSales = itemSales.data.find((i) => i.name.includes("Rice"));
  assert(riceSales?.qtySold === 10, `Item A qty sold matches: 10 (got ${riceSales?.qtySold})`);

  // 4. Salesperson Sales
  const spSales = await getSalespersonSalesReport({
    companyId,
    from: dateFrom,
    to: dateTo,
  });
  assert(spSales.data[0].salesperson === "Rahul Sharma", "Salesperson Rahul Sharma captured");
  assert(spSales.data[0].grandTotal === 3562, "Salesperson grand total reconciled");

  // 5. Tax Outward Report
  const taxReport = await getTaxReport({
    companyId,
    from: dateFrom,
    to: dateTo,
  });
  assert(
    taxReport.summary?.totalCgst === 231 && taxReport.summary?.totalSgst === 231,
    `Tax Report CGST/SGST reconciled: 231/231 (got ${taxReport.summary?.totalCgst}/${taxReport.summary?.totalSgst})`
  );

  // 6. Sales Profitability Report
  const profitReport = await getSalesProfitabilityReport({
    companyId,
    from: dateFrom,
    to: dateTo,
  });
  assert(profitReport.total === 2, "Sales profitability calculated for both invoices");
  // Inv 1: Rev 1500 - Cost (10 * 100 = 1000) = Profit 500
  // Inv 2: Rev 1600 - Cost (2 * 500 = 1000) = Profit 600
  // Total Profit = 1100
  assert(
    profitReport.summary?.totalProfit === 1100,
    `Sales Gross Profit reconciled: Expected 1100, Got ${profitReport.summary?.totalProfit}`
  );

  console.log("\n--- TEST GROUP 2: PURCHASE REPORTS & RECONCILIATIONS ---");
  // 1. Purchase Register
  const purRegister = await getPurchaseRegisterReport({
    companyId,
    from: dateFrom,
    to: dateTo,
  });
  assert(purRegister.total === 1, "Purchase Register returned 1 bill");
  assert(
    purRegister.summary?.totalGrand === 2360,
    `Purchase Register total spend reconciled: 2360 (got ${purRegister.summary?.totalGrand})`
  );

  // 2. Tax Purchase Report (ITC)
  const taxPur = await getTaxPurchaseReport({
    companyId,
    from: dateFrom,
    to: dateTo,
  });
  assert(
    taxPur.summary?.totalTax === 360,
    `Tax Purchase ITC reconciled: Expected 360, Got ${taxPur.summary?.totalTax}`
  );

  // 3. Purchase Rate History
  const rateHist = await getPurchaseRateHistoryReport({ companyId });
  assert(rateHist.total === 1, "Purchase Rate history recorded");
  assert(rateHist.data[0].purchaseRate === 100, "Purchase rate matches Rs 100");

  console.log("\n--- TEST GROUP 3: INVENTORY REPORTS & RECONCILIATIONS ---");
  // 1. Stock Summary
  const stockSummary = await getStockSummaryReport({ companyId });
  assert(stockSummary.total === 2, "Stock summary lists both active products");

  // 2. Stock Valuation
  const stockValuation = await getStockValuationReport({ companyId });
  // Item A: 50 * 100 = 5000; Item B: 5 * 500 = 2500; Total = 7500
  assert(
    stockValuation.summary?.totalInventoryValuation === 7500,
    `Inventory valuation reconciled: Expected 7500, Got ${stockValuation.summary?.totalInventoryValuation}`
  );

  // 3. Low Stock & Reorder Alert
  const lowStock = await getLowStockReport({ companyId });
  assert(lowStock.total === 1, "Low Stock identified exactly 1 deficit item");
  assert(
    lowStock.data[0].name.includes("Olive Oil"),
    `Deficit item correctly detected as Olive Oil (got ${lowStock.data[0].name})`
  );
  assert(
    lowStock.data[0].suggestedOrderQty === 25, // reorder(15)*2 - stock(5) = 25
    `Suggested reorder quantity calculated correctly (got ${lowStock.data[0].suggestedOrderQty})`
  );

  // 4. Stock Ledger (Chronological running balance)
  const stockLedger = await getStockLedgerReport({ companyId, itemId: itemA.id });
  assert(stockLedger.total === 2, "Stock ledger tracked both inward and outward movements");
  assert(
    stockLedger.data[1].runningBalance === 10,
    `Stock ledger running balance reconciled to 10 (got ${stockLedger.data[1].runningBalance})`
  );

  // 5. Item Profitability
  const itemProf = await getItemProfitabilityReport({ companyId, from: dateFrom, to: dateTo });
  assert(itemProf.total === 2, "Item profitability calculated for sold products");

  console.log("\n--- TEST GROUP 4: PARTY REPORTS (AGING, OVERDUE, PAYMENTS) ---");
  // 1. Customer Aging
  const custAging = await getPartyAgingReport({
    companyId,
    type: "CUSTOMER",
    asOfDate: today,
  });
  assert(custAging.total === 1, "Customer aging has 1 customer with outstanding");
  assert(
    custAging.data[0].totalOutstanding === 2562,
    `Customer total aging outstanding reconciled: 2562 (got ${custAging.data[0].totalOutstanding})`
  );

  // 2. Customer Overdue Invoices
  const custOverdue = await getPartyOverdueReport({
    companyId,
    type: "CUSTOMER",
  });
  assert(custOverdue.total === 1, "Customer overdue report identified exactly 1 overdue invoice");
  assert(
    custOverdue.data[0].invoiceNo === "INV-P7-001",
    "Overdue invoice matches INV-P7-001"
  );
  assert(
    custOverdue.data[0].overdueDays >= 14,
    `Overdue days calculated correctly: ${custOverdue.data[0].overdueDays} days`
  );

  // 3. Payment History
  const payHist = await getPartyPaymentHistoryReport({ companyId });
  assert(payHist.total === 1, "Payment history captured payment record");
  assert(payHist.data[0].amount === 1000, "Payment amount matches 1000");

  console.log("\n--- TEST GROUP 5: DASHBOARD ANALYTICS & STRICT SEPARATION ---");
  const dashboard = await getDashboardAnalytics({
    companyId,
    from: dateFrom,
    to: dateTo,
    periodLabel: "This Month",
  });

  // Strict separation of Period vs As-Of-Date
  assert(
    dashboard.periodSales === 3562,
    `Dashboard periodSales reconciled: 3562 (got ${dashboard.periodSales})`
  );
  assert(
    dashboard.periodPurchases === 2360,
    `Dashboard periodPurchases reconciled: 2360 (got ${dashboard.periodPurchases})`
  );
  assert(
    dashboard.asOfDateReceivables === 2562,
    `Dashboard asOfDateReceivables reconciled: 2562 (got ${dashboard.asOfDateReceivables})`
  );
  assert(
    dashboard.asOfDatePayables === 1360,
    `Dashboard asOfDatePayables reconciled: 1360 (got ${dashboard.asOfDatePayables})`
  );
  assert(
    dashboard.asOfDateStockValue === 7500,
    `Dashboard asOfDateStockValue reconciled: 7500 (got ${dashboard.asOfDateStockValue})`
  );

  // Business Specific Metrics: Retail
  assert(
    dashboard.retail.lowStockItemCount === 1,
    `Retail lowStockItemCount matches: 1 (got ${dashboard.retail.lowStockItemCount})`
  );
  assert(
    dashboard.retail.currentStockUnits === 55,
    `Retail currentStockUnits matches: 55 (got ${dashboard.retail.currentStockUnits})`
  );

  console.log("\n--- TEST GROUP 6: GLOBAL SEARCH (CTRL + K) MULTI-ENTITY ---");
  const searchCustomer = await performGlobalSearch(companyId, "Acme");
  assert(
    searchCustomer.results.CUSTOMERS?.length > 0,
    "Search found Customer by name 'Acme'"
  );

  const searchSku = await performGlobalSearch(companyId, "RICE-BAS");
  assert(
    searchSku.results.PRODUCTS?.length > 0,
    "Search found Product by SKU 'RICE-BAS'"
  );

  const searchBarcode = await performGlobalSearch(companyId, "8909876543211");
  assert(
    searchBarcode.results.PRODUCTS?.length > 0,
    "Search found Product by Barcode"
  );

  const searchInvoice = await performGlobalSearch(companyId, "INV-P7-001");
  assert(
    searchInvoice.results.INVOICES?.length > 0,
    "Search found Invoice by Invoice Number"
  );

  console.log("\n--- TEST GROUP 7: PROACTIVE NOTIFICATION ENGINE ---");
  // Check proactive detection of low stock & overdue invoice
  const notifs = await getCompanyNotifications(companyId);
  assert(notifs.unreadCount >= 2, `Proactive alerts generated: ${notifs.unreadCount}`);
  const hasLowStockAlert = notifs.notifications.some((n) => n.type === "LOW_STOCK");
  assert(hasLowStockAlert, "Low stock notification proactively generated");
  const hasOverdueAlert = notifs.notifications.some((n) => n.type === "INVOICE_OVERDUE");
  assert(hasOverdueAlert, "Invoice overdue notification proactively generated");

  // Create & Read system notification
  const createdNotif = await createSystemNotification({
    companyId,
    type: "BACKUP_FAILED",
    title: "Test System Warning",
    message: "Automated cloud backup skipped due to maintenance",
    severity: "WARNING",
  });
  assert(createdNotif.id !== undefined, "System notification created");
  await markNotificationAsRead(createdNotif.id, companyId);
  const updatedNotif = await prisma.notification.findUnique({ where: { id: createdNotif.id } });
  assert(updatedNotif?.isRead === true, "Notification successfully marked as read");

  console.log("\n--- TEST GROUP 8: DATA EXPORTS (CSV & EXCEL INTEGRITY) ---");
  const headers = ["Invoice #", "Customer", "Amount"];
  const rows = [
    ["INV-001", 'Acme, "Retailers" Inc.', 1000],
    ["INV-002", "Special characters: ₹ & %", 2500],
  ];

  const csvOutput = generateCsv(headers, rows);
  assert(csvOutput.startsWith("\uFEFF"), "CSV output includes UTF-8 BOM for Excel compatibility");
  assert(
    csvOutput.includes('"Acme, ""Retailers"" Inc."'),
    "CSV properly escapes quotes and commas per RFC-4180"
  );

  const excelXmlOutput = generateExcelXml("Sales-Register", headers, rows);
  assert(
    excelXmlOutput.includes('<?xml version="1.0" encoding="UTF-8"?>'),
    "Excel export has valid XML declaration"
  );
  assert(
    excelXmlOutput.includes('xmlns="urn:schemas-microsoft-com:office:spreadsheet"'),
    "Excel export is true Microsoft SpreadsheetML (NOT a mislabeled CSV)"
  );

  console.log("\n==================================================");
  console.log(`PHASE 7 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase7Tests().catch((err) => {
  console.error("Test execution encountered unexpected error:", err);
  process.exit(1);
});
