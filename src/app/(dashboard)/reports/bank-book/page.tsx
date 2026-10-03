import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { getBankBook } from "@/lib/accounting";
import { getCurrentFinancialYear } from "@/lib/financialYear";
import { formatCurrency } from "@/lib/currency";
import { Building2 } from "lucide-react";
import Link from "next/link";

export default async function BankBookPage({
  searchParams,
}: {
  searchParams: { preset?: string; from?: string; to?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const currentFy = await getCurrentFinancialYear(company.id);
  const preset = searchParams.preset?.toUpperCase() || "CURRENT_FY";
  let fromDate = currentFy.startDate;
  let toDate = currentFy.endDate;
  let periodLabel = currentFy.label;

  if (preset === "THIS_MONTH") {
    const now = new Date();
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    periodLabel = "This Month";
  }

  let bankBooks: Awaited<ReturnType<typeof getBankBook>> = [];
  let error = null;
  try {
    bankBooks = await getBankBook({ companyId: company.id, from: fromDate, to: toDate });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load bank book";
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Building2 className="h-6 w-6 text-brand-600" />
        <div>
          <h1 className="text-2xl font-bold">Bank Book</h1>
          <p className="text-sm text-slate-500">{company.name} — Bank Accounts — {periodLabel}</p>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        {[
          { preset: "THIS_MONTH", label: "This Month" },
          { preset: "CURRENT_FY", label: currentFy.label },
        ].map((p) => (
          <Link
            key={p.preset}
            href={`/reports/bank-book?preset=${p.preset}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              preset === p.preset ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {error && (
        <div className="card p-4 bg-amber-50 border-amber-200 text-amber-800 text-sm mb-4">
          {error}
          <p className="mt-1 text-xs">Bank accounts (groupId: Bank-Accounts) need to be created first.</p>
        </div>
      )}

      {bankBooks.length === 0 && !error && (
        <div className="card p-8 text-center text-slate-400">
          <Building2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>No bank accounts found. Add bank account transactions to see them here.</p>
        </div>
      )}

      {bankBooks.map((bankBook, idx) => (
        <div key={idx} className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">
              {bankBook.account.code} — {bankBook.account.name}
            </h2>
            <div className="flex gap-4 text-sm">
              <span className="text-slate-500">
                Opening: <strong>{formatCurrency(bankBook.openingBalance)}</strong>
              </span>
              <span className={bankBook.closingBalance >= 0 ? "text-emerald-700" : "text-red-600"}>
                Closing: <strong>{formatCurrency(bankBook.closingBalance)}</strong>
              </span>
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Voucher No.</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Particulars</th>
                  <th className="px-4 py-3 text-right">Receipts (₹)</th>
                  <th className="px-4 py-3 text-right">Payments (₹)</th>
                  <th className="px-4 py-3 text-right">Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td className="px-4 py-2 text-xs text-slate-400" colSpan={4}>Opening Balance</td>
                  <td className="px-4 py-2" colSpan={2}></td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(bankBook.openingBalance)}</td>
                </tr>
                {bankBook.entries.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={7}>
                      No bank transactions in this period.
                    </td>
                  </tr>
                ) : (
                  bankBook.entries.map((e, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-2 font-mono text-xs text-brand-700">{e.voucherNo}</td>
                      <td className="px-4 py-2">
                        <span className={`badge text-xs ${
                          e.voucherType === "RECEIPT" ? "bg-emerald-100 text-emerald-700" :
                          e.voucherType === "PAYMENT" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>{e.voucherType}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {e.narration || "—"}
                        {e.partyName && <span className="text-slate-400"> | {e.partyName}</span>}
                      </td>
                      <td className="px-4 py-2 text-right text-emerald-700 font-medium">
                        {e.debit > 0 ? formatCurrency(e.debit) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-red-600 font-medium">
                        {e.credit > 0 ? formatCurrency(e.credit) : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold ${e.balance >= 0 ? "text-slate-900" : "text-red-600"}`}>
                        {formatCurrency(e.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <tr>
                  <td className="px-4 py-3" colSpan={4}>Closing Balance</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(bankBook.totalDebit)}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatCurrency(bankBook.totalCredit)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(bankBook.closingBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
