"use client";

import Link from "next/link";
import {
  Printer,
  Package,
  Receipt,
} from "lucide-react";

export default function PurchaseOrderActions({
  purchaseOrderId,
  poNo,
  status,
  isFullyReceived,
}: {
  purchaseOrderId: string;
  poNo: string;
  status: string;
  isFullyReceived: boolean;
}) {
  return (
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

      {/* Receive Goods (GRN) */}
      {!isFullyReceived && status !== "CANCELLED" && (
        <Link
          href={`/goods-receipts/new?purchaseOrderId=${purchaseOrderId}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
        >
          <Package className="h-4 w-4" />
          <span>Receive Goods (GRN)</span>
        </Link>
      )}

      {/* Direct Convert to Purchase Bill */}
      <Link
        href={`/invoices/new?type=PURCHASE&purchaseOrderId=${purchaseOrderId}`}
        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
      >
        <Receipt className="h-4 w-4" />
        <span>Convert to Purchase Bill</span>
      </Link>
    </div>
  );
}
