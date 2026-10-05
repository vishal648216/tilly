"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  Warehouse as WarehouseIcon,
  CheckCircle2,
} from "lucide-react";

type Party = {
  id: string;
  name: string;
  city?: string | null;
  gstin?: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  isDefault: boolean;
};

type Item = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  purchasePrice: any;
  salePrice: any;
};

type GRNLine = {
  key: number;
  purchaseOrderLineId?: string;
  itemId?: string;
  name: string;
  sku?: string;
  unit: string;
  orderedQty: number;
  receivedQty: number; // Qty receiving now
  pendingQty: number;
  rate: number;
};

export default function NewGoodsReceiptForm({
  parties,
  warehouses,
  items,
  initialData,
}: {
  parties: Party[];
  warehouses: Warehouse[];
  items: Item[];
  initialData?: {
    purchaseOrderId?: string;
    purchaseOrderNo?: string;
    partyId?: string;
    warehouseId?: string;
    notes?: string;
    lines?: GRNLine[];
  };
}) {
  const router = useRouter();

  const [purchaseOrderId] = useState(initialData?.purchaseOrderId || "");
  const [partyId, setPartyId] = useState(initialData?.partyId || "");
  const [warehouseId, setWarehouseId] = useState(
    initialData?.warehouseId || warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ""
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [grnNo, setGrnNo] = useState("");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [receiveNow, setReceiveNow] = useState(true);

  const [lines, setLines] = useState<GRNLine[]>(
    initialData?.lines && initialData.lines.length > 0
      ? initialData.lines
      : [
          {
            key: Date.now(),
            itemId: "",
            name: "",
            sku: "",
            unit: "PCS",
            orderedQty: 1,
            receivedQty: 1,
            pendingQty: 0,
            rate: 0,
          },
        ]
  );

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateLine(key: number, field: keyof GRNLine, value: any) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;

        const updated = { ...line, [field]: value };

        if (field === "itemId") {
          const selected = items.find((i) => i.id === value);
          if (selected) {
            updated.name = selected.name;
            updated.sku = selected.sku || "";
            updated.unit = selected.unit || "PCS";
            updated.rate = Number(selected.purchasePrice || selected.salePrice) || 0;
          }
        }

        return updated;
      })
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: Date.now(),
        itemId: "",
        name: "",
        sku: "",
        unit: "PCS",
        orderedQty: 1,
        receivedQty: 1,
        pendingQty: 0,
        rate: 0,
      },
    ]);
  }

  function removeLine(key: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!partyId) {
      setError("Please select a vendor / supplier for this goods receipt note.");
      return;
    }

    const validLines = lines.filter((l) => l.name.trim() && Number(l.receivedQty) > 0);
    if (validLines.length === 0) {
      setError("Please include at least one item with a received quantity greater than 0.");
      return;
    }

    // Validate that receivedQty does not exceed pendingQty when linked to a PO
    for (const l of validLines) {
      if (l.purchaseOrderLineId && l.pendingQty !== undefined) {
        if (Number(l.receivedQty) > Number(l.pendingQty)) {
          setError(
            `Received quantity (${l.receivedQty}) cannot exceed pending quantity (${l.pendingQty}) for "${l.name}".`
          );
          return;
        }
      }
    }

    setLoading(true);

    try {
      const payload = {
        purchaseOrderId: purchaseOrderId || undefined,
        partyId,
        warehouseId: warehouseId || undefined,
        date,
        grnNo: grnNo.trim() || undefined,
        notes: notes.trim() || undefined,
        receiveNow,
        lines: validLines.map((l) => ({
          purchaseOrderLineId: l.purchaseOrderLineId || undefined,
          itemId: l.itemId || undefined,
          name: l.name.trim(),
          sku: l.sku?.trim() || undefined,
          unit: l.unit || "PCS",
          orderedQty: Number(l.orderedQty || l.receivedQty),
          receivedQty: Number(l.receivedQty),
          rate: Number(l.rate || 0),
        })),
      };

      const res = await fetch("/api/goods-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create goods receipt note.");
      }

      router.push(`/goods-receipts/${data.goodsReceipt.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create goods receipt note.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Banner if linked to Purchase Order */}
      {initialData?.purchaseOrderNo && (
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-900">
                Inwarding Goods for Purchase Order #{initialData.purchaseOrderNo}
              </p>
              <p className="text-[11px] text-indigo-600">
                Items and remaining quantities have been loaded. Enter the actual physical quantities received into your warehouse.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800">
            PO Linked
          </span>
        </div>
      )}

      {/* Details Card */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Package className="h-4 w-4 text-indigo-600" />
          Receipt & Inward Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Supplier */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vendor / Supplier <span className="text-red-500">*</span>
            </label>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="select w-full text-xs"
              required
              disabled={Boolean(purchaseOrderId)}
            >
              <option value="">-- Select Supplier --</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.city ? `(${p.city})` : ""} {p.gstin ? `[GSTIN: ${p.gstin}]` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Receiving Warehouse */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Receiving Into Warehouse
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="select w-full text-xs"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.isDefault ? "(Default)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Receipt Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt Date</label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input w-full text-xs pr-8"
                required
              />
              <Calendar className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* GRN No & Stock Inward Checkbox */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              GRN Number (Optional, auto-generated if blank)
            </label>
            <input
              type="text"
              placeholder="e.g. GRN-000001"
              value={grnNo}
              onChange={(e) => setGrnNo(e.target.value)}
              className="input w-full text-xs"
            />
          </div>

          <div className="flex items-center gap-3 pt-5">
            <input
              type="checkbox"
              id="receiveNow"
              checked={receiveNow}
              onChange={(e) => setReceiveNow(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="receiveNow" className="text-xs font-semibold text-slate-800 cursor-pointer">
              Add received items into physical warehouse stock immediately (Status: RECEIVED)
            </label>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Package className="h-4 w-4 text-indigo-600" />
            <span>Items to Inward</span>
          </h3>

          {!purchaseOrderId && (
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Item</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="table w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[220px]">Item Description</th>
                {purchaseOrderId && <th className="py-2.5 px-3 w-24 text-right">Ordered</th>}
                {purchaseOrderId && <th className="py-2.5 px-3 w-24 text-right">Remaining</th>}
                <th className="py-2.5 px-3 w-32 text-right">Received Qty *</th>
                <th className="py-2.5 px-3 w-20">Unit</th>
                <th className="py-2.5 px-3 w-28 text-right">Unit Rate (₹)</th>
                {!purchaseOrderId && <th className="py-2.5 px-2 w-10 text-center"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, idx) => (
                <tr key={line.key} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    {purchaseOrderId ? (
                      <div>
                        <p className="font-bold text-slate-900">{line.name}</p>
                        {line.sku && <p className="text-[10px] text-slate-400">SKU: {line.sku}</p>}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <select
                          value={line.itemId}
                          onChange={(e) => updateLine(line.key, "itemId", e.target.value)}
                          className="select w-full text-xs font-semibold py-1 h-8"
                        >
                          <option value="">-- Choose Item or Custom --</option>
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} {it.sku ? `(${it.sku})` : ""}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Item name..."
                          value={line.name}
                          onChange={(e) => updateLine(line.key, "name", e.target.value)}
                          className="input w-full text-xs py-1 h-7"
                          required
                        />
                      </div>
                    )}
                  </td>

                  {purchaseOrderId && (
                    <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                      {line.orderedQty} {line.unit}
                    </td>
                  )}
                  {purchaseOrderId && (
                    <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                      {line.pendingQty} {line.unit}
                    </td>
                  )}

                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      min="0"
                      max={purchaseOrderId ? line.pendingQty : undefined}
                      step="any"
                      value={line.receivedQty}
                      onChange={(e) =>
                        updateLine(line.key, "receivedQty", parseFloat(e.target.value) || 0)
                      }
                      className="input w-full text-xs text-right py-1 h-8 font-bold text-indigo-700 border-indigo-300"
                      required
                    />
                  </td>

                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={line.unit}
                      onChange={(e) => updateLine(line.key, "unit", e.target.value)}
                      className="input w-full text-xs py-1 h-8 uppercase"
                      disabled={Boolean(purchaseOrderId)}
                    />
                  </td>

                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.rate}
                      onChange={(e) => updateLine(line.key, "rate", parseFloat(e.target.value) || 0)}
                      className="input w-full text-xs text-right py-1 h-8"
                    />
                  </td>

                  {!purchaseOrderId && (
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length <= 1}
                        className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes & Inward Verification */}
      <div className="card p-5 space-y-4">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Gate Entry / Physical Inspection / Verification Notes
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Received via Blue Dart Courier (AWB #987654), Packaging intact, verified by storekeeper..."
          className="textarea w-full text-xs"
        />

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-60 transition"
          >
            <Package className="h-4 w-4" />
            <span>{loading ? "Receiving Goods..." : "Confirm & Inward Goods (GRN)"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
