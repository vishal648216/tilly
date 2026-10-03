// Taily - Accounting Reports Engine
// Computes Trial Balance, P&L, Balance Sheet, General Ledger, Day Book,
// Cash Book, Bank Book, Journal Register from the double-entry voucher store.
// All computations use the same source: VoucherEntry table.

import { prisma } from "./prisma";
import { roundTo2 } from "./currency";
import { resolveDateRange } from "./financialYear";

export interface AccountBalance {
  id: string;
  code: string;
  name: string;
  type: string;       // ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  groupId: string | null;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;  // Net balance (normal balance direction)
  isDebitNature: boolean;
}

export interface TrialBalanceRow extends AccountBalance {
  drColumn: number;   // Amount in Dr column
  crColumn: number;   // Amount in Cr column
}

export interface ProfitLossData {
  // Revenue
  salesRevenue: number;
  salesReturn: number;          // Deducted from sales
  netSales: number;
  otherIncome: number;
  totalRevenue: number;

  // COGS
  openingStock: number;
  purchases: number;
  purchaseReturn: number;       // Deducted from purchases
  closingStock: number;
  cogs: number;                 // openingStock + purchases - purchaseReturn - closingStock

  // Gross Profit
  grossProfit: number;          // netSales - cogs

  // Operating Expenses
  expenses: ExpenseBreakdown[];
  totalExpenses: number;

  // Net Profit
  netProfit: number;            // grossProfit + otherIncome - totalExpenses
  isProfit: boolean;

  // Detail rows for display
  incomeAccounts: AccountBalance[];
  expenseAccounts: AccountBalance[];
  cogsAccounts: AccountBalance[];
}

export interface ExpenseBreakdown {
  code: string;
  name: string;
  amount: number;
}

export interface BalanceSheetData {
  // Assets
  currentAssets: AccountBalance[];
  fixedAssets: AccountBalance[];
  totalAssets: number;

  // Liabilities
  currentLiabilities: AccountBalance[];
  longTermLiabilities: AccountBalance[];
  totalLiabilities: number;

  // Equity
  equityAccounts: AccountBalance[];
  retainedEarnings: number;      // Net Profit transferred from P&L
  totalEquity: number;

  // Verification
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;           // Assets = Liabilities + Equity
  difference: number;
}

export interface GeneralLedgerEntry {
  date: Date;
  voucherNo: string;
  voucherType: string;
  narration: string;
  partyName: string | null;
  debit: number;
  credit: number;
  balance: number;      // Running balance (Dr - Cr for debit nature accounts)
}

