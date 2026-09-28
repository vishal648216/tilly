"use client";

import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";

export default function ReportActions() {
  return (
    <div className="no-print mb-4 flex items-center justify-between">
      <Link href="/reports" className="btn-secondary text-sm inline-flex items-center gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Reports
      </Link>
      <button onClick={() => window.print()} className="btn-primary text-sm inline-flex items-center gap-1.5">
        <Printer className="h-4 w-4" /> Print / PDF
      </button>
    </div>
  );
}
