import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import { FileSpreadsheet, Plus, BookOpen } from "lucide-react";

export default async function VouchersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const vouchers = await prisma.voucher.findMany({
    where: { companyId: company.id },
    include: { entries: { include: { account: true } } },
    orderBy: { date: "desc" },
    take: 50,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vouchers</h1>
          <p className="text-sm text-slate-500">All journal & auto-created entries</p>
        </div>
        <Link href="/vouchers/new" className="btn-primary inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Journal Entry
        </Link>
      </div>

      <div className="card overflow-hidden">
        {vouchers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <BookOpen className="h-6 w-6" />
            </div>
            <p className="text-slate-600 font-medium">Koi voucher nahi hai.</p>
            <Link href="/vouchers/new" className="btn-primary mt-4 inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Pehla entry banao
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Voucher #</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Narration</th>
                <th className="px-4 py-3 text-right font-medium">Debit</th>
                <th className="px-4 py-3 text-right font-medium">Credit</th>
                <th className="px-4 py-3 font-medium">Accounts</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => {
                const totalDr = v.entries.reduce(
                  (s, e) => s + parseFloat(e.debit.toString()),
                  0
                );
                const totalCr = v.entries.reduce(
                  (s, e) => s + parseFloat(e.credit.toString()),
                  0
                );
                return (
                  <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-xs font-medium text-brand-600">
                      {v.voucherNo}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`badge ${
                        v.type === "SALES" ? "bg-blue-100 text-blue-700" :
                        v.type === "PURCHASE" ? "bg-purple-100 text-purple-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {v.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(v.date).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-2 text-slate-500 truncate max-w-[200px]">
                      {v.narration ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(totalDr)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(totalCr)}</td>
                    <td className="px-4 py-2 text-xs text-slate-400">
                      {v.entries.map((e) => e.account.name).join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
