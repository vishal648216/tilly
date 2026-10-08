"use client";

import Link from "next/link";
import { Printer, Receipt } from "lucide-react";

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
  return (
    <div className="space-y-3">
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
