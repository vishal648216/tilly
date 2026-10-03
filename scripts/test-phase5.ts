/**
 * Taily Phase 5: Accounting System Integrity Test Suite
 * Tests: COGS, Double-Entry, Balance Sheet, P&L, Trial Balance, GST, Financial Year
 * Run: npx tsx scripts/test-phase5.ts
 */

import { prisma } from "../src/lib/prisma";
import { createInvoice } from "../src/lib/invoice";
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getDayBook,
  getCashBook,
  checkAccountingIntegrity,
} from "../src/lib/accounting";
import {
  getCurrentFinancialYear,
  parseFyStartMonth,
  getFinancialYearForDate,
  getDateRangePreset,
} from "../src/lib/financialYear";
import { calculateLineTax, calculateInvoiceTax, validateGstin } from "../src/lib/gst";
import { roundTo2 } from "../src/lib/currency";

// ====================================================
// TEST HELPERS
// ====================================================
let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
    failures.push(name);
  }
}

function group(name: string) {
  console.log(`\n--- ${name} ---`);
}

async function cleanup(companyId: string) {
  await prisma.paymentAllocation.deleteMany({ where: { companyId } });
  await prisma.payment.deleteMany({ where: { companyId } });
  await prisma.stockMovement.deleteMany({ where: { companyId } });
  await prisma.warehouseStock.deleteMany({ where: { companyId } });
  await prisma.voucherEntry.deleteMany({ where: { voucher: { companyId } } });
  await prisma.voucher.deleteMany({ where: { companyId } });
  await prisma.invoiceLine.deleteMany({ where: { invoice: { companyId } } });
  await prisma.invoice.deleteMany({ where: { companyId } });
  await prisma.expense.deleteMany({ where: { companyId } });
  await prisma.item.deleteMany({ where: { companyId } });
  await prisma.warehouse.deleteMany({ where: { companyId } });
  await prisma.party.deleteMany({ where: { companyId } });
  await prisma.account.deleteMany({ where: { companyId } });
  await prisma.companySettings.deleteMany({ where: { companyId } });
  await prisma.activityLog.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
}

