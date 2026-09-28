"use client";

import { exportToCSV } from "@/lib/exportCsv";
import { Download } from "lucide-react";

export default function PartiesExportButton({
  parties,
}: {
  parties: {
    name: string;
    type: string;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    city: string | null;
    state: string | null;
  }[];
}) {
  function handleExport() {
    const headers = ["Name", "Type", "Phone", "Email", "GSTIN", "City", "State"];
    const rows = parties.map((p) => [
      p.name,
      p.type,
      p.phone || "",
      p.email || "",
      p.gstin || "",
      p.city || "",
      p.state || "",
    ]);
    exportToCSV("taily_parties", headers, rows);
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
