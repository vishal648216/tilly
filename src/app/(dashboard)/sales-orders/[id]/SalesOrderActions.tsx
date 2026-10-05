"use client";

import Link from "next/link";
import {
  Printer,
  Truck,
  Receipt,
  CheckCircle2,
} from "lucide-react";

export default function SalesOrderActions({
  salesOrderId,
  orderNo,
  status,
  isFullyDelivered,
}: {
  salesOrderId: string;
  orderNo: string;
  status: string;
  isFullyDelivered: boolean;
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

      {/* Dispatch Delivery Challan */}
      {!isFullyDelivered && status !== "CANCELLED" && (
        <Link
          href={`/delivery-challans/new?salesOrderId=${salesOrderId}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <Truck className="h-4 w-4" />
          <span>Dispatch (Delivery Challan)</span>
        </Link>
      )}

      {/* Direct Convert to Invoice */}
      <Link
        href={`/invoices/new?salesOrderId=${salesOrderId}`}
        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
      >
        <Receipt className="h-4 w-4" />
        <span>Convert to Tax Invoice</span>
      </Link>
    </div>
  );
}
