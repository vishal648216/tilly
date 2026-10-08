"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { exportToCSV } from "@/lib/exportCsv";
import {
  RotateCcw,
  Plus,
  Download,
  Search,
  FileText,
  Calendar,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  TrendingDown,
  Package,
} from "lucide-react";
import TwoStepDeleteModal from "@/components/TwoStepDeleteModal";

interface CreditNote {
  id: string;
  invoiceNo: string;
  date: string;
  party: { id: string; name: string; phone: string | null } | null;
  grandTotal: string | number;
  subTotal: string | number;
  status: string;
  notes: string | null;
  lines: Array<{
    id: string;
    name: string;
    qty: string | number;
    rate: string | number;
    amount: string | number;
  }>;
}

export default function SalesReturnClient({
  returns: initialReturns,
}: {
  returns: CreditNote[];
}) {
  const [returns, setReturns] = useState<CreditNote[]>(initialReturns);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CreditNote | null>(null);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/invoices/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete credit note");

    setReturns((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const filtered = returns.filter((r) => {
    const matchSearch =
      r.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.party && r.party.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      r.lines.some((l) => l.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchSearch;
  });

  const totalReturnValue = returns.reduce(
    (sum, r) => sum + parseFloat(r.grandTotal.toString()),
    0
  );
  const totalItemsReturned = returns.reduce(
    (sum, r) =>
      sum +
      r.lines.reduce((lSum, l) => lSum + parseFloat(l.qty.toString() || "0"), 0),
    0
  );

  function handleExport() {
    const headers = [
      "Credit Note No",
      "Date",
      "Customer Name",
      "Total Items",
      "Grand Total (₹)",
      "Notes & Reason",
    ];
    const rows = filtered.map((r) => [
      r.invoiceNo,
      new Date(r.date).toLocaleDateString("en-IN"),
      r.party?.name || "Cash Customer",
      r.lines.reduce((s, l) => s + parseFloat(l.qty.toString() || "0"), 0),
      parseFloat(r.grandTotal.toString()),
      r.notes || "-",
    ]);
    exportToCSV(`Sales_Returns_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <RotateCcw className="h-5 w-5" />
            </div>
            Sales Return (Credit Notes)
          </h1>
          <p className="text-sm text-slate-500">
            Manage customer product returns, credit notes, and automated inventory adjustments
          </p>
        </div>

        <div className="flex items-center gap-3">
          {returns.length > 0 && (
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <Download className="h-4 w-4 text-slate-500" />
              Export CSV
            </button>
          )}

          <Link
            href="/sales-return/new"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-600/20 hover:from-amber-700 hover:to-orange-700 transition"
          >
            <Plus className="h-4 w-4" />
            Create Sales Return
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/50 to-orange-50/30 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Total Sales Returns
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-slate-900">
            {formatCurrency(totalReturnValue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Total credited amount to customers</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Credit Notes Issued
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-slate-900">{returns.length}</p>
          <p className="mt-1 text-xs text-slate-500">Active credit vouchers in ledger</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Items Restocked
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-slate-900">
            {totalItemsReturned}{" "}
            <span className="text-sm font-semibold text-slate-500">Units</span>
          </p>
          <p className="mt-1 text-xs text-emerald-600 font-medium">✓ Restocked back into inventory</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        {/* Search Bar */}
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Credit Note #, Customer name, or Item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-4 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <RotateCcw className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-slate-800">Koi Sales Return record nahi mila</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Jab koi customer saman wapas kare, toh Sales Return (Credit Note) create karein.
            </p>
            <Link
              href="/sales-return/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Pehla Sales Return banayein
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Credit Note #</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Items Returned</th>
                  <th className="px-5 py-3.5 text-right">Credited Amount</th>
                  <th className="px-5 py-3.5">Reason / Notes</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((cn) => {
                  const totalQty = cn.lines.reduce(
                    (sum, l) => sum + parseFloat(l.qty.toString() || "0"),
                    0
                  );
                  return (
                    <tr key={cn.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-slate-900">
                        <Link
                          href={`/invoices/${cn.id}`}
                          className="text-amber-700 hover:text-amber-800 hover:underline"
                        >
                          {cn.invoiceNo}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-600">
                        {new Date(cn.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {cn.party?.name || "Cash Customer"}
                        </div>
                        {cn.party?.phone && (
                          <div className="text-xs text-slate-400">{cn.party.phone}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 border border-amber-200/60">
                          <Package className="h-3 w-3" />
                          {totalQty} Qty ({cn.lines.length} Items)
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-slate-900">
                        {formatCurrency(cn.grandTotal)}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500 max-w-xs truncate">
                        {cn.notes || "Goods Return"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Link
                            href={`/invoices/${cn.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                            title="View / Print Bill"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-500" />
                            <span>View</span>
                          </Link>
                          <Link
                            href={`/invoices/${cn.id}/edit`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 transition"
                            title="Edit / Update Bill"
                          >
                            <Edit className="h-3.5 w-3.5 text-indigo-500" />
                            <span>Edit</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(cn)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 hover:border-red-300 transition"
                            title="Delete Bill (Requires 2 confirmations)"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <TwoStepDeleteModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Credit Note"
          itemIdentifier={`#${deleteTarget.invoiceNo}`}
          itemTypeLabel="Credit Note"
          itemDetails={[
            { label: "Customer", value: deleteTarget.party?.name || "Cash Customer" },
            { label: "Grand Total", value: formatCurrency(deleteTarget.grandTotal) },
            { label: "Date", value: new Date(deleteTarget.date).toLocaleDateString("en-IN") },
            { label: "Status", value: deleteTarget.status },
          ]}
        />
      )}
    </div>
  );
}
