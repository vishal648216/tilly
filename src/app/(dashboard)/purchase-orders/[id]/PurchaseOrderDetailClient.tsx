"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import {
  ArrowLeft,
  Printer,
  ShoppingCart,
  PackageCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Warehouse as WarehouseIcon,
  Calendar,
  FileText,
  AlertCircle,
} from "lucide-react";

interface PODetailData {
  id: string;
  poNo: string;
  date: string;
  expectedDate: string | null;
  status: string;
  notes: string | null;
  terms: string | null;
  subTotal: number;
  discount: number;
  taxTotal: number;
  grandTotal: number;
  party: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  warehouse: { id: string; name: string } | null;
  lines: Array<{
    id: string;
    name: string;
    sku: string | null;
    unit: string;
    hsn: string | null;
    orderedQty: number;
    receivedQty: number;
    billedQty: number;
    rate: number;
    discount: number;
    gstRate: number;
    taxableAmount: number;
    amount: number;
  }>;
  grns: Array<{
    id: string;
    grnNo: string;
    date: string;
    status: string;
  }>;
  invoices: Array<{
    id: string;
    invoiceNo: string;
    date: string;
    status: string;
    grandTotal: number;
    paidAmount: number;
  }>;
}

export default function PurchaseOrderDetailClient({ po }: { po: PODetailData }) {
  const [currentStatus, setCurrentStatus] = useState(po.status);
  const [updating, setUpdating] = useState(false);

  const totalOrdered = po.lines.reduce((s, l) => s + l.orderedQty, 0);
  const totalReceived = po.lines.reduce((s, l) => s + l.receivedQty, 0);
  const totalBilled = po.lines.reduce((s, l) => s + l.billedQty, 0);

  const percentReceived =
    totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Are you sure you want to mark this PO as ${newStatus}?`)) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        setCurrentStatus(newStatus);
      } else {
        alert(data.error || "Failed to update status");
      }
    } catch (err: any) {
      alert(err.message || "Error updating status");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/purchase-orders"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold font-mono text-slate-900">{po.poNo}</h1>
              {currentStatus === "RECEIVED" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Fully Received
                </span>
              ) : currentStatus === "PARTIALLY_RECEIVED" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  <Clock className="h-3.5 w-3.5" /> Partially Received ({percentReceived}%)
                </span>
              ) : currentStatus === "CANCELLED" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                  <XCircle className="h-3.5 w-3.5" /> Cancelled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  Confirmed (Open)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Issued on{" "}
              {new Date(po.date).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              {po.expectedDate && (
                <>
                  {" "}
                  • Expected by{" "}
                  {new Date(po.expectedDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs"
          >
            <Printer className="h-4 w-4" />
            <span>Print PO</span>
          </button>

          {currentStatus !== "CANCELLED" && currentStatus !== "RECEIVED" && (
            <Link
              href={`/invoices/new?type=PURCHASE&purchaseOrderId=${po.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/20 active:scale-95 transition-all"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Convert to Purchase Bill</span>
            </Link>
          )}

          {currentStatus !== "CANCELLED" && currentStatus !== "RECEIVED" && (
            <button
              onClick={() => handleStatusChange("CANCELLED")}
              disabled={updating}
              className="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancel PO
            </button>
          )}
        </div>
      </div>

      {/* Fulfillment Progress Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Fulfillment & Inward Status
          </div>
          <div className="text-xs font-semibold text-slate-700">
            {totalReceived} received of {totalOrdered} ordered ({percentReceived}%)
            {totalBilled > 0 && ` • ${totalBilled} billed`}
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percentReceived === 100
                ? "bg-emerald-500"
                : percentReceived > 0
                ? "bg-amber-500"
                : "bg-slate-300"
            }`}
            style={{ width: `${percentReceived}%` }}
          />
        </div>
      </div>

      {/* Supplier & Warehouse Meta Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-brand-600" /> Supplier Information
          </h2>
          {po.party ? (
            <div className="space-y-1 text-xs text-slate-600">
              <p className="font-bold text-sm text-slate-900">{po.party.name}</p>
              {po.party.gstin && <p>GSTIN: <span className="font-mono font-semibold text-slate-800">{po.party.gstin}</span></p>}
              {po.party.phone && <p>Phone: {po.party.phone}</p>}
              {po.party.email && <p>Email: {po.party.email}</p>}
              {po.party.address && (
                <p className="text-slate-500 pt-1">
                  {po.party.address}
                  {po.party.city ? `, ${po.party.city}` : ""}
                  {po.party.state ? `, ${po.party.state}` : ""}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Direct Vendor / Supplier</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <WarehouseIcon className="h-4 w-4 text-brand-600" /> Receiving Warehouse & Logistics
          </h2>
          <div className="space-y-1.5 text-xs text-slate-600">
            <p>
              <span className="text-slate-400">Warehouse: </span>
              <span className="font-semibold text-slate-900">
                {po.warehouse?.name || "Main Warehouse"}
              </span>
            </p>
            <p>
              <span className="text-slate-400">PO Date: </span>
              <span className="font-medium text-slate-800">
                {new Date(po.date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </p>
            {po.expectedDate && (
              <p>
                <span className="text-slate-400">Expected Delivery: </span>
                <span className="font-medium text-slate-800">
                  {new Date(po.expectedDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Line Items & Procurement Schedule
          </h2>
          <span className="text-xs font-semibold text-slate-500">{po.lines.length} items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Item Details</th>
                <th className="px-3 py-3 text-center">Unit</th>
                <th className="px-3 py-3 text-right">Ordered</th>
                <th className="px-3 py-3 text-right">Received</th>
                <th className="px-3 py-3 text-right">Billed</th>
                <th className="px-3 py-3 text-right">Rate</th>
                <th className="px-3 py-3 text-center">GST %</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {po.lines.map((line, idx) => (
                <tr key={line.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{line.name}</p>
                    <div className="flex gap-2 text-[10px] text-slate-400 font-mono">
                      {line.sku && <span>SKU: {line.sku}</span>}
                      {line.hsn && <span>HSN: {line.hsn}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center font-medium">{line.unit}</td>
                  <td className="px-3 py-3 text-right font-bold text-slate-900">
                    {line.orderedQty}
                  </td>
                  <td className="px-3 py-3 text-right font-medium">
                    <span
                      className={
                        line.receivedQty >= line.orderedQty
                          ? "text-emerald-600 font-bold"
                          : line.receivedQty > 0
                          ? "text-amber-600 font-bold"
                          : "text-slate-400"
                      }
                    >
                      {line.receivedQty}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-slate-700">
                    {line.billedQty}
                  </td>
                  <td className="px-3 py-3 text-right font-medium">{formatCurrency(line.rate)}</td>
                  <td className="px-3 py-3 text-center">{line.gstRate}%</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">
                    {formatCurrency(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Order Totals Summary */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex flex-col items-end gap-1.5 text-xs">
          <div className="flex justify-between w-64 text-slate-600">
            <span>Subtotal:</span>
            <span className="font-semibold text-slate-800">{formatCurrency(po.subTotal)}</span>
          </div>
          {po.discount > 0 && (
            <div className="flex justify-between w-64 text-emerald-600">
              <span>Discounts:</span>
              <span className="font-semibold">-{formatCurrency(po.discount)}</span>
            </div>
          )}
          <div className="flex justify-between w-64 text-slate-600">
            <span>GST / Taxes:</span>
            <span className="font-semibold text-slate-800">{formatCurrency(po.taxTotal)}</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between w-64 font-bold text-slate-900 text-sm">
            <span>Grand Total:</span>
            <span className="text-brand-600 font-extrabold">{formatCurrency(po.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Linked Invoices / Purchase Bills */}
      {po.invoices.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-brand-600" /> Linked Purchase Bills ({po.invoices.length})
          </h2>
          <div className="divide-y divide-slate-100">
            {po.invoices.map((inv) => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="font-bold text-brand-600 hover:underline font-mono"
                  >
                    {inv.invoiceNo}
                  </Link>
                  <span className="text-slate-400 ml-2">
                    {new Date(inv.date).toLocaleDateString("en-IN")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(inv.grandTotal)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes & Terms */}
      {(po.notes || po.terms) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {po.notes && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Notes
              </h3>
              <p className="text-xs text-slate-700 whitespace-pre-wrap">{po.notes}</p>
            </div>
          )}
          {po.terms && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Terms & Conditions
              </h3>
              <p className="text-xs text-slate-700 whitespace-pre-wrap">{po.terms}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
