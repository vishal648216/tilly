import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import GoodsReceiptActions from "./GoodsReceiptActions";
import {
  ArrowLeft,
  Package,
  Receipt,
  ShoppingCart,
  CheckCircle2,
  Calendar,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GoodsReceiptDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const grn = await prisma.goodsReceipt.findFirst({
    where: {
      id: params.id,
      companyId: company.id,
    },
    include: {
      party: true,
      warehouse: true,
      purchaseOrder: true,
      invoice: true,
      lines: {
        include: { item: true },
      },
    },
  });

  if (!grn) {
    notFound();
  }

  const totalQty = grn.lines.reduce((a, l) => a + Number(l.receivedQty), 0);

  const statusColors: Record<string, string> = {
    DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
    RECEIVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <Link
          href="/goods-receipts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Goods Receipts</span>
        </Link>

        <GoodsReceiptActions
          grnId={grn.id}
          grnNo={grn.grnNo}
          status={grn.status}
          invoiceId={grn.invoiceId}
          invoiceNo={grn.invoice?.invoiceNo}
        />
      </div>

      {/* Main GRN Document (Printable) */}
      <div className="card p-8 bg-white shadow-sm border border-slate-200 rounded-2xl print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-slate-900">
                GOODS RECEIPT NOTE (GRN)
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  statusColors[grn.status] || "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {grn.status}
              </span>
            </div>
            <p className="text-sm font-bold text-indigo-600 mt-1">#{grn.grnNo}</p>
            {grn.purchaseOrder && (
              <p className="text-xs text-slate-500 mt-0.5">
                Against Purchase Order:{" "}
                <Link
                  href={`/purchase-orders/${grn.purchaseOrder.id}`}
                  className="font-semibold text-indigo-600 underline"
                >
                  #{grn.purchaseOrder.poNo}
                </Link>
              </p>
            )}
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

        {/* Supplier & Receipt Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Supplier / Consignor Details
            </span>
            <div className="mt-1">
              <p className="text-sm font-bold text-slate-900">
                {grn.party?.name || "Direct Supplier"}
              </p>
              {grn.party?.gstin && (
                <p className="text-xs text-slate-600">GSTIN: {grn.party.gstin}</p>
              )}
              {grn.party?.phone && (
                <p className="text-xs text-slate-500">Phone: {grn.party.phone}</p>
              )}
              {grn.party?.address && (
                <p className="text-xs text-slate-500">{grn.party.address}</p>
              )}
              {grn.party?.city && (
                <p className="text-xs text-slate-500">
                  {grn.party.city}
                  {grn.party.state ? `, ${grn.party.state}` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 sm:text-right">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Receipt Date
              </span>
              <p className="text-xs font-bold text-slate-800">
                {new Date(grn.date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Receiving Godown / Warehouse
              </span>
              <p className="text-xs font-medium text-slate-700">
                {grn.warehouse?.name || "Main Godown"}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Physical Inventory Inward Status
              </span>
              <p className="text-xs font-bold text-emerald-700">
                {grn.stockMoved ? "Stock Inwarded into Warehouse" : "Pending Inward"}
              </p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto py-4">
          <table className="table w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Item Description</th>
                {grn.purchaseOrder && (
                  <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                )}
                <th className="py-2.5 px-3 text-right">Received Qty</th>
                <th className="py-2.5 px-3">Unit</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grn.lines.map((line, idx) => (
                <tr key={line.id}>
                  <td className="py-3 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-900">{line.name}</p>
                    {line.sku && <p className="text-[10px] text-slate-400">SKU: {line.sku}</p>}
                  </td>
                  {grn.purchaseOrder && (
                    <td className="py-3 px-3 text-right text-slate-600">
                      {Number(line.orderedQty)} {line.unit}
                    </td>
                  )}
                  <td className="py-3 px-3 text-right font-black text-indigo-700 text-sm">
                    {Number(line.receivedQty)}
                  </td>
                  <td className="py-3 px-3 text-slate-600 uppercase font-medium">{line.unit}</td>
                  <td className="py-3 px-3 text-right text-slate-600">
                    ₹{Number(line.rate || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-800">
                <td colSpan={grn.purchaseOrder ? 3 : 2} className="py-3 px-3 text-right">
                  Total Received Quantity:
                </td>
                <td className="py-3 px-3 text-right text-indigo-700 text-sm font-black">
                  {totalQty} units
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Transport & Gate Entry Notes */}
        {grn.notes && (
          <div className="py-4 border-t border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Verification & Gate Entry Notes
            </span>
            <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{grn.notes}</p>
          </div>
        )}

        {/* Verification Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-12 mt-6 border-t border-slate-200">
          <div>
            <div className="h-16 border-b border-dashed border-slate-300"></div>
            <p className="text-[11px] font-bold text-slate-600 mt-2">Quality Inspector Signature</p>
            <p className="text-[10px] text-slate-400">
              Goods physically inspected and accepted
            </p>
          </div>
          <div className="text-right">
            <div className="h-16 border-b border-dashed border-slate-300"></div>
            <p className="text-[11px] font-bold text-slate-800 mt-2">Storekeeper / Godown In-Charge</p>
            <p className="text-[10px] text-slate-400">Inventory updated in physical register</p>
          </div>
        </div>

        {/* Connected Purchase Bill */}
        {grn.invoice && (
          <div className="mt-8 pt-6 border-t border-slate-200 print:hidden flex items-center justify-between bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-900">
                Purchase Bill Generated: #{grn.invoice.invoiceNo}
              </span>
            </div>
            <Link
              href={`/invoices/${grn.invoice.id}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 underline"
            >
              <span>View Purchase Bill</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
