"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { roundTo2, formatCurrency } from "@/lib/currency";
import {
  RotateCcw,
  Plus,
  Trash2,
  AlertCircle,
  Package,
  Calendar,
  User,
  FileText,
  Building,
  ArrowRight,
} from "lucide-react";

type Party = { id: string; name: string; state: string | null; gstin: string | null };
type Item = {
  id: string;
  name: string;
  sku: string | null;
  hsn: string | null;
  salePrice: any;
  gstRate: any;
  stock: any;
};

type PastInvoice = {
  id: string;
  invoiceNo: string;
  partyId: string | null;
  date: string;
  grandTotal: any;
  lines: Array<{
    id: string;
    itemId: string | null;
    name: string;
    hsn: string | null;
    qty: any;
    rate: any;
    gstRate: any;
  }>;
};

type ReturnLine = {
  key: number;
  itemId: string;
  name: string;
  hsn: string;
  qty: number;
  rate: number;
  gstRate: number;
};

const emptyLine: ReturnLine = {
  key: 0,
  itemId: "",
  name: "",
  hsn: "",
  qty: 1,
  rate: 0,
  gstRate: 18,
};

export default function NewSalesReturnForm({
  parties,
  items,
  pastInvoices,
  companyState,
  prefilledInvoiceId,
}: {
  parties: Party[];
  items: Item[];
  pastInvoices: PastInvoice[];
  companyState: string | null;
  prefilledInvoiceId?: string;
}) {
  const router = useRouter();

  // Find prefilled invoice if query parameter passed
  const initialInvoice = prefilledInvoiceId
    ? pastInvoices.find((i) => i.id === prefilledInvoiceId)
    : null;

  const [partyId, setPartyId] = useState(initialInvoice?.partyId || "");
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState(initialInvoice?.invoiceNo || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("Damaged / Defective Goods");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Initialize lines from prefilled invoice or empty line
  const [lines, setLines] = useState<ReturnLine[]>(() => {
    if (initialInvoice && initialInvoice.lines.length > 0) {
      return initialInvoice.lines.map((l, index) => ({
        key: Date.now() + index,
        itemId: l.itemId || "",
        name: l.name,
        hsn: l.hsn || "",
        qty: parseFloat(l.qty.toString()) || 1,
        rate: parseFloat(l.rate.toString()) || 0,
        gstRate: parseFloat(l.gstRate.toString()) || 0,
      }));
    }
    return [{ ...emptyLine, key: Date.now() }];
  });

  const selectedParty = parties.find((p) => p.id === partyId);

  // Invoices for this customer
  const customerInvoices = useMemo(() => {
    if (!partyId) return [];
    return pastInvoices.filter((inv) => inv.partyId === partyId);
  }, [pastInvoices, partyId]);

  // Handle invoice auto-selection
  function handleSelectInvoice(invNo: string) {
    setSelectedInvoiceNo(invNo);
    if (!invNo) return;
    const inv = pastInvoices.find((i) => i.invoiceNo === invNo);
    if (inv) {
      if (inv.partyId && inv.partyId !== partyId) {
        setPartyId(inv.partyId);
      }
      if (inv.lines && inv.lines.length > 0) {
        setLines(
          inv.lines.map((l, index) => ({
            key: Date.now() + index,
            itemId: l.itemId || "",
            name: l.name,
            hsn: l.hsn || "",
            qty: parseFloat(l.qty.toString()) || 1,
            rate: parseFloat(l.rate.toString()) || 0,
            gstRate: parseFloat(l.gstRate.toString()) || 0,
          }))
        );
      }
    }
  }

  // Inter-state check
  const isInterState = useMemo(() => {
    if (!companyState || !selectedParty?.state) return false;
    return companyState.toLowerCase() !== selectedParty.state.toLowerCase();
  }, [companyState, selectedParty]);

  // Live GST calculation
  const totals = useMemo(() => {
    let subTotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    for (const l of lines) {
      const amt = roundTo2(l.qty * l.rate);
      const gst = roundTo2((amt * l.gstRate) / 100);
      subTotal += amt;
      if (isInterState) {
        igst += gst;
      } else {
        cgst += roundTo2(gst / 2);
        sgst += roundTo2(gst / 2);
      }
    }

    const beforeRound = roundTo2(subTotal + cgst + sgst + igst);
    const grand = Math.round(beforeRound);
    return {
      subTotal,
      cgst,
      sgst,
      igst,
      roundOff: roundTo2(grand - beforeRound),
      grand,
    };
  }, [lines, isInterState]);

  function addLine() {
    setLines((ls) => [...ls, { ...emptyLine, key: Date.now() + Math.random() }]);
  }

  function removeLine(key: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  function updateLine(key: number, field: keyof ReturnLine, value: any) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  function selectItem(key: number, itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      updateLine(key, "itemId", itemId);
      updateLine(key, "name", item.name);
      updateLine(key, "hsn", item.hsn || "");
      updateLine(key, "rate", parseFloat(item.salePrice.toString()));
      updateLine(key, "gstRate", parseFloat(item.gstRate.toString()));
    } else {
      updateLine(key, "itemId", "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!partyId) {
      setError("Please select a customer.");
      return;
    }

    const validLines = lines.filter((l) => l.name.trim() && l.qty > 0 && l.rate >= 0);
    if (validLines.length === 0) {
      setError("Please add at least one valid return item with quantity.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sales-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId,
          originalInvoiceNo: selectedInvoiceNo.trim() || undefined,
          date,
          reason,
          notes,
          isInterState,
          lines: validLines,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sales return creation failed");

      router.push("/sales-return");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-900">Validation Error</p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Header Fields Card */}
      <div className="card grid grid-cols-1 gap-5 p-6 sm:grid-cols-4">
        {/* Customer / Party */}
        <div className="sm:col-span-2">
          <label className="label">
            Customer / Grahak <span className="text-red-500">*</span>
          </label>
          <select
            className="input font-medium"
            value={partyId}
            onChange={(e) => {
              setPartyId(e.target.value);
              setSelectedInvoiceNo("");
            }}
            required
          >
            <option value="">— Select Customer —</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.gstin ? `(GST: ${p.gstin})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Original Reference Invoice (Optional) */}
        <div>
          <label className="label">Original Invoice (Ref)</label>
          <select
            className="input font-mono"
            value={selectedInvoiceNo}
            onChange={(e) => handleSelectInvoice(e.target.value)}
          >
            <option value="">— Direct Return / No Ref —</option>
            {customerInvoices.map((inv) => (
              <option key={inv.id} value={inv.invoiceNo}>
                {inv.invoiceNo} (₹{parseFloat(inv.grandTotal.toString()).toFixed(0)})
              </option>
            ))}
          </select>
        </div>

        {/* Return Date */}
        <div>
          <label className="label">
            Return Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        {/* Reason for Return */}
        <div className="sm:col-span-2">
          <label className="label">Return Reason (Kaaran)</label>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="Damaged / Defective Goods">Damaged / Defective Goods (Kharab Saman)</option>
            <option value="Wrong Item Delivered">Wrong Item Delivered (Galat Item Gaya)</option>
            <option value="Quality Dissatisfaction">Quality Issue (Quality Pasand Nahi Aayi)</option>
            <option value="Customer Exchanged / Cancelled">Customer Exchanged / Cancelled</option>
            <option value="Excess Quantity Supplied">Excess Quantity Supplied (Zyada Bheja)</option>
            <option value="Other">Other / Miscellaneous</option>
          </select>
        </div>

        {/* GST Type Indicator */}
        <div className="sm:col-span-2">
          <label className="label">GST Tax Slabs</label>
          <div className="input flex items-center bg-slate-50 text-slate-700 font-medium">
            {isInterState ? "⚡ Inter-State Return → Reverse IGST" : "🏢 Intra-State Return → Reverse CGST + SGST"}
          </div>
        </div>
      </div>

      {/* Line Items Table Card */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4 bg-slate-50/60 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-600" />
            Returned Items (Stock automatically restored)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[950px]">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 min-w-[240px]">Item / Description</th>
                <th className="px-3 py-3 w-28 min-w-[90px]">HSN/SAC</th>
                <th className="px-3 py-3 w-28 min-w-[105px] text-right">Return Qty</th>
                <th className="px-3 py-3 w-32 min-w-[115px] text-right">Rate (₹)</th>
                <th className="px-3 py-3 w-24 min-w-[90px] text-right">GST %</th>
                <th className="px-4 py-3 w-32 min-w-[125px] text-right">Amount (₹)</th>
                <th className="px-2 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => {
                const lineAmt = roundTo2(l.qty * l.rate);
                const lineGst = roundTo2((lineAmt * l.gstRate) / 100);
                const totalLine = roundTo2(lineAmt + lineGst);

                return (
                  <tr key={l.key} className="hover:bg-slate-50/50 transition">
                    <td className="p-3">
                      <select
                        className="input text-xs mb-1"
                        value={l.itemId}
                        onChange={(e) => selectItem(l.key, e.target.value)}
                      >
                        <option value="">— Pick from Product List —</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} (Stock: {Number(i.stock)})
                          </option>
                        ))}
                      </select>
                      <input
                        className="input text-xs font-medium"
                        placeholder="Item Description"
                        value={l.name}
                        onChange={(e) => updateLine(l.key, "name", e.target.value)}
                        required
                      />
                    </td>
                    <td className="p-3">
                      <input
                        className="input font-mono text-xs"
                        placeholder="HSN"
                        value={l.hsn}
                        onChange={(e) => updateLine(l.key, "hsn", e.target.value)}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        className="input text-right font-bold text-xs"
                        value={l.qty}
                        onChange={(e) => updateLine(l.key, "qty", parseFloat(e.target.value) || 0)}
                        required
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="input text-right text-xs font-medium"
                        value={l.rate}
                        onChange={(e) => updateLine(l.key, "rate", parseFloat(e.target.value) || 0)}
                        required
                      />
                    </td>
                    <td className="p-3">
                      <select
                        className="input text-right text-xs font-semibold"
                        value={l.gstRate}
                        onChange={(e) => updateLine(l.key, "gstRate", parseFloat(e.target.value))}
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900 text-xs">
                      {formatCurrency(totalLine)}
                    </td>
                    <td className="p-3 text-center">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(l.key)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/40">
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Add Another Item
          </button>
        </div>
      </div>

      {/* Bottom Section: Notes & Total Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Notes */}
        <div className="card p-5 space-y-3">
          <label className="label">Credit Note Notes / Remarks</label>
          <textarea
            rows={4}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-amber-500"
            placeholder="e.g. Products received back in warehouse. Customer balance adjusted via Credit Note."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Calculation Box */}
        <div className="card p-5 space-y-3 bg-gradient-to-br from-amber-50/30 to-orange-50/20 border-amber-200/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Credit Note Calculation Summary
          </h3>

          <div className="space-y-2 border-b border-slate-200/80 pb-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Subtotal:</span>
              <span className="font-semibold">{formatCurrency(totals.subTotal)}</span>
            </div>

            {isInterState ? (
              <div className="flex justify-between text-slate-600">
                <span>Integrated GST (IGST):</span>
                <span className="font-semibold">{formatCurrency(totals.igst)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Central GST (CGST):</span>
                  <span className="font-semibold">{formatCurrency(totals.cgst)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>State GST (SGST):</span>
                  <span className="font-semibold">{formatCurrency(totals.sgst)}</span>
                </div>
              </>
            )}

            {totals.roundOff !== 0 && (
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Round Off:</span>
                <span>{totals.roundOff > 0 ? `+${totals.roundOff}` : totals.roundOff}</span>
              </div>
            )}
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-base font-bold text-slate-900">Total Credit Value:</span>
            <span className="text-2xl font-extrabold text-amber-700">
              {formatCurrency(totals.grand)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => router.push("/sales-return")}
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading || totals.grand <= 0}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-600/20 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 transition"
        >
          {loading ? "Generating Credit Note..." : "Create Credit Note & Restock"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
