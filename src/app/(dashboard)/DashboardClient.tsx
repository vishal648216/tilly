"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ShoppingCart,
  Wallet,
  Package,
  Layers,
  Calendar,
  Building2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Store,
  Briefcase,
  Truck,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Plus,
  FileSpreadsheet,
} from "lucide-react";

interface DashboardData {
  periodLabel: string;
  from: string | Date;
  to: string | Date;
  periodSales: number;
  periodPurchases: number;
  periodExpenses: number;
  periodCOGS: number;
  periodGrossProfit: number;
  asOfDateReceivables: number;
  asOfDatePayables: number;
  asOfDateStockValue: number;
  businessType: string;
  retail: {
    todaySales: number;
    currentStockUnits: number;
    lowStockItemCount: number;
    topProducts: { name: string; qty: number; revenue: number }[];
  };
  service: {
    periodRevenue: number;
    currentOutstanding: number;
    periodExpenses: number;
    topClients: { name: string; amount: number }[];
  };
  distributor: {
    periodSales: number;
    periodPurchases: number;
    warehouseStock: { name: string; units: number; value: number }[];
    periodCollections: number;
    currentOutstanding: number;
  };
}

interface DashboardClientProps {
  initialData: DashboardData;
  companyName: string;
  userName: string;
}

export default function DashboardClient({
  initialData,
  companyName,
  userName,
}: DashboardClientProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState("CURRENT_FY");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [activeBusinessTab, setActiveBusinessTab] = useState<"RETAIL" | "SERVICE" | "DISTRIBUTOR">(
    (initialData.businessType?.toUpperCase() as any) || "RETAIL"
  );

  const fetchDashboardData = async (
    selectedPreset: string,
    from?: string,
    to?: string
  ) => {
    try {
      setLoading(true);
      let url = `/api/reports?report=DASHBOARD_ANALYTICS&preset=${selectedPreset}`;
      if (selectedPreset === "CUSTOM" && from && to) {
        url += `&from=${from}&to=${to}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = (newPreset: string) => {
    setPreset(newPreset);
    if (newPreset === "CUSTOM") {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
      fetchDashboardData(newPreset);
    }
  };

  const applyCustomRange = () => {
    if (customFrom && customTo) {
      fetchDashboardData("CUSTOM", customFrom, customTo);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Welcome & Global Date Range Bar */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Production Dashboard & Reporting Layer</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Namaste, {userName.split(" ")[0]}!
            </h1>
            <p className="text-sm text-slate-300 max-w-xl font-medium">
              Real-time financial performance and live operational metrics for{" "}
              <span className="font-semibold text-white">{companyName}</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/invoices/new"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Create Invoice</span>
            </Link>
            <Link
              href="/reports"
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/20 transition-all backdrop-blur-xs border border-white/15"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Reports Catalog</span>
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* 2. Interactive Date Range Selector Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <Calendar className="h-4 w-4 text-emerald-600" />
          <span>Active Period Filter:</span>
          <span className="rounded-lg bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-extrabold border border-emerald-200/60">
            {data.periodLabel}
          </span>
          {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400 ml-1" />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "TODAY", label: "Today" },
            { id: "THIS_WEEK", label: "This Week" },
            { id: "THIS_MONTH", label: "This Month" },
            { id: "CURRENT_FY", label: "Current FY" },
            { id: "PREVIOUS_FY", label: "Previous FY" },
            { id: "CUSTOM", label: "Custom Range" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handlePresetChange(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                preset === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Pickers Drawer */}
      {showCustomRange && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-end gap-3 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              End Date
            </label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <button
            onClick={applyCustomRange}
            disabled={!customFrom || !customTo}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-1.5 text-xs font-bold transition-all shadow-xs"
          >
            Apply Range
          </button>
        </div>
      )}

      {/* 3. Core KPI Cards (7 Requirements: Sales, Purchases, Expenses, Receivables, Payables, Gross Profit, Stock Value) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Primary Financial Metrics
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">
            Strict separation: Period Activity vs. As-of Balance
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. SALES (Period) */}
          <div className="card p-5 bg-gradient-to-br from-white via-white to-emerald-50/40 border-emerald-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Sales
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {formatCurrency(data.periodSales)}
            </p>
            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="rounded-md bg-emerald-100/70 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                Period: {data.periodLabel}
              </span>
              <Link href="/sales" className="text-emerald-700 font-semibold hover:underline">
                View Register →
              </Link>
            </div>
          </div>

          {/* 2. PURCHASES (Period) */}
          <div className="card p-5 bg-gradient-to-br from-white via-white to-indigo-50/40 border-indigo-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Purchases
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {formatCurrency(data.periodPurchases)}
            </p>
            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="rounded-md bg-indigo-100/70 text-indigo-800 px-2 py-0.5 text-[10px] font-bold">
                Period: {data.periodLabel}
              </span>
              <Link href="/purchases" className="text-indigo-700 font-semibold hover:underline">
                View Register →
              </Link>
            </div>
          </div>

          {/* 3. EXPENSES (Period) */}
          <div className="card p-5 bg-gradient-to-br from-white via-white to-rose-50/40 border-rose-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Expenses
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {formatCurrency(data.periodExpenses)}
            </p>
            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="rounded-md bg-rose-100/70 text-rose-800 px-2 py-0.5 text-[10px] font-bold">
                Period: {data.periodLabel}
              </span>
              <Link href="/expenses" className="text-rose-700 font-semibold hover:underline">
                View All →
              </Link>
            </div>
          </div>

          {/* 4. GROSS PROFIT (Period) */}
          <div className="card p-5 bg-gradient-to-br from-white via-white to-teal-50/40 border-teal-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Gross Profit
              </span>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  data.periodGrossProfit >= 0
                    ? "bg-teal-100 text-teal-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {data.periodGrossProfit >= 0 ? (
                  <ArrowUpRight className="h-5 w-5" />
                ) : (
                  <ArrowDownRight className="h-5 w-5" />
                )}
              </div>
            </div>
            <p
              className={`mt-3 text-2xl sm:text-3xl font-black tracking-tight ${
                data.periodGrossProfit >= 0 ? "text-teal-700" : "text-rose-600"
              }`}
            >
              {formatCurrency(data.periodGrossProfit)}
            </p>
            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="rounded-md bg-teal-100/70 text-teal-800 px-2 py-0.5 text-[10px] font-bold">
                Period: {data.periodLabel}
              </span>
              <Link href="/reports/profit-loss" className="text-teal-700 font-semibold hover:underline">
                P&L Statement →
              </Link>
            </div>
          </div>
        </div>

        {/* Balance Sheet / Point-in-time Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* 5. RECEIVABLES (All-time Point-in-Time) */}
          <div className="card p-5 bg-gradient-to-br from-white via-white to-amber-50/50 border-amber-200/80 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Receivables
                </span>
                <span className="rounded-md bg-amber-100 text-amber-900 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                  All-Time Balance
                </span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-amber-700 tracking-tight">
              {formatCurrency(data.asOfDateReceivables)}
            </p>
            <p className="mt-2 text-xs text-slate-500 font-medium">
              Outstanding payments due from all customers as of today.
            </p>
          </div>

          {/* 6. PAYABLES (All-time Point-in-Time) */}
          <div className="card p-5 bg-gradient-to-br from-white via-white to-orange-50/50 border-orange-200/80 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Payables
                </span>
                <span className="rounded-md bg-orange-100 text-orange-900 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                  All-Time Balance
                </span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-orange-700 tracking-tight">
              {formatCurrency(data.asOfDatePayables)}
            </p>
            <p className="mt-2 text-xs text-slate-500 font-medium">
              Outstanding payments due to all vendors and suppliers as of today.
            </p>
          </div>

          {/* 7. STOCK VALUE (All-time Current Asset) */}
          <div className="card p-5 bg-gradient-to-br from-white via-white to-blue-50/50 border-blue-200/80 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Stock Value
                </span>
                <span className="rounded-md bg-blue-100 text-blue-900 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                  Current Asset
                </span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-blue-700 tracking-tight">
              {formatCurrency(data.asOfDateStockValue)}
            </p>
            <p className="mt-2 text-xs text-slate-500 font-medium">
              Total valuation of physical inventory currently held in stock.
            </p>
          </div>
        </div>
      </div>

      {/* 4. BUSINESS-SPECIFIC DASHBOARD MODES (Retail, Service, Distributor) */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-extrabold text-slate-900">
                Business-Specific Intelligence
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Specialized workflows and operational indicators tailored for your business vertical.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
            <button
              onClick={() => setActiveBusinessTab("RETAIL")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeBusinessTab === "RETAIL"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Store className="h-3.5 w-3.5" />
              <span>Retail</span>
            </button>
            <button
              onClick={() => setActiveBusinessTab("SERVICE")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeBusinessTab === "SERVICE"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Service</span>
            </button>
            <button
              onClick={() => setActiveBusinessTab("DISTRIBUTOR")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeBusinessTab === "DISTRIBUTOR"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              <span>Distributor</span>
            </button>
          </div>
        </div>

        {/* === RETAIL VIEW === */}
        {activeBusinessTab === "RETAIL" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Retail: Today's Sales */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Today&apos;s Sales
                </span>
                <p className="mt-2 text-2xl font-black text-emerald-950">
                  {formatCurrency(data.retail.todaySales)}
                </p>
                <p className="text-[11px] text-emerald-700 mt-1">
                  Gross receipts generated since 00:00 today.
                </p>
              </div>

              {/* Retail: Stock */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Total Active Stock
                </span>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {data.retail.currentStockUnits} Units
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Valued at {formatCurrency(data.asOfDateStockValue)}
                </p>
              </div>

              {/* Retail: Low Stock */}
              <div
                className={`p-4 rounded-2xl border ${
                  data.retail.lowStockItemCount > 0
                    ? "bg-amber-50 border-amber-200"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Low Stock Alerts
                  </span>
                  {data.retail.lowStockItemCount > 0 && (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <p className="mt-2 text-2xl font-black text-amber-900">
                  {data.retail.lowStockItemCount} Items
                </p>
                <Link
                  href="/items"
                  className="text-[11px] text-amber-800 font-bold hover:underline inline-flex items-center gap-1 mt-1"
                >
                  Manage inventory thresholds →
                </Link>
              </div>
            </div>

            {/* Retail: Top Products */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Top Selling Products ({data.periodLabel})
              </h3>
              {data.retail.topProducts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                  No products sold during this selected period.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100">
                      <tr>
                        <th className="py-2.5 px-4">Product Name</th>
                        <th className="py-2.5 px-4 text-right">Units Sold</th>
                        <th className="py-2.5 px-4 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.retail.topProducts.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-bold text-slate-800">{p.name}</td>
                          <td className="py-2.5 px-4 text-right font-medium text-slate-600">
                            {p.qty}
                          </td>
                          <td className="py-2.5 px-4 text-right font-black text-slate-900">
                            {formatCurrency(p.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === SERVICE VIEW === */}
        {activeBusinessTab === "SERVICE" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Service: Revenue */}
              <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                  Service Revenue ({data.periodLabel})
                </span>
                <p className="mt-2 text-2xl font-black text-teal-950">
                  {formatCurrency(data.service.periodRevenue)}
                </p>
                <p className="text-[11px] text-teal-700 mt-1">Total invoiced fees & retainers.</p>
              </div>

              {/* Service: Outstanding */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Client Outstanding
                </span>
                <p className="mt-2 text-2xl font-black text-amber-950">
                  {formatCurrency(data.service.currentOutstanding)}
                </p>
                <p className="text-[11px] text-amber-700 mt-1">Pending fees across all clients.</p>
              </div>

              {/* Service: Expenses */}
              <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                  Operating Expenses ({data.periodLabel})
                </span>
                <p className="mt-2 text-2xl font-black text-rose-950">
                  {formatCurrency(data.service.periodExpenses)}
                </p>
                <p className="text-[11px] text-rose-700 mt-1">Direct overhead & service delivery.</p>
              </div>
            </div>

            {/* Service: Top Clients */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Top Clients by Revenue ({data.periodLabel})
              </h3>
              {data.service.topClients.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                  No client billing recorded for this period.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {data.service.topClients.map((client, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-800 truncate">{client.name}</p>
                        <p className="text-[10px] text-slate-400">Client Partner</p>
                      </div>
                      <p className="text-xs font-black text-slate-900 shrink-0">
                        {formatCurrency(client.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === DISTRIBUTOR VIEW === */}
        {activeBusinessTab === "DISTRIBUTOR" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Distributor: Sales */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Distribution Sales
                </span>
                <p className="mt-2 text-xl font-black text-emerald-950">
                  {formatCurrency(data.distributor.periodSales)}
                </p>
                <span className="text-[10px] font-semibold text-emerald-700">
                  Period: {data.periodLabel}
                </span>
              </div>

              {/* Distributor: Purchase */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                  Inward Purchases
                </span>
                <p className="mt-2 text-xl font-black text-indigo-950">
                  {formatCurrency(data.distributor.periodPurchases)}
                </p>
                <span className="text-[10px] font-semibold text-indigo-700">
                  Period: {data.periodLabel}
                </span>
              </div>

              {/* Distributor: Collections */}
              <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                  Period Collections
                </span>
                <p className="mt-2 text-xl font-black text-teal-950">
                  {formatCurrency(data.distributor.periodCollections)}
                </p>
                <span className="text-[10px] font-semibold text-teal-700">
                  Total Cash & Bank Inflow
                </span>
              </div>

              {/* Distributor: Outstanding */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Route Outstanding
                </span>
                <p className="mt-2 text-xl font-black text-amber-950">
                  {formatCurrency(data.distributor.currentOutstanding)}
                </p>
                <span className="text-[10px] font-semibold text-amber-700">
                  All-time pending collections
                </span>
              </div>
            </div>

            {/* Distributor: Warehouse Stock */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Warehouse Stock Breakdown
              </h3>
              {data.distributor.warehouseStock.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                  No multi-warehouse locations registered.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {data.distributor.warehouseStock.map((wh, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{wh.name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                          {wh.units} Units
                        </span>
                      </div>
                      <p className="text-sm font-extrabold text-emerald-700">
                        {formatCurrency(wh.value)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Direct Quick Links to the Production Report Suites */}
      <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold">Ready for deep statutory and ledger audits?</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Access 31+ production reports across Sales, Purchase, Inventory, Accounting, and Party balances.
            </p>
          </div>
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 text-xs transition-all shadow-md active:scale-95"
          >
            <span>Open All Reports</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
