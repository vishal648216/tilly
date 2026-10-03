import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ArrowRight, Truck, CheckCircle2, AlertTriangle, XCircle, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DeliveryChallansPage({
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
      { dcNo: { contains: query } },
      { party: { name: { contains: query } } },
      { notes: { contains: query } },
    ];
  }

  const deliveryChallans = await prisma.deliveryChallan.findMany({
    where,
    include: {
      party: true,
      warehouse: true,
      salesOrder: true,
      invoice: true,
      lines: true,
    },
    orderBy: { date: "desc" },
  });

  const dispatchedCount = deliveryChallans.filter((dc) => dc.status === "DISPATCHED").length;
  const deliveredCount = deliveryChallans.filter((dc) => dc.status === "DELIVERED").length;
  const cancelledCount = deliveryChallans.filter((dc) => dc.status === "CANCELLED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Truck className="h-6 w-6 text-emerald-600" />
            Delivery Challans (Dispatch)
          </h1>
          <p className="text-sm text-slate-500">
            Track goods dispatch, physical inventory movements, and prevent double stock deduction when invoicing.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/sales-orders"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-colors"
          >
            <span>View Sales Orders</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <span className="text-xs text-slate-500 font-medium">Total Challans</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{deliveryChallans.length}</p>
          <span className="text-xs text-slate-400">All dispatches</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-blue-600 font-medium">Dispatched</span>
          <p className="text-xl font-bold text-blue-700 mt-1">{dispatchedCount}</p>
          <span className="text-xs text-slate-400">Awaiting invoice</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-emerald-600 font-medium">Invoiced / Delivered</span>
          <p className="text-xl font-bold text-emerald-700 mt-1">{deliveredCount}</p>
          <span className="text-xs text-slate-400">Linked to Tax Invoice</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-rose-600 font-medium">Cancelled</span>
          <p className="text-xl font-bold text-rose-700 mt-1">{cancelledCount}</p>
          <span className="text-xs text-slate-400">Stock reversed</span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">DC #</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Source Order</th>
                <th className="py-3 px-4 font-semibold text-center">Items Dispatched</th>
                <th className="py-3 px-4 font-semibold text-center">Stock Moved</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-center">Tax Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deliveryChallans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No delivery challans recorded. Create delivery challans from confirmed Sales Orders.
                  </td>
                </tr>
              ) : (
                deliveryChallans.map((dc) => {
                  const totalDelivered = dc.lines.reduce((a, l) => a + Number(l.deliveredQty), 0);
                  const statusColors: Record<string, string> = {
                    DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
                    DISPATCHED: "bg-blue-50 text-blue-700 border-blue-200",
                    DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
                  };

                  return (
                    <tr key={dc.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{dc.dcNo}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(dc.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {dc.party?.name || "Direct Customer"}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {dc.salesOrder?.orderNo || "Direct DC"}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {totalDelivered} units ({dc.lines.length} items)
                      </td>
                      <td className="py-3 px-4 text-center">
                        {dc.stockMoved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Deducted
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Pending</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            statusColors[dc.status] || "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {dc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {dc.invoice ? (
                          <Link
                            href={`/invoices/${dc.invoice.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-800"
                          >
                            <Receipt className="h-3 w-3" />
                            <span>{dc.invoice.invoiceNo}</span>
                          </Link>
                        ) : dc.status === "DISPATCHED" ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Ready to Invoice
                          </span>
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
