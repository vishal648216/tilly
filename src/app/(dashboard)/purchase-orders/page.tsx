import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import { ShoppingCart, Plus, ArrowRight, Package, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage({
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
      { poNo: { contains: query } },
      { party: { name: { contains: query } } },
      { notes: { contains: query } },
    ];
  }

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      party: true,
      warehouse: true,
      lines: true,
      grns: true,
      invoices: true,
    },
    orderBy: { date: "desc" },
  });

  const totalValue = purchaseOrders.reduce((acc, po) => acc + Number(po.grandTotal), 0);
  const confirmedCount = purchaseOrders.filter((po) => po.status === "CONFIRMED").length;
  const partialCount = purchaseOrders.filter((po) => po.status === "PARTIALLY_RECEIVED").length;
  const receivedCount = purchaseOrders.filter((po) => po.status === "RECEIVED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-indigo-600" />
            Purchase Orders (PO)
          </h1>
          <p className="text-sm text-slate-500">
            Issue formal purchase orders to suppliers and track ordered vs received quantities.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/purchase-orders/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Link>
          <Link
            href="/invoices/new?type=PURCHASE"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Direct Purchase
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <span className="text-xs text-slate-500 font-medium">Total POs</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{purchaseOrders.length}</p>
          <span className="text-xs text-slate-400">{formatCurrency(totalValue)}</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-blue-600 font-medium">Confirmed</span>
          <p className="text-xl font-bold text-blue-700 mt-1">{confirmedCount}</p>
          <span className="text-xs text-slate-400">Awaiting shipment</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-amber-600 font-medium">Partially Received</span>
          <p className="text-xl font-bold text-amber-700 mt-1">{partialCount}</p>
          <span className="text-xs text-slate-400">Goods in transit/arriving</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-emerald-600 font-medium">Fully Received</span>
          <p className="text-xl font-bold text-emerald-700 mt-1">{receivedCount}</p>
          <span className="text-xs text-slate-400">Complete / Billed</span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">PO #</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Supplier</th>
                <th className="py-3 px-4 font-semibold">Warehouse</th>
                <th className="py-3 px-4 font-semibold text-center">Receipt Status</th>
                <th className="py-3 px-4 font-semibold text-right">Amount</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-center">Linked Docs</th>
                <th className="py-3 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No purchase orders found. Create purchase orders to track supplier procurement.
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((po) => {
                  const totalOrdered = po.lines.reduce((a, l) => a + Number(l.orderedQty), 0);
                  const totalReceived = po.lines.reduce((a, l) => a + Number(l.receivedQty), 0);
                  const percent = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;
                  const isFullyReceived = totalOrdered > 0 && totalReceived >= totalOrdered;

                  const statusColors: Record<string, string> = {
                    DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
                    SENT: "bg-blue-50 text-blue-700 border-blue-200",
                    CONFIRMED: "bg-indigo-50 text-indigo-700 border-indigo-200",
                    PARTIALLY_RECEIVED: "bg-amber-50 text-amber-800 border-amber-300",
                    RECEIVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
                  };

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <Link
                          href={`/purchase-orders/${po.id}`}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {po.poNo}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(po.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {po.party?.name || "Vendor"}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {po.warehouse?.name || "Main Godown"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold text-slate-700">
                            {totalReceived} / {totalOrdered} ({percent}%)
                          </span>
                          <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-500 h-1.5 rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(Number(po.grandTotal))}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            statusColors[po.status] || "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {po.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {po.grns.length > 0 && (
                            <Link
                              href={`/goods-receipts/${po.grns[0].id}`}
                              title={`${po.grns.length} GRN(s)`}
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                            >
                              <Package className="h-3 w-3" />
                              <span>{po.grns.length} GRN</span>
                            </Link>
                          )}
                          {po.invoices.length > 0 && (
                            <Link
                              href={`/invoices/${po.invoices[0].id}`}
                              title="Linked Purchase Bill"
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                            >
                              <Receipt className="h-3 w-3" />
                              <span>Bill</span>
                            </Link>
                          )}
                          {po.grns.length === 0 && po.invoices.length === 0 && (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/purchase-orders/${po.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                          >
                            View
                          </Link>
                          {!isFullyReceived && po.status !== "CANCELLED" && (
                            <Link
                              href={`/goods-receipts/new?purchaseOrderId=${po.id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
                              title="Receive Goods (GRN)"
                            >
                              Receive
                            </Link>
                          )}
                          <Link
                            href={`/invoices/new?type=PURCHASE&purchaseOrderId=${po.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                            title="Direct Purchase Bill"
                          >
                            To Bill
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
