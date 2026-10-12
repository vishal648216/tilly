"use client";

import { useState, useMemo } from "react";
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
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  Banknote,
  QrCode,
  ArrowDownLeft,
  ArrowUpRight,
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
  contactPerson?: string | null;
  code?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  gstTreatment?: string | null;
  creditLimit?: number | string | null;
  creditDays?: number | null;
  paymentTerms?: string | null;
  priceList?: string | null;
  bankDetails?: string | null;
  salesperson?: string | null;
  notes?: string | null;
  tags?: string | null;
  customFields?: string | null;
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

interface PaymentHistoryItem {
  id: string;
  paymentNo: string;
  date: string;
  type: string;
  mode: string;
  amount: number;
  reference: string | null;
  notes: string | null;
  allocationsCount: number;
}

export default function PartyProfileClient({
  party,
  invoices: initialInvoices,
  payments: initialPayments,
  totalBilled,
  totalPaid: initialTotalPaid,
  balance: initialBalance,
  companyName,
}: {
  party: Party;
  invoices: Invoice[];
  payments: PaymentHistoryItem[];
  totalBilled: number;
  totalPaid: number;
  balance: number;
  companyName: string;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [payments, setPayments] = useState<PaymentHistoryItem[]>(initialPayments);
  const [totalPaid, setTotalPaid] = useState<number>(initialTotalPaid);
  const [balance, setBalance] = useState<number>(initialBalance);

  // Tab: INVOICES vs PAYMENTS
  const [activeTab, setActiveTab] = useState<"INVOICES" | "PAYMENTS">("INVOICES");

  // Payment Settle Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "BANK" | "CHEQUE">("CASH");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const cleanPhone = party.phone ? party.phone.replace(/\D/g, "") : "";
  const whatsappNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  // WhatsApp reminder message
  const whatsappMsg = encodeURIComponent(
    `Dear ${party.name},\n\nGreetings from ${companyName}!\nThis is a summary of your account with us:\n\n` +
      `📊 Total Billed: ${formatCurrency(totalBilled)}\n` +
      `💰 Total Paid: ${formatCurrency(totalPaid)}\n` +
      `⚠️ Outstanding Balance: ${formatCurrency(balance)}\n\n` +
      `Please clear the pending dues at your earliest convenience. Thank you!`
  );

  // Unpaid invoices list
  const unpaidInvoices = useMemo(() => {
    return invoices.filter((i) => {
      const g = parseFloat(i.grandTotal.toString());
      const p = parseFloat(i.paidAmount.toString());
      return p < g;
    });
  }, [invoices]);

  // FIFO auto-allocation calculation
  const allocationPreview = useMemo(() => {
    const amt = parseFloat(paymentAmount) || 0;
    if (amt <= 0) return { allocations: [], unallocated: 0 };

    if (selectedInvoice) {
      const grand = parseFloat(selectedInvoice.grandTotal.toString());
      const paid = parseFloat(selectedInvoice.paidAmount.toString());
      const remainingDue = Math.max(0, grand - paid);
      const allocAmt = Math.min(amt, remainingDue);
      return {
        allocations: [{ invoiceId: selectedInvoice.id, invoiceNo: selectedInvoice.invoiceNo, amount: allocAmt }],
        unallocated: Math.max(0, amt - allocAmt),
      };
    }

    // Auto-allocate across unpaid invoices from oldest to newest
    let remaining = amt;
    const allocs: Array<{ invoiceId: string; invoiceNo: string; amount: number }> = [];

    // Sort unpaid invoices by date asc
    const sorted = [...unpaidInvoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const inv of sorted) {
      if (remaining <= 0) break;
      const grand = parseFloat(inv.grandTotal.toString());
      const paid = parseFloat(inv.paidAmount.toString());
      const due = Math.max(0, grand - paid);
      if (due <= 0) continue;

      const take = Math.min(remaining, due);
      allocs.push({
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        amount: Math.round(take * 100) / 100,
      });
      remaining -= take;
    }

    return {
      allocations: allocs,
      unallocated: Math.max(0, Math.round(remaining * 100) / 100),
    };
  }, [paymentAmount, selectedInvoice, unpaidInvoices]);

  // Open Settle Modal for overall balance
  const openOverallSettleModal = () => {
    setSelectedInvoice(null);
    setPaymentAmount(balance > 0 ? balance.toString() : "");
    setPaymentMode("CASH");
    setReference("");
    setChequeNo("");
    setChequeDate("");
    setNotes("");
    setMsg("");
    setShowPaymentModal(true);
  };

  // Open Settle Modal for specific invoice
  const openInvoiceSettleModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    const grand = parseFloat(inv.grandTotal.toString());
    const paid = parseFloat(inv.paidAmount.toString());
    const remaining = Math.max(0, grand - paid);
    setPaymentAmount(remaining.toString());
    setPaymentMode("CASH");
    setReference("");
    setChequeNo("");
    setChequeDate("");
    setNotes("");
    setMsg("");
    setShowPaymentModal(true);
  };

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);

    if (isNaN(amt) || amt <= 0) {
      setMsg("Please enter a valid payment amount greater than 0.");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const isCustomer = party.type === "CUSTOMER" || party.type === "BOTH";
      const targetType = isCustomer ? "RECEIPT" : "PAYMENT";

      const payload = {
        partyId: party.id,
        amount: amt,
        date: paymentDate,
        mode: paymentMode,
        type: targetType,
        direction: isCustomer ? "RECEIVED" : "MADE",
        reference: reference.trim() || undefined,
        chequeNo: chequeNo.trim() || undefined,
        chequeDate: chequeDate || undefined,
        notes: notes.trim() || undefined,
        allocations: allocationPreview.allocations.map((a) => ({
          invoiceId: a.invoiceId,
          amount: a.amount,
        })),
      };

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Payment recording failed");
      }

      // Update state locally
      setTotalPaid((prev) => prev + amt);
      setBalance((prev) => Math.max(0, prev - amt));

      // Update invoices
      setInvoices((prev) =>
        prev.map((inv) => {
          const matched = allocationPreview.allocations.find((a) => a.invoiceId === inv.id);
          if (!matched) return inv;
          const currentPaid = parseFloat(inv.paidAmount.toString()) + matched.amount;
          const grand = parseFloat(inv.grandTotal.toString());
          return {
            ...inv,
            paidAmount: currentPaid,
            status: currentPaid >= grand ? "PAID" : "PARTIALLY_PAID",
          };
        })
      );

      // Add to payments list
      if (data.payment) {
        setPayments((prev) => [
          {
            id: data.payment.id,
            paymentNo: data.payment.paymentNo,
            date: paymentDate,
            type: targetType,
            mode: paymentMode,
            amount: amt,
            reference: reference || null,
            notes: notes || null,
            allocationsCount: allocationPreview.allocations.length,
          },
          ...prev,
        ]);
      }

      setShowPaymentModal(false);
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
                    : party.type === "VENDOR"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-teal-100 text-teal-800"
                }`}
              >
                {party.type}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">360° Profile, Invoices & Khata Settlement</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Settle Balance Button */}
          <button
            type="button"
            onClick={openOverallSettleModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-brand-600/20 hover:bg-brand-700 active:scale-95 transition-all"
          >
            <CreditCard className="h-4 w-4" />
            <span>{party.type === "CUSTOMER" ? "Receive Payment" : "Settle Balance"}</span>
          </button>

          {whatsappNumber && balance > 0 && (
            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp Reminder
            </a>
          )}
          <Link
            href={`/ledger?partyId=${party.id}`}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <BookOpen className="h-4 w-4 text-slate-500" /> Ledger
          </Link>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Billed</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(totalBilled)}</p>
          <p className="mt-1 text-xs text-slate-500">{invoices.length} transactions</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Settled / Paid</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
          <p className="mt-1 text-xs text-slate-500">{payments.length} receipts / payments</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-2xs">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Outstanding Balance</p>
          <p className={`mt-2 text-2xl font-extrabold ${balance > 0 ? "text-amber-700" : "text-slate-900"}`}>
            {formatCurrency(balance)}
          </p>
          <p className="mt-1 text-xs text-amber-700/80">{balance > 0 ? "Pending dues" : "All cleared"}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Opening Balance</p>
          <p className="mt-2 text-2xl font-bold text-slate-700">{formatCurrency(party.openingBalance)}</p>
          <p className="mt-1 text-xs text-slate-500">Ledger opening</p>
        </div>
      </div>

      {/* Details & Invoices Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-brand-600" /> Party Information
          </h2>

          <div className="space-y-3 text-xs">
            {party.code && (
              <div>
                <p className="text-slate-400">Account Code</p>
                <p className="font-semibold font-mono text-slate-800">{party.code}</p>
              </div>
            )}
            {party.contactPerson && (
              <div>
                <p className="text-slate-400">Contact Person</p>
                <p className="font-semibold text-slate-800">{party.contactPerson}</p>
              </div>
            )}
            <div>
              <p className="text-slate-400">Contact Number</p>
              <p className="font-semibold text-slate-800">{party.phone || "—"}</p>
            </div>
            <div>
              <p className="text-slate-400">Email Address</p>
              <p className="font-medium text-slate-800">{party.email || "—"}</p>
            </div>
            <div>
              <p className="text-slate-400">GSTIN / Tax ID</p>
              <p className="font-medium font-mono text-slate-800">
                {party.gstin || "Unregistered"}{" "}
                {party.gstTreatment && <span className="text-slate-400">({party.gstTreatment})</span>}
              </p>
            </div>
            {party.address && (
              <div>
                <p className="text-slate-400">Address</p>
                <p className="font-medium text-slate-800">
                  {party.address}
                  {party.city ? `, ${party.city}` : ""}
                  {party.state ? `, ${party.state}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tabbed Invoices & Payments (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab Selector */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("INVOICES")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "INVOICES"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Invoices & Bills ({invoices.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("PAYMENTS")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "PAYMENTS"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Payment & Receipt History ({payments.length})
            </button>
          </div>

          {activeTab === "INVOICES" ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Bill #</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Grand Total</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Due</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                          No invoices found for this party.
                        </td>
                      </tr>
                    ) : (
                      invoices.map((inv) => {
                        const grand = parseFloat(inv.grandTotal.toString());
                        const paid = parseFloat(inv.paidAmount.toString());
                        const due = Math.max(0, grand - paid);

                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-5 py-3 font-bold text-brand-600 font-mono">
                              <Link href={`/invoices/${inv.id}`} className="hover:underline">
                                {inv.invoiceNo}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {new Date(inv.date).toLocaleDateString("en-IN")}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-900">
                              {formatCurrency(grand)}
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                              {formatCurrency(paid)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">
                              {formatCurrency(due)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  inv.status === "PAID"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : due > 0
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              {due > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => openInvoiceSettleModal(inv)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-[11px] font-bold shadow-2xs transition-all"
                                >
                                  <CreditCard className="h-3 w-3" /> Pay
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">Settled</span>
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
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Receipt / Pay #</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-5 py-3 text-center">Settled Bills</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                          No payment receipts recorded yet.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3 font-bold font-mono text-slate-900">
                            {p.paymentNo}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {new Date(p.date).toLocaleDateString("en-IN")}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {p.mode}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                            {p.reference || "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-emerald-700">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="px-5 py-3 text-center text-slate-500">
                            {p.allocationsCount} {p.allocationsCount === 1 ? "bill" : "bills"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settle Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-brand-600" />
                  <span>
                    {selectedInvoice
                      ? `Settle Bill #${selectedInvoice.invoiceNo}`
                      : party.type === "CUSTOMER"
                      ? "Receive Customer Payment"
                      : "Settle Vendor Payment"}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Party: <strong className="text-slate-800">{party.name}</strong> • Outstanding:{" "}
                  <strong className="text-brand-600">{formatCurrency(balance)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {msg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{msg}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 pl-7 pr-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* FIFO Allocation Preview */}
              {!selectedInvoice && allocationPreview.allocations.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Automatic Bill Allocation (FIFO):
                  </p>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {allocationPreview.allocations.map((a) => (
                      <div key={a.invoiceId} className="flex justify-between text-[11px] text-slate-600">
                        <span>{a.invoiceNo}:</span>
                        <span className="font-bold text-slate-900">{formatCurrency(a.amount)}</span>
                      </div>
                    ))}
                  </div>
                  {allocationPreview.unallocated > 0 && (
                    <p className="text-[10px] text-emerald-700 font-semibold pt-1 border-t border-slate-200">
                      Remaining {formatCurrency(allocationPreview.unallocated)} will be credited as Account Advance.
                    </p>
                  )}
                </div>
              )}

              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["CASH", "UPI", "BANK", "CHEQUE"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMode(m)}
                      className={`py-2 px-2 rounded-xl border text-center font-bold text-xs transition-all ${
                        paymentMode === m
                          ? "border-brand-600 bg-brand-50 text-brand-700 shadow-2xs"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-brand-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {paymentMode === "UPI" ? "UPI Ref / UTR #" : paymentMode === "BANK" ? "Transaction #" : "Reference #"}
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Optional reference"
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              {/* Cheque Details if CHEQUE */}
              {paymentMode === "CHEQUE" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-purple-50/50 border border-purple-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cheque Number</label>
                    <input
                      type="text"
                      value={chequeNo}
                      onChange={(e) => setChequeNo(e.target.value)}
                      placeholder="e.g. 000452"
                      className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-brand-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cheque Date</label>
                    <input
                      type="date"
                      value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-brand-500 font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Narration (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Cleared pending dues"
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-brand-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{loading ? "Recording..." : "Confirm & Save Payment"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
