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
  CheckCircle2,
  ArrowRight,
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
  qty: number | string;
  rate: number | string;
  discount: number | string;
  gstRate: number | string;
};

const emptyLine: Line = {
  key: 0,
  itemId: "",
  name: "",
  sku: "",
  unit: "",
  hsn: "",
  qty: "",
  rate: "",
  discount: "",
  gstRate: "",
};

export default function NewSalesOrderForm({
  parties,
  items,
  warehouses,
  companyState,
  initialData,
}: {
  parties: Party[];
  items: Item[];
  warehouses: Warehouse[];
  companyState: string | null;
  initialData?: {
    partyId?: string;
    warehouseId?: string;
    quotationId?: string;
    date?: string;
    expectedDelivery?: string;
    notes?: string;
    terms?: string;
    lines?: Line[];
  };
}) {
  const router = useRouter();

  const [partyId, setPartyId] = useState(initialData?.partyId || "");
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId || "");
  const [date, setDate] = useState(initialData?.date || "");
  const [expectedDelivery, setExpectedDelivery] = useState(initialData?.expectedDelivery || "");

  const [notes, setNotes] = useState(initialData?.notes || "");
  const [terms, setTerms] = useState(initialData?.terms || "");

  const [lines, setLines] = useState<Line[]>(
    initialData?.lines && initialData.lines.length > 0
      ? initialData.lines
      : [{ ...emptyLine, key: Date.now() }]
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Selected party
  const selectedParty = parties.find((p) => p.id === partyId);

  // Inter-state detection: if customer state is different from company state
  const isInterState = useMemo(() => {
    if (!selectedParty?.state || !companyState) return false;
    return selectedParty.state.trim().toLowerCase() !== companyState.trim().toLowerCase();
  }, [selectedParty, companyState]);

  // Update line item
  function updateLine(key: number, field: keyof Line, value: any) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;

        const updated = { ...line, [field]: value };

        // When item is picked from dropdown
        if (field === "itemId") {
          const selected = items.find((i) => i.id === value);
          if (selected) {
            updated.name = selected.name;
            updated.sku = selected.sku || "";
            updated.unit = selected.unit || "PCS";
            updated.hsn = selected.hsn || "";
            updated.rate = Number(selected.salePrice) || 0;
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

  // Live calculations per line
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

  // Overall totals
  const subTotal = roundTo2(computedLines.reduce((acc, l) => acc + l.taxable, 0));
  const totalDiscount = roundTo2(computedLines.reduce((acc, l) => acc + l.discountAmt, 0));
  const totalTax = roundTo2(computedLines.reduce((acc, l) => acc + l.taxAmount, 0));
  const grandTotal = roundTo2(subTotal + totalTax);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!partyId) {
      setError("Please select a customer for this sales order.");
      return;
    }

    const validLines = lines.filter((l) => l.name.trim() && Number(l.qty) > 0);
    if (validLines.length === 0) {
      setError("Please add at least one item with a valid quantity and name.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        partyId,
        warehouseId: warehouseId || undefined,
        quotationId: initialData?.quotationId || undefined,
        date: date || new Date().toISOString().slice(0, 10),
        expectedDelivery: expectedDelivery || undefined,
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

      const res = await fetch("/api/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create sales order.");
      }

      router.push(`/sales-orders/${data.salesOrder.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create sales order. Please try again.");
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

      {/* Top Banner if converted from quote */}
      {initialData?.quotationId && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-900">
                Converting Quotation to Confirmed Sales Order
              </p>
              <p className="text-[11px] text-blue-600">
                Items and customer details have been pre-filled. You can adjust expected delivery date or quantities.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
            Quotation Linked
          </span>
        </div>
      )}

      {/* Primary Order Information */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-blue-600" />
          Customer & Order Details
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
            >
              <option value="">-- Select Customer --</option>
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
                  <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    Intra-State (CGST + SGST)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Warehouse */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dispatch Godown / Warehouse
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="select w-full text-xs"
            >
              <option value="">-- Select Godown / Warehouse --</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.isDefault ? "(Default)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Order Date</label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input w-full text-xs pr-8"
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
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
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
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Order Line Items</h3>
          </div>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Item</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[200px]">Item Description</th>
                <th className="py-2.5 px-3 w-24">HSN</th>
                <th className="py-2.5 px-3 w-20 text-right">Qty</th>
                <th className="py-2.5 px-3 w-20">Unit</th>
                <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
                <th className="py-2.5 px-3 w-20 text-right">Disc (%)</th>
                <th className="py-2.5 px-3 w-24 text-center">GST %</th>
                <th className="py-2.5 px-3 w-28 text-right">Taxable</th>
                <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
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
                        className="select w-full text-xs font-semibold py-1 h-8"
                      >
                        <option value="">-- Choose Item or Custom --</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} {it.sku ? `(${it.sku})` : ""} - ₹{Number(it.salePrice || 0)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Item name / title..."
                        value={line.name}
                        onChange={(e) => updateLine(line.key, "name", e.target.value)}
                        className="input w-full text-xs py-1 h-7"
                        required
                      />
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      placeholder="HSN"
                      value={line.hsn}
                      onChange={(e) => updateLine(line.key, "hsn", e.target.value)}
                      className="input w-full text-xs py-1 h-8"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="0"
                      value={line.qty !== undefined && line.qty !== null ? line.qty : ""}
                      onChange={(e) => updateLine(line.key, "qty", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                      className="input w-full text-xs text-right py-1 h-8 font-semibold"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      placeholder="PCS"
                      value={line.unit || ""}
                      onChange={(e) => updateLine(line.key, "unit", e.target.value)}
                      className="input w-full text-xs py-1 h-8 uppercase"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={line.rate !== undefined && line.rate !== null ? line.rate : ""}
                      onChange={(e) => updateLine(line.key, "rate", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                      className="input w-full text-xs text-right py-1 h-8"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={line.discount !== undefined && line.discount !== null ? line.discount : ""}
                      onChange={(e) => updateLine(line.key, "discount", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                      className="input w-full text-xs text-right py-1 h-8"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      value={line.gstRate !== undefined && line.gstRate !== null ? line.gstRate : ""}
                      onChange={(e) => updateLine(line.key, "gstRate", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                      className="select w-full text-xs text-center py-1 h-8 font-semibold"
                    >
                      <option value="">-- GST --</option>
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                    {formatCurrency(line.taxable)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
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
              Internal Notes / Dispatch Instructions
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Deliver to Gate 2, Contact Mr. Sharma before dispatch..."
              className="textarea w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Terms & Conditions
            </label>
            <textarea
              rows={4}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="e.g. 1. Delivery as per agreed schedule.&#10;2. Prices are inclusive/exclusive of taxes..."
              className="textarea w-full text-xs font-mono text-[11px]"
            />
          </div>
        </div>

        {/* Calculation Summary Card */}
        <div className="card p-5 space-y-3 bg-slate-50/50">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Order Financial Summary
          </h3>

          <div className="flex justify-between text-xs text-slate-600 py-1 border-b border-slate-200">
            <span>Taxable Subtotal:</span>
            <span className="font-semibold text-slate-900">{formatCurrency(subTotal)}</span>
          </div>

          {totalDiscount > 0 && (
            <div className="flex justify-between text-xs text-emerald-600 py-1 border-b border-slate-200">
              <span>Item Discounts:</span>
              <span className="font-semibold">-{formatCurrency(totalDiscount)}</span>
            </div>
          )}

          <div className="flex justify-between text-xs text-slate-600 py-1 border-b border-slate-200">
            <span>GST Amount ({isInterState ? "IGST" : "CGST + SGST"}):</span>
            <span className="font-semibold text-slate-900">{formatCurrency(totalTax)}</span>
          </div>

          <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t-2 border-slate-300">
            <span>Grand Total:</span>
            <span className="text-blue-700">{formatCurrency(grandTotal)}</span>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-60 transition"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>{loading ? "Confirming Order..." : "Confirm & Save Sales Order"}</span>
            </button>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              Creates official Sales Order. Inventory is deducted only when Delivery Challan is dispatched.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
