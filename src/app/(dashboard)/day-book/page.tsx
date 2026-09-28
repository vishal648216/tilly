import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import DateSelector from "./DateSelector";
import DayBookExportButton from "./DayBookExportButton";
import { CalendarDays, CheckCircle2, AlertTriangle, BookOpen } from "lucide-react";

export default async function DayBookPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  // Default to today if no date provided
  const selectedDate = searchParams.date || new Date().toISOString().slice(0, 10);
  const dayStart = new Date(selectedDate);
  const dayEnd = new Date(selectedDate);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const vouchers = await prisma.voucher.findMany({
    where: {
      companyId: company.id,
      date: { gte: dayStart, lt: dayEnd },
      isReversed: false,
    },
    include: { entries: { include: { account: true } } },
    orderBy: { voucherNo: "asc" },
  });

  const flattenedEntries = vouchers.flatMap((v) =>
    v.entries.map((e) => ({
      voucherNo: v.voucherNo,
      type: v.type,
      narration: v.narration,
      debit: parseFloat(e.debit.toString()),
      credit: parseFloat(e.credit.toString()),
      account: `${e.account.name} (${e.account.code})`,
    }))
  );

  let totalDr = 0,
    totalCr = 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Day Book</h1>
          <p className="text-sm text-slate-500">Date-wise voucher summary</p>
        </div>
        <div className="flex items-center gap-2">
          {flattenedEntries.length > 0 && (
            <DayBookExportButton date={selectedDate} vouchers={flattenedEntries} />
          )}
          <DateSelector defaultValue={selectedDate} />
        </div>
      </div>

      {/* Date display */}
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-600 font-medium">
        <CalendarDays className="h-4 w-4 text-brand-600" />
        {new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </div>

      <div className="card overflow-hidden">
        {vouchers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <BookOpen className="h-6 w-6" />
            </div>
            <p className="text-slate-600 font-medium">
              Is date pe koi transaction nahi hai.
            </p>
            <p className="text-sm text-slate-400 mt-1">Doosri date select karein.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {vouchers.map((v) => {
              const vDr = v.entries.reduce((s, e) => s + parseFloat(e.debit.toString()), 0);
              const vCr = v.entries.reduce((s, e) => s + parseFloat(e.credit.toString()), 0);
              totalDr += vDr;
              totalCr += vCr;

              return (
                <div key={v.id} className="p-4">
                  {/* Voucher header */}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-brand-600">{v.voucherNo}</span>
                      <span className={`badge ${
                        v.type === "SALES" ? "bg-blue-100 text-blue-700" :
                        v.type === "PURCHASE" ? "bg-purple-100 text-purple-700" :
                        v.type === "RECEIPT" ? "bg-green-100 text-green-700" :
                        v.type === "PAYMENT" ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {v.type}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">
                      {formatCurrency(vDr)}
                    </span>
                  </div>

                  {/* Narration */}
                  {v.narration && (
                    <p className="mb-2 text-sm italic text-slate-500">{v.narration}</p>
                  )}

                  {/* Entries */}
                  <table className="w-full text-sm">
                    <tbody>
                      {v.entries.map((e) => {
                        const isDr = parseFloat(e.debit.toString()) > 0;
                        return (
                          <tr key={e.id} className="text-slate-600">
                            <td className="py-1 pl-4">
                              {isDr ? "Dr." : "Cr."} {e.account.name}
                            </td>
                            <td className={`py-1 text-right ${isDr ? "text-slate-700" : "text-slate-400"}`}>
                              {isDr ? formatCurrency(e.debit) : ""}
                            </td>
                            <td className={`py-1 text-right ${!isDr ? "text-slate-700" : "text-slate-400"}`}>
                              {!isDr ? formatCurrency(e.credit) : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daily totals */}
      {vouchers.length > 0 && (
        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-sm rounded-lg bg-slate-50 p-4 text-sm border border-slate-200">
            <div className="flex justify-between border-b border-slate-200 py-1.5">
              <span className="font-medium text-slate-600">Total Debits</span>
              <span className="font-bold text-slate-900">{formatCurrency(totalDr)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 py-1.5">
              <span className="font-medium text-slate-600">Total Credits</span>
              <span className="font-bold text-slate-900">{formatCurrency(totalCr)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="font-medium text-slate-600">Vouchers Count</span>
              <span className="font-bold">{vouchers.length}</span>
            </div>
            <div className={`mt-2 flex items-center justify-between rounded-lg px-3 py-2 font-bold text-sm ${
              Math.abs(totalDr - totalCr) < 0.01 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
            }`}>
              <span>Difference</span>
              <span className="flex items-center gap-1.5">
                {Math.abs(totalDr - totalCr) < 0.01 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Balanced
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-red-600" /> Unbalanced
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
