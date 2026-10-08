"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { roundTo2, formatCurrency } from "@/lib/currency";
import {
  Plus,
  Trash2,
  Building2,
  Calendar,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  ArrowLeft,
  FileText,
  PackageMinus,
  Sparkles,
} from "lucide-react";

interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  gstin: string | null;
  state: string | null;
}

interface Item {
  id: string;
  name: string;
  hsn: string | null;
  purchasePrice: string;
  gstRate: string;
  stock: string;
}

interface PastBill {
  id: string;
  invoiceNo: string;
  partyId: string | null;
  date: string;
  grandTotal: string;
  lines: Array<{
    itemId: string | null;
    name: string;
    hsn: string | null;
    qty: string;
    rate: string;
    gstRate: string;
  }>;
}

interface ReturnLine {
  key: number;
  itemId: string;
  name: string;
  hsn: string;
  qty: number;
  rate: number;
  gstRate: number;
}

const emptyLine: Omit<ReturnLine, "key"> = {
  itemId: "",
  name: "",
  hsn: "",
  qty: 1,
  rate: 0,
  gstRate: 18,
};

export default function NewPurchaseReturnForm({
  vendors,
  items,
  pastBills,
  companyState,
  initialBill,
}: {
  vendors: Vendor[];
  items: Item[];
  pastBills: PastBill[];
  companyState: string;
  initialBill?: any;
}) {
  const router = useRouter();

  const [vendorId, setVendorId] = useState(initialBill?.partyId || "");
  const [selectedBillNo, setSelectedBillNo] = useState(initialBill?.invoiceNo || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("Damaged in Transit");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [lines, setLines] = useState<ReturnLine[]>(() => {
    if (initialBill && initialBill.lines.length > 0) {
      return initialBill.lines.map((l: any, index: number) => ({
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

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  // Filter bills by selected vendor
  const vendorBills = useMemo(() => {
    if (!vendorId) return [];
    return pastBills.filter((b) => b.partyId === vendorId);
  }, [pastBills, vendorId]);

  // Handle bill auto-selection
  function handleSelectBill(billNo: string) {
    setSelectedBillNo(billNo);
    if (!billNo) return;
    const bill = pastBills.find((b) => b.invoiceNo === billNo);
    if (bill) {
      if (bill.partyId && bill.partyId !== vendorId) {
        setVendorId(bill.partyId);
      }
      if (bill.lines && bill.lines.length > 0) {
        setLines(
          bill.lines.map((l, index) => ({
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

  // Inter-state check for IGST vs CGST/SGST
  const isInterState = useMemo(() => {
    if (!companyState || !selectedVendor?.state) return false;
    return companyState.toLowerCase() !== selectedVendor.state.toLowerCase();
  }, [companyState, selectedVendor]);

  // Calculation
  const totals = useMemo(() => {
    let subTotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    for (const l of lines) {
      const amt = roundTo2((l.qty || 0) * (l.rate || 0));
      const gst = roundTo2((amt * (l.gstRate || 0)) / 100);
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
      subTotal: roundTo2(subTotal),
      cgst: roundTo2(cgst),
      sgst: roundTo2(sgst),
      igst: roundTo2(igst),
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
      updateLine(key, "rate", parseFloat(item.purchasePrice));
      updateLine(key, "gstRate", parseFloat(item.gstRate));
    } else {
      updateLine(key, "itemId", "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!vendorId) {
      setError("Please select a vendor / supplier.");
      return;
    }

    const validLines = lines.filter((l) => l.name.trim() && l.qty > 0 && l.rate >= 0);
    if (validLines.length === 0) {
      setError("Please add at least one valid return item with quantity and purchase rate.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/purchase-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: vendorId,
          originalInvoiceNo: selectedBillNo || null,
          date,
          reason,
          notes,
          isInterState,
          lines: validLines.map((l) => ({
            itemId: l.itemId || undefined,
            name: l.name.trim(),
            hsn: l.hsn ? l.hsn.trim() : undefined,
            qty: l.qty,
            rate: l.rate,
            gstRate: l.gstRate,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create debit note");

      router.push("/purchase-return");
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
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Helpful Inventory Notification */}
      <div className="flex items-center gap-2.5 rounded-2xl bg-rose-50/80 border border-rose-200/80 px-4 py-3 text-xs text-rose-800">
        <PackageMinus className="h-4 w-4 text-rose-600 shrink-0" />
        <span>
          <strong>Automated Inventory & Ledger Accounting:</strong> Creating this Debit Note will automatically deduct the returned item quantities from your <strong>Inventory Stock</strong> and reduce your payable balance in the <strong>Vendor Ledger</strong>.
        </span>
      </div>

      {/* Top Details Card */}
      <div className="card p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Vendor Selection */}
        <div>
          <label className="label">
            Vendor / Supplier <span className="text-red-500">*</span>
          </label>
          <select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              setSelectedBillNo("");
            }}
            className="input"
            required
          >
            <option value="">— Select Vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {/* Link Purchase Bill */}
        <div>
          <label className="label flex items-center justify-between">
            <span>Against Purchase Bill</span>
            <span className="text-[10px] text-slate-400 font-normal">Optional</span>
          </label>
          <select
            value={selectedBillNo}
            onChange={(e) => handleSelectBill(e.target.value)}
            disabled={!vendorId}
            className="input"
          >
            <option value="">
              {vendorId ? "— Direct Return / Select Bill —" : "Select vendor first"}
            </option>
            {vendorBills.map((b) => (
              <option key={b.id} value={b.invoiceNo}>
                {b.invoiceNo} (₹{parseFloat(b.grandTotal).toLocaleString("en-IN")})
              </option>
            ))}
          </select>
        </div>

        {/* Return Date */}
        <div>
          <label className="label">Return Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            required
          />
        </div>

        {/* Reason for Return */}
        <div>
          <label className="label">Reason for Return</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
          >
            <option value="Damaged in Transit">Damaged in Transit</option>
            <option value="Defective / Quality Issue">Defective / Quality Issue</option>
            <option value="Wrong Product Supplied">Wrong Product Supplied</option>
            <option value="Excess Quantity Supplied">Excess Quantity Supplied</option>
            <option value="Rate Difference / Overcharged">Rate Difference / Overcharged</option>
            <option value="Near Expiry / Expired">Near Expiry / Expired</option>
            <option value="Other">Other Reason</option>
          </select>
        </div>
      </div>

      {/* Return Line Items Card */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <PackageMinus className="h-4 w-4 text-rose-600" />
            Items to Return (Stock Deduction)
          </h2>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Return Item</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[950px]">
            <thead className="bg-slate-100/70 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 min-w-[240px]">Item Description</th>
                <th className="px-3 py-3 w-24 min-w-[85px]">HSN</th>
                <th className="px-3 py-3 w-28 min-w-[105px] text-right">Return Qty</th>
                <th className="px-3 py-3 w-32 min-w-[115px] text-right">Purchase Rate (₹)</th>
                <th className="px-3 py-3 w-24 min-w-[90px] text-right">GST %</th>
                <th className="px-4 py-3 w-32 min-w-[125px] text-right">Amount (₹)</th>
                <th className="px-3 py-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {lines.map((line) => {
                const lineAmt = roundTo2((line.qty || 0) * (line.rate || 0));
                return (
                  <tr key={line.key} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      {items.length > 0 && (
                        <select
                          value={line.itemId}
                          onChange={(e) => selectItem(line.key, e.target.value)}
                          className="input text-xs py-1.5 mb-1.5"
                        >
                          <option value="">— Select from inventory (or type below) —</option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} (Stock: {i.stock})
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        type="text"
                        placeholder="Item name"
                        value={line.name}
                        onChange={(e) => updateLine(line.key, "name", e.target.value)}
                        className="input text-xs py-1.5"
                        required
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        placeholder="HSN"
                        value={line.hsn}
                        onChange={(e) => updateLine(line.key, "hsn", e.target.value)}
                        className="input text-xs py-1.5 font-mono"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder="1"
                        value={line.qty}
                        onChange={(e) =>
                          updateLine(line.key, "qty", parseFloat(e.target.value) || 0)
                        }
                        className="input text-xs py-1.5 text-right font-bold"
                        required
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={line.rate}
                        onChange={(e) =>
                          updateLine(line.key, "rate", parseFloat(e.target.value) || 0)
                        }
                        className="input text-xs py-1.5 text-right font-semibold"
                        required
                      />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={line.gstRate}
                        onChange={(e) =>
                          updateLine(line.key, "gstRate", parseFloat(e.target.value) || 0)
                        }
                        className="input text-xs py-1.5 text-right"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      ₹{lineAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length === 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
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

        {/* Calculation Summary Footer */}
        <div className="p-6 bg-slate-50/70 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Internal Notes / Remarks</label>
            <textarea
              rows={3}
              placeholder="e.g. Returned to supplier dispatch unit via transporter ABC..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input text-xs resize-none"
            />
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Subtotal:</span>
              <span className="font-semibold text-slate-800">
                ₹{totals.subTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {isInterState ? (
              <div className="flex justify-between text-slate-600">
                <span>IGST:</span>
                <span className="font-semibold text-slate-800">
                  ₹{totals.igst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>CGST:</span>
                  <span className="font-semibold text-slate-800">
                    ₹{totals.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST:</span>
                  <span className="font-semibold text-slate-800">
                    ₹{totals.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}

            {totals.roundOff !== 0 && (
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Round Off:</span>
                <span>₹{totals.roundOff.toFixed(2)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline">
              <span className="text-base font-bold text-slate-900">Total Return Value:</span>
              <span className="text-2xl font-black text-rose-700">
                ₹{totals.grand.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href="/purchase-return"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Cancel</span>
        </Link>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-600/20 hover:from-rose-700 hover:to-red-700 transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <span>Saving Debit Note...</span>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>Issue Debit Note</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
