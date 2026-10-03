"use client";

import { useState } from "react";
import { ShieldCheck, Filter, Search, Calendar, User, Building, Clock, CheckCircle } from "lucide-react";

interface AuditLogItem {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  company: { id: string; name: string } | null;
  details: any;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditClient({ initialLogs }: { initialLogs: AuditLogItem[] }) {
  const [logs, setLogs] = useState<AuditLogItem[]>(initialLogs);
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [search, setSearch] = useState("");

  const filtered = logs.filter((log) => {
    if (filterAction && log.action !== filterAction) return false;
    if (filterEntity && log.entityType !== filterEntity) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchEmail = log.userEmail?.toLowerCase().includes(q);
      const matchComp = log.company?.name.toLowerCase().includes(q);
      const matchAction = log.action.toLowerCase().includes(q);
      if (!matchEmail && !matchComp && !matchAction) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          Platform-Level Audit Trail
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Immutable forensic log of administrative actions, plan modifications, and company status events.
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search by admin email, company, action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Platform Actions</option>
            <option value="PLAN_CREATED">PLAN_CREATED</option>
            <option value="PLAN_UPDATED">PLAN_UPDATED</option>
            <option value="COMPANY_SUSPENDED">COMPANY_SUSPENDED</option>
            <option value="COMPANY_STATUS_UPDATED">COMPANY_STATUS_UPDATED</option>
            <option value="SUBSCRIPTION_UPDATED">SUBSCRIPTION_UPDATED</option>
          </select>
        </div>

        <div>
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Entity Types</option>
            <option value="PLAN">PLAN</option>
            <option value="COMPANY">COMPANY</option>
            <option value="SUBSCRIPTION">SUBSCRIPTION</option>
            <option value="PLATFORM">PLATFORM</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ShieldCheck className="h-10 w-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium">No platform audit records match the selected criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Super Admin</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Target Company</th>
                  <th className="py-3 px-4">Change Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filtered.map((log) => {
                  const dateStr = new Date(log.createdAt).toLocaleString("en-IN", {
                    dateStyle: "short",
                    timeStyle: "medium",
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.action === "COMPANY_SUSPENDED"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : log.action.includes("CREATED")
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        {log.userEmail || "System"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-300">
                          {log.entityType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {log.company?.name || "Global / Platform"}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-400 font-mono text-[11px]">
                        {typeof log.details === "object"
                          ? JSON.stringify(log.details)
                          : log.details || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
