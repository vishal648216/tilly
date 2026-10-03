import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { getGeneralLedger } from "@/lib/accounting";
import { getCurrentFinancialYear } from "@/lib/financialYear";
import { formatCurrency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { BookOpen } from "lucide-react";
import Link from "next/link";

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: { accountId?: string; preset?: string; from?: string; to?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const currentFy = await getCurrentFinancialYear(company.id);

  // All accounts for dropdown
  const accounts = await prisma.account.findMany({
    where: { companyId: company.id },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  const preset = searchParams.preset?.toUpperCase() || "CURRENT_FY";
  let fromDate = currentFy.startDate;
  let toDate = currentFy.endDate;
  let periodLabel = currentFy.label;

  if (preset === "THIS_MONTH") {
    const now = new Date();
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    periodLabel = "This Month";
  } else if (searchParams.from && searchParams.to) {
    fromDate = new Date(searchParams.from + "T00:00:00");
    toDate = new Date(searchParams.to + "T23:59:59");
    periodLabel = `${searchParams.from} to ${searchParams.to}`;
  }

  const accountId = searchParams.accountId || accounts[0]?.id;

  let ledger = null;
  let error = null;
  if (accountId) {
    try {
      ledger = await getGeneralLedger({
        companyId: company.id,
        accountId,
        from: fromDate,
        to: toDate,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load ledger";
    }
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-brand-600" />
          <h1 className="text-2xl font-bold">General Ledger</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {company.name} — Account-wise transaction history — {periodLabel}
        </p>
      </div>

      {/* Account Selector */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Account:</label>
          <form method="GET" action="/reports/general-ledger">
            <input type="hidden" name="preset" value={preset} />
            {searchParams.from && <input type="hidden" name="from" value={searchParams.from} />}
            {searchParams.to && <input type="hidden" name="to" value={searchParams.to} />}
            <select
              name="accountId"
              defaultValue={accountId}
              onChange={(e) => {
                // Client-side navigation on select change
              }}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} — {acc.name} ({acc.type})
                </option>
              ))}
            </select>
            <button type="submit" className="ml-2 rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">
              View
            </button>
          </form>
        </div>

        {/* Period */}
        <div className="flex gap-2">
          {[
            { preset: "THIS_MONTH", label: "This Month" },
            { preset: "CURRENT_FY", label: currentFy.label },
          ].map((p) => (
            <Link
              key={p.preset}
              href={`/reports/general-ledger?accountId=${accountId}&preset=${p.preset}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                preset === p.preset ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm mb-4">{error}</div>
      )}

      {ledger && (
        <>
          {/* Account Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-4">
              <p className="text-xs text-slate-500">Opening Balance</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(ledger.openingBalance)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500">Total Dr / Cr</p>
              <p className="text-sm font-medium text-slate-700">
                Dr: {formatCurrency(ledger.totalDebit)} | Cr: {formatCurrency(ledger.totalCredit)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500">Closing Balance</p>
              <p className={`text-lg font-bold ${ledger.closingBalance >= 0 ? "text-slate-900" : "text-red-600"}`}>
                {formatCurrency(ledger.closingBalance)}
              </p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">
                {ledger.account.code} — {ledger.account.name}
                <span className="ml-2 badge bg-slate-100 text-slate-600 text-xs">{ledger.account.type}</span>
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Voucher No.</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Narration / Party</th>
                  <th className="px-4 py-3 text-right font-medium">Debit (₹)</th>
                  <th className="px-4 py-3 text-right font-medium">Credit (₹)</th>
                  <th className="px-4 py-3 text-right font-medium">Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td className="px-4 py-2 text-xs text-slate-400" colSpan={4}>Opening Balance</td>
                  <td className="px-4 py-2 text-right text-xs text-slate-400" colSpan={2}></td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(ledger.openingBalance)}</td>
                </tr>

                {ledger.entries.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-400" colSpan={7}>
                      No transactions in this period.
                    </td>
                  </tr>
                ) : (
                  ledger.entries.map((entry, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {new Date(entry.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-brand-700">{entry.voucherNo}</td>
                      <td className="px-4 py-2">
                        <span className={`badge text-xs ${
                          entry.voucherType === "SALES" ? "bg-blue-100 text-blue-700" :
                          entry.voucherType === "PURCHASE" ? "bg-orange-100 text-orange-700" :
                          entry.voucherType === "RECEIPT" ? "bg-emerald-100 text-emerald-700" :
                          entry.voucherType === "PAYMENT" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {entry.voucherType}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {entry.narration || "—"}
                        {entry.partyName && <span className="text-slate-400"> | {entry.partyName}</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-slate-500">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold ${entry.balance >= 0 ? "text-slate-900" : "text-red-600"}`}>
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <tr>
                  <td className="px-4 py-3 text-sm" colSpan={4}>Closing Balance</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(ledger.totalDebit)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(ledger.totalCredit)}</td>
                  <td className={`px-4 py-3 text-right ${ledger.closingBalance >= 0 ? "text-slate-900" : "text-red-600"}`}>
                    {formatCurrency(ledger.closingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
