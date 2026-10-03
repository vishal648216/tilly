import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { getCashBook } from "@/lib/accounting";
import { getCurrentFinancialYear } from "@/lib/financialYear";
import { formatCurrency } from "@/lib/currency";
import { CreditCard } from "lucide-react";
import Link from "next/link";

export default async function CashBookPage({
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
  } else if (preset === "TODAY") {
    const now = new Date();
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    periodLabel = "Today";
  }

  let cashBook = null;
  let error = null;
  try {
    cashBook = await getCashBook({ companyId: company.id, from: fromDate, to: toDate });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load cash book";
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <CreditCard className="h-6 w-6 text-brand-600" />
        <div>
          <h1 className="text-2xl font-bold">Cash Book</h1>
          <p className="text-sm text-slate-500">{company.name} — Cash in Hand (1001) — {periodLabel}</p>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        {[
          { preset: "TODAY", label: "Today" },
          { preset: "THIS_MONTH", label: "This Month" },
          { preset: "CURRENT_FY", label: currentFy.label },
        ].map((p) => (
          <Link
            key={p.preset}
            href={`/reports/cash-book?preset=${p.preset}`}
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
          <p className="mt-1 text-xs">Cash account (1001) needs to be created. Go to Settings → Chart of Accounts.</p>
        </div>
      )}

      {cashBook && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-4">
              <p className="text-xs text-slate-500">Opening Balance</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(cashBook.openingBalance)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500">Cash In (Dr) / Cash Out (Cr)</p>
              <p className="text-sm font-medium text-slate-700">
                In: <span className="text-emerald-600">{formatCurrency(cashBook.totalDebit)}</span> |
                Out: <span className="text-red-600">{formatCurrency(cashBook.totalCredit)}</span>
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500">Closing Balance</p>
              <p className={`text-lg font-bold ${cashBook.closingBalance >= 0 ? "text-slate-900" : "text-red-600"}`}>
                {formatCurrency(cashBook.closingBalance)}
              </p>
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
                  <th className="px-4 py-3 text-right">Cash In (₹)</th>
                  <th className="px-4 py-3 text-right">Cash Out (₹)</th>
                  <th className="px-4 py-3 text-right">Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td className="px-4 py-2 text-xs text-slate-400" colSpan={4}>Opening Balance</td>
                  <td className="px-4 py-2" colSpan={2}></td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(cashBook.openingBalance)}</td>
                </tr>
                {cashBook.entries.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-400" colSpan={7}>
                      No cash transactions in this period.
                    </td>
                  </tr>
                ) : (
                  cashBook.entries.map((e, i) => (
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
                      <td className="px-4 py-2 text-right font-medium text-emerald-700">
                        {e.debit > 0 ? formatCurrency(e.debit) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-red-600">
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
                  <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(cashBook.totalDebit)}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatCurrency(cashBook.totalCredit)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(cashBook.closingBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
