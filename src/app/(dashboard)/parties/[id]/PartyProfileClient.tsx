"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { exportToCSV } from "@/lib/exportCsv";
import {
  ArrowLeft,
  MessageCircle,
  BookOpen,
  Download,
  Plus,
  X,
  CreditCard,
  Receipt,
  User,
  Phone,
  Mail,
  MapPin,
  Building,
  CheckCircle2,
} from "lucide-react";

interface Party {
  id: string;
  name: string;
  type: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  openingBalance: string | number;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  type: string;
  date: string;
  grandTotal: string | number;
  paidAmount: string | number;
  status: string;
  notes: string | null;
}

export default function PartyProfileClient({
  party,
  invoices,
  totalBilled,
  totalPaid,
  balance,
  companyName,
}: {
  party: Party;
  invoices: Invoice[];
  totalBilled: number;
  totalPaid: number;
  balance: number;
  companyName: string;
}) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const cleanPhone = party.phone ? party.phone.replace(/\D/g, "") : "";
  const whatsappNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  // WhatsApp formatted reminder message
  const whatsappMsg = encodeURIComponent(
    `Dear ${party.name},\n\nGreetings from ${companyName}!\nThis is a summary of your account with us:\n\n` +
      `📊 Total Billed: ${formatCurrency(totalBilled)}\n` +
      `💰 Total Paid: ${formatCurrency(totalPaid)}\n` +
      `⚠️ Outstanding Balance: ${formatCurrency(balance)}\n\n` +
      `Please clear the pending dues at your earliest convenience. Thank you!`
  );

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setMsg("Please enter a valid payment amount");
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: selectedInvoice.id,
          amount: amt,
          paymentMode,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment recording failed");
      window.location.reload();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    const headers = ["Invoice No", "Date", "Type", "Grand Total", "Paid Amount", "Outstanding", "Status"];
    const rows = invoices.map((inv) => {
      const grand = parseFloat(inv.grandTotal.toString());
      const paid = parseFloat(inv.paidAmount.toString());
      return [
        inv.invoiceNo,
        new Date(inv.date).toLocaleDateString("en-IN"),
        inv.type,
        grand,
        paid,
        grand - paid,
        inv.status,
      ];
    });
    exportToCSV(`party_statement_${party.name.replace(/\s+/g, "_")}`, headers, rows);
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/parties"
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{party.name}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  party.type === "CUSTOMER"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-purple-100 text-purple-800"
                }`}
              >
                {party.type}
              </span>
            </div>
            <p className="text-sm text-slate-500">Party 360° Profile & Outstanding Dashboard</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp Reminder
            </a>
          )}
          <Link
            href={`/ledger?partyId=${party.id}`}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <BookOpen className="h-4 w-4 text-slate-500" /> Ledger
          </Link>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Billed</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(totalBilled)}</p>
          <p className="mt-1 text-xs text-slate-500">{invoices.length} total transactions</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Paid</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
          <p className="mt-1 text-xs text-slate-500">Received / Settled</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Outstanding Balance</p>
          <p className={`mt-2 text-2xl font-bold ${balance > 0 ? "text-amber-600" : "text-slate-900"}`}>
            {formatCurrency(balance)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{balance > 0 ? "Pending dues" : "All cleared"}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Opening Balance</p>
          <p className="mt-2 text-2xl font-bold text-slate-700">{formatCurrency(party.openingBalance)}</p>
          <p className="mt-1 text-xs text-slate-500">Ledger opening</p>
        </div>
      </div>

      {/* Details & Invoices Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-brand-600" /> Party Information
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">Contact Number</p>
              <p className="font-semibold text-slate-800">{party.phone || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Email Address</p>
              <p className="font-medium text-slate-800">{party.email || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">GSTIN</p>
              <p className="font-medium font-mono text-slate-800">{party.gstin || "Unregistered"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">PAN Number</p>
              <p className="font-medium font-mono text-slate-800">{party.pan || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Billing Address</p>
              <p className="font-medium text-slate-800">
                {[party.address, party.city, party.state, party.pincode].filter(Boolean).join(", ") || "—"}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex gap-2">
            <Link
              href={party.type === "VENDOR" ? `/invoices/new?type=PURCHASE` : `/invoices/new`}
              className="w-full text-center rounded-xl bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Create {party.type === "VENDOR" ? "Purchase Bill" : "Sales Invoice"}
            </Link>
          </div>
        </div>

        {/* Invoices List */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-5 py-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-brand-600" /> Invoices & Bills
            </h2>
            <span className="text-xs text-slate-500 font-medium">{invoices.length} records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Pending</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No invoices found for this party.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const grand = parseFloat(inv.grandTotal.toString());
                    const paid = parseFloat(inv.paidAmount.toString());
                    const pending = grand - paid;
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-brand-600">
                          <Link href={`/invoices/${inv.id}`}>{inv.invoiceNo}</Link>
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {new Date(inv.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              inv.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800"
                                : inv.status === "PARTIAL"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatCurrency(grand)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-600">
                          {formatCurrency(paid)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {formatCurrency(pending)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {pending > 0 ? (
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setPaymentAmount(pending.toString());
                              }}
                              className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 hover:bg-brand-100 transition-colors"
                            >
                              Collect ₹
                            </button>
                          ) : (
                            <span className="text-xs text-emerald-600 font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payment Entry Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-brand-600" />
                Record Payment for {selectedInvoice.invoiceNo}
              </h3>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {msg && (
              <div className="mb-4 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                {msg}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                >
                  <option value="Cash">Cash in Hand</option>
                  <option value="Bank">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Notes / Reference No
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref #, Cheque No, Transaction ID"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading ? "Recording..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
