"use client";

import { useState, useEffect } from "react";
import {
  Package,
  AlertTriangle,
  Clock,
  BellRing,
  RefreshCw,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";

export default function BatchesAndExpiryPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [expiryReport, setExpiryReport] = useState<any>(null);
  const [thresholdDays, setThresholdDays] = useState(30);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [notificationSent, setNotificationSent] = useState(false);

  useEffect(() => {
    fetchBatchesAndAlerts();
  }, [thresholdDays]);

  async function fetchBatchesAndAlerts() {
    setIsLoading(true);
    try {
      const [batchRes, expiryRes] = await Promise.all([
        fetch("/api/inventory/batches"),
        fetch(`/api/inventory/expiry-alerts?days=${thresholdDays}`),
      ]);

      const bData = await batchRes.json();
      const eData = await expiryRes.json();

      if (batchRes.ok) setBatches(bData.batches || []);
      if (expiryRes.ok) setExpiryReport(eData.report || null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function triggerNotifications() {
    try {
      const res = await fetch("/api/inventory/expiry-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: thresholdDays }),
      });
      if (res.ok) {
        setNotificationSent(true);
        setTimeout(() => setNotificationSent(false), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const filteredBatches = batches.filter(
    (b) =>
      b.batchNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.item?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.item?.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-600" />
            Batch Tracking & Expiry Alerts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track lot numbers, expiry dates, MRP, and FEFO inventory allocation with proactive alert triggers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <span className="text-slate-500 px-2">Alert Window:</span>
            {[15, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setThresholdDays(d)}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  thresholdDays === d ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <button
            onClick={triggerNotifications}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Generate Expiry Alerts</span>
          </button>
        </div>
      </div>

      {notificationSent && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>System alerts generated and dispatched to dashboard notifications.</span>
        </div>
      )}

      {/* KPI METRICS CARDS */}
      {expiryReport && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Expired Batches</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-bold text-rose-700 mt-2">{expiryReport.expiredCount}</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              Stock Value: ₹{expiryReport.expiredStockValue.toLocaleString("en-IN")}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                Expiring in &le; {thresholdDays} Days
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-700 mt-2">{expiryReport.expiringSoonCount}</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              Stock Value: ₹{expiryReport.expiringSoonStockValue.toLocaleString("en-IN")}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Active Batches</span>
              <Package className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{batches.length}</p>
            <p className="text-xs text-slate-500 mt-1">Managed under FEFO policy</p>
          </div>
        </div>
      )}

      {/* BATCHES TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">Batch Stock Master</h2>
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search batch or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Item Name</th>
                <th className="py-2.5 px-4">Batch Number</th>
                <th className="py-2.5 px-4">Current Stock</th>
                <th className="py-2.5 px-4">Cost Price (₹)</th>
                <th className="py-2.5 px-4">MRP (₹)</th>
                <th className="py-2.5 px-4">Expiry Date</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No batch inventory records found.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => {
                  const isExpired = b.expiryDate && new Date(b.expiryDate) < new Date();
                  const isExpiring =
                    b.expiryDate &&
                    !isExpired &&
                    new Date(b.expiryDate).getTime() - Date.now() <= thresholdDays * 24 * 3600 * 1000;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {b.item?.name || "Item"}
                        {b.item?.sku && <span className="block text-[11px] font-mono text-slate-400">{b.item.sku}</span>}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{b.batchNumber}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-800">
                        {b.quantity} {b.item?.unit || "PCS"}
                      </td>
                      <td className="py-2.5 px-4 font-mono">₹{b.cost || "-"}</td>
                      <td className="py-2.5 px-4 font-mono">₹{b.mrp || "-"}</td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString("en-IN") : "No Expiry"}
                      </td>
                      <td className="py-2.5 px-4">
                        {isExpired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            Expired
                          </span>
                        ) : isExpiring ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Expiring Soon
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Good Stock
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
  );
}
