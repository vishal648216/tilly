import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import { FileText, Plus, CheckCircle, ArrowRight, Clock, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const query = searchParams.q?.trim() || "";
  const statusFilter = searchParams.status;

  const where: any = { companyId: company.id };
  if (statusFilter) where.status = statusFilter;
  if (query) {
    where.OR = [
      { quotationNo: { contains: query } },
      { party: { name: { contains: query } } },
      { notes: { contains: query } },
    ];
  }

  const quotations = await prisma.quotation.findMany({
    where,
    include: { party: true, lines: true, salesOrders: true },
    orderBy: { date: "desc" },
  });

  const totalValue = quotations.reduce((acc, q) => acc + Number(q.grandTotal), 0);
  const draftCount = quotations.filter((q) => q.status === "DRAFT").length;
  const acceptedCount = quotations.filter((q) => q.status === "ACCEPTED").length;
  const convertedCount = quotations.filter((q) => q.status === "CONVERTED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-600" />
            Quotations & Estimates
          </h1>
          <p className="text-sm text-slate-500">
            Create pre-sales quotations and convert accepted offers directly into Sales Orders.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/invoices/new"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Direct Invoice
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <span className="text-xs text-slate-500 font-medium">Total Quotes</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{quotations.length}</p>
          <span className="text-xs text-slate-400">{formatCurrency(totalValue)}</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-amber-600 font-medium">Drafts</span>
          <p className="text-xl font-bold text-amber-700 mt-1">{draftCount}</p>
          <span className="text-xs text-slate-400">Under preparation</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-emerald-600 font-medium">Accepted</span>
          <p className="text-xl font-bold text-emerald-700 mt-1">{acceptedCount}</p>
          <span className="text-xs text-slate-400">Ready to convert</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-blue-600 font-medium">Converted to SO</span>
          <p className="text-xl font-bold text-blue-700 mt-1">{convertedCount}</p>
          <span className="text-xs text-slate-400">Active sales pipeline</span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Quote #</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Valid Until</th>
                <th className="py-3 px-4 font-semibold text-right">Amount</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-center">Linked Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No quotations found. Use the Quotations API or workflow to issue customer estimates.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => {
                  const statusColors: Record<string, string> = {
                    DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
                    SENT: "bg-blue-50 text-blue-700 border-blue-200",
                    ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
                    EXPIRED: "bg-slate-50 text-slate-600 border-slate-200",
                    CONVERTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
                  };

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{q.quotationNo}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(q.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {q.party?.name || "Direct Customer"}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {q.validUntil ? new Date(q.validUntil).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(Number(q.grandTotal))}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            statusColors[q.status] || "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {q.salesOrders.length > 0 ? (
                          <Link
                            href={`/sales-orders`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-800"
                          >
                            <span>{q.salesOrders[0].orderNo}</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
