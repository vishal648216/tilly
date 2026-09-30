"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { exportToCSV } from "@/lib/exportCsv";
import {
  ShoppingCart,
  Download,
  Plus,
  Search,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  PackageMinus,
  RotateCcw,
} from "lucide-react";

interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  party: { id: string; name: string; phone: string | null } | null;
  grandTotal: string | number;
  paidAmount: string | number;
  status: string;
  notes: string | null;
}

export default function PurchasesClient({
  purchases,
}: {
  purchases: Invoice[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = purchases.filter((p) => {
    const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
    const matchSearch =
      p.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.party && p.party.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const totalPurchases = purchases.reduce((sum, p) => sum + parseFloat(p.grandTotal.toString()), 0);
  const totalPaid = purchases.reduce((sum, p) => sum + parseFloat(p.paidAmount.toString()), 0);
  const totalOutstanding = totalPurchases - totalPaid;

  function handleExport() {
    const headers = [
      "Bill No",
      "Date",
      "Supplier Name",
      "Grand Total",
      "Paid Amount",
      "Pending Amount",
      "Status",
    ];
    const rows = filtered.map((p) => {
      const grand = parseFloat(p.grandTotal.toString());
      const paid = parseFloat(p.paidAmount.toString());
      return [
        p.invoiceNo,
        new Date(p.date).toLocaleDateString("en-IN"),
        p.party?.name || "Cash Supplier",
        grand,
        paid,
        grand - paid,
        p.status,
      ];
    });
    exportToCSV("taily_purchases", headers, rows);
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-brand-600" /> Purchase Bills
          </h1>
          <p className="text-sm text-slate-500">
            Manage vendor bills, input GST credits, and inventory replenishment
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/purchase-return"
            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100 transition-colors"
          >
            <PackageMinus className="h-4 w-4 text-rose-600" />
            <span>Vendor Returns (Debit Notes)</span>
          </Link>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" /> Export CSV
          </button>
          <Link
            href="/invoices/new?type=PURCHASE"
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Purchase Bill
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Purchases
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(totalPurchases)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{purchases.length} total purchase bills</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Paid to Suppliers
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {formatCurrency(totalPaid)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Settled payments</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Payables / Outstanding
          </p>
          <p className={`mt-2 text-2xl font-bold ${totalOutstanding > 0 ? "text-amber-600" : "text-slate-900"}`}>
            {formatCurrency(totalOutstanding)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Due to vendors/suppliers</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by bill #, supplier name, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="ALL">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="UNPAID">Unpaid</option>
          </select>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Bill #</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Supplier / Vendor</th>
                <th className="px-6 py-3 text-right">Grand Total</th>
                <th className="px-6 py-3 text-right">Paid</th>
                <th className="px-6 py-3 text-right">Pending</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <ShoppingCart className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-base font-medium text-slate-600">No purchase bills found</p>
                    <p className="text-xs">Click "Add Purchase Bill" to record stock purchases.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((pur) => {
                  const grand = parseFloat(pur.grandTotal.toString());
                  const paid = parseFloat(pur.paidAmount.toString());
                  const pending = grand - paid;
                  return (
                    <tr key={pur.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-bold text-brand-600 whitespace-nowrap">
                        <Link href={`/invoices/${pur.id}`}>{pur.invoiceNo}</Link>
                      </td>
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {new Date(pur.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {pur.party ? (
                          <Link href={`/parties/${pur.party.id}`} className="hover:underline">
                            {pur.party.name}
                          </Link>
                        ) : (
                          "Cash Vendor"
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900 whitespace-nowrap">
                        {formatCurrency(grand)}
                      </td>
                      <td className="px-6 py-4 text-right text-emerald-600 whitespace-nowrap">
                        {formatCurrency(paid)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(pending)}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            pur.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : pur.status === "PARTIAL"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {pur.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/purchase-return/new?billId=${pur.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                            title="Return goods from this bill to vendor"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Return
                          </Link>
                          <Link
                            href={`/invoices/${pur.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" /> View Bill
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
