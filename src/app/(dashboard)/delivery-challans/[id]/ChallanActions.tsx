"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Printer,
  Receipt,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";

export default function ChallanActions({
  challanId,
  dcNo,
  status,
  invoiceId,
  invoiceNo,
}: {
  challanId: string;
  dcNo: string;
  status: string;
  invoiceId?: string | null;
  invoiceNo?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isInvoiced = Boolean(invoiceId) || status === "DELIVERED";

  async function handleQuickConvert() {
    if (!confirm(`Generate Tax Invoice immediately for Delivery Challan ${dcNo}?`)) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/delivery-challans/${challanId}/convert-to-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to convert challan to invoice.");

      router.push(`/invoices/${data.invoice.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to convert challan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 print:hidden">
        {/* Print / PDF */}
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <Printer className="h-4 w-4 text-slate-500" />
          <span>Print / PDF</span>
        </button>

        {/* Invoice Actions */}
        {isInvoiced ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <span>Invoiced</span>
            </span>
            {invoiceId && (
              <Link
                href={`/invoices/${invoiceId}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
              >
                <Receipt className="h-4 w-4" />
                <span>View Invoice #{invoiceNo || ""}</span>
              </Link>
            )}
          </div>
        ) : status !== "CANCELLED" ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleQuickConvert}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              <Receipt className="h-4 w-4" />
              <span>{loading ? "Generating..." : "Quick Tax Invoice"}</span>
            </button>

            <Link
              href={`/invoices/new?challanId=${challanId}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
            >
              <span>Customize Invoice</span>
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
