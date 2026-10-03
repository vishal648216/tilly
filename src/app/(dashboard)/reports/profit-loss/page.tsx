import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { getProfitAndLoss } from "@/lib/accounting";
import { getCurrentFinancialYear, getPreviousFinancialYear } from "@/lib/financialYear";
import { formatCurrency } from "@/lib/currency";
import { PieChart, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

export default async function ProfitLossPage({
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
  } else if (preset === "CUSTOM" && searchParams.from && searchParams.to) {
    fromDate = new Date(searchParams.from + "T00:00:00");
    toDate = new Date(searchParams.to + "T23:59:59");
    periodLabel = `${searchParams.from} to ${searchParams.to}`;
  }

  const pl = await getProfitAndLoss({ companyId: company.id, from: fromDate, to: toDate });

  const gpMargin = pl.netSales > 0 ? ((pl.grossProfit / pl.netSales) * 100).toFixed(1) : "0.0";
  const npMargin = pl.netSales > 0 ? ((pl.netProfit / pl.netSales) * 100).toFixed(1) : "0.0";

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <PieChart className="h-6 w-6 text-brand-600" />
          <h1 className="text-2xl font-bold">Profit & Loss Statement</h1>
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
            href={`/reports/profit-loss?preset=${p.preset}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              preset === p.preset ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">Net Sales</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(pl.netSales)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">COGS</p>
          <p className="text-xl font-bold text-orange-600 mt-1">{formatCurrency(pl.cogs)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">Gross Profit ({gpMargin}%)</p>
          <p className={`text-xl font-bold mt-1 ${pl.grossProfit >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {formatCurrency(pl.grossProfit)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">Net {pl.isProfit ? "Profit" : "Loss"} ({npMargin}%)</p>
          <p className={`text-xl font-bold mt-1 ${pl.isProfit ? "text-emerald-600" : "text-red-600"}`}>
            {formatCurrency(Math.abs(pl.netProfit))}
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Particulars</th>
              <th className="px-4 py-3 text-right font-medium">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {/* REVENUE */}
            <tr className="bg-green-50/50">
              <td className="px-4 py-2 font-semibold text-green-700" colSpan={2}>
                <div className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Revenue</div>
              </td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-4 py-2 pl-8">Sales Revenue</td>
              <td className="px-4 py-2 text-right text-green-700">{formatCurrency(pl.salesRevenue)}</td>
            </tr>
            {pl.salesReturn > 0 && (
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 pl-8 text-slate-500">Less: Sales Return</td>
                <td className="px-4 py-2 text-right text-red-500">({formatCurrency(pl.salesReturn)})</td>
              </tr>
            )}
            <tr className="border-b border-slate-200 font-semibold bg-green-50/30">
              <td className="px-4 py-2 pl-8">Net Sales Revenue</td>
              <td className="px-4 py-2 text-right text-green-700">{formatCurrency(pl.netSales)}</td>
            </tr>

            {/* COGS */}
            <tr className="bg-orange-50/50">
              <td className="px-4 py-2 font-semibold text-orange-700" colSpan={2}>
                Cost of Goods Sold (COGS)
              </td>
            </tr>
            {pl.cogs > 0 ? (
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 pl-8">Cost of Goods Sold (at WAC)</td>
                <td className="px-4 py-2 text-right text-orange-600">{formatCurrency(pl.cogs)}</td>
              </tr>
            ) : (
              <>
                {pl.purchases > 0 && (
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-2 pl-8">Purchases</td>
                    <td className="px-4 py-2 text-right text-orange-600">{formatCurrency(pl.purchases)}</td>
                  </tr>
                )}
                {pl.purchaseReturn > 0 && (
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-2 pl-8 text-slate-500">Less: Purchase Return</td>
                    <td className="px-4 py-2 text-right text-green-600">({formatCurrency(pl.purchaseReturn)})</td>
                  </tr>
                )}
              </>
            )}
            <tr className="border-b border-slate-200 font-semibold bg-orange-50/30">
              <td className="px-4 py-2 pl-8">Total COGS</td>
              <td className="px-4 py-2 text-right text-orange-700">{formatCurrency(pl.cogs)}</td>
            </tr>

            {/* GROSS PROFIT */}
            <tr className="border-b-2 border-blue-200 bg-blue-50 font-bold">
              <td className="px-4 py-3 text-blue-800">Gross Profit</td>
              <td className={`px-4 py-3 text-right text-base ${pl.grossProfit >= 0 ? "text-blue-700" : "text-red-700"}`}>
                {formatCurrency(pl.grossProfit)}
                <span className="ml-2 text-xs font-normal">({gpMargin}% margin)</span>
              </td>
            </tr>

            {/* OTHER INCOME */}
            {pl.otherIncome > 0 && (
              <>
                <tr className="bg-green-50/50">
                  <td className="px-4 py-2 font-semibold text-green-700" colSpan={2}>Other Income</td>
                </tr>
                {pl.incomeAccounts
                  .filter((a) => a.code !== "4001" && a.code !== "4002" && a.closingBalance > 0)
                  .map((a) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="px-4 py-2 pl-8">{a.name} <span className="text-xs text-slate-400">({a.code})</span></td>
                      <td className="px-4 py-2 text-right text-green-700">{formatCurrency(a.closingBalance)}</td>
                    </tr>
                  ))}
              </>
            )}

            {/* OPERATING EXPENSES */}
            {pl.expenses.length > 0 && (
              <>
                <tr className="bg-red-50/50">
                  <td className="px-4 py-2 font-semibold text-red-700" colSpan={2}>
                    <div className="flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> Operating Expenses</div>
                  </td>
                </tr>
                {pl.expenses.map((e) => (
                  <tr key={e.code} className="border-b border-slate-100">
                    <td className="px-4 py-2 pl-8">{e.name} <span className="text-xs text-slate-400">({e.code})</span></td>
                    <td className="px-4 py-2 text-right text-red-600">{formatCurrency(e.amount)}</td>
                  </tr>
                ))}
                <tr className="border-b border-slate-200 font-semibold bg-red-50/30">
                  <td className="px-4 py-2 pl-8">Total Operating Expenses</td>
                  <td className="px-4 py-2 text-right text-red-700">{formatCurrency(pl.totalExpenses)}</td>
                </tr>
              </>
            )}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 text-base font-bold">
            <tr>
              <td className="px-4 py-3">
                {pl.isProfit ? "✅ Net Profit" : "⚠ Net Loss"}
              </td>
              <td className={`px-4 py-3 text-right ${pl.isProfit ? "text-emerald-600" : "text-red-600"}`}>
                {formatCurrency(Math.abs(pl.netProfit))}
                <span className="ml-2 text-xs font-normal">({npMargin}% margin)</span>
                {!pl.isProfit && " (Loss)"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
