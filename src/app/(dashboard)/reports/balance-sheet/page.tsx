import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { getBalanceSheet } from "@/lib/accounting";
import { getCurrentFinancialYear, getPreviousFinancialYear } from "@/lib/financialYear";
import { formatCurrency } from "@/lib/currency";
import { CheckCircle2, AlertTriangle, Scale, TrendingUp, Building2 } from "lucide-react";
import Link from "next/link";

export default async function BalanceSheetPage({
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

  // Default: current FY
  const preset = searchParams.preset?.toUpperCase() || "CURRENT_FY";
  let fromDate = currentFy.startDate;
  let toDate = currentFy.endDate;
  let periodLabel = currentFy.label;

  if (preset === "PREVIOUS_FY") {
    fromDate = previousFy.startDate;
    toDate = previousFy.endDate;
    periodLabel = previousFy.label;
  } else if (preset === "CUSTOM" && searchParams.from && searchParams.to) {
    fromDate = new Date(searchParams.from + "T00:00:00");
    toDate = new Date(searchParams.to + "T23:59:59");
    periodLabel = `${searchParams.from} to ${searchParams.to}`;
  }

  const bs = await getBalanceSheet({
    companyId: company.id,
    from: fromDate,
    to: toDate,
  });

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-brand-600" />
          <h1 className="text-2xl font-bold text-slate-900">Balance Sheet</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {company.name} — As at {toDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          {" "}<span className="font-medium text-brand-600">({periodLabel})</span>
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        {["CURRENT_FY", "PREVIOUS_FY"].map((p) => (
          <Link
            key={p}
            href={`/reports/balance-sheet?preset=${p}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              preset === p ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p === "CURRENT_FY" ? `Current FY (${currentFy.label})` : `Previous FY (${previousFy.label})`}
          </Link>
        ))}
      </div>

      {/* Accounting Equation Check */}
      <div className={`mb-6 rounded-lg border p-4 flex items-center gap-3 ${
        bs.isBalanced ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
      }`}>
        {bs.isBalanced ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
        )}
        <div>
          <p className={`font-semibold ${bs.isBalanced ? "text-emerald-800" : "text-red-800"}`}>
            {bs.isBalanced
              ? "✅ Accounting Equation Verified: Assets = Liabilities + Equity"
              : `⚠ Out of Balance by ${formatCurrency(bs.difference)} — Please check accounting entries`}
          </p>
          <p className="text-sm text-slate-600 mt-0.5">
            Total Assets: <strong>{formatCurrency(bs.totalAssets)}</strong> |
            Total Liabilities + Equity: <strong>{formatCurrency(bs.totalLiabilitiesAndEquity)}</strong>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ASSETS */}
        <div className="card overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <h2 className="font-semibold text-blue-800">Assets</h2>
            <span className="ml-auto font-bold text-blue-700">{formatCurrency(bs.totalAssets)}</span>
          </div>

          <table className="w-full text-sm">
            <tbody>
              {bs.currentAssets.length > 0 && (
                <>
                  <tr className="bg-slate-50">
                    <td className="px-4 py-2 text-xs font-semibold uppercase text-slate-500" colSpan={2}>
                      Current Assets
                    </td>
                  </tr>
                  {bs.currentAssets.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs text-slate-400">{a.code}</span>{" "}
                        {a.name}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(a.closingBalance)}</td>
                    </tr>
                  ))}
                </>
              )}

              {bs.fixedAssets.length > 0 && (
                <>
                  <tr className="bg-slate-50">
                    <td className="px-4 py-2 text-xs font-semibold uppercase text-slate-500" colSpan={2}>
                      Fixed Assets
                    </td>
                  </tr>
                  {bs.fixedAssets.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs text-slate-400">{a.code}</span>{" "}
                        {a.name}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(a.closingBalance)}</td>
                    </tr>
                  ))}
                </>
              )}

              {bs.currentAssets.length === 0 && bs.fixedAssets.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-400" colSpan={2}>
                    No asset balances yet.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-blue-200 bg-blue-50 font-bold">
              <tr>
                <td className="px-4 py-3 text-blue-800">Total Assets</td>
                <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(bs.totalAssets)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* LIABILITIES + EQUITY */}
        <div className="space-y-4">
          {/* Liabilities */}
          <div className="card overflow-hidden">
            <div className="bg-orange-50 border-b border-orange-100 px-4 py-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-600" />
              <h2 className="font-semibold text-orange-800">Liabilities</h2>
              <span className="ml-auto font-bold text-orange-700">{formatCurrency(bs.totalLiabilities)}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {bs.currentLiabilities.length > 0 && (
                  <>
                    <tr className="bg-slate-50">
                      <td className="px-4 py-2 text-xs font-semibold uppercase text-slate-500" colSpan={2}>
                        Current Liabilities
                      </td>
                    </tr>
                    {bs.currentLiabilities.map((a) => (
                      <tr key={a.id} className="border-b border-slate-100">
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs text-slate-400">{a.code}</span>{" "}
                          {a.name}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(a.closingBalance)}</td>
                      </tr>
                    ))}
                  </>
                )}
                {bs.longTermLiabilities.length > 0 && (
                  <>
                    <tr className="bg-slate-50">
                      <td className="px-4 py-2 text-xs font-semibold uppercase text-slate-500" colSpan={2}>
                        Long-Term Liabilities
                      </td>
                    </tr>
                    {bs.longTermLiabilities.map((a) => (
                      <tr key={a.id} className="border-b border-slate-100">
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs text-slate-400">{a.code}</span>{" "}
                          {a.name}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(a.closingBalance)}</td>
                      </tr>
                    ))}
                  </>
                )}
                {bs.currentLiabilities.length === 0 && bs.longTermLiabilities.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-center text-sm text-slate-400" colSpan={2}>
                      No liability balances yet.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-orange-200 bg-orange-50 font-bold">
                <tr>
                  <td className="px-4 py-3 text-orange-800">Total Liabilities</td>
                  <td className="px-4 py-3 text-right text-orange-700">{formatCurrency(bs.totalLiabilities)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Equity */}
          <div className="card overflow-hidden">
            <div className="bg-purple-50 border-b border-purple-100 px-4 py-3 flex items-center gap-2">
              <h2 className="font-semibold text-purple-800">Capital & Equity</h2>
              <span className="ml-auto font-bold text-purple-700">{formatCurrency(bs.totalEquity)}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {bs.equityAccounts.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs text-slate-400">{a.code}</span>{" "}
                      {a.name}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(a.closingBalance)}</td>
                  </tr>
                ))}
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs text-slate-400">—</span>{" "}
                    Retained Earnings / Net P&L
                  </td>
                  <td className={`px-4 py-2 text-right font-medium ${bs.retainedEarnings >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {formatCurrency(bs.retainedEarnings)}
                  </td>
                </tr>
              </tbody>
              <tfoot className="border-t-2 border-purple-200 bg-purple-50 font-bold">
                <tr>
                  <td className="px-4 py-3 text-purple-800">Total Equity</td>
                  <td className="px-4 py-3 text-right text-purple-700">{formatCurrency(bs.totalEquity)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Total Liabilities + Equity */}
          <div className={`card px-4 py-3 flex items-center justify-between font-bold text-base ${
            bs.isBalanced ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
          }`}>
            <span className={bs.isBalanced ? "text-emerald-800" : "text-red-800"}>
              Total Liabilities + Equity
            </span>
            <span className={bs.isBalanced ? "text-emerald-700" : "text-red-700"}>
              {formatCurrency(bs.totalLiabilitiesAndEquity)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
