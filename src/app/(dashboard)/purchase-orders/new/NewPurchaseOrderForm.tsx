"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { roundTo2, formatCurrency } from "@/lib/currency";
import {
  Plus,
  Trash2,
  ShoppingCart,
  Calendar,
  AlertCircle,
  Warehouse as WarehouseIcon,
  Sparkles,
} from "lucide-react";

type Party = {
  id: string;
  name: string;
  state: string | null;
  gstin: string | null;
  phone?: string | null;
  city?: string | null;
};

type Item = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  hsn: string | null;
  purchasePrice: any;
  salePrice: any;
  gstRate: any;
};

type Warehouse = {
  id: string;
  name: string;
  isDefault: boolean;
};

type Line = {
  key: number;
  itemId: string;
  name: string;
  sku: string;
  unit: string;
  hsn: string;
  qty: number;
  rate: number;
  discount: number;
  gstRate: number;
};

const emptyLine: Line = {
  key: 0,
  itemId: "",
  name: "",
  sku: "",
  unit: "PCS",
  hsn: "",
  qty: 1,
  rate: 0,
  discount: 0,
  gstRate: 18,
};

export default function NewPurchaseOrderForm({
  parties,
  items,
  warehouses,
  companyState,
}: {
  parties: Party[];
  items: Item[];
  warehouses: Warehouse[];
  companyState: string | null;
}) {
  const router = useRouter();

  const [partyId, setPartyId] = useState("");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ""
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const defaultExpected = new Date();
  defaultExpected.setDate(defaultExpected.getDate() + 10);
  const [expectedDate, setExpectedDate] = useState(defaultExpected.toISOString().slice(0, 10));

  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(
    "1. Delivery as per schedule specified.\n2. Invoices must include our PO number.\n3. Goods must meet standard quality specifications."
  );

  const [lines, setLines] = useState<Line[]>([{ ...emptyLine, key: Date.now() }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedParty = parties.find((p) => p.id === partyId);

  const isInterState = useMemo(() => {
    if (!selectedParty?.state || !companyState) return false;
    return selectedParty.state.trim().toLowerCase() !== companyState.trim().toLowerCase();
  }, [selectedParty, companyState]);

  function updateLine(key: number, field: keyof Line, value: any) {
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
            updated.hsn = selected.hsn || "";
            // Use purchase price if available, else sale price
            updated.rate = Number(selected.purchasePrice || selected.salePrice) || 0;
            updated.gstRate = Number(selected.gstRate) || 0;
          }
        }

        return updated;
      })
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine, key: Date.now() }]);
  }

  function removeLine(key: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const computedLines = useMemo(() => {
    return lines.map((l) => {
      const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0);
      const discountPercent = Number(l.discount) || 0;
      const discountAmt = roundTo2((gross * discountPercent) / 100);
      const taxable = Math.max(0, gross - discountAmt);
      const gstRate = Number(l.gstRate) || 0;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (gstRate > 0) {
        if (isInterState) {
          igst = roundTo2((taxable * gstRate) / 100);
        } else {
          const half = gstRate / 2;
          cgst = roundTo2((taxable * half) / 100);
          sgst = roundTo2((taxable * half) / 100);
        }
      }

      const taxAmount = igst > 0 ? igst : cgst + sgst;
      const total = roundTo2(taxable + taxAmount);

      return {
        ...l,
        discountAmt,
        taxable: roundTo2(taxable),
        cgst,
        sgst,
        igst,
        taxAmount,
        total,
      };
    });
  }, [lines, isInterState]);

  const subTotal = roundTo2(computedLines.reduce((acc, l) => acc + l.taxable, 0));
  const totalDiscount = roundTo2(computedLines.reduce((acc, l) => acc + l.discountAmt, 0));
  const totalTax = roundTo2(computedLines.reduce((acc, l) => acc + l.taxAmount, 0));
  const grandTotal = roundTo2(subTotal + totalTax);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!partyId) {
      setError("Please select a vendor / supplier for this purchase order.");
      return;
    }

    const validLines = lines.filter((l) => l.name.trim() && Number(l.qty) > 0);
    if (validLines.length === 0) {
      setError("Please add at least one item with a valid quantity and description.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        partyId,
        warehouseId: warehouseId || undefined,
        date,
        expectedDate: expectedDate || undefined,
        notes: notes.trim() || undefined,
        terms: terms.trim() || undefined,
        status: "CONFIRMED",
        isInterState,
        items: validLines.map((l) => {
          const gross = Number(l.qty) * Number(l.rate);
          const discAmt = roundTo2((gross * Number(l.discount || 0)) / 100);
          return {
            itemId: l.itemId || undefined,
            name: l.name.trim(),
            sku: l.sku?.trim() || undefined,
            unit: l.unit || "PCS",
            hsn: l.hsn?.trim() || undefined,
            qty: Number(l.qty),
            rate: Number(l.rate),
            discount: discAmt,
            gstRate: Number(l.gstRate || 0),
          };
        }),
      };

      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create purchase order.");
      }

      router.push(`/purchase-orders/${data.purchaseOrder.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create purchase order. Please try again.");
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

      {/* Primary Supplier & PO Info */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-indigo-600" />
          Supplier & Order Details
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
            >
              <option value="">-- Select Supplier / Vendor --</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.city ? `(${p.city})` : ""} {p.gstin ? `[GSTIN: ${p.gstin}]` : ""}
                </option>
              ))}
            </select>
            {selectedParty && (
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
                <span>State: {selectedParty.state || "Not specified"}</span>
                {isInterState ? (
                  <span className="font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Inter-State (IGST)
                  </span>
                ) : (
                  <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                    Intra-State (CGST + SGST)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Receiving Godown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Destination Godown / Warehouse
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

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">PO Date</label>
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

          {/* Expected Delivery */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Expected Delivery Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="input w-full text-xs pr-8"
              />
              <Calendar className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Purchased Items & Material</h3>
          </div>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Item</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1150px]">
            <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[240px]">Item Description</th>
                <th className="py-2.5 px-2.5 w-24 min-w-[85px]">HSN</th>
                <th className="py-2.5 px-2.5 w-28 min-w-[105px] text-right">Qty</th>
                <th className="py-2.5 px-2.5 w-20 min-w-[75px]">Unit</th>
                <th className="py-2.5 px-2.5 w-32 min-w-[115px] text-right">Purchase Rate (₹)</th>
                <th className="py-2.5 px-2.5 w-24 min-w-[90px] text-right">Disc (%)</th>
                <th className="py-2.5 px-2.5 w-28 min-w-[100px] text-center">GST %</th>
                <th className="py-2.5 px-3 w-28 min-w-[105px] text-right">Taxable</th>
                <th className="py-2.5 px-3 w-32 min-w-[125px] text-right">Total (₹)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {computedLines.map((line, idx) => (
                <tr key={line.key} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="space-y-1">
                      <select
                        value={line.itemId}
                        onChange={(e) => updateLine(line.key, "itemId", e.target.value)}
                        className="select w-full text-xs font-semibold px-2 py-1 h-8"
                      >
                        <option value="">-- Choose Item or Custom --</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} {it.sku ? `(${it.sku})` : ""} - ₹{Number(it.purchasePrice || it.salePrice || 0)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Item name / raw material..."
                        value={line.name}
                        onChange={(e) => updateLine(line.key, "name", e.target.value)}
                        className="input w-full text-xs px-2.5 py-1 h-7"
                        required
                      />
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5">
                    <input
                      type="text"
                      placeholder="HSN"
                      value={line.hsn}
                      onChange={(e) => updateLine(line.key, "hsn", e.target.value)}
                      className="input w-full text-xs px-2 py-1 h-8 font-mono"
                    />
                  </td>
                  <td className="py-2.5 px-2.5">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={line.qty}
                      onChange={(e) => updateLine(line.key, "qty", parseFloat(e.target.value) || 0)}
                      className="input w-full text-xs text-right px-2 py-1 h-8 font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      required
                    />
                  </td>
                  <td className="py-2.5 px-2.5">
                    <input
                      type="text"
                      value={line.unit}
                      onChange={(e) => updateLine(line.key, "unit", e.target.value)}
                      className="input w-full text-xs text-center px-2 py-1 h-8 uppercase font-medium"
                    />
                  </td>
                  <td className="py-2.5 px-2.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.rate}
                      onChange={(e) => updateLine(line.key, "rate", parseFloat(e.target.value) || 0)}
                      className="input w-full text-xs text-right px-2 py-1 h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      required
                    />
                  </td>
                  <td className="py-2.5 px-2.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.discount}
                      onChange={(e) => updateLine(line.key, "discount", parseFloat(e.target.value) || 0)}
                      className="input w-full text-xs text-right px-2 py-1 h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>
                  <td className="py-2.5 px-2.5">
                    <select
                      value={line.gstRate}
                      onChange={(e) => updateLine(line.key, "gstRate", parseFloat(e.target.value) || 0)}
                      className="select w-full text-xs text-center px-2 py-1 h-8 font-semibold"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                    {formatCurrency(line.taxable)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                    {formatCurrency(line.total)}
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terms, Notes & Summary Calculations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Notes & Terms */}
        <div className="card p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instructions for Vendor / Receiving Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Delivery between 10am-4pm, Material test certificate required..."
              className="textarea w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Purchase Terms & Conditions
            </label>
            <textarea
              rows={4}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="textarea w-full text-xs font-mono text-[11px]"
            />
          </div>
        </div>

        {/* Calculation Summary Card */}
        <div className="card p-5 space-y-3 bg-slate-50/50">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            PO Financial Summary
          </h3>

          <div className="flex justify-between text-xs text-slate-600 py-1 border-b border-slate-200">
            <span>Taxable Subtotal:</span>
            <span className="font-semibold text-slate-900">{formatCurrency(subTotal)}</span>
          </div>

          {totalDiscount > 0 && (
            <div className="flex justify-between text-xs text-emerald-600 py-1 border-b border-slate-200">
              <span>Discounts:</span>
              <span className="font-semibold">-{formatCurrency(totalDiscount)}</span>
            </div>
          )}

          <div className="flex justify-between text-xs text-slate-600 py-1 border-b border-slate-200">
            <span>GST Amount ({isInterState ? "IGST" : "CGST + SGST"}):</span>
            <span className="font-semibold text-slate-900">{formatCurrency(totalTax)}</span>
          </div>

          <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t-2 border-slate-300">
            <span>Grand Total:</span>
            <span className="text-indigo-700">{formatCurrency(grandTotal)}</span>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>{loading ? "Issuing PO..." : "Issue & Save Purchase Order"}</span>
            </button>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              Issues formal Purchase Order to vendor. Stock enters warehouse only upon Goods Receipt (GRN).
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
