import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ArrowRight, Package, CheckCircle2, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GoodsReceiptsPage({
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
      { grnNo: { contains: query } },
      { party: { name: { contains: query } } },
      { notes: { contains: query } },
    ];
  }

  const goodsReceipts = await prisma.goodsReceipt.findMany({
    where,
    include: {
      party: true,
      warehouse: true,
      purchaseOrder: true,
      invoice: true,
      lines: true,
    },
    orderBy: { date: "desc" },
  });

  const receivedCount = goodsReceipts.filter((grn) => grn.status === "RECEIVED").length;
  const billedCount = goodsReceipts.filter((grn) => grn.invoiceId !== null).length;
  const cancelledCount = goodsReceipts.filter((grn) => grn.status === "CANCELLED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-600" />
            Goods Receipt Notes (GRN)
          </h1>
          <p className="text-sm text-slate-500">
            Verify supplier deliveries at warehouse, record received quantities into stock, and prevent double inventory entries.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/purchase-orders"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-colors"
          >
            <span>View Purchase Orders</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <span className="text-xs text-slate-500 font-medium">Total GRNs</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{goodsReceipts.length}</p>
          <span className="text-xs text-slate-400">All inbound receipts</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-indigo-600 font-medium">Received Stock</span>
          <p className="text-xl font-bold text-indigo-700 mt-1">{receivedCount}</p>
          <span className="text-xs text-slate-400">Stock entered warehouse</span>
        </div>
        <div className="card p-4">
          <span className="text-xs text-emerald-600 font-medium">Billed / Invoiced</span>
          <p className="text-xl font-bold text-emerald-700 mt-1">{billedCount}</p>
          <span className="text-xs text-slate-400">Linked to Purchase Bill</span>
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
                <th className="py-3 px-4 font-semibold">GRN #</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Supplier</th>
                <th className="py-3 px-4 font-semibold">Source PO</th>
                <th className="py-3 px-4 font-semibold text-center">Items Received</th>
                <th className="py-3 px-4 font-semibold text-center">Stock Entered</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-center">Purchase Bill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {goodsReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No goods receipt notes recorded. Create GRNs from confirmed Purchase Orders.
                  </td>
                </tr>
              ) : (
                goodsReceipts.map((grn) => {
                  const totalReceived = grn.lines.reduce((a, l) => a + Number(l.receivedQty), 0);
                  const statusColors: Record<string, string> = {
                    DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
                    RECEIVED: "bg-indigo-50 text-indigo-700 border-indigo-200",
                    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
                  };

                  return (
                    <tr key={grn.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{grn.grnNo}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(grn.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {grn.party?.name || "Supplier"}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {grn.purchaseOrder?.poNo || "Direct GRN"}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {totalReceived} units ({grn.lines.length} items)
                      </td>
                      <td className="py-3 px-4 text-center">
                        {grn.stockMoved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Added
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Pending</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            statusColors[grn.status] || "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {grn.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {grn.invoice ? (
                          <Link
                            href={`/invoices/${grn.invoice.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-800"
                          >
                            <Receipt className="h-3 w-3" />
                            <span>{grn.invoice.invoiceNo}</span>
                          </Link>
                        ) : grn.status === "RECEIVED" ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Ready to Bill
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
