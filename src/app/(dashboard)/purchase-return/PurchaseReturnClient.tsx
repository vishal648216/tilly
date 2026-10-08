"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RotateCcw,
  Plus,
  Search,
  Building2,
  Calendar,
  IndianRupee,
  FileText,
  Printer,
  PackageMinus,
  CheckCircle2,
  Eye,
  Edit,
  Trash2,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import TwoStepDeleteModal from "@/components/TwoStepDeleteModal";

interface PurchaseReturnItem {
  id: string;
  invoiceNo: string;
  date: string;
  grandTotal: string | number;
  subTotal: string | number;
  status: string;
  notes: string | null;
  party: {
    id: string;
    name: string;
    phone: string | null;
    gstin: string | null;
  } | null;
  lines: Array<{
    id: string;
    name: string;
    qty: string | number;
    rate: string | number;
    amount: string | number;
  }>;
}

export default function PurchaseReturnClient({
  initialReturns,
}: {
  initialReturns: PurchaseReturnItem[];
}) {
  const [returns, setReturns] = useState<PurchaseReturnItem[]>(initialReturns);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PurchaseReturnItem | null>(null);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/invoices/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete debit note");

    setReturns((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const filtered = returns.filter((r) => {
    const s = search.toLowerCase();
    const matchNo = r.invoiceNo.toLowerCase().includes(s);
    const matchParty = r.party?.name?.toLowerCase().includes(s) || false;
    const matchNotes = r.notes?.toLowerCase().includes(s) || false;
    const matchItems = r.lines.some((l) => l.name.toLowerCase().includes(s));
    return matchNo || matchParty || matchNotes || matchItems;
  });

  const totalReturnAmount = returns.reduce(
    (sum, r) => sum + parseFloat(r.grandTotal.toString()),
    0
  );

  const totalItemsReturned = returns.reduce(
    (sum, r) =>
      sum +
      r.lines.reduce((lSum, l) => lSum + parseFloat(l.qty.toString()), 0),
    0
  );

  const uniqueVendors = new Set(returns.map((r) => r.party?.id).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <PackageMinus className="h-7 w-7 text-rose-600" />
            Purchase Returns (Debit Notes)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Vendor return management, debit notes to suppliers, and automated stock deductions.
          </p>
        </div>
        <Link
          href="/purchase-return/new"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-rose-600/20 hover:from-rose-700 hover:to-red-700 transition-all active:scale-95 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Debit Note (Vendor Return)</span>
        </Link>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 border-slate-200/80 bg-white">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Debit Notes</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{returns.length}</div>
          <div className="mt-1 text-xs text-slate-500">Across {uniqueVendors} Vendors</div>
        </div>

        <div className="card p-5 border-rose-200/80 bg-rose-50/30">
          <div className="flex items-center justify-between text-rose-700 text-xs font-semibold uppercase tracking-wider">
            <span>Total Returned Amount</span>
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">
            {formatCurrency(totalReturnAmount)}
          </div>
          <div className="mt-1 text-xs text-rose-600/80">Credited to Vendor Ledger</div>
        </div>

        <div className="card p-5 border-slate-200/80 bg-white">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Items Returned / Sent Back</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <RotateCcw className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{totalItemsReturned} Units</div>
          <div className="mt-1 text-xs text-emerald-600 font-medium">Stock Automatically Deducted</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Debit Note #, Vendor name, item name, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
      </div>

      {/* Debit Notes Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Debit Note #</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Vendor (Supplier)</th>
                <th className="px-5 py-3.5">Items Returned</th>
                <th className="px-5 py-3.5">Reason / Notes</th>
                <th className="px-5 py-3.5 text-right">Return Amount</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    <PackageMinus className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No purchase returns recorded yet.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      When you send damaged or defective goods back to a vendor, create a Debit Note here.
                    </p>
                    <Link
                      href="/purchase-return/new"
                      className="mt-4 inline-flex items-center gap-1.5 btn-primary text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create First Debit Note</span>
                    </Link>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-900 flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                        <PackageMinus className="h-3.5 w-3.5" />
                      </span>
                      <span>{r.invoiceNo}</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {new Date(r.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-800">{r.party?.name || "Direct Vendor"}</div>
                      {r.party?.phone && (
                        <div className="text-xs text-slate-400 font-mono">{r.party.phone}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs text-slate-700 max-w-xs truncate">
                        {r.lines.map((l) => `${l.name} (${l.qty})`).join(", ")}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {r.lines.length} item line{r.lines.length > 1 ? "s" : ""}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 max-w-[200px] truncate">
                      {r.notes || "—"}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-rose-600">
                      {formatCurrency(parseFloat(r.grandTotal.toString()))}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Adjusted</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <Link
                          href={`/invoices/${r.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                          title="View / Print Debit Note"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>View</span>
                        </Link>
                        <Link
                          href={`/invoices/${r.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:border-rose-200 transition"
                          title="Edit / Update Debit Note"
                        >
                          <Edit className="h-3.5 w-3.5 text-rose-500" />
                          <span>Edit</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 hover:border-red-300 transition"
                          title="Delete Debit Note (Requires 2 confirmations)"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <TwoStepDeleteModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Debit Note"
          itemIdentifier={`#${deleteTarget.invoiceNo}`}
          itemTypeLabel="Debit Note"
          itemDetails={[
            { label: "Vendor", value: deleteTarget.party?.name || "Direct Vendor" },
            { label: "Grand Total", value: formatCurrency(deleteTarget.grandTotal) },
            { label: "Date", value: new Date(deleteTarget.date).toLocaleDateString("en-IN") },
            { label: "Status", value: deleteTarget.status },
          ]}
        />
      )}
    </div>
  );
}
