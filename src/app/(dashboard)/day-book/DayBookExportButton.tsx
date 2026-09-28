"use client";

import { exportToCSV } from "@/lib/exportCsv";
import { Download } from "lucide-react";

export default function DayBookExportButton({
  date,
  vouchers,
}: {
  date: string;
  vouchers: {
    voucherNo: string;
    type: string;
    narration: string | null;
    debit: number;
    credit: number;
    account: string;
  }[];
}) {
  function handleExport() {
    const headers = ["Voucher #", "Type", "Account Head", "Narration", "Debit (₹)", "Credit (₹)"];
    const rows = vouchers.map((v) => [
      v.voucherNo,
      v.type,
      v.account,
      v.narration || "",
      v.debit,
      v.credit,
    ]);
    exportToCSV(`day_book_${date}`, headers, rows);
  }

  return (
    <button
      onClick={handleExport}
      className="btn-secondary flex items-center gap-1.5 text-sm font-medium"
    >
      <Download className="h-4 w-4" /> Export CSV
    </button>
  );
}
