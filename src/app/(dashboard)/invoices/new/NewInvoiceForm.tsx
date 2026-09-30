"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { roundTo2 } from "@/lib/currency";
import { Plus, Trash2, UserPlus, X, AlertCircle, CheckCircle2 } from "lucide-react";

type Party = { id: string; name: string; state: string | null; gstin: string | null; phone?: string | null };
type Item = {
  id: string;
  name: string;
  sku: string | null;
  hsn: string | null;
  salePrice: typeof import("@prisma/client/runtime/library").Decimal;
  gstRate: typeof import("@prisma/client/runtime/library").Decimal;
  stock: typeof import("@prisma/client/runtime/library").Decimal;
};

type Line = {
  key: number;
  itemId: string;
  name: string;
  hsn: string;
  qty: number;
  rate: number;
  gstRate: number;
};

const emptyLine: Line = { key: 0, itemId: "", name: "", hsn: "", qty: 1, rate: 0, gstRate: 0 };

export default function NewInvoiceForm({
  parties,
  items,
  companyState,
  invoiceType = "SALES",
}: {
  parties: Party[];
  items: any[];
  companyState: string | null;
  invoiceType?: "SALES" | "PURCHASE";
}) {
  const router = useRouter();
  const isPurchase = invoiceType === "PURCHASE";
  const [partiesList, setPartiesList] = useState<Party[]>(parties);
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine, key: Date.now() }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Quick Add Party Modal state
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [partySuccessMsg, setPartySuccessMsg] = useState("");
  const [newPartyData, setNewPartyData] = useState({
    name: "",
    phone: "",
    gstin: "",
    state: companyState || "",
    address: "",
  });

  async function handleQuickCreateParty(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");
    const cleanName = newPartyData.name.trim();
    if (!cleanName || cleanName.length < 2) {
      setModalError("Party name must be at least 2 characters long.");
      return;
    }
    const cleanPhone = newPartyData.phone.replace(/\D/g, "");
    if (newPartyData.phone && cleanPhone.length !== 10) {
      setModalError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (newPartyData.gstin && newPartyData.gstin.trim().length !== 15) {
      setModalError("GSTIN must be 15 alphanumeric characters (e.g. 27ABCDE1234F1Z5).");
      return;
    }

    setModalLoading(true);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          type: isPurchase ? "VENDOR" : "CUSTOMER",
          phone: cleanPhone || null,
          gstin: newPartyData.gstin ? newPartyData.gstin.trim().toUpperCase() : null,
          state: newPartyData.state ? newPartyData.state.trim() : null,
          address: newPartyData.address ? newPartyData.address.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create party");

      const created: Party = {
        id: data.party.id,
        name: data.party.name,
        state: data.party.state,
        gstin: data.party.gstin,
        phone: data.party.phone,
      };

      setPartiesList((prev) => [created, ...prev]);
      setPartyId(created.id);
      setShowAddPartyModal(false);
      setNewPartyData({
        name: "",
        phone: "",
        gstin: "",
        state: companyState || "",
        address: "",
      });
      setPartySuccessMsg(`${isPurchase ? "Vendor" : "Customer"} "${created.name}" created and selected!`);
      setTimeout(() => setPartySuccessMsg(""), 5000);
    } catch (err: any) {
      setModalError(err.message || "Failed to save party");
    } finally {
      setModalLoading(false);
    }
  }

  const selectedParty = partiesList.find((p) => p.id === partyId);
  // Inter-state if company & party are in different states (and both have GST)
  const isInterState = useMemo(() => {
    if (!companyState || !selectedParty?.state) return false;
    return companyState.toLowerCase() !== selectedParty.state.toLowerCase();
  }, [companyState, selectedParty]);

  // Live GST calc
  const totals = useMemo(() => {
    let subTotal = 0,
      cgst = 0,
      sgst = 0,
      igst = 0;
    for (const l of lines) {
      const amt = roundTo2(l.qty * l.rate);
      const gst = roundTo2((amt * l.gstRate) / 100);
      subTotal += amt;
      if (isInterState) igst += gst;
      else {
        cgst += roundTo2(gst / 2);
        sgst += roundTo2(gst / 2);
      }
    }
    const beforeRound = roundTo2(subTotal + cgst + sgst + igst);
    const grand = Math.round(beforeRound);
    return { subTotal, cgst, sgst, igst, roundOff: roundTo2(grand - beforeRound), grand };
  }, [lines, isInterState]);

  function addLine() {
    setLines((ls) => [...ls, { ...emptyLine, key: Date.now() + Math.random() }]);
  }
  function removeLine(key: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }
  function updateLine(key: number, field: keyof Line, value: any) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }
  function selectItem(key: number, itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      updateLine(key, "itemId", itemId);
      updateLine(key, "name", item.name);
      updateLine(key, "hsn", item.hsn || "");
      // Purchase uses purchasePrice, Sales uses salePrice
      updateLine(key, "rate", isPurchase ? parseFloat(item.purchasePrice) : parseFloat(item.salePrice));
      updateLine(key, "gstRate", parseFloat(item.gstRate));
    } else {
      updateLine(key, "itemId", "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const validLines = lines.filter((l) => l.name && l.qty > 0 && l.rate >= 0);
    if (validLines.length === 0) {
      setError("Please add at least one item with valid quantity and rate.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: invoiceType,
          partyId: partyId || null,
          date,
          isInterState,
          notes,
          lines: validLines.map((l) => ({
            itemId: l.itemId || undefined,
            name: l.name,
            hsn: l.hsn,
            qty: l.qty,
            rate: l.rate,
            gstRate: l.gstRate,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push("/invoices");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {isPurchase && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs text-emerald-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            <strong>Inventory Auto-Sync Active:</strong> When you save this purchase bill, items will be automatically updated or added to your <strong>Items & Inventory</strong> list.
          </span>
        </div>
      )}

      {partySuccessMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{partySuccessMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {isPurchase ? "Vendor / Supplier" : "Customer / Party"}
            </label>
            <button
              type="button"
              onClick={() => {
                setModalError("");
                setShowAddPartyModal(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ New {isPurchase ? "Vendor" : "Customer"}</span>
            </button>
          </div>
          <select className="input" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">— Select {isPurchase ? "Vendor" : "Customer"} —</option>
            {partiesList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.gstin ? `(${p.gstin.slice(0, 5)}...)` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Invoice Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label">GST Type</label>
          <div className="input flex items-center bg-slate-50">
            {isInterState ? " interstate → IGST" : "Intra-state → CGST + SGST"}
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">HSN</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
              <th className="px-3 py-2 text-right font-medium">GST%</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const amt = roundTo2(line.qty * line.rate);
              return (
                <tr key={line.key} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    {items.length > 0 ? (
                      <select
                        className="input min-w-[160px]"
                        value={line.itemId}
                        onChange={(e) => selectItem(line.key, e.target.value)}
                      >
                        <option value="">Custom / New Item</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <input
                      className="input mt-1"
                      placeholder="Item name"
                      value={line.name}
                      onChange={(e) => updateLine(line.key, "name", e.target.value)}
                    />
                    {isPurchase && !line.itemId && line.name.trim() && (
                      <span className="inline-block mt-1 text-[11px] text-emerald-600 font-medium">
                        ✨ Will auto-add to Item list
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="input w-24"
                      value={line.hsn}
                      onChange={(e) => updateLine(line.key, "hsn", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input w-20 text-right"
                      value={line.qty}
                      onChange={(e) => updateLine(line.key, "qty", parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input w-24 text-right"
                      value={line.rate}
                      onChange={(e) => updateLine(line.key, "rate", parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="input w-20"
                      value={line.gstRate}
                      onChange={(e) => updateLine(line.key, "gstRate", parseFloat(e.target.value))}
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-medium">₹{amt.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" onClick={addLine} className="m-3 btn-secondary text-sm inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Add Line
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <label className="label">Notes (optional)</label>
          <textarea
            className="input min-h-[100px]"
            placeholder="Payment terms, delivery notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="card p-5">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span>₹{totals.subTotal.toFixed(2)}</span>
            </div>
            {isInterState ? (
              <div className="flex justify-between">
                <span className="text-slate-500">IGST</span>
                <span>₹{totals.igst.toFixed(2)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">CGST</span>
                  <span>₹{totals.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SGST</span>
                  <span>₹{totals.sgst.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Round Off</span>
              <span>₹{totals.roundOff.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
              <span>Grand Total</span>
              <span className="text-brand-700">₹{totals.grand.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save Invoice"}
        </button>
        <button type="button" onClick={() => router.push("/invoices")} className="btn-secondary">
          Cancel
        </button>
      </div>

      {/* Quick Add Customer / Vendor Modal */}
      {showAddPartyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Add New {isPurchase ? "Vendor" : "Customer"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Quickly register and select for this bill
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddPartyModal(false);
                  setModalError("");
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs text-red-700 flex items-center gap-2 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  {isPurchase ? "Vendor / Supplier Name" : "Customer Name"} *
                </label>
                <input
                  type="text"
                  className="input mt-1 w-full"
                  placeholder={isPurchase ? "e.g. Acme Supplier Ltd" : "e.g. Ramesh Sharma / Krishna Stores"}
                  value={newPartyData.name}
                  onChange={(e) => setNewPartyData((d) => ({ ...d, name: e.target.value }))}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Mobile Number (10 Digits)</label>
                <input
                  type="text"
                  maxLength={10}
                  className="input mt-1 w-full font-mono"
                  placeholder="e.g. 9876543210"
                  value={newPartyData.phone}
                  onChange={(e) => setNewPartyData((d) => ({ ...d, phone: e.target.value.replace(/\D/g, "") }))}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">GSTIN (Optional, 15 Chars)</label>
                <input
                  type="text"
                  maxLength={15}
                  className="input mt-1 w-full font-mono uppercase"
                  placeholder="e.g. 27ABCDE1234F1Z5"
                  value={newPartyData.gstin}
                  onChange={(e) => setNewPartyData((d) => ({ ...d, gstin: e.target.value.toUpperCase() }))}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">State / Region</label>
                <input
                  type="text"
                  className="input mt-1 w-full"
                  placeholder="e.g. Maharashtra, Gujarat, Delhi"
                  value={newPartyData.state}
                  onChange={(e) => setNewPartyData((d) => ({ ...d, state: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddPartyModal(false);
                  setModalError("");
                }}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalLoading}
                onClick={handleQuickCreateParty}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {modalLoading ? "Saving..." : `Save & Select ${isPurchase ? "Vendor" : "Customer"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
