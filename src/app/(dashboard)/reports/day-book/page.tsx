import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { getDayBook } from "@/lib/accounting";
import { getCurrentFinancialYear } from "@/lib/financialYear";
import { formatCurrency } from "@/lib/currency";
import { BookOpen, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";

const VOUCHER_TYPES = [
  { value: "", label: "All Vouchers" },
  { value: "SALES", label: "Sales" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "RECEIPT", label: "Receipts" },
  { value: "PAYMENT", label: "Payments" },
  { value: "JOURNAL", label: "Journal" },
  { value: "CONTRA", label: "Contra" },
];

export default async function DayBookPage({
  searchParams,
}: {
  searchParams: { preset?: string; from?: string; to?: string; type?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const currentFy = await getCurrentFinancialYear(company.id);

  let fromDate: Date;
  let toDate: Date;
  const preset = searchParams.preset || "TODAY";
  const now = new Date();

  if (searchParams.from && searchParams.to) {
    fromDate = new Date(searchParams.from + "T00:00:00");
    toDate = new Date(searchParams.to + "T23:59:59");
  } else if (preset === "CURRENT_FY") {
    fromDate = currentFy.startDate;
    toDate = currentFy.endDate;
  } else {
    // Default TODAY
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  const voucherType = searchParams.type || undefined;

  const entries = await getDayBook({
    companyId: company.id,
    from: fromDate,
    to: toDate,
    voucherType,
  });

  const totalDr = entries.reduce((s, e) => s + e.totalDebit, 0);
  const totalCr = entries.reduce((s, e) => s + e.totalCredit, 0);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.01;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-brand-600" />
            <h1 className="text-2xl font-bold">Day Book / Journal Register</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {company.name} — All vouchers by date
          </p>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
          isBalanced ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        }`}>
          {isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {isBalanced ? "Balanced" : "Unbalanced!"}
        </div>
      </div>

      {/* Date Presets */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { label: "Today", preset: "TODAY", from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) },
          { label: "This Month", preset: "THIS_MONTH", from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) },
          { label: currentFy.label, preset: "CURRENT_FY", from: currentFy.startDate.toISOString().slice(0, 10), to: currentFy.endDate.toISOString().slice(0, 10) },
        ].map((p) => (
          <Link
            key={p.preset}
            href={`/reports/day-book?from=${p.from}&to=${p.to}&preset=${p.preset}${voucherType ? `&type=${voucherType}` : ""}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              preset === p.preset ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* Voucher Type Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {VOUCHER_TYPES.map((vt) => (
          <Link
            key={vt.value}
            href={`/reports/day-book?preset=${preset}&from=${searchParams.from || ""}&to=${searchParams.to || ""}${vt.value ? `&type=${vt.value}` : ""}`}
            className={`px-3 py-1 rounded text-xs font-medium border transition-all ${
              voucherType === vt.value || (!voucherType && vt.value === "")
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {vt.label}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No vouchers found for this period.</p>
          <p className="text-xs mt-1">Post an invoice or payment to see entries here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => (
            <div key={idx} className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-brand-700">{entry.voucherNo}</span>
                  <span className={`badge text-xs ${
                    entry.voucherType === "SALES" ? "bg-blue-100 text-blue-700" :
                    entry.voucherType === "PURCHASE" ? "bg-orange-100 text-orange-700" :
                    entry.voucherType === "RECEIPT" ? "bg-emerald-100 text-emerald-700" :
                    entry.voucherType === "PAYMENT" ? "bg-red-100 text-red-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    {entry.voucherType}
                  </span>
                  {entry.partyName && (
                    <span className="text-slate-500">{entry.partyName}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{new Date(entry.date).toLocaleDateString("en-IN")}</span>
                  <span className="font-medium text-slate-700">{formatCurrency(entry.totalDebit)}</span>
                </div>
              </div>
              {entry.narration && (
                <p className="px-4 py-1.5 text-xs text-slate-500 italic border-b border-slate-100">
                  {entry.narration}
                </p>
              )}
              <table className="w-full text-xs">
                <tbody>
                  {entry.entries.map((e, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-1.5 font-mono text-slate-400 w-12">{e.accountCode}</td>
                      <td className="px-2 py-1.5 text-slate-700">
                        {e.debit > 0 && <span className="text-slate-400 mr-2">Dr</span>}
                        {e.credit > 0 && <span className="text-slate-400 mr-2 pl-6">Cr</span>}
                        {e.accountName}
                      </td>
                      <td className="px-4 py-1.5 text-right font-medium text-slate-700">
                        {e.debit > 0 ? formatCurrency(e.debit) : ""}
                      </td>
                      <td className="px-4 py-1.5 text-right font-medium text-slate-500">
                        {e.credit > 0 ? formatCurrency(e.credit) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Grand Total */}
          <div className={`card px-4 py-3 flex items-center justify-between font-bold ${
            isBalanced ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
          }`}>
            <span className="text-sm">
              {entries.length} Vouchers | Period Total
            </span>
            <div className="flex gap-8 text-sm">
              <span>Dr: {formatCurrency(totalDr)}</span>
              <span>Cr: {formatCurrency(totalCr)}</span>
              {!isBalanced && (
                <span className="text-red-600">
                  Diff: {formatCurrency(Math.abs(totalDr - totalCr))}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
