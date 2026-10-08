"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { roundTo2, formatCurrency } from "@/lib/currency";
import {
  Plus,
  Trash2,
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Clock,
  Sparkles,
  Percent,
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

export default function NewQuotationForm({
  parties,
  items,
  companyState,
}: {
  parties: Party[];
  items: Item[];
  companyState: string | null;
}) {
  const router = useRouter();

  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  // Default valid until: 15 days from today
  const defaultValidDate = new Date();
  defaultValidDate.setDate(defaultValidDate.getDate() + 15);
  const [validUntil, setValidUntil] = useState(defaultValidDate.toISOString().slice(0, 10));

  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(
    "1. Prices are valid for 15 days from the date of quotation.\n2. Goods once sold will not be taken back unless damaged.\n3. GST is applicable as per government regulations."
  );

  const [lines, setLines] = useState<Line[]>([{ ...emptyLine, key: Date.now() }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Selected party
  const selectedParty = parties.find((p) => p.id === partyId);

  // Inter-state detection: if customer state is different from company state
  const isInterState = useMemo(() => {
    if (!selectedParty?.state || !companyState) return false;
    return selectedParty.state.trim().toLowerCase() !== companyState.trim().toLowerCase();
  }, [selectedParty, companyState]);

  // Handle line item change
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
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  // Calculate totals
  const calculations = useMemo(() => {
    let subTotal = 0;
    let totalDiscount = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const lineCalculations = lines.map((l) => {
      const gross = l.qty * l.rate;
      const discAmt = (gross * (l.discount || 0)) / 100;
      const taxable = gross - discAmt;
      const taxAmt = (taxable * (l.gstRate || 0)) / 100;
      const lineTotal = taxable + taxAmt;

      subTotal += taxable;
      totalDiscount += discAmt;

      if (isInterState) {
        igstTotal += taxAmt;
      } else {
        cgstTotal += taxAmt / 2;
        sgstTotal += taxAmt / 2;
      }

      return {
        ...l,
        taxable: roundTo2(taxable),
        taxAmt: roundTo2(taxAmt),
        lineTotal: roundTo2(lineTotal),
      };
    });

    const taxTotal = cgstTotal + sgstTotal + igstTotal;
    const grandTotal = subTotal + taxTotal;

    return {
      subTotal: roundTo2(subTotal),
      totalDiscount: roundTo2(totalDiscount),
      cgstTotal: roundTo2(cgstTotal),
      sgstTotal: roundTo2(sgstTotal),
      igstTotal: roundTo2(igstTotal),
      taxTotal: roundTo2(taxTotal),
      grandTotal: roundTo2(grandTotal),
      lineCalculations,
    };
  }, [lines, isInterState]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validLines = lines.filter((l) => l.name && l.qty > 0 && l.rate >= 0);
    if (validLines.length === 0) {
      setError("Please add at least one line item with valid quantity and rate.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: partyId || null,
          date,
          validUntil: validUntil || null,
          notes,
          terms,
          isInterState,
          status: "DRAFT",
          items: validLines.map((l) => ({
            itemId: l.itemId || undefined,
            name: l.name,
            sku: l.sku || undefined,
            unit: l.unit || "PCS",
            hsn: l.hsn || undefined,
            qty: Number(l.qty),
            rate: Number(l.rate),
            discount: Number(l.discount || 0),
            gstRate: Number(l.gstRate || 0),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create quotation");

      router.push(`/quotations/${data.quotation.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to save quotation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 flex items-center gap-2 shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Details */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
          Quotation Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Customer Selection */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Customer / Client <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              required
            >
              <option value="">Select Customer...</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.city ? `(${p.city})` : ""} {p.gstin ? `[GSTIN: ${p.gstin}]` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Quotation Date */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Quotation Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Valid Until Date */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Valid Until <span className="text-slate-400 font-normal">(Validity)</span>
            </label>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>

        {selectedParty && (
          <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex flex-wrap gap-4">
            <div>
              <span className="font-semibold text-slate-700">State:</span>{" "}
              {selectedParty.state || "Not specified"}
            </div>
            <div>
              <span className="font-semibold text-slate-700">GSTIN:</span>{" "}
              {selectedParty.gstin || "Unregistered"}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Tax Type:</span>{" "}
              <span className={`font-bold ${isInterState ? "text-amber-700" : "text-emerald-700"}`}>
                {isInterState ? "Inter-State (IGST)" : "Intra-State (CGST + SGST)"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Quoted Products & Services
          </h2>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1150px]">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-semibold min-w-[240px]">Item / Product</th>
                <th className="py-2.5 px-2 font-semibold w-24 min-w-[85px]">HSN</th>
                <th className="py-2.5 px-2 font-semibold w-28 min-w-[105px] text-right">Qty</th>
                <th className="py-2.5 px-2 font-semibold w-20 min-w-[75px]">Unit</th>
                <th className="py-2.5 px-2 font-semibold w-32 min-w-[115px] text-right">Rate (₹)</th>
                <th className="py-2.5 px-2 font-semibold w-24 min-w-[90px] text-right">Disc %</th>
                <th className="py-2.5 px-2 font-semibold w-28 min-w-[100px] text-center">GST %</th>
                <th className="py-2.5 px-3 font-semibold w-32 min-w-[125px] text-right">Amount (₹)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculations.lineCalculations.map((line, idx) => (
                <tr key={line.key} className="hover:bg-slate-50/50">
                  {/* Item Picker */}
                  <td className="py-2 px-3">
                    <div className="space-y-1">
                      <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                        value={line.itemId}
                        onChange={(e) => updateLine(line.key, "itemId", e.target.value)}
                      >
                        <option value="">Select from catalog...</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} (₹{Number(i.salePrice)})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Item description / name"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                        value={line.name}
                        onChange={(e) => updateLine(line.key, "name", e.target.value)}
                        required
                      />
                    </div>
                  </td>

                  {/* HSN */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
                      value={line.hsn}
                      onChange={(e) => updateLine(line.key, "hsn", e.target.value)}
                      placeholder="HSN"
                    />
                  </td>

                  {/* Qty */}
                  <td className="py-2 px-2 text-right">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 text-right"
                      value={line.qty}
                      onChange={(e) => updateLine(line.key, "qty", parseFloat(e.target.value) || 0)}
                      required
                    />
                  </td>

                  {/* Unit */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
                      value={line.unit}
                      onChange={(e) => updateLine(line.key, "unit", e.target.value)}
                    />
                  </td>

                  {/* Rate */}
                  <td className="py-2 px-2 text-right">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 text-right font-semibold"
                      value={line.rate}
                      onChange={(e) => updateLine(line.key, "rate", parseFloat(e.target.value) || 0)}
                      required
                    />
                  </td>

                  {/* Disc % */}
                  <td className="py-2 px-2 text-right">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 text-right"
                      value={line.discount}
                      onChange={(e) =>
                        updateLine(line.key, "discount", parseFloat(e.target.value) || 0)
                      }
                    />
                  </td>

                  {/* GST % */}
                  <td className="py-2 px-2 text-right">
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-1 py-1 text-xs text-slate-900 text-right"
                      value={line.gstRate}
                      onChange={(e) =>
                        updateLine(line.key, "gstRate", parseFloat(e.target.value) || 0)
                      }
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </td>

                  {/* Line Total */}
                  <td className="py-2 px-3 text-right font-bold text-slate-900">
                    {formatCurrency(line.lineTotal)}
                  </td>

                  {/* Delete Row */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.key)}
                      className="text-slate-400 hover:text-rose-600 disabled:opacity-30 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-slate-100">
          <div className="w-full sm:w-1/2 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Terms & Conditions
              </label>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Notes / Remarks for Customer
              </label>
              <textarea
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special notes or discounts..."
              />
            </div>
          </div>

          <div className="w-full sm:w-80 rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Sub Total (Taxable):</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(calculations.subTotal)}
              </span>
            </div>

            {calculations.totalDiscount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Total Discount:</span>
                <span className="font-semibold">-{formatCurrency(calculations.totalDiscount)}</span>
              </div>
            )}

            {!isInterState ? (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>CGST Total:</span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(calculations.cgstTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST Total:</span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(calculations.sgstTotal)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-600">
                <span>IGST Total:</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(calculations.igstTotal)}
                </span>
              </div>
            )}

            <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-slate-900">
              <span>Estimated Grand Total:</span>
              <span className="text-emerald-700">{formatCurrency(calculations.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push("/quotations")}
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
        >
          {loading ? "Saving Quotation..." : "Save & Preview Quotation"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
