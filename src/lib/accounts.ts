// Taily - Default Chart of Accounts
// Standard Indian SME chart of accounts (Tally-style groups).
// Used when a new company is created.

export type AccountSeed = {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  groupId: string;
};

export const DEFAULT_CHART_OF_ACCOUNTS: AccountSeed[] = [
  // ===== ASSETS =====
  { code: "1001", name: "Cash in Hand", type: "ASSET", groupId: "Cash-in-Hand" },
  { code: "1002", name: "Bank Accounts", type: "ASSET", groupId: "Bank-Accounts" },
  { code: "1003", name: "Bank of Baroda", type: "ASSET", groupId: "Bank-Accounts" },
  { code: "1100", name: "Sundry Debtors", type: "ASSET", groupId: "Sundry-Debtors" },
  { code: "1200", name: "Stock in Hand", type: "ASSET", groupId: "Stock-in-Hand" },
  { code: "1300", name: "Input CGST", type: "ASSET", groupId: "Duties-Taxes" },
  { code: "1301", name: "Input SGST", type: "ASSET", groupId: "Duties-Taxes" },
  { code: "1302", name: "Input IGST", type: "ASSET", groupId: "Duties-Taxes" },

  // ===== LIABILITIES =====
  { code: "2001", name: "Sundry Creditors", type: "LIABILITY", groupId: "Sundry-Creditors" },
  { code: "2100", name: "Output CGST", type: "LIABILITY", groupId: "Duties-Taxes" },
  { code: "2101", name: "Output SGST", type: "LIABILITY", groupId: "Duties-Taxes" },
  { code: "2102", name: "Output IGST", type: "LIABILITY", groupId: "Duties-Taxes" },
  { code: "2200", name: "Loans (Liability)", type: "LIABILITY", groupId: "Loans" },

  // ===== EQUITY / CAPITAL =====
  { code: "3001", name: "Capital Account", type: "EQUITY", groupId: "Capital-Account" },
  { code: "3002", name: "Drawings", type: "EQUITY", groupId: "Capital-Account" },

  // ===== INCOME =====
  { code: "4001", name: "Sales", type: "INCOME", groupId: "Sales-Accounts" },
  { code: "4002", name: "Sales Return", type: "INCOME", groupId: "Sales-Accounts" },
  { code: "4100", name: "Other Income", type: "INCOME", groupId: "Indirect-Income" },
  { code: "4900", name: "Round Off", type: "INCOME", groupId: "Indirect-Income" },

  // ===== EXPENSES =====
  { code: "5001", name: "Purchase", type: "EXPENSE", groupId: "Purchase-Accounts" },
  { code: "5002", name: "Purchase Return", type: "EXPENSE", groupId: "Purchase-Accounts" },
  { code: "5100", name: "Rent", type: "EXPENSE", groupId: "Indirect-Expense" },
  { code: "5101", name: "Salaries & Wages", type: "EXPENSE", groupId: "Indirect-Expense" },
  { code: "5102", name: "Electricity", type: "EXPENSE", groupId: "Indirect-Expense" },
  { code: "5103", name: "Telephone & Internet", type: "EXPENSE", groupId: "Indirect-Expense" },
  { code: "5104", name: "Printing & Stationery", type: "EXPENSE", groupId: "Indirect-Expense" },
  { code: "5105", name: "Bank Charges", type: "EXPENSE", groupId: "Indirect-Expense" },
  { code: "5106", name: "Travelling & Conveyance", type: "EXPENSE", groupId: "Indirect-Expense" },
  { code: "5107", name: "Office Expenses", type: "EXPENSE", groupId: "Indirect-Expense" },
];
