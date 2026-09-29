"use client";

import { useState } from "react";
import {
  Activity,
  Search,
  Calendar,
  User,
  Building2,
  Clock,
  Filter,
} from "lucide-react";

interface ActivityItem {
  id: string;
  userId: string | null;
  userEmail: string | null;
  companyId: string | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function ActivityClient({
  initialActivities,
}: {
  initialActivities: ActivityItem[];
}) {
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  const actionTypes = Array.from(new Set(activities.map((a) => a.action)));

  const filtered = activities.filter((a) => {
    const s = searchTerm.toLowerCase();
    const matchSearch =
      a.action.toLowerCase().includes(s) ||
      (a.userEmail && a.userEmail.toLowerCase().includes(s)) ||
      (a.details && a.details.toLowerCase().includes(s));

    const matchAction = actionFilter === "ALL" || a.action === actionFilter;

    return matchSearch && matchAction;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="h-6 w-6 text-emerald-400" /> Platform Audit Trail & Activity Logs
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Complete, chronological record of all system events, signups, logins, and administrative operations.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by action, email, details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none"
          >
            <option value="ALL">All Actions</option>
            {actionTypes.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Action</th>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                    No activity logs found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap font-mono">
                      {new Date(item.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold text-amber-300 border border-slate-700">
                        {item.action}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-xs font-mono text-slate-300">
                      {item.userEmail || "System / Anonymous"}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-slate-300 max-w-md">
                      {item.details || "—"}
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
