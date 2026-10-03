"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { exportToCSV } from "@/lib/exportCsv";
import {
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  Building2,
  Calendar,
  AlertTriangle,
  Download,
  Search,
  Filter,
} from "lucide-react";
import type { OutstandingReport } from "@/lib/outstanding";

export default function OutstandingClient({ report }: { report: OutstandingReport }) {
  const [activeTab, setActiveTab] = useState<"CUSTOMERS" | "SUPPLIERS">("CUSTOMERS");
  const [searchTerm, setSearchTerm] = useState("");

  const { summary, receivableAging, payableAging, customers, suppliers } = report;

  const currentList = activeTab === "CUSTOMERS" ? customers : suppliers;
  const filteredList = currentList.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.gstin && p.gstin.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.phone && p.phone.includes(searchTerm))
  );

  function handleExport() {
    const isCust = activeTab === "CUSTOMERS";
    const filename = isCust ? "customer_outstanding" : "supplier_payables";
    const headers = [
      "Party Name",
      "Phone",
      "GSTIN",
      "Total Invoiced / Billed",
      "Paid Amount",
      "Balance Due",
      "Overdue Amount",
      ...(isCust ? ["Credit Limit"] : []),
    ];

    const rows = filteredList.map((p) => [
      p.name,
      p.phone || "-",
      p.gstin || "-",
      p.totalAmount,
      p.paidAmount,
      p.balance,
      p.overdueAmount,
      ...(isCust ? [p.creditLimit] : []),
    ]);

    exportToCSV(filename, headers, rows);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/reports"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              Reports
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-slate-500">Outstanding & Aging</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Clock className="h-6 w-6 text-brand-600" />
            <span>Outstanding & Aging Analysis</span>
          </h1>
          <p className="text-sm text-slate-500">
            Real-time accounts receivable, payables, customer credit exposure, and 30-day invoice aging.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="btn-secondary flex items-center gap-2 self-start sm:self-auto"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-gradient-to-br from-emerald-500/5 to-white border-emerald-100">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-800">
            <span>Total Receivables</span>
            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {formatCurrency(summary.totalReceivable)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Customer dues to collect</p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-rose-500/5 to-white border-rose-100">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-rose-800">
            <span>Total Payables</span>
            <ArrowUpRight className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-700">
            {formatCurrency(summary.totalPayable)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Supplier bills to settle</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-700">
            <span>Overdue Receivables</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {formatCurrency(summary.totalOverdueReceivable)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Past payment due date</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700">
            <span>Total Settled</span>
            <Calendar className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(summary.totalSalesPaid + summary.totalPurchasePaid)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Recorded collections & payouts</p>
        </div>
      </div>

      {/* Aging Analysis Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receivables Aging */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              <span>Receivables Aging (Days from Invoice)</span>
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-700">
              {formatCurrency(receivableAging.total)}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">0 - 30 Days</p>
              <p className="mt-1 text-sm font-bold text-slate-900 font-mono">
                {formatCurrency(receivableAging.current)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100">
              <p className="text-[11px] font-semibold text-amber-700 uppercase">31 - 60 Days</p>
              <p className="mt-1 text-sm font-bold text-amber-900 font-mono">
                {formatCurrency(receivableAging.days31to60)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-100">
              <p className="text-[11px] font-semibold text-orange-700 uppercase">61 - 90 Days</p>
              <p className="mt-1 text-sm font-bold text-orange-900 font-mono">
                {formatCurrency(receivableAging.days61to90)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100">
              <p className="text-[11px] font-semibold text-rose-700 uppercase">&gt; 90 Days</p>
              <p className="mt-1 text-sm font-bold text-rose-900 font-mono">
                {formatCurrency(receivableAging.days90Plus)}
              </p>
            </div>
          </div>
        </div>

        {/* Payables Aging */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="h-4 w-4 text-rose-600" />
              <span>Payables Aging (Days from Bill)</span>
            </h3>
            <span className="text-xs font-mono font-bold text-rose-700">
              {formatCurrency(payableAging.total)}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">0 - 30 Days</p>
              <p className="mt-1 text-sm font-bold text-slate-900 font-mono">
                {formatCurrency(payableAging.current)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100">
              <p className="text-[11px] font-semibold text-amber-700 uppercase">31 - 60 Days</p>
              <p className="mt-1 text-sm font-bold text-amber-900 font-mono">
                {formatCurrency(payableAging.days31to60)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-100">
              <p className="text-[11px] font-semibold text-orange-700 uppercase">61 - 90 Days</p>
              <p className="mt-1 text-sm font-bold text-orange-900 font-mono">
                {formatCurrency(payableAging.days61to90)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100">
              <p className="text-[11px] font-semibold text-rose-700 uppercase">&gt; 90 Days</p>
              <p className="mt-1 text-sm font-bold text-rose-900 font-mono">
                {formatCurrency(payableAging.days90Plus)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("CUSTOMERS")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
              activeTab === "CUSTOMERS"
                ? "bg-brand-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Customer Outstanding ({customers.length})
          </button>
          <button
            onClick={() => setActiveTab("SUPPLIERS")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
              activeTab === "SUPPLIERS"
                ? "bg-brand-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Supplier Payables ({suppliers.length})
          </button>
        </div>

        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 w-full sm:w-72">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder={`Search ${activeTab === "CUSTOMERS" ? "customers" : "suppliers"}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs outline-none bg-transparent"
          />
        </div>
      </div>

      {/* Party Breakdown Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Party Name</th>
                <th className="px-6 py-3">Contact / GSTIN</th>
                <th className="px-6 py-3 text-right">Invoiced / Billed</th>
                <th className="px-6 py-3 text-right">Paid</th>
                <th className="px-6 py-3 text-right">Balance Outstanding</th>
                <th className="px-6 py-3 text-right">Overdue</th>
                {activeTab === "CUSTOMERS" && (
                  <th className="px-6 py-3 text-right">Credit Limit</th>
                )}
                <th className="px-6 py-3 text-center">Invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <p className="text-sm">No {activeTab.toLowerCase()} with outstanding balance found.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((party) => {
                  const isOverCredit =
                    activeTab === "CUSTOMERS" &&
                    party.creditLimit > 0 &&
                    party.balance > party.creditLimit;

                  return (
                    <tr key={party.partyId} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 font-medium text-slate-900">
                        <Link
                          href={`/parties/${party.partyId}`}
                          className="hover:text-brand-600 hover:underline flex items-center gap-1.5"
                        >
                          <span>{party.name}</span>
                          {isOverCredit && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                              Exceeded Limit
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-500">
                        <div>{party.phone || "-"}</div>
                        {party.gstin && (
                          <div className="font-mono text-[11px] text-slate-400">{party.gstin}</div>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-slate-700">
                        {formatCurrency(party.totalAmount)}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-emerald-600 font-medium">
                        {formatCurrency(party.paidAmount)}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(party.balance)}
                      </td>
                      <td
                        className={`px-6 py-3.5 text-right font-mono font-semibold ${
                          party.overdueAmount > 0 ? "text-amber-600" : "text-slate-400"
                        }`}
                      >
                        {party.overdueAmount > 0 ? formatCurrency(party.overdueAmount) : "₹0"}
                      </td>
                      {activeTab === "CUSTOMERS" && (
                        <td className="px-6 py-3.5 text-right font-mono text-xs text-slate-500">
                          {party.creditLimit > 0 ? formatCurrency(party.creditLimit) : "No Limit"}
                        </td>
                      )}
                      <td className="px-6 py-3.5 text-center text-xs text-slate-500">
                        <span className="bg-slate-100 px-2 py-1 rounded-full font-semibold">
                          {party.invoiceCount} bills
                        </span>
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
  );
}
