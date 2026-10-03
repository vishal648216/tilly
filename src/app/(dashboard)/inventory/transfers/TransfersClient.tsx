"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  Building2,
  Package,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  SlidersHorizontal,
  ArrowRight,
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

interface TransferRecord {
  id: string;
  transferRef: string;
  date: string;
  itemId: string;
  item: string;
  sku: string | null;
  unit: string;
  quantity: number;
  fromWarehouse: string;
  fromWarehouseCode: string;
  toWarehouse: string;
  toWarehouseCode: string;
  notes: string | null;
  createdBy: string | null;
}

export default function TransfersClient({
  warehouses,
  items,
  initialTransfers,
}: {
  warehouses: Warehouse[];
  items: Item[];
  initialTransfers: TransferRecord[];
}) {
  const [transfers, setTransfers] = useState<TransferRecord[]>(initialTransfers);
  const [searchItem, setSearchItem] = useState("");
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || "");
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id || "");
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[1]?.id || "");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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

    if (!fromWarehouseId || !toWarehouseId) {
      setError("Please select both source and destination warehouses.");
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setError("Source and destination warehouses cannot be the same.");
      return;
    }
    if (!selectedItemId) {
      setError("Please select an item.");
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Transfer quantity must be greater than zero.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/inventory/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWarehouseId,
          toWarehouseId,
          itemId: selectedItemId,
          quantity: qty,
          date,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to execute stock transfer");

      const sourceWh = warehouses.find((w) => w.id === fromWarehouseId);
      const destWh = warehouses.find((w) => w.id === toWarehouseId);

      const newRecord: TransferRecord = {
        id: data.outMovement.id,
        transferRef: data.transferRef,
        date: new Date(date).toISOString(),
        itemId: selectedItemId,
        item: selectedItem ? selectedItem.name : "Product",
        sku: selectedItem?.sku || null,
        unit: selectedItem?.unit || "PCS",
        quantity: qty,
        fromWarehouse: sourceWh?.name || "Godown A",
        fromWarehouseCode: sourceWh?.code || "",
        toWarehouse: destWh?.name || "Godown B",
        toWarehouseCode: destWh?.code || "",
        notes: notes.trim() || null,
        createdBy: "You",
      };

      setTransfers((prev) => [newRecord, ...prev]);
      setQuantity("");
      setNotes("");
      setSuccessMsg(
        `Successfully transferred ${qty} ${selectedItem?.unit || "units"} of ${selectedItem?.name} from ${sourceWh?.name} to ${destWh?.name}!`
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
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-brand-600" /> Godown Stock Transfers
          </h1>
          <p className="text-sm text-slate-500">
            Atomically move inventory between branches, godowns, and fulfillment hubs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/warehouses"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <Building2 className="h-4 w-4 text-slate-500" /> Manage Godowns
          </Link>
          <Link
            href="/stock-ledger"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <FileText className="h-4 w-4 text-brand-600" /> Stock Ledger
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
        {/* Transfer Dispatch Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-brand-600" /> New Stock Transfer
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Source Godown <span className="text-red-500">*</span>
                </label>
                <select
                  className="input bg-white text-xs"
                  value={fromWarehouseId}
                  onChange={(e) => setFromWarehouseId(e.target.value)}
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.code ? `(${w.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Godown <span className="text-red-500">*</span>
                </label>
                <select
                  className="input bg-white text-xs"
                  value={toWarehouseId}
                  onChange={(e) => setToWarehouseId(e.target.value)}
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.code ? `(${w.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Select Product <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">Scanner search</span>
              </div>
              <div className="relative mb-2">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  className="input pl-9 text-xs"
                  placeholder="Scan barcode or type SKU / Name..."
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
                    {i.name} {i.sku ? `[SKU: ${i.sku}]` : ""} (Total Stock: {i.stock} {i.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transfer Qty <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  className="input font-semibold"
                  placeholder="e.g. 10"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transfer Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="input text-xs"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dispatch / Gate Pass / Challan Notes
              </label>
              <textarea
                className="input min-h-[60px] text-xs"
                placeholder="Vehicle number, driver name, delivery challan reference..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading || warehouses.length < 2}
              className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-brand-600 hover:bg-brand-700 shadow-xs transition-colors disabled:opacity-50"
            >
              {loading
                ? "Processing Transfer..."
                : warehouses.length < 2
                ? "At least 2 warehouses required"
                : "Execute Stock Transfer"}
            </button>
          </form>
        </div>

        {/* Transfers History Table */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-600" /> Recent Transfers Log
            </h2>
            <span className="text-xs text-slate-500 font-medium">{transfers.length} completed</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Transfer Ref</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Transfer Route</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No stock transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-brand-600 whitespace-nowrap">
                        {t.transferRef}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {t.item}
                        {t.sku && <span className="block text-[10px] text-slate-400 font-mono">SKU: {t.sku}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{t.fromWarehouse}</span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded text-[11px] font-semibold">{t.toWarehouse}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {t.quantity} {t.unit}
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                        {t.notes || "—"}
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
