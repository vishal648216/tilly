"use client";

import { exportToCSV } from "@/lib/exportCsv";
import { Download } from "lucide-react";

export default function ItemsExportButton({
  items,
}: {
  items: {
    name: string;
    type: string;
    category: string | null;
    barcode: string | null;
    sku: string | null;
    hsn: string | null;
    unit: string;
    salePrice: string | number;
    purchasePrice: string | number;
    gstRate: string | number;
    stock: string | number;
  }[];
}) {
  function handleExport() {
    const headers = [
      "Item Name",
      "Type",
      "Category",
      "Barcode",
      "SKU",
      "HSN/SAC",
      "Unit",
      "Sale Price",
      "Cost Price",
      "GST %",
      "Stock",
    ];
    const rows = items.map((i) => [
      i.name,
      i.type || "PRODUCT",
      i.category || "",
      i.barcode || "",
      i.sku || "",
      i.hsn || "",
      i.unit,
      parseFloat(i.salePrice.toString()),
      parseFloat(i.purchasePrice.toString()),
      parseFloat(i.gstRate.toString()),
      parseFloat(i.stock.toString()),
    ]);
    exportToCSV("taily_inventory_items", headers, rows);
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
