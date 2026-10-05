import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import { ShoppingCart, Plus, ArrowRight, CheckCircle2, Truck, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SalesOrdersPage({
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
      { orderNo: { contains: query } },
      { party: { name: { contains: query } } },
      { notes: { contains: query } },
    ];
  }

  const salesOrders = await prisma.salesOrder.findMany({
    where,
    include: {
      party: true,
      warehouse: true,
      quotation: true,
      lines: true,
      deliveryChallans: true,
      invoices: true,
    },
    orderBy: { date: "desc" },
  });

  const totalValue = salesOrders.reduce((acc, so) => acc + Number(so.grandTotal), 0);
  const confirmedCount = salesOrders.filter((so) => so.status === "CONFIRMED").length;
  const partialCount = salesOrders.filter((so) => so.status === "PARTIALLY_DELIVERED").length;
  const deliveredCount = salesOrders.filter((so) => so.status === "DELIVERED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            Sales Orders
          </h1>
          <p className="text-sm text-slate-500">
            Track customer sales orders, ordered vs delivered quantities, and dispatch challans.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/sales-orders/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Sales Order
          </Link>
          <Link
            href="/invoices/new"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Direct Invoice
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <span className="text-xs text-slate-500 font-medium">Total Orders</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{salesOrders.length}</p>
          <span className="text-xs text-slate-400">{formatCurrency(totalValue)}</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-blue-600 font-medium">Confirmed</span>
          <p className="text-xl font-bold text-blue-700 mt-1">{confirmedCount}</p>
          <span className="text-xs text-slate-400">Awaiting dispatch</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-amber-600 font-medium">Partially Delivered</span>
          <p className="text-xl font-bold text-amber-700 mt-1">{partialCount}</p>
          <span className="text-xs text-slate-400">In-progress deliveries</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-emerald-600 font-medium">Fully Delivered</span>
          <p className="text-xl font-bold text-emerald-700 mt-1">{deliveredCount}</p>
          <span className="text-xs text-slate-400">Complete / Invoiced</span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Order #</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Warehouse</th>
                <th className="py-3 px-4 font-semibold text-center">Fulfillment</th>
                <th className="py-3 px-4 font-semibold text-right">Amount</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-center">Linked Docs</th>
                <th className="py-3 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No sales orders found. Use quotations or sales order workflow to track customer orders.
                  </td>
                </tr>
              ) : (
                salesOrders.map((so) => {
                  const totalOrdered = so.lines.reduce((a, l) => a + Number(l.orderedQty), 0);
                  const totalDelivered = so.lines.reduce((a, l) => a + Number(l.deliveredQty), 0);
                  const percent = totalOrdered > 0 ? Math.min(100, Math.round((totalDelivered / totalOrdered) * 100)) : 0;
                  const isFullyDelivered = totalOrdered > 0 && totalDelivered >= totalOrdered;

                  const statusColors: Record<string, string> = {
                    DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
                    CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
                    PARTIALLY_DELIVERED: "bg-amber-50 text-amber-800 border-amber-300",
                    DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
                  };

                  return (
                    <tr key={so.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <Link
                          href={`/sales-orders/${so.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {so.orderNo}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(so.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {so.party?.name || "Cash Customer"}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {so.warehouse?.name || "Main Godown"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold text-slate-700">
                            {totalDelivered} / {totalOrdered} ({percent}%)
                          </span>
                          <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(Number(so.grandTotal))}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            statusColors[so.status] || "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {so.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {so.deliveryChallans.length > 0 && (
                            <Link
                              href={`/delivery-challans/${so.deliveryChallans[0].id}`}
                              title={`${so.deliveryChallans.length} Challan(s)`}
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              <Truck className="h-3 w-3" />
                              <span>{so.deliveryChallans.length} DC</span>
                            </Link>
                          )}
                          {so.invoices.length > 0 && (
                            <Link
                              href={`/invoices/${so.invoices[0].id}`}
                              title="Linked Invoice"
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                            >
                              <Receipt className="h-3 w-3" />
                              <span>Inv</span>
                            </Link>
                          )}
                          {so.deliveryChallans.length === 0 && so.invoices.length === 0 && (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/sales-orders/${so.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                          >
                            View
                          </Link>
                          {!isFullyDelivered && so.status !== "CANCELLED" && (
                            <Link
                              href={`/delivery-challans/new?salesOrderId=${so.id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                              title="Dispatch Delivery Challan"
                            >
                              Dispatch
                            </Link>
                          )}
                          <Link
                            href={`/invoices/new?salesOrderId=${so.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                            title="Direct Tax Invoice"
                          >
                            To Inv
                          </Link>
                        </div>
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
