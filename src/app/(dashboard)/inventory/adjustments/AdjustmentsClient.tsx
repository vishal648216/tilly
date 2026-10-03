"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  SlidersHorizontal,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Building2,
  Package,
  Barcode,
  ArrowRightLeft,
  Calendar,
  FileText,
  Search,
} from "lucide-react";

interface Warehouse {
  id: string;
  name: string;
  code: string | null;
  isDefault: boolean;
}

interface Item {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  stock: number;
}

interface AdjustmentRecord {
  id: string;
  referenceId: string | null;
  date: string;
  item: string;
  itemId: string;
  sku: string | null;
  unit: string;
  warehouse: string;
  quantity: number;
  direction: "INCREASE" | "DECREASE";
  movementType: string;
  notes: string | null;
  createdBy: string | null;
}

export default function AdjustmentsClient({
  warehouses,
  items,
  initialAdjustments,
}: {
  warehouses: Warehouse[];
  items: Item[];
  initialAdjustments: AdjustmentRecord[];
}) {
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>(initialAdjustments);
  const [searchItem, setSearchItem] = useState("");
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || "");
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || "");
  const [direction, setDirection] = useState<"INCREASE" | "DECREASE">("INCREASE");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<string>("Physical Count");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Barcode / Name / SKU auto-filter
  const filteredItems = useMemo(() => {
    if (!searchItem.trim()) return items;
    const q = searchItem.trim().toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.sku && i.sku.toLowerCase().includes(q)) ||
        (i.barcode && i.barcode.toLowerCase().includes(q))
    );
  }, [items, searchItem]);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedItemId) {
      setError("Please select a product.");
      return;
    }
    if (!warehouseId) {
      setError("Please select a warehouse / godown.");
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId,
          itemId: selectedItemId,
          quantity: qty,
          direction,
          reason,
          notes: notes.trim() || null,
          date,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record adjustment");

      const newRecord: AdjustmentRecord = {
        id: data.movement.id,
        referenceId: data.adjustmentRef,
        date: new Date(date).toISOString(),
        item: selectedItem ? selectedItem.name : "Product",
        itemId: selectedItemId,
        sku: selectedItem?.sku || null,
        unit: selectedItem?.unit || "PCS",
        warehouse: warehouses.find((w) => w.id === warehouseId)?.name || "Godown",
        quantity: qty,
        direction,
        movementType: data.movement.movementType,
        notes: notes.trim() || null,
        createdBy: "You",
      };

      setAdjustments((prev) => [newRecord, ...prev]);
      setQuantity("");
      setNotes("");
      setSuccessMsg(
        `Stock adjusted: ${direction === "INCREASE" ? "+" : "-"}${qty} ${selectedItem?.unit || "units"} for ${selectedItem?.name}!`
      );
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6 text-brand-600" /> Stock Adjustments
          </h1>
          <p className="text-sm text-slate-500">
            Reconcile physical stock counts, log damages, write-offs, and inventory corrections
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/stock-ledger"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <FileText className="h-4 w-4 text-slate-500" /> View Stock Ledger
          </Link>
          <Link
            href="/inventory/transfers"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <ArrowRightLeft className="h-4 w-4 text-brand-600" /> Godown Transfers
          </Link>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Adjustment Entry Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-brand-600" /> New Stock Adjustment
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Godown / Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                className="input bg-white"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.code ? `(${w.code})` : ""} {w.isDefault ? "★ Default" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Select Product <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">Barcode scan ready</span>
              </div>
              <div className="relative mb-2">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  className="input pl-9 text-xs"
                  placeholder="Scan barcode or type name / SKU..."
                  value={searchItem}
                  onChange={(e) => setSearchItem(e.target.value)}
                />
              </div>
              <select
                className="input bg-white text-xs"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                required
              >
                {filteredItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} {i.sku ? `[SKU: ${i.sku}]` : ""} {i.barcode ? `[BC: ${i.barcode}]` : ""} (Stock: {i.stock} {i.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Direction / Action <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("INCREASE")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                    direction === "INCREASE"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Plus className="h-4 w-4" /> Add Stock (+)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("DECREASE")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                    direction === "DECREASE"
                      ? "border-rose-500 bg-rose-50 text-rose-700 shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Minus className="h-4 w-4" /> Deduct Stock (-)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  className="input font-semibold"
                  placeholder="e.g. 5"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <select
                  className="input bg-white text-xs"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                >
                  <option value="Physical Count">Physical Count</option>
                  <option value="Damage">Damage</option>
                  <option value="Lost">Lost</option>
                  <option value="Expired">Expired</option>
                  <option value="Opening Correction">Opening Correction</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Remarks / Reference
              </label>
              <textarea
                className="input min-h-[60px] text-xs"
                placeholder="Audit notes, reason breakdown, rack number..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 rounded-xl font-bold text-xs text-white shadow-xs transition-colors ${
                direction === "INCREASE"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {loading ? "Recording..." : `Post ${direction === "INCREASE" ? "Addition" : "Deduction"}`}
            </button>
          </form>
        </div>

        {/* Adjustments History Table */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-600" /> Recent Adjustments Audit Trail
            </h2>
            <span className="text-xs text-slate-500 font-medium">{adjustments.length} logged</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Ref #</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Godown</th>
                  <th className="px-4 py-3 text-right">Adjustment</th>
                  <th className="px-4 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No stock adjustments recorded yet.
                    </td>
                  </tr>
                ) : (
                  adjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(adj.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {adj.referenceId || "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {adj.item}
                        {adj.sku && <span className="block text-[10px] text-slate-400 font-mono">SKU: {adj.sku}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{adj.warehouse}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-bold ${
                            adj.direction === "INCREASE"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {adj.direction === "INCREASE" ? "+" : "-"}
                          {adj.quantity} {adj.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                        {adj.notes || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
