"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Building2,
  Warehouse as WarehouseIcon,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface PartyOption {
  id: string;
  name: string;
  phone: string | null;
  gstin: string | null;
  state: string | null;
}

interface ItemOption {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  hsn: string | null;
  purchasePrice: number | string;
  gstRate: number | string;
}

interface WarehouseOption {
  id: string;
  name: string;
  isDefault: boolean;
}

interface FormLine {
  id: string;
  itemId?: string;
  name: string;
  sku?: string;
  unit: string;
  hsn?: string;
  orderedQty: number;
  rate: number;
  discount: number;
  gstRate: number;
}

export default function NewPurchaseOrderForm({
  parties,
  items,
  warehouses,
  companyState,
}: {
  parties: PartyOption[];
  items: ItemOption[];
  warehouses: WarehouseOption[];
  companyState?: string;
}) {
  const router = useRouter();

  const [poNo, setPoNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDate, setExpectedDate] = useState("");
  const [partyId, setPartyId] = useState(parties[0]?.id || "");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ""
  );
  const [isInterState, setIsInterState] = useState(false);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(
    "1. Delivery within agreed schedule.\n2. Goods subject to quality inspection at warehouse."
  );

  const [lines, setLines] = useState<FormLine[]>([
    {
      id: "1",
      name: "",
      unit: "PCS",
      orderedQty: 1,
      rate: 0,
      discount: 0,
      gstRate: 18,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check state when supplier changes
  const handlePartyChange = (selectedPartyId: string) => {
    setPartyId(selectedPartyId);
    const selectedParty = parties.find((p) => p.id === selectedPartyId);
    if (selectedParty?.state && companyState) {
      setIsInterState(
        selectedParty.state.trim().toLowerCase() !==
          companyState.trim().toLowerCase()
      );
    }
  };

  const handleSelectItem = (lineIdx: number, selectedItemId: string) => {
    const found = items.find((i) => i.id === selectedItemId);
    if (!found) return;

    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== lineIdx) return l;
        return {
          ...l,
          itemId: found.id,
          name: found.name,
          sku: found.sku || "",
          unit: found.unit || "PCS",
          hsn: found.hsn || "",
          rate: Number(found.purchasePrice) || 0,
          gstRate: Number(found.gstRate) || 0,
        };
      })
    );
  };

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        name: "",
        unit: "PCS",
        orderedQty: 1,
        rate: 0,
        discount: 0,
        gstRate: 18,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, patch: Partial<FormLine>) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    );
  };

  // Calculations
  const calculatedLines = lines.map((l) => {
    const gross = (Number(l.orderedQty) || 0) * (Number(l.rate) || 0);
    const disc = Number(l.discount) || 0;
    const taxable = Math.max(0, gross - disc);
    const gstPct = Number(l.gstRate) || 0;
    const tax = (taxable * gstPct) / 100;
    const total = taxable + tax;
    return {
      ...l,
      gross,
      taxable,
      tax,
      total,
    };
  });

  const subTotal = calculatedLines.reduce((s, l) => s + l.gross, 0);
  const discountTotal = calculatedLines.reduce((s, l) => s + (Number(l.discount) || 0), 0);
  const taxableTotal = calculatedLines.reduce((s, l) => s + l.taxable, 0);
  const taxTotal = calculatedLines.reduce((s, l) => s + l.tax, 0);
  const grandTotal = taxableTotal + taxTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!partyId) {
      setError("Please select a supplier/vendor.");
      return;
    }

    const validLines = lines.filter((l) => l.name.trim() && l.orderedQty > 0);
    if (validLines.length === 0) {
      setError("Please add at least one line item with valid product name and quantity.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poNo: poNo.trim() || undefined,
          date,
          expectedDate: expectedDate || undefined,
          partyId,
          warehouseId: warehouseId || undefined,
          isInterState,
          notes,
          terms,
          status: "CONFIRMED",
          items: validLines.map((l) => ({
            itemId: l.itemId || undefined,
            name: l.name.trim(),
            sku: l.sku || undefined,
            unit: l.unit || "PCS",
            hsn: l.hsn || undefined,
            orderedQty: Number(l.orderedQty),
            rate: Number(l.rate),
            discount: Number(l.discount) || 0,
            gstRate: Number(l.gstRate) || 0,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create Purchase Order");
      }

      router.push(`/purchase-orders/${data.purchaseOrder.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to save purchase order");
    } finally {
      setLoading(false);
    }
  };

  const selectedParty = parties.find((p) => p.id === partyId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/purchase-orders"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">New Purchase Order (PO)</h1>
            <p className="text-xs text-slate-500">
              Create an official procurement order for your supplier
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/purchase-orders"
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/20 disabled:opacity-50 active:scale-95 transition-all"
          >
            <Save className="h-4 w-4" />
            <span>{loading ? "Generating PO..." : "Create & Confirm PO"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Supplier & Warehouse Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-brand-600" /> Supplier & Order Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier / Vendor <span className="text-red-500">*</span>
                </label>
                <select
                  value={partyId}
                  onChange={(e) => handlePartyChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  required
                >
                  <option value="">Select Supplier</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.gstin ? `(${p.gstin})` : ""}
                    </option>
                  ))}
                </select>
                {selectedParty && (
                  <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
                    {selectedParty.phone && <span>📞 {selectedParty.phone}</span>}
                    {selectedParty.gstin && <span>GST: {selectedParty.gstin}</span>}
                    {selectedParty.state && <span>State: {selectedParty.state}</span>}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Warehouse
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.isDefault ? "(Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PO Number
                </label>
                <input
                  type="text"
                  placeholder="Auto (e.g. PO-0001)"
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-mono outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PO Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="isInterState"
                checked={isInterState}
                onChange={(e) => setIsInterState(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
              />
              <label htmlFor="isInterState" className="text-xs font-medium text-slate-700 cursor-pointer">
                Inter-state procurement (IGST applies instead of CGST + SGST)
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Actions */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Procurement Summary
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Gross)</span>
                <span className="font-medium text-slate-900">{formatCurrency(subTotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Line Discounts</span>
                  <span className="font-medium">-{formatCurrency(discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount</span>
                <span className="font-medium text-slate-900">{formatCurrency(taxableTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total GST</span>
                <span className="font-medium text-slate-900">{formatCurrency(taxTotal)}</span>
              </div>
              <div className="border-t border-slate-100 pt-3 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-900">Grand Total</span>
                <span className="text-xl font-bold text-brand-600">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/20 disabled:opacity-50 active:scale-98 transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{loading ? "Saving Order..." : "Confirm & Save Order"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Order Items & Procurement Quantities
          </h2>
          <button
            type="button"
            onClick={handleAddLine}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Item</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 min-w-[220px]">Item Description</th>
                <th className="px-3 py-3 w-24">Unit</th>
                <th className="px-3 py-3 w-28 text-right">Order Qty</th>
                <th className="px-3 py-3 w-32 text-right">Rate (₹)</th>
                <th className="px-3 py-3 w-24 text-right">Disc (₹)</th>
                <th className="px-3 py-3 w-24 text-center">GST %</th>
                <th className="px-4 py-3 w-32 text-right">Amount (₹)</th>
                <th className="px-3 py-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, idx) => {
                const calc = calculatedLines[idx];
                return (
                  <tr key={line.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5">
                      <div className="space-y-1">
                        <select
                          value={line.itemId || ""}
                          onChange={(e) => handleSelectItem(idx, e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-brand-500"
                        >
                          <option value="">-- Choose Existing Item --</option>
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} {it.sku ? `[${it.sku}]` : ""}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Or type custom item name"
                          value={line.name}
                          onChange={(e) => updateLine(idx, { name: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs outline-none focus:border-brand-500"
                          required
                        />
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        value={line.unit}
                        onChange={(e) => updateLine(idx, { unit: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-center outline-none focus:border-brand-500 font-medium"
                      />
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={line.orderedQty}
                        onChange={(e) =>
                          updateLine(idx, { orderedQty: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-right outline-none focus:border-brand-500 font-bold text-slate-800"
                        required
                      />
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.rate}
                        onChange={(e) =>
                          updateLine(idx, { rate: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-right outline-none focus:border-brand-500 font-medium"
                      />
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.discount}
                        onChange={(e) =>
                          updateLine(idx, { discount: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-right outline-none focus:border-brand-500"
                      />
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <select
                        value={line.gstRate}
                        onChange={(e) =>
                          updateLine(idx, { gstRate: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-center outline-none focus:border-brand-500"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>

                    <td className="px-4 py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(calc.total)}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        disabled={lines.length <= 1}
                        className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleAddLine}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Another Item</span>
          </button>
          <div className="text-right text-xs font-semibold text-slate-600">
            {lines.length} Line {lines.length === 1 ? "Item" : "Items"}
          </div>
        </div>
      </div>

      {/* Notes & Terms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Notes & Remarks
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special delivery instructions, contact person, etc."
            className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-brand-500"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Terms & Conditions
          </label>
          <textarea
            rows={3}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-brand-500"
          />
        </div>
      </div>
    </form>
  );
}
