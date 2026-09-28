"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/currency";
import { CreditCard, CheckCircle2, DollarSign, Wallet, X } from "lucide-react";

export default function PaymentForm({
  invoiceId,
  invoiceNo,
  grandTotal,
  paidAmount,
  direction = "RECEIVE",
}: {
  invoiceId: string;
  invoiceNo: string;
  grandTotal: string;
  paidAmount: string;
  direction?: "RECEIVE" | "MADE";
}) {
  const router = useRouter();
  const isMade = direction === "MADE";
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("CASH");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const balance = parseFloat(grandTotal) - parseFloat(paidAmount);
  const buttonLabel = isMade ? "Pay Vendor" : "Receive Payment";
  const formTitle = isMade ? `Pay Vendor for ${invoiceNo}` : `Receive Payment for ${invoiceNo}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, amount, date, mode, reference, direction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Payment summary + trigger button */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-1.5">
          <span className="text-slate-500 font-medium">Total: </span>
          <span className="font-bold text-slate-800">{formatCurrency(grandTotal)}</span>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-1.5">
          <span className="text-slate-500 font-medium">Paid: </span>
          <span className="font-bold text-emerald-700">{formatCurrency(paidAmount)}</span>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-1.5">
          <span className="text-slate-500 font-medium">Balance: </span>
          <span className="font-bold text-amber-700">{formatCurrency(balance)}</span>
        </div>
        {balance > 0.01 && (
          <button
            onClick={() => {
              setAmount(balance.toFixed(2));
              setOpen(!open);
            }}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <CreditCard className="h-4 w-4" />
            {buttonLabel}
          </button>
        )}
        {balance <= 0.01 && (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 text-emerald-800 px-3 py-1.5 font-bold text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Fully Paid
          </span>
        )}
      </div>

      {/* Payment form modal */}
      {open && (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-5 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-brand-600" />
              {formTitle}
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Amount (₹) *</label>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                  Max ₹{balance.toFixed(2)}
                </span>
              </div>
              <input
                type="number"
                step="any"
                min="0.01"
                max={balance}
                className="input font-bold"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Max: ${balance.toFixed(2)}`}
                required
              />
            </div>
            <div>
              <label className="label">Payment Date *</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Payment Mode</label>
              <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="CASH">Cash in Hand</option>
                <option value="BANK">Bank Account</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <label className="label">Reference / Notes</label>
              <input
                type="text"
                className="input"
                placeholder="UPI ref / Cheque #..."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="sm:col-span-4 flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? "Recording..." : `Confirm ${isMade ? "Payment" : "Receipt"}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
