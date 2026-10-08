"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { Eye, Edit, Trash2, Receipt, Plus } from "lucide-react";
import TwoStepDeleteModal from "@/components/TwoStepDeleteModal";

interface InvoiceItem {
  id: string;
  invoiceNo: string;
  type: string;
  partyName: string;
  date: string;
  grandTotal: string | number;
  paidAmount: string | number;
  status: string;
}

export default function InvoicesClient({
  initialInvoices,
  query,
}: {
  initialInvoices: InvoiceItem[];
  query?: string;
}) {
  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceItem | null>(null);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    const res = await fetch(`/api/invoices/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete bill");

    setInvoices((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  if (invoices.length === 0) {
    return (
      <div className="card p-12 text-center bg-white shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
          <Receipt className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800">No invoices found</h3>
        <p className="mt-1 text-xs text-slate-500">
          {query ? `No results found for "${query}".` : "No invoices have been created yet."}
        </p>
        {query ? (
          <Link href="/invoices" className="btn-secondary mt-4 inline-flex">
            Clear search
          </Link>
        ) : (
          <Link href="/invoices/new" className="btn-primary mt-4 inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Create First Invoice
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="card overflow-hidden bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Invoice #</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Party / Customer</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-right">Grand Total</th>
                <th className="px-5 py-3.5 text-right">Paid Amount</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3.5 font-bold font-mono text-emerald-700">
                    <Link href={`/invoices/${inv.id}`} className="hover:underline">
                      {inv.invoiceNo}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`badge ${
                        inv.type === "SALES"
                          ? "bg-blue-100 text-blue-700"
                          : inv.type === "SALES_RETURN"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {inv.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-slate-900">{inv.partyName}</td>
                  <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                    {new Date(inv.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                    {formatCurrency(inv.grandTotal)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-600 whitespace-nowrap">
                    {formatCurrency(inv.paidAmount)}
                  </td>
                  <td className="px-5 py-3.5 text-center whitespace-nowrap">
                    <span
                      className={`badge ${
                        inv.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : inv.status === "PARTIALLY_PAID" || inv.status === "PARTIAL"
                          ? "bg-amber-100 text-amber-800"
                          : inv.status === "DRAFT"
                          ? "bg-slate-100 text-slate-700"
                          : inv.status === "OVERDUE"
                          ? "bg-red-100 text-red-800"
                          : inv.status === "CANCELLED"
                          ? "bg-rose-100 text-rose-800 line-through"
                          : inv.status === "REVERSED"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* View */}
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        title="View / Print Bill"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>

                      {/* Edit */}
                      <Link
                        href={`/invoices/${inv.id}/edit`}
                        className="p-1.5 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit Bill"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(inv)}
                        className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Bill"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-Step Delete Modal */}
      {deleteTarget && (
        <TwoStepDeleteModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Invoice"
          itemIdentifier={`#${deleteTarget.invoiceNo}`}
          itemTypeLabel="Invoice"
          itemDetails={[
            { label: "Party", value: deleteTarget.partyName },
            { label: "Grand Total", value: formatCurrency(deleteTarget.grandTotal) },
            { label: "Status", value: deleteTarget.status },
          ]}
        />
      )}
    </>
  );
}
