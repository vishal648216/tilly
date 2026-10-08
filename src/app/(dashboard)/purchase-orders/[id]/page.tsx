import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import PurchaseOrderActions from "./PurchaseOrderActions";
import {
  ArrowLeft,
  Package,
  Receipt,
  ShoppingCart,
  Calendar,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: {
      id: params.id,
      companyId: company.id,
    },
    include: {
      party: true,
      warehouse: true,
      lines: {
        include: { item: true },
      },
      grns: true,
      invoices: true,
    },
  });

  if (!purchaseOrder) {
    notFound();
  }

  const totalOrdered = purchaseOrder.lines.reduce((a, l) => a + Number(l.orderedQty), 0);
  const totalReceived = purchaseOrder.lines.reduce((a, l) => a + Number(l.receivedQty), 0);
  const totalInvoiced = purchaseOrder.lines.reduce((a, l) => a + Number(l.billedQty), 0);
  const isFullyReceived = totalOrdered > 0 && totalReceived >= totalOrdered;

  const statusColors: Record<string, string> = {
    DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
    CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
    PARTIALLY_RECEIVED: "bg-amber-50 text-amber-800 border-amber-300",
    RECEIVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Navigation & Actions */}
      <div className="no-print print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/purchase-orders"
            className="btn-secondary text-sm inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Purchase Orders</span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">
              Purchase Order
            </h1>
            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              #{purchaseOrder.poNo}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                statusColors[purchaseOrder.status] || "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {purchaseOrder.status.replace("_", " ")}
            </span>
          </div>
        </div>

        <PurchaseOrderActions
          purchaseOrderId={purchaseOrder.id}
          poNo={purchaseOrder.poNo}
          status={purchaseOrder.status}
          isFullyReceived={isFullyReceived}
        />
      </div>

      {/* Main PO Document (Printable) */}
      <div id="invoice-paper" className="card p-8 bg-white shadow-sm border border-slate-200 rounded-2xl print:border-none print:shadow-none print:p-0">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-slate-900">
                PURCHASE ORDER
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  statusColors[purchaseOrder.status] || "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {purchaseOrder.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-sm font-bold text-indigo-600 mt-1">#{purchaseOrder.poNo}</p>
          </div>

          <div className="sm:text-right">
            <h2 className="text-lg font-bold text-slate-900">{company.name}</h2>
            {company.gstin && (
              <p className="text-xs text-slate-600 mt-0.5 font-medium">GSTIN: {company.gstin}</p>
            )}
            {company.email && <p className="text-xs text-slate-500">{company.email}</p>}
            {company.phone && <p className="text-xs text-slate-500">{company.phone}</p>}
            {company.city && (
              <p className="text-xs text-slate-500">
                {company.city}
                {company.state ? `, ${company.state}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* PO Meta & Parties */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Supplier / Vendor
            </span>
            <div className="mt-1">
              <p className="text-sm font-bold text-slate-900">
                {purchaseOrder.party?.name || "Direct Supplier"}
              </p>
              {purchaseOrder.party?.gstin && (
                <p className="text-xs text-slate-600">GSTIN: {purchaseOrder.party.gstin}</p>
              )}
              {purchaseOrder.party?.phone && (
                <p className="text-xs text-slate-500">Phone: {purchaseOrder.party.phone}</p>
              )}
              {purchaseOrder.party?.address && (
                <p className="text-xs text-slate-500">{purchaseOrder.party.address}</p>
              )}
              {purchaseOrder.party?.city && (
                <p className="text-xs text-slate-500">
                  {purchaseOrder.party.city}
                  {purchaseOrder.party.state ? `, ${purchaseOrder.party.state}` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 sm:text-right">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                PO Date
              </span>
              <p className="text-xs font-bold text-slate-800">
                {new Date(purchaseOrder.date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            {purchaseOrder.expectedDate && (
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Expected Delivery
                </span>
                <p className="text-xs font-bold text-indigo-700">
                  {new Date(purchaseOrder.expectedDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Receiving Godown
              </span>
              <p className="text-xs font-medium text-slate-700">
                {purchaseOrder.warehouse?.name || "Main Godown"}
              </p>
            </div>
          </div>
        </div>

        {/* Fulfillment Summary Bar */}
        <div className="my-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Ordered</span>
              <p className="text-sm font-black text-slate-800">{totalOrdered} units</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Received (GRN)</span>
              <p className="text-sm font-black text-indigo-700">{totalReceived} units</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-600 uppercase">Pending Inward</span>
              <p className="text-sm font-black text-amber-700">
                {Math.max(0, totalOrdered - totalReceived)} units
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Billed</span>
              <p className="text-sm font-black text-emerald-700">{totalInvoiced} units</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {purchaseOrder.grns.length > 0 && (
              <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200">
                {purchaseOrder.grns.length} GRN(s) Inwarded
              </span>
            )}
            {purchaseOrder.invoices.length > 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                {purchaseOrder.invoices.length} Bill(s) Linked
              </span>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto py-2">
          <table className="table w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Item Description</th>
                <th className="py-2.5 px-3 text-center">HSN</th>
                <th className="py-2.5 px-3 text-right">Ordered</th>
                <th className="py-2.5 px-3 text-right">Received</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
                <th className="py-2.5 px-3 text-center">GST</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchaseOrder.lines.map((line, idx) => (
                <tr key={line.id}>
                  <td className="py-3 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-900">{line.name}</p>
                    {line.sku && <p className="text-[10px] text-slate-400">SKU: {line.sku}</p>}
                  </td>
                  <td className="py-3 px-3 text-center text-slate-500">{line.hsn || "—"}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {Number(line.orderedQty)} {line.unit}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-indigo-700">
                    {Number(line.receivedQty)} {line.unit}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700">
                    {formatCurrency(Number(line.rate))}
                  </td>
                  <td className="py-3 px-3 text-center text-slate-600">
                    {Number(line.gstRate)}%
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatCurrency(Number(line.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Notes Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-slate-200">
          <div className="space-y-4">
            {purchaseOrder.notes && (
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Notes / Inward Instructions
                </span>
                <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{purchaseOrder.notes}</p>
              </div>
            )}
            {purchaseOrder.terms && (
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Purchase Terms
                </span>
                <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap font-mono text-[11px]">
                  {purchaseOrder.terms}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-600 py-1">
              <span>Taxable Subtotal:</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(Number(purchaseOrder.subTotal))}
              </span>
            </div>
            {Number(purchaseOrder.discount) > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 py-1">
                <span>Total Discount:</span>
                <span className="font-semibold">-{formatCurrency(Number(purchaseOrder.discount))}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-600 py-1">
              <span>GST Total:</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(Number(purchaseOrder.taxTotal))}
              </span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-3 border-t-2 border-slate-300">
              <span>Grand Total:</span>
              <span className="text-indigo-700">{formatCurrency(Number(purchaseOrder.grandTotal))}</span>
            </div>
          </div>
        </div>

        {/* Linked Documents Footer */}
        {(purchaseOrder.grns.length > 0 || purchaseOrder.invoices.length > 0) && (
          <div className="mt-8 pt-6 border-t border-slate-200 print:hidden space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Connected Documents
            </h4>
            <div className="flex flex-wrap gap-3">
              {purchaseOrder.grns.map((grn) => (
                <Link
                  key={grn.id}
                  href={`/goods-receipts/${grn.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
                >
                  <Package className="h-3.5 w-3.5" />
                  <span>GRN #{grn.grnNo}</span>
                  <span className="text-[10px] text-indigo-500 font-normal">({grn.status})</span>
                </Link>
              ))}
              {purchaseOrder.invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  <span>Bill #{inv.invoiceNo}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