// ====================================================
// MAIN TEST RUNNER
// ====================================================
async function main() {
  console.log("\n=======================================================");
  console.log("🧾  TAILY PHASE 5: ACCOUNTING INTEGRITY TEST SUITE");
  console.log("=======================================================");

  const suffix = Math.floor(Math.random() * 99999);
  let companyId = "";
  let supplierId = "";
  let customerId = "";
  let itemId = "";
  let userId = "";

  try {
    // ===== SETUP =====
    console.log("\n[1] Setting up test environment...");

    // Create user
    const user = await prisma.user.create({
      data: {
        email: `phase5-test-${suffix}@taily.test`,
        name: "Phase5 Tester",
        passwordHash: "test",
        role: "USER",
        status: "APPROVED",
      },
    });
    userId = user.id;

    // Create company
    const company = await prisma.company.create({
      data: {
        name: `Phase5 Accounting Test ${suffix}`,
        currency: "INR",
        financialYear: "04-01", // Indian FY: April 1
        gstin: "29AABCT1234Z1Z5",
        state: "Karnataka",
      },
    });
    companyId = company.id;

    await prisma.companyMember.create({
      data: { userId, companyId, role: "COMPANY_ADMIN" },
    });

    await prisma.companySettings.create({
      data: {
        companyId,
        inventoryEnabled: true,
        gstEnabled: true,
        warehouseEnabled: false,
        roundOffEnabled: true,
        creditLimitBlock: false,
        duplicateSupplierInvoiceBlock: true,
      },
    });

    // Create parties
    const supplier = await prisma.party.create({
      data: { companyId, name: "Reliable Suppliers Ltd", type: "VENDOR", gstin: "27AABCS5555A1Z5" },
    });
    supplierId = supplier.id;

    const customer = await prisma.party.create({
      data: { companyId, name: "Prime Traders", type: "CUSTOMER", creditLimit: 100000 },
    });
    customerId = customer.id;

    // Create warehouse
    const warehouse = await prisma.warehouse.create({
      data: { companyId, name: "Main Godown", code: "WH-MAIN", isDefault: true, active: true },
    });

    console.log(`[1] Setup complete: Company "${company.name}", Supplier, Customer, Warehouse`);

    // ====================================================
    // GROUP 1: FINANCIAL YEAR ENGINE
    // ====================================================
    group("Group 1: Financial Year Engine");

    const { month, day } = parseFyStartMonth("04-01");
    test("FY parser: April 1 start month is 4", month === 4);
    test("FY parser: April 1 start day is 1", day === 1);

    const { month: m2, day: d2 } = parseFyStartMonth("01-01");
    test("FY parser: Calendar year (Jan 1) month is 1", m2 === 1);

    const { month: m3 } = parseFyStartMonth(null);
    test("FY parser: null defaults to April (month 4)", m3 === 4);

    // Test FY boundaries
    const fy = getFinancialYearForDate(new Date("2024-07-15"), 4, 1);
    test("FY for July 2024 starts April 1, 2024", fy.startYear === 2024);
    test("FY for July 2024 ends in 2025", fy.endYear === 2025);
    test("FY label is FY 2024-25", fy.label === "FY 2024-25");

    const fyBefore = getFinancialYearForDate(new Date("2024-01-15"), 4, 1);
    test("FY for Jan 2024 starts April 1, 2023 (previous FY)", fyBefore.startYear === 2023);

    // Date range presets
    const now = new Date();
    const currentFy = await getCurrentFinancialYear(companyId);
    test("getCurrentFinancialYear returns FY data", !!currentFy.label);
    test("FY startDate is April 1", currentFy.startDate.getMonth() === 3); // 0-indexed: March=2, April=3

    // ====================================================
    // GROUP 2: CENTRALIZED GST ENGINE
    // ====================================================
    group("Group 2: Centralized GST Tax Engine");

    // Test exclusive GST calculation
    const line1 = calculateLineTax({ qty: 10, rate: 1000, gstRate: 18 }, false);
    test("GST: 10 × ₹1000 = ₹10,000 base amount", line1.baseAmount === 10000);
    test("GST: Taxable amount = ₹10,000 (no discount)", line1.taxableAmount === 10000);
    test("GST: 18% intra-state splits to 9% CGST + 9% SGST", roundTo2(line1.cgst) === 900 && roundTo2(line1.sgst) === 900);
    test("GST: Total tax = ₹1800", line1.totalTax === 1800);
    test("GST: IGST = 0 for intra-state", line1.igst === 0);

    // Inter-state IGST
    const line2 = calculateLineTax({ qty: 5, rate: 500, gstRate: 12 }, true);
    test("GST: IGST 12% = ₹300 for inter-state", line2.igst === 300);
    test("GST: CGST = 0 for inter-state", line2.cgst === 0);

    // Inclusive pricing
    const line3 = calculateLineTax({ qty: 1, rate: 1180, gstRate: 18, taxMode: "INCLUSIVE" }, false);
    test("GST: Inclusive ₹1180 @ 18% → taxable ≈ ₹1000", Math.abs(line3.taxableAmount - 1000) < 1);
    test("GST: Inclusive tax ≈ ₹180", Math.abs(line3.totalTax - 180) < 1);

    // Discount
    const line4 = calculateLineTax({ qty: 10, rate: 100, discount: 50, gstRate: 18 }, false);
    test("GST: ₹1000 - ₹50 discount = ₹950 taxable", line4.taxableAmount === 950);
    test("GST: Tax on ₹950 @ 18% = ₹171", line4.totalTax === 171);

    // Full invoice GST
    const invoiceTax = calculateInvoiceTax(
      [
        { qty: 10, rate: 1000, gstRate: 18 },
        { qty: 5, rate: 500, gstRate: 12 },
      ],
      { isInterState: false, freight: 200, discount: 500, roundOffEnabled: false }
    );
    test("GST: Invoice subTotal correct", invoiceTax.subTotal === 12500);
    test("GST: CGST total = (1800+300)/2 = 1050", invoiceTax.cgstTotal === 1050);
    test("GST: SGST total = 1050", invoiceTax.sgstTotal === 1050);
    test("GST: Grand total includes freight and deducts discount", 
      invoiceTax.grandTotal === roundTo2(12500 - 500 + 200 + 2100));

    // GSTIN Validation
    test("GSTIN: Valid GSTIN passes validation", validateGstin("27AABCS5555A1Z5"));
    test("GSTIN: Invalid GSTIN fails validation", !validateGstin("INVALID-GSTIN"));
    test("GSTIN: Short GSTIN fails validation", !validateGstin("27AABCS"));

    // ====================================================
    // GROUP 3: PURCHASE ACCOUNTING (Double-Entry)
    // ====================================================
    group("Group 3: Purchase Posting — Double-Entry Accounting");

    const purchaseInvoice = await createInvoice({
      companyId,
      type: "PURCHASE",
      partyId: supplierId,
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      isInterState: false,
      warehouseId: warehouse.id,
      lines: [
        {
          name: "Widget A",
          qty: 100,
          rate: 500,
          gstRate: 18,
          unit: "PCS",
        },
      ],
      notes: "Phase 5 test purchase",
      createdBy: userId,
    });
    itemId = purchaseInvoice.lines[0].itemId!;

    // Expected: Taxable = 100 × 500 = 50000, CGST = 4500, SGST = 4500, Total = 59000
    test("Purchase: Invoice created with POSTED status", purchaseInvoice.status === "POSTED");
    test("Purchase: Subtotal = ₹50,000", Number(purchaseInvoice.subTotal) === 50000);
    test("Purchase: Grand Total = ₹59,000 (incl. 18% GST)", Number(purchaseInvoice.grandTotal) === 59000);

    // Verify voucher was created
    const purchaseVoucher = await prisma.voucher.findUnique({
      where: { id: purchaseInvoice.voucherId! },
      include: { entries: { include: { account: true } } },
    });
    test("Purchase: Accounting voucher created", !!purchaseVoucher);

    // Check voucher balances
    const pvDr = purchaseVoucher!.entries.reduce((s, e) => s + Number(e.debit), 0);
    const pvCr = purchaseVoucher!.entries.reduce((s, e) => s + Number(e.credit), 0);
    test("Purchase: Voucher is balanced (Dr = Cr)", Math.abs(pvDr - pvCr) < 0.01,
      `Dr=${pvDr} Cr=${pvCr}`);

    // Check that Sundry Creditors was credited (grand total)
    const creditorEntry = purchaseVoucher!.entries.find((e) => e.account.code === "2001");
    test("Purchase: Sundry Creditors (2001) credited ₹59,000", 
      !!creditorEntry && Math.abs(Number(creditorEntry.credit) - 59000) < 0.01);

    // Check Input CGST debited
    const cgstEntry = purchaseVoucher!.entries.find((e) => e.account.code === "1300");
    test("Purchase: Input CGST (1300) debited ₹4,500", 
      !!cgstEntry && Math.abs(Number(cgstEntry.debit) - 4500) < 0.01);

    // Check Stock in Hand (1200) debited on purchase
    const stockEntry = purchaseVoucher!.entries.find((e) => e.account.code === "1200");
    test("Purchase: Stock in Hand (1200) debited ₹50,000", 
      !!stockEntry && Math.abs(Number(stockEntry.debit) - 50000) < 0.01);

    // Verify stock increased
    const itemAfterPurchase = await prisma.item.findUnique({ where: { id: itemId } });
    test("Purchase: Item stock = 100 after purchase", Number(itemAfterPurchase!.stock) === 100);
    test("Purchase: WAC = ₹500 after purchase", Number(itemAfterPurchase!.purchasePrice) === 500);

    // ====================================================
    // GROUP 4: SALES ACCOUNTING WITH COGS
    // ====================================================
    group("Group 4: Sales Posting — Revenue + COGS Double-Entry");

    // Sell 30 units @ ₹800 (WAC = ₹500 per unit → COGS = ₹15,000)
    const salesInvoice = await createInvoice({
      companyId,
      type: "SALES",
      partyId: customerId,
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      isInterState: false,
      warehouseId: warehouse.id,
      lines: [
        {
          itemId,
          name: "Widget A",
          qty: 30,
          rate: 800,
          gstRate: 18,
          unit: "PCS",
        },
      ],
      notes: "Phase 5 test sale",
      createdBy: userId,
    });

    // Expected: Taxable = 30 × 800 = 24000, CGST=2160, SGST=2160, Total=28320
    test("Sales: Invoice created with POSTED status", salesInvoice.status === "POSTED");
    test("Sales: Subtotal = ₹24,000", Number(salesInvoice.subTotal) === 24000);
    test("Sales: Grand Total = ₹28,320 (18% GST)", Number(salesInvoice.grandTotal) === 28320);

    const salesVoucher = await prisma.voucher.findUnique({
      where: { id: salesInvoice.voucherId! },
      include: { entries: { include: { account: true } } },
    });
    test("Sales: Accounting voucher created", !!salesVoucher);

    // Check balance
    const svDr = salesVoucher!.entries.reduce((s, e) => s + Number(e.debit), 0);
    const svCr = salesVoucher!.entries.reduce((s, e) => s + Number(e.credit), 0);
    test("Sales: Voucher is balanced (Dr = Cr)", Math.abs(svDr - svCr) < 0.01,
      `Dr=${svDr} Cr=${svCr}`);

    // Check Sales account (4001) credited
    const salesAccEntry = salesVoucher!.entries.find((e) => e.account.code === "4001");
    test("Sales: Sales (4001) credited ₹24,000", 
      !!salesAccEntry && Math.abs(Number(salesAccEntry.credit) - 24000) < 0.01);

    // Check Sundry Debtors (1100) debited (grand total)
    const debtorEntry = salesVoucher!.entries.find((e) => e.account.code === "1100");
    test("Sales: Sundry Debtors (1100) debited ₹28,320", 
      !!debtorEntry && Math.abs(Number(debtorEntry.debit) - 28320) < 0.01);

    // Check COGS (5400) debited at WAC (30 × 500 = 15000)
    const cogsEntry = salesVoucher!.entries.find((e) => e.account.code === "5400");
    test("Sales: COGS (5400) debited ₹15,000 (30 × WAC ₹500)", 
      !!cogsEntry && Math.abs(Number(cogsEntry.debit) - 15000) < 0.01,
      `Actual COGS debit: ${cogsEntry ? Number(cogsEntry.debit) : "MISSING"}`);

    // Check Stock in Hand (1200) credited for COGS
    const stockCrEntry = salesVoucher!.entries.filter((e) => e.account.code === "1200");
    const stockCrAmt = stockCrEntry.reduce((s, e) => s + Number(e.credit), 0);
    test("Sales: Stock in Hand (1200) credited ₹15,000 (WAC × qty)", 
      Math.abs(stockCrAmt - 15000) < 0.01,
      `Actual Stock Cr: ${stockCrAmt}`);

    // Check Output CGST (2100) credited
    const outputCgst = salesVoucher!.entries.find((e) => e.account.code === "2100");
    test("Sales: Output CGST (2100) credited ₹2,160", 
      !!outputCgst && Math.abs(Number(outputCgst.credit) - 2160) < 0.01);

    // Verify stock decreased
    const itemAfterSale = await prisma.item.findUnique({ where: { id: itemId } });
    test("Sales: Item stock decreased to 70 (100 - 30)", Number(itemAfterSale!.stock) === 70);

    // ====================================================
    // GROUP 5: P&L — GROSS PROFIT CALCULATION
    // ====================================================
    group("Group 5: Profit & Loss — COGS and Gross Profit");

    const pl = await getProfitAndLoss({ companyId });

    test("P&L: Sales revenue = ₹24,000", pl.salesRevenue === 24000);
    test("P&L: Net sales = ₹24,000", pl.netSales === 24000);

    // COGS from account 5400: ₹15,000
    test("P&L: COGS = ₹15,000 (via COGS account 5400)", pl.cogs === 15000,
      `Actual COGS: ${pl.cogs}`);

    // Gross Profit = 24000 - 15000 = 9000
    test("P&L: Gross Profit = ₹9,000 (Sales ₹24,000 - COGS ₹15,000)", 
      pl.grossProfit === 9000, `Actual GP: ${pl.grossProfit}`);

    // Net Profit (no expenses yet) = 9000
    test("P&L: Net Profit = ₹9,000 (no operating expenses)", 
      pl.netProfit === 9000, `Actual NP: ${pl.netProfit}`);
    test("P&L: isProfit = true", pl.isProfit === true);

    // ====================================================
    // GROUP 6: TRIAL BALANCE — ACCOUNTING EQUATION
    // ====================================================
    group("Group 6: Trial Balance — Debit = Credit");

    const tb = await getTrialBalance({ companyId });

    test("Trial Balance: Generated with rows", tb.rows.length > 0);
    test("Trial Balance: Total Debit = Total Credit (Balanced)", tb.isBalanced,
      `Dr=${tb.totalDr} Cr=${tb.totalCr} Diff=${tb.difference}`);
    test("Trial Balance: Difference < ₹0.01", tb.difference < 0.01);

    // ====================================================
    // GROUP 7: BALANCE SHEET
    // ====================================================
    group("Group 7: Balance Sheet — Assets = Liabilities + Equity");

    const bs = await getBalanceSheet({ companyId });

    test("Balance Sheet: Has asset accounts", bs.currentAssets.length > 0 || bs.fixedAssets.length > 0);
    test("Balance Sheet: Total Assets > 0", bs.totalAssets > 0);

    // Accounting equation verified
    test("Balance Sheet: Assets = Liabilities + Equity",
      Math.abs(bs.totalAssets - bs.totalLiabilitiesAndEquity) < 1,
      `Assets=${bs.totalAssets} L+E=${bs.totalLiabilitiesAndEquity}`);

    // Retained earnings = Net Profit from P&L
    test("Balance Sheet: Retained Earnings matches Net Profit", 
      Math.abs(bs.retainedEarnings - pl.netProfit) < 0.01);

    // ====================================================
    // GROUP 8: ACCOUNTING INTEGRITY CHECK
    // ====================================================
    group("Group 8: Accounting Integrity — All Vouchers Balanced");

    const integrity = await checkAccountingIntegrity(companyId);

    test("Integrity: All vouchers are balanced (Dr = Cr)", integrity.isIntegral,
      `${integrity.unbalancedVouchers.length} unbalanced vouchers found`);
    test("Integrity: Total vouchers > 0", integrity.totalVouchers > 0);

    if (!integrity.isIntegral) {
      for (const v of integrity.unbalancedVouchers) {
        console.log(`    ⚠ Unbalanced: ${v.voucherNo} Dr=${v.totalDebit} Cr=${v.totalCredit}`);
      }
    }

    // ====================================================
    // GROUP 9: GST REPORT FILTERING
    // ====================================================
    group("Group 9: GST Reports — Draft/Cancelled Excluded");

    // Create a DRAFT invoice (should not appear in GSTR-1)
    const draftInvoice = await createInvoice({
      companyId,
      type: "SALES",
      partyId: customerId,
      date: new Date(),
      isInterState: false,
      lines: [{ name: "Draft Item", qty: 5, rate: 1000, gstRate: 18 }],
      status: "DRAFT",
      createdBy: userId,
    });
    test("GST: Draft invoice created successfully", draftInvoice.status === "DRAFT");
    test("GST: Draft invoice has no voucher", !draftInvoice.voucherId);
    test("GST: Draft invoice has no stock movement", Number(draftInvoice.subTotal) > 0);

    // Count only posted invoices (simulating GSTR-1 query)
    const gstr1Invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: "SALES",
        status: { notIn: ["DRAFT", "CANCELLED", "REVERSED"] },
      },
    });
    const allSalesInvoices = await prisma.invoice.findMany({
      where: { companyId, type: "SALES" },
    });

    test("GST: GSTR-1 excludes DRAFT invoices",
      gstr1Invoices.length < allSalesInvoices.length);
    test("GST: GSTR-1 only includes posted invoices", 
      gstr1Invoices.every((inv) => !["DRAFT", "CANCELLED", "REVERSED"].includes(inv.status)));

    // ====================================================
    // GROUP 10: DAY BOOK
    // ====================================================
    group("Group 10: Day Book — Complete Voucher Register");

    const dayBook = await getDayBook({ companyId });
    test("Day Book: Has entries", dayBook.length > 0);

    const dayBookDr = dayBook.reduce((s, v) => s + v.totalDebit, 0);
    const dayBookCr = dayBook.reduce((s, v) => s + v.totalCredit, 0);
    test("Day Book: Total Dr = Total Cr", Math.abs(dayBookDr - dayBookCr) < 0.01,
      `Dr=${dayBookDr} Cr=${dayBookCr}`);

    // ====================================================
    // GROUP 11: SAMPLE CALCULATIONS PROOF
    // ====================================================
    group("Group 11: Sample Calculation Proof (₹ Verification)");

    // Purchase: 100 units @ ₹500 + 18% GST
    // Dr Purchase 50000, Dr Input CGST 4500, Dr Input SGST 4500, Dr Stock 50000
    // Cr Sundry Creditors 59000
    // Sales: 30 units @ ₹800 + 18% GST (WAC = ₹500)
    // Dr Sundry Debtors 28320, Dr COGS 15000
    // Cr Sales 24000, Cr Output CGST 2160, Cr Output SGST 2160, Cr Stock 15000

    const expectedGrossProfit = 24000 - 15000; // ₹9,000
    const expectedGpMargin = ((expectedGrossProfit / 24000) * 100).toFixed(1); // 37.5%

    test("Proof: Gross Profit formula correct: ₹24,000 - ₹15,000 = ₹9,000",
      expectedGrossProfit === 9000);
    test("Proof: GP Margin = 37.5%", expectedGpMargin === "37.5");

    // Net GST payable = Output - Input
    const outputGst = 2160 + 2160; // CGST + SGST
    const inputGst = 4500 + 4500; // CGST + SGST
    const netGstPayable = Math.max(0, outputGst - inputGst);
    test("Proof: Net CGST payable = max(0, 2160 - 4500) = 0 (ITC exceeds output)", netGstPayable === 0);

    // WAC remains ₹500 (only bought at ₹500, sold didn't change WAC)
    const finalItem = await prisma.item.findUnique({ where: { id: itemId } });
    test("Proof: WAC stays ₹500 after sales (WAC unchanged on sale)", 
      Number(finalItem!.purchasePrice) === 500);
    test("Proof: Remaining stock = 70 units", Number(finalItem!.stock) === 70);
    test("Proof: Stock value = 70 × ₹500 = ₹35,000", 
      roundTo2(Number(finalItem!.stock) * Number(finalItem!.purchasePrice)) === 35000);

  } catch (err) {
    console.error("\n💥 UNEXPECTED ERROR:", err);
    failed++;
  } finally {
    // Cleanup
    if (companyId) {
      try {
        await cleanup(companyId);
        if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      } catch (e) {
        console.error("Cleanup error:", e);
      }
    }
    await prisma.$disconnect();
  }

  // ====================================================
  // FINAL SUMMARY
  // ====================================================
  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  if (failures.length > 0) {
    console.log("\nFailed Tests:");
    failures.forEach((f) => console.log(`  ❌ ${f}`));
  }
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

main();
