"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { exportToCSV } from "@/lib/exportCsv";
import BarcodeSvg from "@/components/BarcodeSvg";
import {
  Package,
  Wrench,
  Plus,
  Search,
  Download,
  Barcode,
  Printer,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Tag,
  Layers,
  Sparkles,
  X,
  FileText,
  Building2,
  Copy,
} from "lucide-react";

export interface ItemData {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  brand: string | null;
  type: string;
  hsn: string | null;
  unit: string;
  mrp: number;
  salePrice: number;
  purchasePrice: number;
  gstRate: number;
  taxMode: string;
  stock: number;
  minStock: number;
  supplierName: string | null;
}

export default function ItemsClient({
  items: initialItems,
  companyName,
  isInventoryEnabled,
}: {
  items: ItemData[];
  companyName: string;
  isInventoryEnabled: boolean;
}) {
  const [items] = useState<ItemData[]>(initialItems);
  const [search, setSearch] = useState("");
  const [stockTab, setStockTab] = useState<"ALL" | "LOW_STOCK" | "OUT_OF_STOCK" | "IN_STOCK">("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Barcode Printing Modal State
  const [barcodeModalItem, setBarcodeModalItem] = useState<ItemData | null>(null);
  const [labelFormat, setLabelFormat] = useState<"THERMAL_50x25" | "THERMAL_38x25" | "A4_24_SHEET">("THERMAL_50x25");
  const [printQuantity, setPrintQuantity] = useState<number>(1);
  const [showShopName, setShowShopName] = useState(true);
  const [showItemName, setShowItemName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category && i.category.trim()) set.add(i.category.trim());
    });
    return ["ALL", ...Array.from(set)];
  }, [items]);

  // Inventory KPI Metrics
  const metrics = useMemo(() => {
    let totalProducts = 0;
    let totalServices = 0;
    let totalValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    items.forEach((i) => {
      if (i.type === "SERVICE") {
        totalServices++;
      } else {
        totalProducts++;
        const s = Number(i.stock) || 0;
        const cost = Number(i.purchasePrice) || Number(i.salePrice) || 0;
        totalValuation += s * cost;

        if (s <= 0) {
          outOfStockCount++;
        } else if (i.minStock > 0 && s <= i.minStock) {
          lowStockCount++;
        }
      }
    });

    return {
      totalCount: items.length,
      totalProducts,
      totalServices,
      totalValuation: Math.round(totalValuation * 100) / 100,
      lowStockCount,
      outOfStockCount,
    };
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      // Type
      const matchType = typeFilter === "ALL" || item.type === typeFilter;

      // Category
      const matchCategory = categoryFilter === "ALL" || item.category === categoryFilter;

      // Stock Tab
      let matchStock = true;
      if (item.type === "PRODUCT" && isInventoryEnabled) {
        if (stockTab === "LOW_STOCK") {
          matchStock = item.stock > 0 && item.minStock > 0 && item.stock <= item.minStock;
        } else if (stockTab === "OUT_OF_STOCK") {
          matchStock = item.stock <= 0;
        } else if (stockTab === "IN_STOCK") {
          matchStock = item.stock > item.minStock;
        }
      }

      // Search Query
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        (item.hsn && item.hsn.toLowerCase().includes(q));

      return matchType && matchCategory && matchStock && matchSearch;
    });
  }, [items, search, typeFilter, categoryFilter, stockTab, isInventoryEnabled]);

  // Open Barcode Modal
  const openBarcodeModal = (item: ItemData) => {
    setBarcodeModalItem(item);
    const initialQty = item.stock > 0 ? Math.min(24, Math.floor(item.stock)) : 1;
    setPrintQuantity(initialQty || 1);
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      "Item Name",
      "Type",
      "SKU",
      "Barcode",
      "Category",
      "Brand",
      "HSN/SAC",
      "Sale Price",
      "Cost Price",
      "MRP",
      "GST %",
      "Current Stock",
      "Min Stock Alert",
      "Unit",
    ];
    const rows = filteredItems.map((i) => [
      i.name,
      i.type,
      i.sku || "",
      i.barcode || "",
      i.category || "",
      i.brand || "",
      i.hsn || "",
      i.salePrice,
      i.purchasePrice,
      i.mrp,
      i.gstRate,
      i.stock,
      i.minStock,
      i.unit,
    ]);
    exportToCSV("taily_inventory_catalog", headers, rows);
  };

  // Print Barcodes Trigger
  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-brand-600" /> Items, Catalog & Barcodes
          </h1>
          <p className="text-sm text-slate-500">
            Real-time stock valuation, low-stock warnings, and barcode label printing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/inventory/adjustments"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
            <span>Stock Adjustments</span>
          </Link>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" /> Export CSV
          </button>
          <Link
            href="/items/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/20 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" /> Add Item / Service
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Catalog Items</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.totalCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {metrics.totalProducts} Physical Products • {metrics.totalServices} Services
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Inventory Valuation</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">
            {formatCurrency(metrics.totalValuation)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Total stock asset value</p>
        </div>

        {/* Low Stock Warning Card */}
        <div
          onClick={() => setStockTab(stockTab === "LOW_STOCK" ? "ALL" : "LOW_STOCK")}
          className={`rounded-2xl border p-4 shadow-2xs cursor-pointer transition-all ${
            stockTab === "LOW_STOCK"
              ? "border-amber-400 bg-amber-100/50 ring-2 ring-amber-400"
              : "border-amber-200 bg-amber-50/40 hover:bg-amber-50/70"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Low Stock Warnings
            </p>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">{metrics.lowStockCount}</p>
          <p className="text-[11px] text-amber-700/80 mt-0.5">Items at or below min stock</p>
        </div>

        {/* Out of Stock Card */}
        <div
          onClick={() => setStockTab(stockTab === "OUT_OF_STOCK" ? "ALL" : "OUT_OF_STOCK")}
          className={`rounded-2xl border p-4 shadow-2xs cursor-pointer transition-all ${
            stockTab === "OUT_OF_STOCK"
              ? "border-rose-400 bg-rose-100/50 ring-2 ring-rose-400"
              : "border-rose-200 bg-rose-50/40 hover:bg-rose-50/70"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
              Out of Stock
            </p>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-1 text-2xl font-extrabold text-rose-700">{metrics.outOfStockCount}</p>
          <p className="text-[11px] text-rose-700/80 mt-0.5">Inventory completely depleted</p>
        </div>
      </div>

      {/* Stock Status Pills & Filter Bar */}
      <div className="space-y-3">
        {/* Quick Stock Filter Tabs */}
        {isInventoryEnabled && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setStockTab("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                stockTab === "ALL"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Items ({items.length})
            </button>
            <button
              onClick={() => setStockTab("LOW_STOCK")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                stockTab === "LOW_STOCK"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>Low Stock Alerts ({metrics.lowStockCount})</span>
            </button>
            <button
              onClick={() => setStockTab("OUT_OF_STOCK")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                stockTab === "OUT_OF_STOCK"
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
              }`}
            >
              <XCircle className="h-3.5 w-3.5 text-rose-600" />
              <span>Out of Stock ({metrics.outOfStockCount})</span>
            </button>
            <button
              onClick={() => setStockTab("IN_STOCK")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                stockTab === "IN_STOCK"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>In Stock Only</span>
            </button>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by product name, barcode, SKU, brand, category, HSN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs font-medium outline-none bg-transparent"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 bg-white"
            >
              <option value="ALL">All Types</option>
              <option value="PRODUCT">Physical Products</option>
              <option value="SERVICE">Services Only</option>
            </select>

            {/* Category Filter */}
            {categories.length > 1 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 bg-white"
              >
                <option value="ALL">All Categories</option>
                {categories
                  .filter((c) => c !== "ALL")
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Product & SKU</th>
                <th className="px-4 py-3.5">Brand / Category</th>
                <th className="px-4 py-3.5">Barcode / HSN</th>
                <th className="px-4 py-3.5 text-right">Sale Price</th>
                <th className="px-4 py-3.5 text-right">Cost Price</th>
                <th className="px-4 py-3.5 text-right">Stock Level</th>
                <th className="px-5 py-3.5 text-right">Print & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No matching items found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {search ? `No items match "${search}"` : "Try clearing selected filters"}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isService = item.type === "SERVICE";
                  const isOutOfStock = !isService && item.stock <= 0;
                  const isLowStock = !isService && !isOutOfStock && item.minStock > 0 && item.stock <= item.minStock;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & SKU */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-2">
                          <span
                            className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                              isService ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {isService ? <Wrench className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
                          </span>
                          <div>
                            <p className="font-bold text-slate-900">{item.name}</p>
                            {item.sku && (
                              <p className="text-[10px] font-mono text-slate-400">SKU: {item.sku}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Brand & Category */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {item.brand && (
                            <span className="inline-block text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                              {item.brand}
                            </span>
                          )}
                          <p className="text-slate-600 font-medium">{item.category || "General"}</p>
                        </div>
                      </td>

                      {/* Barcode & HSN */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {item.barcode ? (
                            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700 font-semibold">
                              <Barcode className="h-3.5 w-3.5 text-brand-600" />
                              <span>{item.barcode}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                          {item.hsn && (
                            <p className="text-[10px] text-slate-400 font-mono">HSN: {item.hsn}</p>
                          )}
                        </div>
                      </td>

                      {/* Sale Price & MRP */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <p className="font-extrabold text-slate-900">{formatCurrency(item.salePrice)}</p>
                        {item.mrp > item.salePrice && (
                          <p className="text-[10px] text-slate-400 line-through">
                            MRP {formatCurrency(item.mrp)}
                          </p>
                        )}
                      </td>

                      {/* Cost Price */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap text-slate-500">
                        {formatCurrency(item.purchasePrice)}
                        <span className="block text-[10px] text-slate-400">GST {item.gstRate}%</span>
                      </td>

                      {/* Stock Level & Badges */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {isService ? (
                          <span className="text-slate-500 font-medium">{item.unit || "Service"}</span>
                        ) : isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            <XCircle className="h-3 w-3" /> Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              <AlertTriangle className="h-3 w-3" /> {item.stock} {item.unit} (Low)
                            </span>
                            <span className="text-[9px] text-amber-700 mt-0.5 font-medium">
                              Min Alert: {item.minStock}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {item.stock} {item.unit}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Print Barcode Label */}
                          {!isService && (
                            <button
                              type="button"
                              onClick={() => openBarcodeModal(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all shadow-2xs"
                              title="Generate and print barcode sticker"
                            >
                              <Printer className="h-3.5 w-3.5 text-slate-600" />
                              <span>Sticker</span>
                            </button>
                          )}

                          {/* Quick Adjust Stock */}
                          {!isService && (
                            <Link
                              href={`/inventory/adjustments`}
                              className="p-1 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 transition-colors"
                              title="Audit / Adjust Stock"
                            >
                              <SlidersHorizontal className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barcode Sticker Generator Modal */}
      {barcodeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Printer className="h-4 w-4 text-brand-600" />
                  <span>Barcode Sticker Generator</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Product: <strong className="text-slate-800">{barcodeModalItem.name}</strong> • Code:{" "}
                  <strong className="font-mono text-brand-600">
                    {barcodeModalItem.barcode || barcodeModalItem.sku || "AUTO"}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBarcodeModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Print Configuration Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sticker Format</label>
                <select
                  value={labelFormat}
                  onChange={(e) => setLabelFormat(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-brand-500 bg-white"
                >
                  <option value="THERMAL_50x25">Thermal Roll (50mm x 25mm Standard)</option>
                  <option value="THERMAL_38x25">Thermal Roll (38mm x 25mm Compact)</option>
                  <option value="A4_24_SHEET">A4 Sheet (24 Stickers - 3x8 Grid)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Stickers Count to Print
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={printQuantity}
                    onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-brand-500"
                  />
                  {barcodeModalItem.stock > 0 && (
                    <button
                      type="button"
                      onClick={() => setPrintQuantity(Math.max(1, Math.floor(barcodeModalItem.stock)))}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 whitespace-nowrap"
                    >
                      Match Stock ({barcodeModalItem.stock})
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Label Content Toggles */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Visible Content on Sticker:
              </p>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showShopName}
                    onChange={(e) => setShowShopName(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
                  />
                  <span>Shop Name ({companyName})</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showItemName}
                    onChange={(e) => setShowItemName(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
                  />
                  <span>Product Name</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
                  />
                  <span>Sale Price</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMrp}
                    onChange={(e) => setShowMrp(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
                  />
                  <span>MRP</span>
                </label>
              </div>
            </div>

            {/* Live Sticker Preview Card */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Live Sticker Preview ({printQuantity} {printQuantity === 1 ? "Label" : "Labels"}):
              </p>
              <div className="p-6 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center overflow-x-auto">
                {/* Single Sticker Card (Matches 50x25mm aspect ratio) */}
                <div className="w-[190px] min-h-[95px] p-2 bg-white rounded-lg border-2 border-dashed border-slate-400 shadow-sm flex flex-col items-center justify-between text-center select-none font-sans">
                  {showShopName && (
                    <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-800 line-clamp-1 w-full">
                      {companyName}
                    </p>
                  )}
                  {showItemName && (
                    <p className="text-[10px] font-bold text-slate-900 leading-tight line-clamp-1 w-full">
                      {barcodeModalItem.name}
                    </p>
                  )}

                  {/* Scannable Barcode SVG */}
                  <div className="my-1">
                    <BarcodeSvg
                      value={barcodeModalItem.barcode || barcodeModalItem.sku || "8900000001"}
                      height={30}
                      barWidth={1.3}
                      showText={true}
                    />
                  </div>

                  {/* Prices */}
                  {(showPrice || showMrp) && (
                    <div className="flex items-center justify-center gap-2 text-[10px] leading-none pt-0.5 border-t border-slate-100 w-full">
                      {showMrp && barcodeModalItem.mrp > 0 && (
                        <span className="text-slate-400 line-through">
                          MRP: ₹{barcodeModalItem.mrp}
                        </span>
                      )}
                      {showPrice && (
                        <span className="font-extrabold text-slate-900">
                          OUR PRICE: ₹{barcodeModalItem.salePrice}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Print & Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBarcodeModalItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleTriggerPrint}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/20 flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Printer className="h-4 w-4" />
                <span>Print {printQuantity} Stickers</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print-Only Container (Rendered on window.print()) */}
      {barcodeModalItem && (
        <div id="barcode-print-sheet" className="hidden print:block fixed inset-0 bg-white z-[9999] p-2">
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #barcode-print-sheet,
              #barcode-print-sheet * {
                visibility: visible;
              }
              #barcode-print-sheet {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 4mm;
                background: #fff;
              }
            }
          `}</style>

          {labelFormat === "A4_24_SHEET" ? (
            /* A4 3x8 Grid */
            <div className="grid grid-cols-3 gap-2 w-full">
              {Array.from({ length: printQuantity }).map((_, idx) => (
                <div
                  key={idx}
                  className="p-2 border border-slate-300 rounded flex flex-col items-center justify-between text-center min-h-[35mm]"
                >
                  {showShopName && (
                    <p className="text-[10px] font-bold uppercase truncate w-full">{companyName}</p>
                  )}
                  {showItemName && (
                    <p className="text-[11px] font-bold truncate w-full">{barcodeModalItem.name}</p>
                  )}
                  <BarcodeSvg
                    value={barcodeModalItem.barcode || barcodeModalItem.sku || "8900000001"}
                    height={32}
                    barWidth={1.3}
                  />
                  <div className="text-[10px] flex justify-center gap-2">
                    {showMrp && barcodeModalItem.mrp > 0 && <span>MRP: ₹{barcodeModalItem.mrp}</span>}
                    {showPrice && <span className="font-bold">Price: ₹{barcodeModalItem.salePrice}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Thermal Roll Label (One by One) */
            <div className="flex flex-col items-center space-y-4">
              {Array.from({ length: printQuantity }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-[50mm] h-[25mm] p-1 flex flex-col items-center justify-between text-center border border-dashed border-slate-300 break-inside-avoid page-break-after-always"
                >
                  {showShopName && (
                    <p className="text-[8px] font-extrabold uppercase truncate w-full leading-tight">
                      {companyName}
                    </p>
                  )}
                  {showItemName && (
                    <p className="text-[9px] font-bold truncate w-full leading-tight">
                      {barcodeModalItem.name}
                    </p>
                  )}
                  <BarcodeSvg
                    value={barcodeModalItem.barcode || barcodeModalItem.sku || "8900000001"}
                    height={26}
                    barWidth={1.1}
                  />
                  <div className="text-[9px] flex justify-center gap-1.5 font-bold leading-tight">
                    {showMrp && barcodeModalItem.mrp > 0 && (
                      <span className="line-through text-slate-500">₹{barcodeModalItem.mrp}</span>
                    )}
                    {showPrice && <span>₹{barcodeModalItem.salePrice}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
