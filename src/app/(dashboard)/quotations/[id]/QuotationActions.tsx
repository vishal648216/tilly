"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Printer,
  ArrowRight,
  ShoppingCart,
  Receipt,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function QuotationActions({
  quotationId,
  quotationNo,
  status,
  hasLinkedOrder,
}: {
  quotationId: string;
  quotationNo: string;
  status: string;
  hasLinkedOrder: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConvertToSalesOrder() {
    if (!confirm(`Are you sure you want to convert Quotation ${quotationNo} into an official Sales Order?`)) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/quotations/${quotationId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to convert quotation to sales order");

      router.push(`/sales-orders`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to convert quotation");
    } finally {
      setLoading(false);
    }
  }

  const isConverted = status === "CONVERTED" || hasLinkedOrder;

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

        {/* Convert to Sales Order */}
        {!isConverted ? (
          <button
            type="button"
            disabled={loading}
            onClick={handleConvertToSalesOrder}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>{loading ? "Converting..." : "Convert to Sales Order"}</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700">
            <CheckCircle2 className="h-4 w-4" />
            <span>Converted to SO</span>
          </span>
        )}

        {/* Convert to Direct Invoice */}
        <Link
          href={`/invoices/new?quotationId=${quotationId}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
        >
          <Receipt className="h-4 w-4" />
          <span>Convert to Invoice</span>
        </Link>
      </div>
    </div>
  );
}