export interface GeneralLedgerData {
  account: AccountBalance;
  openingBalance: number;
  entries: GeneralLedgerEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

export interface DayBookEntry {
  date: Date;
  voucherNo: string;
  voucherType: string;
  narration: string;
  partyName: string | null;
  entries: {
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
  }[];
  totalDebit: number;
  totalCredit: number;
}

/**
 * Core function: Compute account balances from VoucherEntry in a date range.
 * This is the single authoritative source for all accounting reports.
 *
 * @param companyId - Company tenant
 * @param fromDate - Start of period (optional, for periodic reports)
 * @param toDate - End of period (optional)
 * @param includeReversed - Whether to include reversed vouchers (default: false)
 */
export async function computeAccountBalances(
  companyId: string,
  fromDate?: Date,
  toDate?: Date,
  includeReversed = false
): Promise<AccountBalance[]> {
  // Fetch all company accounts
  const accounts = await prisma.account.findMany({
    where: { companyId },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  if (accounts.length === 0) return [];

  // Build voucher date filter
  const voucherWhere: any = {
    companyId,
    isReversed: includeReversed ? undefined : false,
  };

  if (fromDate || toDate) {
    voucherWhere.date = {};
    if (fromDate) voucherWhere.date.gte = fromDate;
    if (toDate) voucherWhere.date.lte = toDate;
  }

  // Fetch all matching voucher entries in one query
  const entries = await prisma.voucherEntry.findMany({
    where: {
      account: { companyId },
      voucher: voucherWhere,
    },
    select: {
      accountId: true,
      debit: true,
      credit: true,
    },
  });

  // Aggregate entries per account
  const entryMap = new Map<string, { totalDebit: number; totalCredit: number }>();
  for (const e of entries) {
    const existing = entryMap.get(e.accountId) || { totalDebit: 0, totalCredit: 0 };
    existing.totalDebit += Number(e.debit);
    existing.totalCredit += Number(e.credit);
    entryMap.set(e.accountId, existing);
  }

  return accounts.map((acc) => {
    const agg = entryMap.get(acc.id) || { totalDebit: 0, totalCredit: 0 };
    const totalDebit = roundTo2(agg.totalDebit);
    const totalCredit = roundTo2(agg.totalCredit);
    const openingBalance = roundTo2(Number(acc.openingBalance));
    const isDebitNature = ["ASSET", "EXPENSE"].includes(acc.type);

    // Normal balance: Dr nature accounts have Dr balance, Cr nature have Cr balance
    const closingBalance = roundTo2(
      isDebitNature
        ? openingBalance + totalDebit - totalCredit
        : openingBalance + totalCredit - totalDebit
    );

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      groupId: acc.groupId,
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance,
      isDebitNature,
    };
  });
}

/**
 * TRIAL BALANCE
 * Lists all accounts with debit/credit columns.
 * Total Dr must equal Total Cr for accounting integrity.
 */
export async function getTrialBalance(params: {
  companyId: string;
  from?: Date;
  to?: Date;
}): Promise<{
  rows: TrialBalanceRow[];
  totalDr: number;
  totalCr: number;
  isBalanced: boolean;
  difference: number;
}> {
  const balances = await computeAccountBalances(params.companyId, params.from, params.to);

  let totalDr = 0;
  let totalCr = 0;

  const rows: TrialBalanceRow[] = balances
    .filter((b) => b.closingBalance !== 0 || b.totalDebit !== 0 || b.totalCredit !== 0)
    .map((b) => {
      let drColumn = 0;
      let crColumn = 0;

      if (b.isDebitNature) {
        if (b.closingBalance >= 0) {
          drColumn = b.closingBalance;
          totalDr += drColumn;
        } else {
          crColumn = Math.abs(b.closingBalance);
          totalCr += crColumn;
        }
      } else {
        if (b.closingBalance >= 0) {
          crColumn = b.closingBalance;
          totalCr += crColumn;
        } else {
          drColumn = Math.abs(b.closingBalance);
          totalDr += drColumn;
        }
      }

      return { ...b, drColumn, crColumn };
    });

  const difference = roundTo2(Math.abs(totalDr - totalCr));
  return {
    rows,
    totalDr: roundTo2(totalDr),
    totalCr: roundTo2(totalCr),
    isBalanced: difference < 0.01,
    difference,
  };
}

/**
 * PROFIT & LOSS STATEMENT
 * Computes Gross Profit (Sales - COGS) and Net Profit (Gross - Expenses).
 * Uses COGS account (5400) and inventory account (1200) for proper GP computation.
 */
export async function getProfitAndLoss(params: {
  companyId: string;
  from?: Date;
  to?: Date;
}): Promise<ProfitLossData> {
  const balances = await computeAccountBalances(params.companyId, params.from, params.to);

  // INCOME accounts
  const salesAccounts = balances.filter((b) => b.type === "INCOME" && b.code === "4001");
  const salesReturnAccounts = balances.filter((b) => b.code === "4002"); // Sales Return (reduces income)
  const otherIncomeAccounts = balances.filter(
    (b) => b.type === "INCOME" && b.code !== "4001" && b.code !== "4002"
  );

  const salesRevenue = roundTo2(salesAccounts.reduce((s, a) => s + Math.abs(a.closingBalance), 0));
  const salesReturn = roundTo2(salesReturnAccounts.reduce((s, a) => s + Math.abs(a.closingBalance), 0));
  const netSales = roundTo2(salesRevenue - salesReturn);
  const otherIncome = roundTo2(otherIncomeAccounts.reduce((s, a) => s + a.closingBalance, 0));
  const totalRevenue = roundTo2(netSales + otherIncome);

  // COGS accounts (5400 = COGS, or derived from purchase+stock change)
  const cogsAccounts = balances.filter((b) => b.code === "5400" || b.groupId === "COGS");
  const purchaseAccounts = balances.filter((b) => b.code === "5001");
  const purchaseReturnAccounts = balances.filter((b) => b.code === "5002");
  const stockAccount = balances.filter((b) => b.code === "1200"); // Stock in Hand

  const purchases = roundTo2(purchaseAccounts.reduce((s, a) => s + Math.abs(a.closingBalance), 0));
  const purchaseReturn = roundTo2(purchaseReturnAccounts.reduce((s, a) => s + Math.abs(a.closingBalance), 0));
  const directCogs = roundTo2(cogsAccounts.reduce((s, a) => s + Math.abs(a.closingBalance), 0));

  // COGS is sum of direct COGS (5400) plus net purchases (5001 - 5002)
  const netPurchases = roundTo2(purchases - purchaseReturn);
  const cogs = roundTo2(directCogs + (netPurchases > 0 ? netPurchases : 0));

  const openingStock = roundTo2(stockAccount.reduce((s, a) => s + a.openingBalance, 0));
  const closingStock = roundTo2(stockAccount.reduce((s, a) => s + a.closingBalance, 0));

  const grossProfit = roundTo2(netSales - cogs);

  // OPERATING EXPENSES (all EXPENSE accounts except Purchase & COGS)
  const expenseAccounts = balances.filter(
    (b) =>
      b.type === "EXPENSE" &&
      b.code !== "5001" &&
      b.code !== "5002" &&
      b.code !== "5400" &&
      b.groupId !== "COGS" &&
      b.closingBalance !== 0
  );
  const totalExpenses = roundTo2(expenseAccounts.reduce((s, a) => s + a.closingBalance, 0));

  const netProfit = roundTo2(grossProfit + otherIncome - totalExpenses);

  return {
    salesRevenue,
    salesReturn,
    netSales,
    otherIncome,
    totalRevenue,
    openingStock,
    purchases,
    purchaseReturn,
    closingStock,
    cogs,
    grossProfit,
    expenses: expenseAccounts.map((a) => ({ code: a.code, name: a.name, amount: a.closingBalance })),
    totalExpenses,
    netProfit,
    isProfit: netProfit >= 0,
    incomeAccounts: balances.filter((b) => b.type === "INCOME"),
    expenseAccounts,
    cogsAccounts: [...cogsAccounts, ...purchaseAccounts, ...purchaseReturnAccounts],
  };
}

/**
 * BALANCE SHEET
 * Assets = Liabilities + Equity + Retained Earnings (Net Profit from P&L)
 * Verifies the accounting equation.
 */
export async function getBalanceSheet(params: {
  companyId: string;
  from?: Date;
  to?: Date;
}): Promise<BalanceSheetData> {
  const balances = await computeAccountBalances(params.companyId, params.from, params.to);

  // Get net profit for retained earnings
  const pl = await getProfitAndLoss(params);

  // ASSETS
  const assetAccounts = balances.filter((b) => b.type === "ASSET" && b.closingBalance !== 0);

  // Current Assets: Cash, Bank, Debtors, Stock, Advances (codes 1xxx)
  const currentAssets = assetAccounts.filter((b) => {
    const code = parseInt(b.code);
    return code >= 1000 && code < 1500; // 1001-1499
  });

  // Fixed Assets: 1500+ asset codes
  const fixedAssets = assetAccounts.filter((b) => {
    const code = parseInt(b.code);
    return code >= 1500;
  });

  const totalAssets = roundTo2(assetAccounts.reduce((s, a) => s + a.closingBalance, 0));

  // LIABILITIES
  const liabilityAccounts = balances.filter((b) => b.type === "LIABILITY" && b.closingBalance !== 0);

  // Current Liabilities: Creditors, Tax payable, Customer advances (codes 2xxx)
  const currentLiabilities = liabilityAccounts.filter((b) => {
    const code = parseInt(b.code);
    return code >= 2000 && code < 2500;
  });

  const longTermLiabilities = liabilityAccounts.filter((b) => {
    const code = parseInt(b.code);
    return code >= 2500;
  });

  const totalLiabilities = roundTo2(liabilityAccounts.reduce((s, a) => s + a.closingBalance, 0));

  // EQUITY
  const equityAccounts = balances.filter((b) => b.type === "EQUITY" && b.closingBalance !== 0);
  const totalEquityBase = roundTo2(equityAccounts.reduce((s, a) => s + a.closingBalance, 0));
  const retainedEarnings = pl.netProfit; // Net Profit flows into retained earnings
  const totalEquity = roundTo2(totalEquityBase + retainedEarnings);

  const totalLiabilitiesAndEquity = roundTo2(totalLiabilities + totalEquity);
  const difference = roundTo2(Math.abs(totalAssets - totalLiabilitiesAndEquity));

  return {
    currentAssets,
    fixedAssets,
    totalAssets,
    currentLiabilities,
    longTermLiabilities,
    totalLiabilities,
    equityAccounts,
    retainedEarnings,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced: difference < 1, // Allow small rounding tolerance
    difference,
  };
}

/**
 * GENERAL LEDGER
 * Chronological transaction history for a single account with running balance.
 */
export async function getGeneralLedger(params: {
  companyId: string;
  accountId: string;
  from?: Date;
  to?: Date;
}): Promise<GeneralLedgerData> {
  const account = await prisma.account.findFirst({
    where: { id: params.accountId, companyId: params.companyId },
  });

  if (!account) throw new Error("Account not found");

  const openingBalance = roundTo2(Number(account.openingBalance));

  // Fetch voucher entries
  const voucherWhere: any = {
    companyId: params.companyId,
    isReversed: false,
  };

  if (params.from || params.to) {
    voucherWhere.date = {};
    if (params.from) voucherWhere.date.gte = params.from;
    if (params.to) voucherWhere.date.lte = params.to;
  }

  const entries = await prisma.voucherEntry.findMany({
    where: {
      accountId: params.accountId,
      voucher: voucherWhere,
    },
    include: {
      voucher: {
        include: {
          company: false,
          entries: false,
          invoices: false,
          expenses: false,
          payments: false,
        },
      },
    },
    orderBy: [{ voucher: { date: "asc" } }, { voucher: { createdAt: "asc" } }],
  });

  const isDebitNature = ["ASSET", "EXPENSE"].includes(account.type);
  let runningBalance = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  // Resolve party names from vouchers
  const partyIds = [...new Set(entries.map((e) => e.voucher.partyId).filter(Boolean))];
  const parties =
    partyIds.length > 0
      ? await prisma.party.findMany({ where: { id: { in: partyIds as string[] } }, select: { id: true, name: true } })
      : [];
  const partyMap = new Map(parties.map((p) => [p.id, p.name]));

  const ledgerEntries: GeneralLedgerEntry[] = entries.map((e) => {
    const dr = roundTo2(Number(e.debit));
    const cr = roundTo2(Number(e.credit));
    totalDebit = roundTo2(totalDebit + dr);
    totalCredit = roundTo2(totalCredit + cr);

    if (isDebitNature) {
      runningBalance = roundTo2(runningBalance + dr - cr);
    } else {
      runningBalance = roundTo2(runningBalance + cr - dr);
    }

    return {
      date: e.voucher.date,
      voucherNo: e.voucher.voucherNo,
      voucherType: e.voucher.type,
      narration: e.voucher.narration || "",
      partyName: e.voucher.partyId ? partyMap.get(e.voucher.partyId) || null : null,
      debit: dr,
      credit: cr,
      balance: runningBalance,
    };
  });

  const accountData: AccountBalance = {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    groupId: account.groupId,
    openingBalance,
    totalDebit,
    totalCredit,
    closingBalance: runningBalance,
    isDebitNature,
  };

  return {
    account: accountData,
    openingBalance,
    entries: ledgerEntries,
    closingBalance: runningBalance,
    totalDebit,
    totalCredit,
  };
}

/**
 * DAY BOOK
 * All vouchers for a date range, grouped by date, showing all entries.
 */
export async function getDayBook(params: {
  companyId: string;
  from?: Date;
  to?: Date;
  voucherType?: string;  // Optional: filter by SALES, PURCHASE, PAYMENT, RECEIPT, JOURNAL
}): Promise<DayBookEntry[]> {
  const where: any = {
    companyId: params.companyId,
    isReversed: false,
  };

  if (params.from || params.to) {
    where.date = {};
    if (params.from) where.date.gte = params.from;
    if (params.to) where.date.lte = params.to;
  }

  if (params.voucherType) {
    where.type = params.voucherType;
  }

  const vouchers = await prisma.voucher.findMany({
    where,
    include: {
      entries: {
        include: {
          account: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  // Resolve party names
  const partyIds = [...new Set(vouchers.map((v) => v.partyId).filter(Boolean))];
  const parties =
    partyIds.length > 0
      ? await prisma.party.findMany({ where: { id: { in: partyIds as string[] } }, select: { id: true, name: true } })
      : [];
  const partyMap = new Map(parties.map((p) => [p.id, p.name]));

  return vouchers.map((v) => {
    const entryRows = v.entries.map((e) => ({
      accountCode: e.account.code,
      accountName: e.account.name,
      debit: roundTo2(Number(e.debit)),
      credit: roundTo2(Number(e.credit)),
    }));

    const totalDebit = roundTo2(entryRows.reduce((s, e) => s + e.debit, 0));
    const totalCredit = roundTo2(entryRows.reduce((s, e) => s + e.credit, 0));

    return {
      date: v.date,
      voucherNo: v.voucherNo,
      voucherType: v.type,
      narration: v.narration || "",
      partyName: v.partyId ? partyMap.get(v.partyId) || null : null,
      entries: entryRows,
      totalDebit,
      totalCredit,
    };
  });
}

/**
 * CASH BOOK
 * All transactions involving Cash account (1001).
 */
export async function getCashBook(params: {
  companyId: string;
  from?: Date;
  to?: Date;
}): Promise<GeneralLedgerData> {
  const cashAccount = await prisma.account.findFirst({
    where: { companyId: params.companyId, code: "1001" },
  });

  if (!cashAccount) {
    throw new Error("Cash account (1001) not found. Please ensure Chart of Accounts is seeded.");
  }

  return getGeneralLedger({
    companyId: params.companyId,
    accountId: cashAccount.id,
    from: params.from,
    to: params.to,
  });
}

/**
 * BANK BOOK
 * All transactions involving Bank account (1002 or 1003).
 */
export async function getBankBook(params: {
  companyId: string;
  from?: Date;
  to?: Date;
}): Promise<GeneralLedgerData[]> {
  const bankAccounts = await prisma.account.findMany({
    where: {
      companyId: params.companyId,
      groupId: "Bank-Accounts",
    },
    orderBy: { code: "asc" },
  });

  if (bankAccounts.length === 0) {
    throw new Error("No bank accounts found. Please ensure Chart of Accounts is seeded.");
  }

  return Promise.all(
    bankAccounts.map((acc) =>
      getGeneralLedger({
        companyId: params.companyId,
        accountId: acc.id,
        from: params.from,
        to: params.to,
      })
    )
  );
}

/**
 * JOURNAL REGISTER
 * All Journal and Contra vouchers in a date range.
 */
export async function getJournalRegister(params: {
  companyId: string;
  from?: Date;
  to?: Date;
}): Promise<DayBookEntry[]> {
  return getDayBook({
    companyId: params.companyId,
    from: params.from,
    to: params.to,
    voucherType: "JOURNAL",
  });
}

/**
 * RECEIVABLE / PAYABLE SUMMARY
 * Computed from transaction + payment state (not a separate contradictory balance).
 * Uses Invoice.grandTotal - Invoice.paidAmount for accuracy.
 */
export async function getReceivablePayableSummary(params: {
  companyId: string;
  from?: Date;
  to?: Date;
}): Promise<{
  totalReceivable: number;
  totalPayable: number;
  customerBalances: { partyId: string; name: string; outstanding: number; overdue: number }[];
  supplierBalances: { partyId: string; name: string; outstanding: number; overdue: number }[];
}> {
  const now = new Date();

  // Receivables (SALES invoices not fully paid)
  const salesInvoices = await prisma.invoice.findMany({
    where: {
      companyId: params.companyId,
      type: "SALES",
      status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
      ...(params.from || params.to
        ? {
            date: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    },
    include: { party: { select: { id: true, name: true } } },
  });

  // Payables (PURCHASE invoices not fully paid)
  const purchaseInvoices = await prisma.invoice.findMany({
    where: {
      companyId: params.companyId,
      type: "PURCHASE",
      status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
      ...(params.from || params.to
        ? {
            date: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    },
    include: { party: { select: { id: true, name: true } } },
  });

  // Group by party
  const customerMap = new Map<string, { name: string; outstanding: number; overdue: number }>();
  const supplierMap = new Map<string, { name: string; outstanding: number; overdue: number }>();

  for (const inv of salesInvoices) {
    const outstanding = roundTo2(Math.max(0, Number(inv.grandTotal) - Number(inv.paidAmount)));
    if (outstanding <= 0) continue;

    const partyId = inv.partyId || "UNKNOWN";
    const partyName = inv.party?.name || "Cash Customer";
    const existing = customerMap.get(partyId) || { name: partyName, outstanding: 0, overdue: 0 };
    existing.outstanding = roundTo2(existing.outstanding + outstanding);

    const isOverdue = inv.dueDate && inv.dueDate < now;
    if (isOverdue) existing.overdue = roundTo2(existing.overdue + outstanding);

    customerMap.set(partyId, existing);
  }

  for (const inv of purchaseInvoices) {
    const outstanding = roundTo2(Math.max(0, Number(inv.grandTotal) - Number(inv.paidAmount)));
    if (outstanding <= 0) continue;

    const partyId = inv.partyId || "UNKNOWN";
    const partyName = inv.party?.name || "Unknown Supplier";
    const existing = supplierMap.get(partyId) || { name: partyName, outstanding: 0, overdue: 0 };
    existing.outstanding = roundTo2(existing.outstanding + outstanding);

    const isOverdue = inv.dueDate && inv.dueDate < now;
    if (isOverdue) existing.overdue = roundTo2(existing.overdue + outstanding);

    supplierMap.set(partyId, existing);
  }

  const customerBalances = [...customerMap.entries()].map(([partyId, data]) => ({
    partyId,
    ...data,
  }));
  const supplierBalances = [...supplierMap.entries()].map(([partyId, data]) => ({
    partyId,
    ...data,
  }));

  const totalReceivable = roundTo2(customerBalances.reduce((s, c) => s + c.outstanding, 0));
  const totalPayable = roundTo2(supplierBalances.reduce((s, c) => s + c.outstanding, 0));

  return { totalReceivable, totalPayable, customerBalances, supplierBalances };
}

/**
 * ACCOUNTING INTEGRITY CHECK
 * Verifies that all posted vouchers have balanced entries (Dr = Cr).
 * Returns list of unbalanced vouchers if any.
 */
export async function checkAccountingIntegrity(companyId: string): Promise<{
  isIntegral: boolean;
  totalVouchers: number;
  unbalancedVouchers: { voucherNo: string; totalDebit: number; totalCredit: number; difference: number }[];
}> {
  const vouchers = await prisma.voucher.findMany({
    where: { companyId, isReversed: false },
    include: {
      entries: { select: { debit: true, credit: true } },
    },
  });

  const unbalancedVouchers = [];

  for (const v of vouchers) {
    const totalDebit = roundTo2(v.entries.reduce((s, e) => s + Number(e.debit), 0));
    const totalCredit = roundTo2(v.entries.reduce((s, e) => s + Number(e.credit), 0));
    const difference = roundTo2(Math.abs(totalDebit - totalCredit));

    if (difference > 0.01) {
      unbalancedVouchers.push({
        voucherNo: v.voucherNo,
        totalDebit,
        totalCredit,
        difference,
      });
    }
  }

  return {
    isIntegral: unbalancedVouchers.length === 0,
    totalVouchers: vouchers.length,
    unbalancedVouchers,
  };
}
