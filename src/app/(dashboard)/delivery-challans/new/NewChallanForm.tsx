"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Truck,
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
  salePrice: any;
};

type ChallanLine = {
  key: number;
  salesOrderLineId?: string;
  itemId?: string;
  name: string;
  sku?: string;
  unit: string;
  orderedQty: number;
  deliveredQty: number; // Qty delivering now
  pendingQty: number;
  rate: number;
};

export default function NewChallanForm({
  parties,
  warehouses,
  items,
  initialData,
}: {
  parties: Party[];
  warehouses: Warehouse[];
  items: Item[];
  initialData?: {
    salesOrderId?: string;
    salesOrderNo?: string;
    partyId?: string;
    warehouseId?: string;
    notes?: string;
    lines?: ChallanLine[];
  };
}) {
  const router = useRouter();

  const [salesOrderId] = useState(initialData?.salesOrderId || "");
  const [partyId, setPartyId] = useState(initialData?.partyId || "");
  const [warehouseId, setWarehouseId] = useState(
    initialData?.warehouseId || warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ""
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dcNo, setDcNo] = useState("");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [dispatchNow, setDispatchNow] = useState(true);

  const [lines, setLines] = useState<ChallanLine[]>(
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
            deliveredQty: 1,
            pendingQty: 0,
            rate: 0,
          },
        ]
  );

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateLine(key: number, field: keyof ChallanLine, value: any) {
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
            updated.rate = Number(selected.salePrice) || 0;
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
        deliveredQty: 1,
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
      setError("Please select a customer for this delivery challan.");
      return;
    }

    const validLines = lines.filter((l) => l.name.trim() && Number(l.deliveredQty) > 0);
    if (validLines.length === 0) {
      setError("Please include at least one item with a delivered quantity greater than 0.");
      return;
    }

    // Validate that deliveredQty does not exceed pendingQty when linked to a sales order
    for (const l of validLines) {
      if (l.salesOrderLineId && l.pendingQty !== undefined) {
        if (Number(l.deliveredQty) > Number(l.pendingQty)) {
          setError(
            `Delivered quantity (${l.deliveredQty}) cannot exceed pending quantity (${l.pendingQty}) for "${l.name}".`
          );
          return;
        }
      }
    }

    setLoading(true);

    try {
      const payload = {
        salesOrderId: salesOrderId || undefined,
        partyId,
        warehouseId: warehouseId || undefined,
        date,
        dcNo: dcNo.trim() || undefined,
        notes: notes.trim() || undefined,
        dispatchNow,
        lines: validLines.map((l) => ({
          salesOrderLineId: l.salesOrderLineId || undefined,
          itemId: l.itemId || undefined,
          name: l.name.trim(),
          sku: l.sku?.trim() || undefined,
          unit: l.unit || "PCS",
          orderedQty: Number(l.orderedQty || l.deliveredQty),
          deliveredQty: Number(l.deliveredQty),
          rate: Number(l.rate || 0),
        })),
      };

      const res = await fetch("/api/delivery-challans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create delivery challan.");
      }

      router.push(`/delivery-challans/${data.deliveryChallan.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create delivery challan.");
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

      {/* Top Banner if linked to Sales Order */}
      {initialData?.salesOrderNo && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">
                Dispatching Goods for Sales Order #{initialData.salesOrderNo}
              </p>
              <p className="text-[11px] text-emerald-600">
                Items and remaining quantities have been loaded. Enter the actual quantities leaving the godown today.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
            SO Linked
          </span>
        </div>
      )}

      {/* Details Card */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Truck className="h-4 w-4 text-emerald-600" />
          Dispatch Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Customer */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="select w-full text-xs"
              required
              disabled={Boolean(salesOrderId)}
            >
              <option value="">-- Select Customer --</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.city ? `(${p.city})` : ""} {p.gstin ? `[GSTIN: ${p.gstin}]` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Dispatch Warehouse */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dispatch From Warehouse
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

          {/* Dispatch Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dispatch Date</label>
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

        {/* Challan No & Immediate Dispatch Checkbox */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Challan Number (Optional, auto-generated if blank)
            </label>
            <input
              type="text"
              placeholder="e.g. DC-000001"
              value={dcNo}
              onChange={(e) => setDcNo(e.target.value)}
              className="input w-full text-xs"
            />
          </div>

          <div className="flex items-center gap-3 pt-5">
            <input
              type="checkbox"
              id="dispatchNow"
              checked={dispatchNow}
              onChange={(e) => setDispatchNow(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="dispatchNow" className="text-xs font-semibold text-slate-800 cursor-pointer">
              Move inventory out of warehouse immediately (Status: DISPATCHED)
            </label>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Truck className="h-4 w-4 text-emerald-600" />
            <span>Items to Dispatch</span>
          </h3>

          {!salesOrderId && (
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
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
                {salesOrderId && <th className="py-2.5 px-3 w-24 text-right">Ordered</th>}
                {salesOrderId && <th className="py-2.5 px-3 w-24 text-right">Remaining</th>}
                <th className="py-2.5 px-3 w-32 text-right">Dispatch Qty *</th>
                <th className="py-2.5 px-3 w-20">Unit</th>
                <th className="py-2.5 px-3 w-28 text-right">Unit Rate (₹)</th>
                {!salesOrderId && <th className="py-2.5 px-2 w-10 text-center"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, idx) => (
                <tr key={line.key} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    {salesOrderId ? (
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

                  {salesOrderId && (
                    <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                      {line.orderedQty} {line.unit}
                    </td>
                  )}
                  {salesOrderId && (
                    <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                      {line.pendingQty} {line.unit}
                    </td>
                  )}

                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      min="0"
                      max={salesOrderId ? line.pendingQty : undefined}
                      step="any"
                      value={line.deliveredQty}
                      onChange={(e) =>
                        updateLine(line.key, "deliveredQty", parseFloat(e.target.value) || 0)
                      }
                      className="input w-full text-xs text-right py-1 h-8 font-bold text-emerald-700 border-emerald-300"
                      required
                    />
                  </td>

                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={line.unit}
                      onChange={(e) => updateLine(line.key, "unit", e.target.value)}
                      className="input w-full text-xs py-1 h-8 uppercase"
                      disabled={Boolean(salesOrderId)}
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

                  {!salesOrderId && (
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

      {/* Transport & Notes Card */}
      <div className="card p-5 space-y-4">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Vehicle / Transport / Dispatch Notes
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Vehicle No: MH 12 AB 1234, Driver: Ramesh (9876543210), E-Way Bill: 1234567890..."
          className="textarea w-full text-xs"
        />

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 transition"
          >
            <Truck className="h-4 w-4" />
            <span>{loading ? "Creating Challan..." : "Create & Dispatch Challan"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
