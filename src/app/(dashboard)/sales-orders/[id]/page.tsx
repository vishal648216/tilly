import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import SalesOrderActions from "./SalesOrderActions";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Truck,
  Receipt,
  FileText,
  Warehouse as WarehouseIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const salesOrder = await prisma.salesOrder.findFirst({
    where: {
      id: params.id,
      companyId: company.id,
    },
    include: {
      party: true,
      warehouse: true,
      quotation: true,
      lines: {
        include: { item: true },
      },
      deliveryChallans: true,
      invoices: true,
    },
  });

  if (!salesOrder) {
    notFound();
  }

  const totalOrdered = salesOrder.lines.reduce((a, l) => a + Number(l.orderedQty), 0);
  const totalDelivered = salesOrder.lines.reduce((a, l) => a + Number(l.deliveredQty), 0);
  const totalInvoiced = salesOrder.lines.reduce((a, l) => a + Number(l.invoicedQty), 0);
  const isFullyDelivered = totalOrdered > 0 && totalDelivered >= totalOrdered;

  const statusColors: Record<string, string> = {
    DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
    CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
    PARTIALLY_DELIVERED: "bg-amber-50 text-amber-800 border-amber-300",
    DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <Link
          href="/sales-orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Sales Orders</span>
        </Link>

        <SalesOrderActions
          salesOrderId={salesOrder.id}
          orderNo={salesOrder.orderNo}
          status={salesOrder.status}
          isFullyDelivered={isFullyDelivered}
        />
      </div>

      {/* Main Order Document (Printable) */}
      <div className="card p-8 bg-white shadow-sm border border-slate-200 rounded-2xl print:border-none print:shadow-none print:p-0">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-slate-900">
                SALES ORDER
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  statusColors[salesOrder.status] || "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {salesOrder.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-sm font-bold text-blue-600 mt-1">#{salesOrder.orderNo}</p>
            {salesOrder.quotation && (
              <p className="text-xs text-slate-500 mt-0.5">
                Ref Quotation:{" "}
                <Link
                  href={`/quotations/${salesOrder.quotation.id}`}
                  className="font-semibold text-blue-600 underline"
                >
                  #{salesOrder.quotation.quotationNo}
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

        {/* Order Meta & Parties */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Customer Details
            </span>
            <div className="mt-1">
              <p className="text-sm font-bold text-slate-900">
                {salesOrder.party?.name || "Direct Customer"}
              </p>
              {salesOrder.party?.gstin && (
                <p className="text-xs text-slate-600">GSTIN: {salesOrder.party.gstin}</p>
              )}
              {salesOrder.party?.phone && (
                <p className="text-xs text-slate-500">Phone: {salesOrder.party.phone}</p>
              )}
              {salesOrder.party?.address && (
                <p className="text-xs text-slate-500">{salesOrder.party.address}</p>
              )}
              {salesOrder.party?.city && (
                <p className="text-xs text-slate-500">
                  {salesOrder.party.city}
                  {salesOrder.party.state ? `, ${salesOrder.party.state}` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 sm:text-right">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Order Date
              </span>
              <p className="text-xs font-bold text-slate-800">
                {new Date(salesOrder.date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            {salesOrder.expectedDelivery && (
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Expected Delivery
                </span>
                <p className="text-xs font-bold text-emerald-700">
                  {new Date(salesOrder.expectedDelivery).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Dispatch Warehouse
              </span>
              <p className="text-xs font-medium text-slate-700">
                {salesOrder.warehouse?.name || "Main Godown"}
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
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Delivered</span>
              <p className="text-sm font-black text-emerald-700">{totalDelivered} units</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-600 uppercase">Pending</span>
              <p className="text-sm font-black text-amber-700">
                {Math.max(0, totalOrdered - totalDelivered)} units
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-blue-600 uppercase">Invoiced</span>
              <p className="text-sm font-black text-blue-700">{totalInvoiced} units</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {salesOrder.deliveryChallans.length > 0 && (
              <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200">
                {salesOrder.deliveryChallans.length} Challan(s) Created
              </span>
            )}
            {salesOrder.invoices.length > 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                {salesOrder.invoices.length} Invoice(s) Generated
              </span>
            )}
          </div>
        </div>

        {/* Items Table with Fulfillment Breakdown */}
        <div className="overflow-x-auto py-2">
          <table className="table w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Item & Description</th>
                <th className="py-2.5 px-3 text-center">HSN</th>
                <th className="py-2.5 px-3 text-right">Ordered</th>
                <th className="py-2.5 px-3 text-right">Delivered</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
                <th className="py-2.5 px-3 text-center">GST</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesOrder.lines.map((line, idx) => (
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
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">
                    {Number(line.deliveredQty)} {line.unit}
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
            {salesOrder.notes && (
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Notes / Dispatch Instructions
                </span>
                <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{salesOrder.notes}</p>
              </div>
            )}
            {salesOrder.terms && (
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Terms & Conditions
                </span>
                <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap font-mono text-[11px]">
                  {salesOrder.terms}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-600 py-1">
              <span>Taxable Subtotal:</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(Number(salesOrder.subTotal))}
              </span>
            </div>
            {Number(salesOrder.discount) > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 py-1">
                <span>Total Discount:</span>
                <span className="font-semibold">-{formatCurrency(Number(salesOrder.discount))}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-600 py-1">
              <span>GST Total:</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(Number(salesOrder.taxTotal))}
              </span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-3 border-t-2 border-slate-300">
              <span>Grand Total:</span>
              <span className="text-blue-700">{formatCurrency(Number(salesOrder.grandTotal))}</span>
            </div>
          </div>
        </div>

        {/* Linked Documents Footer */}
        {(salesOrder.deliveryChallans.length > 0 || salesOrder.invoices.length > 0) && (
          <div className="mt-8 pt-6 border-t border-slate-200 print:hidden space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Connected Documents
            </h4>
            <div className="flex flex-wrap gap-3">
              {salesOrder.deliveryChallans.map((dc) => (
                <Link
                  key={dc.id}
                  href={`/delivery-challans/${dc.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>DC #{dc.dcNo}</span>
                  <span className="text-[10px] text-blue-500 font-normal">({dc.status})</span>
                </Link>
              ))}
              {salesOrder.invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  <span>Inv #{inv.invoiceNo}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
