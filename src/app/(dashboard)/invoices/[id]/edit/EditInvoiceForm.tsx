"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency, roundTo2 } from "@/lib/currency";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  Loader2,
  FileText,
} from "lucide-react";

interface LineItem {
  id?: string;
  itemId?: string | null;
  name: string;
  sku?: string | null;
  hsn?: string | null;
  unit: string;
  qty: number;
  rate: number;
  discount: number;
  gstRate: number;
  amount: number;
}

interface EditInvoiceFormProps {
  invoice: any;
  parties: any[];
  items: any[];
  warehouses: any[];
  companyState: string | null;
}

export default function EditInvoiceForm({
  invoice,
  parties,
  items,
  warehouses,
  companyState,
}: EditInvoiceFormProps) {
  const router = useRouter();

  const [partyId, setPartyId] = useState(invoice.partyId || "");
  const [date, setDate] = useState(invoice.date || "");
  const [dueDate, setDueDate] = useState(invoice.dueDate || "");
  const [orderNo, setOrderNo] = useState(invoice.orderNo || "");
  const [notes, setNotes] = useState(invoice.notes || "");
  const [paymentTerms, setPaymentTerms] = useState(invoice.paymentTerms || "");
  const [billingAddress, setBillingAddress] = useState(invoice.billingAddress || "");
  const [shippingAddress, setShippingAddress] = useState(invoice.shippingAddress || "");
  const [placeOfSupply, setPlaceOfSupply] = useState(invoice.placeOfSupply || "");
  const [salesperson, setSalesperson] = useState(invoice.salesperson || "");
  const [status, setStatus] = useState(invoice.status || "POSTED");

  const [lines, setLines] = useState<LineItem[]>(
    invoice.lines && invoice.lines.length > 0
      ? invoice.lines
      : [
          {
            name: "",
            unit: "PCS",
            qty: 1,
            rate: 0,
            discount: 0,
            gstRate: 18,
            amount: 0,
          },
        ]
  );

  const [discountTotal, setDiscountTotal] = useState(Number(invoice.discount || 0));
  const [freightTotal, setFreightTotal] = useState(Number(invoice.freight || 0));
  const [otherChargesTotal, setOtherChargesTotal] = useState(Number(invoice.otherCharges || 0));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Selected party for inter-state calculation
  const selectedParty = useMemo(() => {
    return parties.find((p) => p.id === partyId);
  }, [partyId, parties]);

  const isInterState = useMemo(() => {
    if (!companyState || !selectedParty?.state) return false;
    return companyState.trim().toLowerCase() !== selectedParty.state.trim().toLowerCase();
  }, [companyState, selectedParty]);

  // Handle line field change
  function updateLine(index: number, field: keyof LineItem, value: any) {
    setLines((prev) => {
      const updated = [...prev];
      const cur = { ...updated[index], [field]: value };

      // Recalculate line amount
      const qty = Number(cur.qty || 0);
      const rate = Number(cur.rate || 0);
      const disc = Number(cur.discount || 0);
      const gst = Number(cur.gstRate || 0);

      const base = roundTo2(qty * rate);
      const discAmt = roundTo2((base * disc) / 100);
      const taxable = Math.max(0, roundTo2(base - discAmt));
      const gstAmt = roundTo2((taxable * gst) / 100);

      cur.amount = roundTo2(taxable + gstAmt);
      updated[index] = cur;
      return updated;
    });
  }

  // Handle select item from catalog
  function handleSelectItem(index: number, itemId: string) {
    const it = items.find((i) => i.id === itemId);
    if (!it) return;

    setLines((prev) => {
      const updated = [...prev];
      const cur = {
        ...updated[index],
        itemId: it.id,
        name: it.name,
        sku: it.sku || "",
        hsn: it.hsn || "",
        unit: it.unit || "PCS",
        rate: Number(invoice.type === "PURCHASE" ? it.purchasePrice || 0 : it.salePrice || 0),
        gstRate: Number(it.gstRate || 18),
      };

      const qty = Number(cur.qty || 1);
      const base = roundTo2(qty * cur.rate);
      const discAmt = roundTo2((base * Number(cur.discount || 0)) / 100);
      const taxable = Math.max(0, roundTo2(base - discAmt));
      const gstAmt = roundTo2((taxable * cur.gstRate) / 100);
      cur.amount = roundTo2(taxable + gstAmt);

      updated[index] = cur;
      return updated;
    });
  }

  function addRow() {
    setLines((prev) => [
      ...prev,
      {
        name: "",
        unit: "PCS",
        qty: 1,
        rate: 0,
        discount: 0,
        gstRate: 18,
        amount: 0,
      },
    ]);
  }

  function removeRow(index: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  // Totals calculations
  const totals = useMemo(() => {
    let subTotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    for (const l of lines) {
      const base = roundTo2(Number(l.qty || 0) * Number(l.rate || 0));
      const disc = roundTo2((base * Number(l.discount || 0)) / 100);
      const taxable = Math.max(0, roundTo2(base - disc));
      const tax = roundTo2((taxable * Number(l.gstRate || 0)) / 100);

      subTotal += taxable;
      if (isInterState) {
        igst += tax;
      } else {
        cgst += roundTo2(tax / 2);
        sgst += roundTo2(tax / 2);
      }
    }

    const netBeforeTax = Math.max(
      0,
      subTotal - Number(discountTotal || 0) + Number(freightTotal || 0) + Number(otherChargesTotal || 0)
    );
    const taxTotal = isInterState ? igst : cgst + sgst;
    const rawGrand = roundTo2(netBeforeTax + taxTotal);
    const roundedGrand = Math.round(rawGrand);
    const roundOff = roundTo2(roundedGrand - rawGrand);

    return {
      subTotal: roundTo2(subTotal),
      cgst: roundTo2(cgst),
      sgst: roundTo2(sgst),
      igst: roundTo2(igst),
      taxTotal: roundTo2(taxTotal),
      roundOff,
      grandTotal: roundedGrand,
    };
  }, [lines, isInterState, discountTotal, freightTotal, otherChargesTotal]);

  // Submit update
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validLines = lines.filter((l) => l.name.trim() && Number(l.qty) > 0);
    if (validLines.length === 0) {
      setError("Please add at least one valid line item with name and quantity.");
      return;
    }

    // Stock validation for Sales invoices
    if (invoice.type !== "PURCHASE" && invoice.type !== "PURCHASE_RETURN") {
      const stockItemMap = new Map<string, { totalQty: number; name: string }>();
      for (const l of validLines) {
        if (l.itemId) {
          const cur = stockItemMap.get(l.itemId) || { totalQty: 0, name: l.name };
          cur.totalQty += Number(l.qty || 0);
          stockItemMap.set(l.itemId, cur);
        }
      }

      for (const [itemId, info] of stockItemMap.entries()) {
        const it = items.find((i) => i.id === itemId);
        if (it && it.type !== "SERVICE") {
          const prevQty = (invoice.lines || [])
            .filter((orig: any) => orig.itemId === itemId)
            .reduce((sum: number, orig: any) => sum + Number(orig.qty || 0), 0);
          const maxAllowed = Number(it.stock || 0) + prevQty;

          if (info.totalQty > maxAllowed) {
            setError(
              `Insufficient stock for "${info.name}". Maximum available stock is ${maxAllowed} ${it.unit || "PCS"}, but you entered ${info.totalQty}. Cannot update bill with quantity exceeding stock.`
            );
            return;
          }
        }
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: partyId || null,
          date,
          dueDate: dueDate || null,
          orderNo: orderNo || null,
          billingAddress: billingAddress || null,
          shippingAddress: shippingAddress || null,
          placeOfSupply: placeOfSupply || null,
          salesperson: salesperson || null,
          paymentTerms: paymentTerms || null,
          notes: notes || null,
          status,
          discount: discountTotal,
          freight: freightTotal,
          otherCharges: otherChargesTotal,
          lines: validLines.map((l) => ({
            itemId: l.itemId || null,
            name: l.name.trim(),
            sku: l.sku || null,
            hsn: l.hsn || null,
            unit: l.unit || "PCS",
            qty: Number(l.qty),
            rate: Number(l.rate),
            discount: Number(l.discount || 0),
            gstRate: Number(l.gstRate || 0),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update bill.");

      setSuccess(true);
      setTimeout(() => {
        router.push(`/invoices/${invoice.id}`);
        router.refresh();
      }, 700);
    } catch (err: any) {
      setError(err.message || "An error occurred while updating the bill.");
      setLoading(false);
    }
  }

  const docTypeLabel =
    invoice.type === "SALES_RETURN"
      ? "Sales Return (CN)"
      : invoice.type === "PURCHASE_RETURN"
      ? "Purchase Return (DN)"
      : invoice.type === "PURCHASE"
      ? "Purchase Bill"
      : "Invoice";

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/invoices/${invoice.id}`}
            className="btn-secondary text-xs sm:text-sm inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Bill</span>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>Edit {docTypeLabel}</span>
              <span className="font-mono text-sm bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                #{invoice.invoiceNo}
              </span>
            </h1>
            <p className="text-xs text-slate-500">Update party details, line items, and quantities</p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Updating...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Update Bill</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Bill updated successfully! Redirecting...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bill Meta Card */}
        <div className="card p-6 bg-white shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            Party & Document Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">
                {invoice.type === "PURCHASE" ? "Vendor / Supplier *" : "Party / Customer *"}
              </label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="input"
              >
                <option value="">Cash / Direct (No Account)</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.gstin ? `(GSTIN: ${p.gstin})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Bill Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="input"
              />
            </div>

            <div>
              <label className="label">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="label">Order / Reference No</label>
              <input
                type="text"
                placeholder="e.g. PO-2026-0001"
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Salesperson</label>
              <input
                type="text"
                placeholder="Salesperson name"
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Bill Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input font-semibold"
              >
                <option value="POSTED">POSTED (Active)</option>
                <option value="PAID">PAID</option>
                <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                <option value="DRAFT">DRAFT</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="card p-6 bg-white shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              Line Items & Products
            </h3>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Item Description</th>
                  <th className="py-2.5 px-3 w-24">HSN</th>
                  <th className="py-2.5 px-3 w-20 text-right">Qty</th>
                  <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
                  <th className="py-2.5 px-3 w-20 text-right">Disc %</th>
                  <th className="py-2.5 px-3 w-20 text-right">GST %</th>
                  <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => {
                  const it = items.find((i) => i.id === line.itemId);
                  const isSalesDoc = invoice.type !== "PURCHASE" && invoice.type !== "PURCHASE_RETURN";
                  let maxAllowedStock: number | null = null;
                  let isOverStock = false;

                  if (isSalesDoc && it && it.type !== "SERVICE") {
                    const prevQty = (invoice.lines || [])
                      .filter((orig: any) => orig.itemId === line.itemId)
                      .reduce((sum: number, orig: any) => sum + Number(orig.qty || 0), 0);
                    maxAllowedStock = Number(it.stock || 0) + prevQty;
                    const totalItemQty = lines
                      .filter((l) => l.itemId === line.itemId)
                      .reduce((sum, l) => sum + Number(l.qty || 0), 0);
                    isOverStock = maxAllowedStock !== null && totalItemQty > maxAllowedStock;
                  }

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 space-y-1">
                        {items.length > 0 && (
                          <select
                            value={line.itemId || ""}
                            onChange={(e) => handleSelectItem(idx, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 mb-1"
                          >
                            <option value="">— Choose from Catalog —</option>
                            {items.map((catItem) => (
                              <option key={catItem.id} value={catItem.id}>
                                {catItem.name} (₹{catItem.salePrice || catItem.purchasePrice}) • Stock: {Number(catItem.stock || 0)} {catItem.unit || "PCS"}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          placeholder="Item name"
                          value={line.name}
                          onChange={(e) => updateLine(idx, "name", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-900"
                          required
                        />
                        {maxAllowedStock !== null && (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            {isOverStock ? (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                Stock Exceeded: Max {maxAllowedStock} {line.unit}
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                Available Stock: {maxAllowedStock} {line.unit}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          placeholder="HSN"
                          value={line.hsn || ""}
                          onChange={(e) => updateLine(idx, "hsn", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={line.qty}
                          onChange={(e) => updateLine(idx, "qty", parseFloat(e.target.value) || 0)}
                          className={`w-full rounded-lg border px-2 py-1 text-xs text-right font-semibold transition-colors ${
                            isOverStock
                              ? "border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-500 focus:ring-rose-500/20"
                              : "border-slate-200 bg-white text-slate-900 focus:border-emerald-500"
                          }`}
                          required
                        />
                        {isOverStock && maxAllowedStock !== null && (
                          <div className="text-[10px] font-bold text-rose-600 text-right mt-0.5">
                            Max: {maxAllowedStock}
                          </div>
                        )}
                      </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.rate}
                        onChange={(e) => updateLine(idx, "rate", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-right font-semibold"
                        required
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={line.discount}
                        onChange={(e) => updateLine(idx, "discount", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <select
                        value={line.gstRate}
                        onChange={(e) => updateLine(idx, "gstRate", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-right font-medium"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(line.amount)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        disabled={lines.length <= 1}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"
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
        </div>

        {/* Bottom Totals & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="card p-5 bg-white space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Notes & Terms</h4>
            <div>
              <label className="label">Customer / Bill Notes</label>
              <textarea
                rows={3}
                placeholder="Notes visible to customer..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="label">Payment Terms</label>
              <input
                type="text"
                placeholder="e.g. Net 30 days"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="input text-xs"
              />
            </div>
          </div>

          <div className="card p-5 bg-white space-y-2 text-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
              Payment & Tax Summary
            </h4>
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatCurrency(totals.subTotal)}</span>
            </div>
            {isInterState ? (
              <div className="flex justify-between text-slate-600">
                <span>IGST:</span>
                <span className="font-semibold">{formatCurrency(totals.igst)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>CGST:</span>
                  <span className="font-semibold">{formatCurrency(totals.cgst)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST:</span>
                  <span className="font-semibold">{formatCurrency(totals.sgst)}</span>
                </div>
              </>
            )}
            {Math.abs(totals.roundOff) > 0.001 && (
              <div className="flex justify-between text-slate-600">
                <span>Round Off:</span>
                <span className="font-semibold">{formatCurrency(totals.roundOff)}</span>
              </div>
            )}
            <div className="flex justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 text-base font-bold text-emerald-950 border border-emerald-200 mt-2">
              <span>Grand Total:</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating Bill...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save All Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
