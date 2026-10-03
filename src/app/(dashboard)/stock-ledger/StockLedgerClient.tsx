"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/currency";
import { exportToCSV } from "@/lib/exportCsv";
import {
  FileText,
  Download,
  Filter,
  Building2,
  Package,
  ArrowRightLeft,
  SlidersHorizontal,
  Search,
  RotateCcw,
} from "lucide-react";

interface ItemOption {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string | null;
}

interface LedgerRow {
  id: string;
  date: string;
  referenceType: string | null;
  referenceId: string | null;
  movementType: string;
  warehouse: string;
  warehouseCode: string;
  item: string;
  itemId: string;
  sku: string | null;
  unit: string;
  variant: string | null;
  qtyIn: number;
  qtyOut: number;
  balance: number;
  unitCost: number;
  totalCost: number;
  notes: string | null;
  createdBy: string | null;
}

export default function StockLedgerClient({
  items,
  warehouses,
  initialLedger,
  filters,
}: {
  items: ItemOption[];
  warehouses: WarehouseOption[];
  initialLedger: LedgerRow[];
  filters: {
    itemId: string;
    warehouseId: string;
    movementType: string;
    from: string;
    to: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filterState, setFilterState] = useState(filters);
  const [searchTerm, setSearchTerm] = useState("");

  function applyFilters(newState: typeof filterState) {
    const params = new URLSearchParams();
    if (newState.itemId) params.set("itemId", newState.itemId);
    if (newState.warehouseId) params.set("warehouseId", newState.warehouseId);
    if (newState.movementType) params.set("movementType", newState.movementType);
    if (newState.from) params.set("from", newState.from);
    if (newState.to) params.set("to", newState.to);

    router.push(`${pathname}?${params.toString()}`);
  }

  function handleFilterChange(key: keyof typeof filterState, val: string) {
    const next = { ...filterState, [key]: val };
    setFilterState(next);
    applyFilters(next);
  }

  function handleReset() {
    const reset = { itemId: "", warehouseId: "", movementType: "", from: "", to: "" };
    setFilterState(reset);
    router.push(pathname);
  }

  // Client search filter (by reference or item name)
  const displayedLedger = useMemo(() => {
    if (!searchTerm.trim()) return initialLedger;
    const q = searchTerm.toLowerCase();
    return initialLedger.filter(
      (r) =>
        r.item.toLowerCase().includes(q) ||
        (r.referenceId && r.referenceId.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
    );
  }, [initialLedger, searchTerm]);

  function handleExport() {
    const headers = [
      "Date",
      "Reference",
      "Movement",
      "Warehouse",
      "Product",
      "SKU",
      "Qty In",
      "Qty Out",
      "Running Balance",
      "Unit Cost",
      "Inventory Value",
      "User / Source",
      "Notes",
    ];
    const rows = displayedLedger.map((r) => [
      new Date(r.date).toLocaleDateString("en-IN"),
      r.referenceId || "—",
      r.movementType,
      r.warehouse,
      r.item,
      r.sku || "—",
      r.qtyIn,
      r.qtyOut,
      r.balance,
      r.unitCost,
      r.balance * r.unitCost,
      r.createdBy || "System",
      r.notes || "—",
    ]);
    exportToCSV("taily_stock_ledger", headers, rows);
  }

  const movementBadgeStyle = (type: string) => {
    switch (type) {
      case "PURCHASE":
      case "OPENING":
      case "TRANSFER_IN":
      case "SALE_RETURN":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "SALE":
      case "PURCHASE_RETURN":
      case "TRANSFER_OUT":
      case "DAMAGE":
      case "WASTAGE":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-brand-600" /> Stock Movement Ledger
          </h1>
          <p className="text-sm text-slate-500">
            Immutable transaction-by-transaction inventory ledger with running balances & weighted cost history
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/inventory/adjustments"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-brand-600" /> Adjust Stock
          </Link>
          <Link
            href="/inventory/transfers"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-brand-600" /> Transfer Stock
          </Link>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" /> Ledger Filters
          </span>
          {(filterState.itemId || filterState.warehouseId || filterState.movementType || filterState.from || filterState.to || searchTerm) && (
            <button
              onClick={handleReset}
              className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Product Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Product</label>
            <select
              className="input bg-white text-xs h-9"
              value={filterState.itemId}
              onChange={(e) => handleFilterChange("itemId", e.target.value)}
            >
              <option value="">All Products</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} {i.sku ? `(${i.sku})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Godown / Warehouse</label>
            <select
              className="input bg-white text-xs h-9"
              value={filterState.warehouseId}
              onChange={(e) => handleFilterChange("warehouseId", e.target.value)}
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.code ? `(${w.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Movement Type Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Movement Type</label>
            <select
              className="input bg-white text-xs h-9"
              value={filterState.movementType}
              onChange={(e) => handleFilterChange("movementType", e.target.value)}
            >
              <option value="">All Movements</option>
              <option value="PURCHASE">PURCHASE (Stock In)</option>
              <option value="SALE">SALE (Stock Out)</option>
              <option value="SALE_RETURN">SALE_RETURN (Restock)</option>
              <option value="PURCHASE_RETURN">PURCHASE_RETURN (Vendor Out)</option>
              <option value="OPENING">OPENING</option>
              <option value="STOCK_ADJUSTMENT">STOCK_ADJUSTMENT</option>
              <option value="TRANSFER_IN">TRANSFER_IN</option>
              <option value="TRANSFER_OUT">TRANSFER_OUT</option>
              <option value="DAMAGE">DAMAGE</option>
              <option value="WASTAGE">WASTAGE</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">From Date</label>
            <input
              type="date"
              className="input text-xs h-9"
              value={filterState.from}
              onChange={(e) => handleFilterChange("from", e.target.value)}
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">To Date</label>
            <input
              type="date"
              className="input text-xs h-9"
              value={filterState.to}
              onChange={(e) => handleFilterChange("to", e.target.value)}
            />
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="relative pt-1">
          <Search className="h-4 w-4 absolute left-3 top-3.5 text-slate-400" />
          <input
            className="input pl-9 text-xs h-9"
            placeholder="Quick search by invoice/bill number, product name, or audit remarks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3.5 py-3">Date</th>
                <th className="px-3.5 py-3">Reference</th>
                <th className="px-3.5 py-3">Movement</th>
                <th className="px-3.5 py-3">Godown</th>
                <th className="px-3.5 py-3">Product</th>
                <th className="px-3.5 py-3 text-right">Qty In</th>
                <th className="px-3.5 py-3 text-right">Qty Out</th>
                <th className="px-3.5 py-3 text-right">Balance</th>
                <th className="px-3.5 py-3 text-right">Unit Cost</th>
                <th className="px-3.5 py-3 text-right">Valuation</th>
                <th className="px-3.5 py-3">User / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedLedger.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                    <Package className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    No stock movement entries match the selected filters.
                  </td>
                </tr>
              ) : (
                displayedLedger.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600">
                      {new Date(row.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono font-bold text-brand-600 whitespace-nowrap">
                      {row.referenceId || "—"}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${movementBadgeStyle(
                          row.movementType
                        )}`}
                      >
                        {row.movementType}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap font-medium text-slate-700">
                      {row.warehouse}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="font-semibold text-slate-900 block">{row.item}</span>
                      {row.sku && <span className="text-[10px] font-mono text-slate-400">SKU: {row.sku}</span>}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-semibold text-emerald-700 whitespace-nowrap">
                      {row.qtyIn > 0 ? `+${row.qtyIn}` : "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-semibold text-rose-700 whitespace-nowrap">
                      {row.qtyOut > 0 ? `-${row.qtyOut}` : "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                      {row.balance} {row.unit}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-slate-600 whitespace-nowrap">
                      {formatCurrency(row.unitCost)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {formatCurrency(row.balance * row.unitCost)}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500 max-w-xs">
                      <div className="truncate">{row.notes || "—"}</div>
                      {row.createdBy && <span className="text-[10px] text-slate-400 block">by {row.createdBy}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
