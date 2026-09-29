"use client";

import { useState } from "react";
import {
  FileText,
  Search,
  Building2,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Eye,
  Download,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  type: string;
  invoiceDate: string;
  dueDate: string | null;
  total: number;
  balance: number;
  status: string;
  company: { id: string; name: string };
  party: { id: string; name: string; phone: string | null };
}

export default function SuperInvoicesClient({
  initialInvoices,
  companies,
}: {
  initialInvoices: InvoiceItem[];
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = initialInvoices.filter((inv) => {
    const s = searchTerm.toLowerCase();
    const matchSearch =
      inv.invoiceNumber.toLowerCase().includes(s) ||
      inv.party.name.toLowerCase().includes(s) ||
      inv.company.name.toLowerCase().includes(s);

    const matchCompany = companyFilter === "ALL" || inv.company.id === companyFilter;
    const matchType = typeFilter === "ALL" || inv.type === typeFilter;
    const matchStatus = statusFilter === "ALL" || inv.status === statusFilter;

    return matchSearch && matchCompany && matchType && matchStatus;
  });

  const totalSalesVal = filtered
    .filter((i) => i.type === "SALES")
    .reduce((sum, i) => sum + i.total, 0);

  const totalPurchaseVal = filtered
    .filter((i) => i.type === "PURCHASE")
    .reduce((sum, i) => sum + i.total, 0);

  async function handleInspectStore(companyId: string) {
    try {
      await fetch("/api/superadmin/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      router.push("/invoices");
      router.refresh();
    } catch (err) {
      alert("Failed to inspect company store");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-400" /> Global Cross-Tenant Invoices
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Master overview of all sales, purchases, and return bills generated across every business tenant.
          </p>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Bills Listed</span>
            <span className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <FileText className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-white">{filtered.length}</div>
        </div>

        <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Total Sales (Filtered)</span>
            <span className="p-2 rounded-xl bg-emerald-900/50 text-emerald-400">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400">₹{totalSalesVal.toLocaleString("en-IN")}</div>
        </div>

        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Total Purchases (Filtered)</span>
            <span className="p-2 rounded-xl bg-amber-900/50 text-amber-400">
              <ArrowDownLeft className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-400">₹{totalPurchaseVal.toLocaleString("en-IN")}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search invoice number, party, or business..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Company Filter */}
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 focus:outline-hidden focus:border-emerald-500"
          >
            <option value="ALL">All Businesses ({companies.length})</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 focus:outline-hidden focus:border-emerald-500"
          >
            <option value="ALL">All Types</option>
            <option value="SALES">Sales Invoice</option>
            <option value="PURCHASE">Purchase Bill</option>
            <option value="SALES_RETURN">Sales Return</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 focus:outline-hidden focus:border-emerald-500"
          >
            <option value="ALL">All Status</option>
            <option value="PAID">PAID</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="UNPAID">UNPAID</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Invoices Master Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Invoice #</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Business / Tenant</th>
                <th className="px-5 py-3.5">Party</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5 text-right">Balance</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-500">
                    No invoices matching current search or filters.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-4 font-bold text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{inv.invoiceNumber}</span>
                    </td>
                    <td className="px-5 py-4">
                      {inv.type === "SALES" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                          <ArrowUpRight className="h-3 w-3" /> Sales
                        </span>
                      ) : inv.type === "PURCHASE" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/40">
                          <ArrowDownLeft className="h-3 w-3" /> Purchase
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-950/60 text-rose-400 border border-rose-800/40">
                          <RotateCcw className="h-3 w-3" /> Return
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                        <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span>{inv.company.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-white">{inv.party.name}</div>
                      {inv.party.phone && (
                        <div className="text-xs text-slate-500 font-mono">{inv.party.phone}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {new Date(inv.invoiceDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-white">
                      ₹{inv.total.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-400">
                      ₹{inv.balance.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          inv.status === "PAID"
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                            : inv.status === "PARTIAL"
                            ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                            : inv.status === "CANCELLED"
                            ? "bg-slate-800 text-slate-400"
                            : "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleInspectStore(inv.company.id)}
                        title="Inspect Business Store"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                      >
                        <Eye className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
