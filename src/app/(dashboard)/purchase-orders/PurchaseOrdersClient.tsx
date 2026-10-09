"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import {
  ClipboardList,
  Plus,
  Search,
  ShoppingCart,
  CheckCircle2,
  Clock,
  ArrowRight,
  FileText,
  Building2,
  PackageCheck,
} from "lucide-react";

interface PurchaseOrderItem {
  id: string;
  poNo: string;
  date: string;
  expectedDate: string | null;
  status: string;
  party: { id: string; name: string; phone: string | null } | null;
  warehouse: { id: string; name: string } | null;
  grandTotal: number;
  orderedQty: number;
  receivedQty: number;
  billedQty: number;
  linesCount: number;
  invoices: Array<{ id: string; invoiceNo: string }>;
  grns: Array<{ id: string; grnNo: string }>;
}

export default function PurchaseOrdersClient({
  purchaseOrders,
}: {
  purchaseOrders: PurchaseOrderItem[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = purchaseOrders.filter((po) => {
    const matchStatus = statusFilter === "ALL" || po.status === statusFilter;
    const matchSearch =
      po.poNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (po.party && po.party.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const totalOrders = purchaseOrders.length;
  const totalValue = purchaseOrders
    .filter((po) => po.status !== "CANCELLED")
    .reduce((s, po) => s + po.grandTotal, 0);
  const pendingOrders = purchaseOrders.filter(
    (po) => po.status === "CONFIRMED" || po.status === "PARTIALLY_RECEIVED"
  ).length;
  const completedOrders = purchaseOrders.filter((po) => po.status === "RECEIVED").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-brand-600" /> Purchase Orders (PO)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage procurement orders, monitor supplier fulfillment, and convert to purchase bills
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/invoices/new?type=PURCHASE"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Direct Purchase Bill</span>
          </Link>
          <Link
            href="/purchase-orders/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/20 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>+ New Purchase Order</span>
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Orders</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalOrders}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">All issued procurement orders</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Order Value</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalValue)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Excludes cancelled orders</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending Receipt</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{pendingOrders}</p>
          <p className="text-[11px] text-amber-700/80 mt-0.5">Awaiting supplier delivery</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Fully Received</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{completedOrders}</p>
          <p className="text-[11px] text-emerald-700/80 mt-0.5">Inwarded into warehouse stock</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search PO #, supplier name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-brand-500 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED">Confirmed / Open</option>
            <option value="PARTIALLY_RECEIVED">Partially Received</option>
            <option value="RECEIVED">Fully Received</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">PO #</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Supplier / Vendor</th>
                <th className="px-5 py-3">Warehouse</th>
                <th className="px-5 py-3 text-center">Fulfillment Qty</th>
                <th className="px-5 py-3 text-right">Order Total</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No purchase orders found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Create a new Purchase Order to manage your procurement lifecycle.
                    </p>
                    <Link
                      href="/purchase-orders/new"
                      className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> + Create First PO
                    </Link>
                  </td>
                </tr>
              ) : (
                filtered.map((po) => {
                  const percentReceived =
                    po.orderedQty > 0
                      ? Math.min(100, Math.round((po.receivedQty / po.orderedQty) * 100))
                      : 0;

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-brand-600 whitespace-nowrap font-mono">
                        <Link href={`/purchase-orders/${po.id}`} className="hover:underline">
                          {po.poNo}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(po.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {po.party ? (
                          <Link href={`/parties/${po.party.id}`} className="hover:underline">
                            {po.party.name}
                          </Link>
                        ) : (
                          "Direct Supplier"
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                        {po.warehouse?.name || "Main Warehouse"}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-medium text-slate-800">
                            {po.receivedQty} / {po.orderedQty}
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({percentReceived}%)
                            </span>
                          </span>
                          <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                percentReceived === 100
                                  ? "bg-emerald-500"
                                  : percentReceived > 0
                                  ? "bg-amber-500"
                                  : "bg-slate-300"
                              }`}
                              style={{ width: `${percentReceived}%` }}
                            />
                          </div>
                          {po.billedQty > 0 && (
                            <span className="text-[10px] text-brand-600">
                              Billed: {po.billedQty}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(po.grandTotal)}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {po.status === "RECEIVED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" /> Received
                          </span>
                        ) : po.status === "PARTIALLY_RECEIVED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="h-3 w-3" /> Partial ({po.receivedQty}/{po.orderedQty})
                          </span>
                        ) : po.status === "CANCELLED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            Cancelled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            Confirmed (Open)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/purchase-orders/${po.id}`}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="View PO Details"
                          >
                            <FileText className="h-4 w-4" />
                          </Link>
                          {po.status !== "RECEIVED" && po.status !== "CANCELLED" && (
                            <Link
                              href={`/invoices/new?type=PURCHASE&purchaseOrderId=${po.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-[11px] font-bold transition-colors"
                              title="Convert to Purchase Bill"
                            >
                              <ShoppingCart className="h-3 w-3" />
                              <span>Create Bill</span>
                            </Link>
                          )}
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
