"use client";

import { exportToCSV } from "@/lib/exportCsv";
import { Download } from "lucide-react";

export default function InvoicesExportButton({
  invoices,
}: {
  invoices: {
    invoiceNo: string;
    type: string;
    date: string;
    partyName: string;
    grandTotal: string | number;
    paidAmount: string | number;
    status: string;
  }[];
}) {
  function handleExport() {
    const headers = [
      "Invoice #",
      "Type",
      "Date",
      "Party Name",
      "Grand Total",
      "Paid Amount",
      "Balance",
      "Status",
    ];
    const rows = invoices.map((inv) => {
      const grand = parseFloat(inv.grandTotal.toString());
      const paid = parseFloat(inv.paidAmount.toString());
      return [
        inv.invoiceNo,
        new Date(inv.date).toLocaleDateString("en-IN"),
        inv.type,
        inv.partyName,
        grand,
        paid,
        grand - paid,
        inv.status,
      ];
    });
    exportToCSV("taily_invoices", headers, rows);
  }

  return (
    <button
      onClick={handleExport}
      className="btn-secondary flex items-center gap-2 text-sm font-medium"
    >
      <Download className="h-4 w-4 text-slate-500" /> Export CSV
    </button>
  );
}
