"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { exportToCSV } from "@/lib/exportCsv";
import {
  Users,
  Search,
  Plus,
  Download,
  CreditCard,
  MessageCircle,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  Building2,
  Calendar,
  Banknote,
  QrCode,
  FileText,
  Printer,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export interface PartyInvoice {
  id: string;
  invoiceNo: string;
  type: string;
  date: string;
  grandTotal: number;
  paidAmount: number;
  status: string;
}

export interface PartyItem {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  city: string | null;
  state: string | null;
  openingBalance: number;
  creditLimit: number | null;
  creditDays: number | null;
  receivable: number;
  payable: number;
  netBalance: number;
  unpaidInvoices: PartyInvoice[];
}

export default function PartiesClient({
  parties: initialParties,
  companyName,
}: {
  parties: PartyItem[];
  companyName: string;
}) {
  const [parties, setParties] = useState<PartyItem[]>(initialParties);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [balanceFilter, setBalanceFilter] = useState("ALL");

  // Payment Settle Modal State
  const [activeParty, setActiveParty] = useState<PartyItem | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "BANK" | "CHEQUE">("CASH");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [chequeNo, setChequeNo] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Receipt Modal State
  const [successReceipt, setSuccessReceipt] = useState<{
    paymentNo: string;
    partyName: string;
    partyPhone?: string | null;
    amount: number;
    mode: string;
    date: string;
    newBalance: number;
    type: string;
  } | null>(null);

  // Totals & KPI Metrics
  const metrics = useMemo(() => {
    let totalCustomers = 0;
    let totalVendors = 0;
    let totalReceivables = 0;
    let totalPayables = 0;

    parties.forEach((p) => {
      if (p.type === "CUSTOMER" || p.type === "BOTH") totalCustomers++;
      if (p.type === "VENDOR" || p.type === "BOTH") totalVendors++;
      if (p.receivable > 0) totalReceivables += p.receivable;
      if (p.payable > 0) totalPayables += p.payable;
    });

    return {
      totalCount: parties.length,
      totalCustomers,
      totalVendors,
      totalReceivables,
      totalPayables,
    };
  }, [parties]);

  // Filtered List
  const filteredParties = useMemo(() => {
    const q = search.toLowerCase().trim();
    return parties.filter((p) => {
      const matchType =
        typeFilter === "ALL" ||
        p.type === typeFilter ||
        (typeFilter === "CUSTOMER" && p.type === "BOTH") ||
        (typeFilter === "VENDOR" && p.type === "BOTH");

      let matchBalance = true;
      if (balanceFilter === "DUE") {
        matchBalance = (p.type === "CUSTOMER" ? p.receivable : p.payable) > 0;
      } else if (balanceFilter === "SETTLED") {
        matchBalance = (p.type === "CUSTOMER" ? p.receivable : p.payable) <= 0;
      }

      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.phone && p.phone.toLowerCase().includes(q)) ||
        (p.gstin && p.gstin.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q));

      return matchType && matchBalance && matchSearch;
    });
  }, [parties, search, typeFilter, balanceFilter]);

  // Open Settle Modal
  const openSettleModal = (party: PartyItem) => {
    setActiveParty(party);
    const defaultDue =
      party.type === "CUSTOMER"
        ? party.receivable
        : party.type === "VENDOR"
        ? party.payable
        : Math.abs(party.netBalance);

    setAmount(defaultDue > 0 ? defaultDue.toString() : "");
    setPaymentMode("CASH");
    setReference("");
    setChequeNo("");
    setChequeDate("");
    setNotes("");
    setModalError("");
  };

  // Live Auto-allocation calculation (FIFO)
  const allocationPreview = useMemo(() => {
    if (!activeParty) return { allocations: [], unallocated: 0 };
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return { allocations: [], unallocated: 0 };

    let remaining = amt;
    const allocs: Array<{ invoice: PartyInvoice; amount: number }> = [];

    // Filter matching unpaid invoices
    const isCustomer = activeParty.type === "CUSTOMER" || activeParty.netBalance > 0;
    const relevantInvoices = activeParty.unpaidInvoices.filter((inv) =>
      isCustomer ? inv.type === "SALES" : inv.type === "PURCHASE"
    );

    for (const inv of relevantInvoices) {
      if (remaining <= 0) break;
      const due = Math.max(0, inv.grandTotal - inv.paidAmount);
      if (due <= 0) continue;

      const take = Math.min(remaining, due);
      allocs.push({ invoice: inv, amount: Math.round(take * 100) / 100 });
      remaining -= take;
    }

    return {
      allocations: allocs,
      unallocated: Math.max(0, Math.round(remaining * 100) / 100),
    };
  }, [activeParty, amount]);

  // Submit Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeParty) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setModalError("Please enter a valid amount greater than 0.");
      return;
    }

    setIsSubmitting(true);
    setModalError("");

    try {
      const isCustomer = activeParty.type === "CUSTOMER" || activeParty.netBalance > 0;
      const targetType = isCustomer ? "RECEIPT" : "PAYMENT";

      const payload = {
        partyId: activeParty.id,
        amount: numAmount,
        date: paymentDate,
        mode: paymentMode,
        type: targetType,
        direction: isCustomer ? "RECEIVED" : "MADE",
        reference: reference.trim() || undefined,
        chequeNo: chequeNo.trim() || undefined,
        chequeDate: chequeDate || undefined,
        notes: notes.trim() || undefined,
        allocations: allocationPreview.allocations.map((a) => ({
          invoiceId: a.invoice.id,
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
        throw new Error(data.error || "Failed to record payment");
      }

      // Update state locally
      const oldReceivable = activeParty.receivable;
      const oldPayable = activeParty.payable;
      const newReceivable = isCustomer ? Math.max(0, oldReceivable - numAmount) : oldReceivable;
      const newPayable = !isCustomer ? Math.max(0, oldPayable - numAmount) : oldPayable;
      const newNet = isCustomer ? newReceivable : -newPayable;

      setParties((prev) =>
        prev.map((p) => {
          if (p.id !== activeParty.id) return p;
          return {
            ...p,
            receivable: newReceivable,
            payable: newPayable,
            netBalance: newNet,
            unpaidInvoices: p.unpaidInvoices
              .map((inv) => {
                const matchedAlloc = allocationPreview.allocations.find(
                  (a) => a.invoice.id === inv.id
                );
                if (!matchedAlloc) return inv;
                const updatedPaid = inv.paidAmount + matchedAlloc.amount;
                return {
                  ...inv,
                  paidAmount: updatedPaid,
                  status: updatedPaid >= inv.grandTotal ? "PAID" : "PARTIALLY_PAID",
                };
              })
              .filter((inv) => inv.paidAmount < inv.grandTotal),
          };
        })
      );

      // Open Success Receipt
      setSuccessReceipt({
        paymentNo: data.payment?.paymentNo || `REC-${Date.now().toString().slice(-5)}`,
        partyName: activeParty.name,
        partyPhone: activeParty.phone,
        amount: numAmount,
        mode: paymentMode,
        date: new Date(paymentDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        newBalance: isCustomer ? newReceivable : newPayable,
        type: targetType,
      });

      setActiveParty(null);
    } catch (err: any) {
      setModalError(err.message || "Failed to settle payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  // WhatsApp Reminder Link
  const getWhatsAppReminderUrl = (party: PartyItem) => {
    const cleanPhone = party.phone ? party.phone.replace(/\D/g, "") : "";
    const phoneNum = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const dueAmt = party.type === "CUSTOMER" ? party.receivable : party.payable;

    const message = encodeURIComponent(
      `Dear ${party.name},\n\nGreetings from ${companyName}!\n` +
        `This is a gentle reminder that your pending balance is ${formatCurrency(dueAmt)}.\n\n` +
        `Kindly clear the dues at your convenience. Thank you!`
    );
    return `https://wa.me/${phoneNum}?text=${message}`;
  };

  // WhatsApp Receipt Link
  const getWhatsAppReceiptUrl = () => {
    if (!successReceipt) return "#";
    const cleanPhone = successReceipt.partyPhone ? successReceipt.partyPhone.replace(/\D/g, "") : "";
    const phoneNum = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const message = encodeURIComponent(
      `Dear ${successReceipt.partyName},\n\n` +
        `Payment Received with thanks!\n\n` +
        `🧾 Receipt No: ${successReceipt.paymentNo}\n` +
        `💵 Amount: ${formatCurrency(successReceipt.amount)}\n` +
        `📅 Date: ${successReceipt.date}\n` +
        `💳 Mode: ${successReceipt.mode}\n` +
        `📊 Remaining Balance: ${formatCurrency(successReceipt.newBalance)}\n\n` +
        `Thank you for your business! - ${companyName}`
    );
    return `https://wa.me/${phoneNum}?text=${message}`;
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      "Party Name",
      "Type",
      "Phone",
      "GSTIN",
      "City",
      "Pending Receivable (To Collect)",
      "Pending Payable (To Pay)",
    ];
    const rows = filteredParties.map((p) => [
      p.name,
      p.type,
      p.phone || "",
      p.gstin || "",
      p.city || "",
      p.receivable,
      p.payable,
    ]);
    exportToCSV("taily_parties_khata", headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-600" /> Parties & Khata Directory
          </h1>
          <p className="text-sm text-slate-500">
            Track customer receivables, vendor payables, and 1-click balance settlements
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" /> Export CSV
          </button>
          <Link
            href="/parties/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/20 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" /> Add New Party
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Parties</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.totalCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {metrics.totalCustomers} Customers • {metrics.totalVendors} Vendors
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              To Collect (Receivables)
            </p>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">
            {formatCurrency(metrics.totalReceivables)}
          </p>
          <p className="text-[11px] text-emerald-700/80 mt-0.5">Pending from customers</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              To Pay (Payables)
            </p>
            <TrendingDown className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">
            {formatCurrency(metrics.totalPayables)}
          </p>
          <p className="text-[11px] text-amber-700/80 mt-0.5">Pending to suppliers</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Net Business Position</p>
          <p
            className={`mt-1 text-2xl font-extrabold ${
              metrics.totalReceivables >= metrics.totalPayables ? "text-slate-900" : "text-amber-700"
            }`}
          >
            {formatCurrency(metrics.totalReceivables - metrics.totalPayables)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Receivables minus Payables</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search party by name, phone, GSTIN, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs font-medium outline-none bg-transparent"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 bg-white"
          >
            <option value="ALL">All Types</option>
            <option value="CUSTOMER">Customers</option>
            <option value="VENDOR">Vendors / Suppliers</option>
            <option value="BOTH">Both</option>
          </select>

          {/* Balance Filter */}
          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 bg-white"
          >
            <option value="ALL">All Balances</option>
            <option value="DUE">Pending Dues Only</option>
            <option value="SETTLED">Settled (₹0 Due)</option>
          </select>
        </div>
      </div>

      {/* Parties Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Party Details</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Phone & City</th>
                <th className="px-4 py-3.5">GSTIN</th>
                <th className="px-4 py-3.5 text-right">Khata Outstanding</th>
                <th className="px-5 py-3.5 text-right">Quick Settle & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No parties found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {search ? `No results matching "${search}"` : "Add your first customer or vendor"}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredParties.map((p) => {
                  const isCustomer = p.type === "CUSTOMER" || (p.type === "BOTH" && p.receivable > 0);
                  const due = isCustomer ? p.receivable : p.payable;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/parties/${p.id}`}
                          className="font-bold text-slate-900 hover:text-brand-600 transition-colors"
                        >
                          {p.name}
                        </Link>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            p.type === "CUSTOMER"
                              ? "bg-blue-100 text-blue-800"
                              : p.type === "VENDOR"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-teal-100 text-teal-800"
                          }`}
                        >
                          {p.type}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="font-medium text-slate-800">{p.phone || "—"}</p>
                        {p.city && <p className="text-[10px] text-slate-400">{p.city}</p>}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {p.gstin || "—"}
                      </td>

                      {/* Outstanding Khata */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {due > 0 ? (
                          <div className="flex flex-col items-end">
                            <span
                              className={`text-xs font-extrabold ${
                                isCustomer ? "text-emerald-700" : "text-amber-700"
                              }`}
                            >
                              {formatCurrency(due)}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                                isCustomer
                                  ? "bg-emerald-50 text-emerald-800"
                                  : "bg-amber-50 text-amber-800"
                              }`}
                            >
                              {isCustomer ? "To Collect" : "To Pay"}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Settled
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* 1-Click Settle Button */}
                          <button
                            type="button"
                            onClick={() => openSettleModal(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-[11px] font-bold transition-all shadow-2xs"
                            title="Settle payment"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>{isCustomer ? "Receive" : "Pay"}</span>
                          </button>

                          {/* WhatsApp Reminder (for customers with dues) */}
                          {p.phone && due > 0 && isCustomer && (
                            <a
                              href={getWhatsAppReminderUrl(p)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Send WhatsApp Payment Reminder"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          )}

                          {/* Profile Link */}
                          <Link
                            href={`/parties/${p.id}`}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="360° Profile"
                          >
                            <FileText className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Settle Payment Modal */}
      {activeParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-brand-600" />
                  <span>
                    {activeParty.type === "CUSTOMER" ? "Receive Customer Payment" : "Settle Vendor Payment"}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Party: <strong className="text-slate-800">{activeParty.name}</strong> • Current Due:{" "}
                  <strong className="text-brand-600">
                    {formatCurrency(
                      activeParty.type === "CUSTOMER"
                        ? activeParty.receivable
                        : activeParty.payable
                    )}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveParty(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
              {/* Amount & Presets */}
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
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 pl-7 pr-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-brand-500"
                  />
                </div>

                {/* Preset Button: Full Due */}
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAmount(
                        (activeParty.type === "CUSTOMER"
                          ? activeParty.receivable
                          : activeParty.payable
                        ).toString()
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700"
                  >
                    Exact Balance (
                    {formatCurrency(
                      activeParty.type === "CUSTOMER"
                        ? activeParty.receivable
                        : activeParty.payable
                    )}
                    )
                  </button>
                </div>
              </div>

              {/* FIFO Allocation Preview */}
              {allocationPreview.allocations.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Automatic Bill Allocation (FIFO):
                  </p>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {allocationPreview.allocations.map((a) => (
                      <div
                        key={a.invoice.id}
                        className="flex justify-between text-[11px] text-slate-600"
                      >
                        <span>
                          {a.invoice.invoiceNo} (
                          {new Date(a.invoice.date).toLocaleDateString("en-IN")}):
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(a.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {allocationPreview.unallocated > 0 && (
                    <p className="text-[10px] text-emerald-700 font-semibold pt-1 border-t border-slate-200">
                      Remaining {formatCurrency(allocationPreview.unallocated)} will be credited as
                      Account Advance.
                    </p>
                  )}
                </div>
              )}

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Payment Method
                </label>
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

              {/* Payment Date & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Date
                  </label>
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
                    {paymentMode === "UPI"
                      ? "UPI Ref / UTR #"
                      : paymentMode === "BANK"
                      ? "Bank Transaction #"
                      : "Reference #"}
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

              {/* Cheque details if CHEQUE mode */}
              {paymentMode === "CHEQUE" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-purple-50/50 border border-purple-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cheque Number
                    </label>
                    <input
                      type="text"
                      value={chequeNo}
                      onChange={(e) => setChequeNo(e.target.value)}
                      placeholder="e.g. 000452"
                      className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-brand-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cheque Date
                    </label>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes / Narration (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Cleared pending dues via GooglePay"
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-brand-500"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveParty(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSubmitting ? "Settling..." : "Confirm & Settle Payment"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Receipt Modal */}
      {successReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Payment Settle Successful!</h3>
              <p className="text-xs text-slate-500">
                Receipt #{successReceipt.paymentNo} generated & ledger updated.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Party:</span>
                <span className="font-bold text-slate-900">{successReceipt.partyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-extrabold text-emerald-700 text-sm">
                  {formatCurrency(successReceipt.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-medium text-slate-900">{successReceipt.mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-medium text-slate-900">{successReceipt.date}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">Remaining Balance:</span>
                <span className="font-bold text-slate-900">
                  {formatCurrency(successReceipt.newBalance)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {successReceipt.partyPhone && (
                <a
                  href={getWhatsAppReceiptUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Send WhatsApp Receipt</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setSuccessReceipt(null)}
                className="w-full py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
