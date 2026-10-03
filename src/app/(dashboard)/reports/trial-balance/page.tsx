import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { getTrialBalance } from "@/lib/accounting";
import { getCurrentFinancialYear, getPreviousFinancialYear } from "@/lib/financialYear";
import { formatCurrency } from "@/lib/currency";
import { Layers, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: { preset?: string; from?: string; to?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const currentFy = await getCurrentFinancialYear(company.id);
  const previousFy = await getPreviousFinancialYear(company.id);

  const preset = searchParams.preset?.toUpperCase() || "CURRENT_FY";
  let fromDate = currentFy.startDate;
  let toDate = currentFy.endDate;
  let periodLabel = currentFy.label;

  if (preset === "PREVIOUS_FY") {
    fromDate = previousFy.startDate;
    toDate = previousFy.endDate;
    periodLabel = previousFy.label;
  } else if (preset === "THIS_MONTH") {
    const now = new Date();
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    periodLabel = "This Month";
  }

  const tb = await getTrialBalance({ companyId: company.id, from: fromDate, to: toDate });

  const typeOrder = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];
  const grouped = typeOrder.map((type) => ({
    type,
    rows: tb.rows.filter((r) => r.type === type),
  })).filter((g) => g.rows.length > 0);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Layers className="h-6 w-6 text-brand-600" />
          <h1 className="text-2xl font-bold">Trial Balance</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {company.name} — <span className="font-medium text-brand-600">{periodLabel}</span>
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        {[
          { preset: "THIS_MONTH", label: "This Month" },
          { preset: "CURRENT_FY", label: `Current FY (${currentFy.label})` },
          { preset: "PREVIOUS_FY", label: `Previous FY (${previousFy.label})` },
        ].map((p) => (
          <Link
            key={p.preset}
            href={`/reports/trial-balance?preset=${p.preset}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              preset === p.preset ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* Balance Check Banner */}
      <div className={`mb-6 rounded-lg border p-3 flex items-center gap-2 text-sm ${
        tb.isBalanced ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
      }`}>
        {tb.isBalanced
          ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          : <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
        <span>
          {tb.isBalanced
            ? `✅ Trial Balance is Balanced — Total Debits = Total Credits = ${formatCurrency(tb.totalDr)}`
            : `⚠ Trial Balance is NOT balanced! Difference: ${formatCurrency(tb.difference)}`}
          {" "}| {tb.rows.length} accounts
        </span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium w-16">Code</th>
              <th className="px-4 py-3 font-medium">Account Name</th>
              <th className="px-4 py-3 font-medium text-center w-24">Type</th>
              <th className="px-4 py-3 text-right font-medium">Debit (₹)</th>
              <th className="px-4 py-3 text-right font-medium">Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((group) => (
              <>
                <tr key={group.type} className="bg-slate-100/70">
                  <td className="px-4 py-2 text-xs font-bold uppercase text-slate-600" colSpan={5}>
                    {group.type === "ASSET" ? "🏦 Assets" :
                     group.type === "LIABILITY" ? "📋 Liabilities" :
                     group.type === "EQUITY" ? "💼 Equity / Capital" :
                     group.type === "INCOME" ? "📈 Income" : "📉 Expenses"}
                  </td>
                </tr>
                {group.rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">{r.code}</td>
                    <td className="px-4 py-2 font-medium">
                      <Link
                        href={`/reports/general-ledger?accountId=${r.id}`}
                        className="hover:text-brand-600 hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`badge text-xs ${
                        r.type === "ASSET" ? "bg-blue-100 text-blue-700" :
                        r.type === "LIABILITY" ? "bg-orange-100 text-orange-700" :
                        r.type === "EQUITY" ? "bg-purple-100 text-purple-700" :
                        r.type === "INCOME" ? "bg-green-100 text-green-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {r.drColumn > 0 ? formatCurrency(r.drColumn) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-500">
                      {r.crColumn > 0 ? formatCurrency(r.crColumn) : "—"}
                    </td>
                  </tr>
                ))}
              </>
            ))}

            {tb.rows.length === 0 && (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-slate-400" colSpan={5}>
                  No voucher entries yet. Trial balance will appear here after transactions are posted.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
            <tr>
              <td className="px-4 py-3 text-sm" colSpan={3}>
                <span className={tb.isBalanced ? "text-emerald-600" : "text-red-600"}>
                  {tb.isBalanced ? <CheckCircle2 className="inline h-4 w-4 mr-1" /> : <AlertTriangle className="inline h-4 w-4 mr-1" />}
                  {tb.isBalanced ? "Balanced" : `Not Balanced — Diff: ${formatCurrency(tb.difference)}`}
                </span>
              </td>
              <td className="px-4 py-3 text-right">{formatCurrency(tb.totalDr)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(tb.totalCr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
