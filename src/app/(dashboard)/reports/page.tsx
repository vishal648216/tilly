import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import Link from "next/link";
import TrialBalanceTable from "./TrialBalanceTable";
import ProfitLossTable from "./ProfitLossTable";
import { 
  FileText, 
  BarChart3, 
  PieChart, 
  Layers, 
  FileSpreadsheet, 
  Download, 
  ArrowRight,
  ShieldCheck
} from "lucide-react";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  // Fetch all accounts
  const accounts = await prisma.account.findMany({
    where: { companyId: company.id },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  // Calculate balance for each account from voucher entries
  const accountsWithBalance = await Promise.all(
    accounts.map(async (acc) => {
      const entries = await prisma.voucherEntry.findMany({
        where: { accountId: acc.id, voucher: { isReversed: false } },
        select: { debit: true, credit: true },
      });

      const totalDebit = entries.reduce(
        (sum, e) => sum + parseFloat(e.debit.toString()),
        0
      );
      const totalCredit = entries.reduce(
        (sum, e) => sum + parseFloat(e.credit.toString()),
        0
      );

      // For assets/expenses: normal balance = debit side
      // For liabilities/equity/income: normal balance = credit side
      const isDebitNature = ["ASSET", "EXPENSE"].includes(acc.type);
      const balance = isDebitNature
        ? totalDebit - totalCredit + parseFloat(acc.openingBalance.toString())
        : totalCredit - totalDebit + parseFloat(acc.openingBalance.toString());

      return {
        ...acc,
        totalDebit,
        totalCredit,
        balance,
      };
    })
  );

  const vouchersCount = await prisma.voucher.count({
    where: { companyId: company.id, isReversed: false },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reports & Financial Statements</h1>
        <p className="text-sm text-slate-500">
          {company.name} — {vouchersCount} vouchers posted
        </p>
      </div>

      <div className="space-y-8">
        {/* GST Reports quick links */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-slate-900">GST Reports</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link href="/reports/gstr-1" className="card p-5 transition-all hover:border-brand-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-brand-700">GSTR-1 — Outward Supplies</h3>
                <ArrowRight className="h-4 w-4 text-brand-500" />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Sales invoices with rate-wise GST breakup + invoice details
              </p>
            </Link>
            <Link href="/reports/gstr-3b" className="card p-5 transition-all hover:border-brand-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-brand-700">GSTR-3B — Tax Liability</h3>
                <ArrowRight className="h-4 w-4 text-brand-500" />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Output tax vs input tax credit → net tax payable summary
              </p>
            </Link>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-slate-900">Trial Balance</h2>
          </div>
          <TrialBalanceTable accounts={accountsWithBalance} />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="h-5 w-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-slate-900">Profit & Loss Statement</h2>
          </div>
          <ProfitLossTable accounts={accountsWithBalance} />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-slate-900">Chart of Accounts</h2>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Account Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                {accountsWithBalance.map((acc) => (
                  <tr key={acc.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-slate-500">{acc.code}</td>
                    <td className="px-4 py-2 font-medium">{acc.name}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`badge ${
                          acc.type === "ASSET"
                            ? "bg-blue-100 text-blue-700"
                            : acc.type === "LIABILITY"
                            ? "bg-orange-100 text-orange-700"
                            : acc.type === "EQUITY"
                            ? "bg-purple-100 text-purple-700"
                            : acc.type === "INCOME"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {acc.type}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        acc.balance > 0 ? "text-slate-900" : "text-red-500"
                      }`}
                    >
                      {formatCurrency(acc.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">System Data & Excel Backup</h2>
          </div>
          <div className="card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-emerald-50/50 border-emerald-200">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900">Download Complete Excel Backup</h3>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Download all your business data ({company.name}) directly in <strong>Microsoft Excel (.CSV)</strong> format — including Invoices, Parties, Stock Items, Expenses, and Ledger Vouchers.
              </p>
            </div>
            <a
              href="/api/backup"
              download
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              <Download className="h-4 w-4" /> Download Excel Backup (.CSV)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
