"use client";

import { useState } from "react";
import {
  Server,
  Database,
  Download,
  ShieldCheck,
  Cpu,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  Lock,
  Zap,
} from "lucide-react";

interface DbStats {
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  totalCompanies: number;
  totalInvoices: number;
  totalExpenses: number;
  totalItems: number;
  totalParties: number;
  totalAuditLogs: number;
}

export default function SystemClient({ dbStats }: { dbStats: DbStats }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  async function handleDownloadBackup() {
    setDownloading(true);
    setDownloadSuccess(false);
    try {
      const res = await fetch("/api/superadmin/system?action=backup");
      const data = await res.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taily_platform_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (err) {
      alert("Failed to export backup");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Server className="h-6 w-6 text-emerald-400" /> Platform Diagnostics & System Master Control
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Master system health, multi-tenant database diagnostics, and 1-click platform full data backup.
        </p>
      </div>

      {/* Security Status Banner */}
      <div className="rounded-2xl border border-emerald-900/50 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-emerald-950/40 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="font-bold text-white text-base flex items-center gap-2">
              Super Admin Security Shield: Active & Enforced
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                100% Protected
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Only verified <code className="text-emerald-400">SUPER_ADMIN</code> accounts can access system APIs, approve accounts, or inspect tenant databases.
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadBackup}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 shrink-0"
        >
          {downloading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span>{downloading ? "Exporting Backup..." : "Export Full Platform Backup (JSON)"}</span>
        </button>
      </div>

      {downloadSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          Full platform JSON backup downloaded successfully to your device!
        </div>
      )}

      {/* Database Breakdown Cards */}
      <div>
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-emerald-400" /> Database Live Entity Counts
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-semibold text-slate-400">Total Businesses</span>
            <div className="mt-1 text-2xl font-black text-white">{dbStats.totalCompanies}</div>
            <span className="text-[11px] text-emerald-400 mt-1 block">Active Tenants</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-semibold text-slate-400">Total Registered Users</span>
            <div className="mt-1 text-2xl font-black text-white">{dbStats.totalUsers}</div>
            <span className="text-[11px] text-amber-400 mt-1 block">{dbStats.pendingUsers} Pending Approval</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-semibold text-slate-400">Total Invoices</span>
            <div className="mt-1 text-2xl font-black text-white">{dbStats.totalInvoices}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Sales & Purchases</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-semibold text-slate-400">Inventory Items</span>
            <div className="mt-1 text-2xl font-black text-white">{dbStats.totalItems}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Products & SKUs</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-semibold text-slate-400">Parties / Ledgers</span>
            <div className="mt-1 text-2xl font-black text-white">{dbStats.totalParties}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Customers & Vendors</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-semibold text-slate-400">Expense Records</span>
            <div className="mt-1 text-2xl font-black text-white">{dbStats.totalExpenses}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Operational Expenses</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-semibold text-slate-400">Audit Logs Recorded</span>
            <div className="mt-1 text-2xl font-black text-white">{dbStats.totalAuditLogs}</div>
            <span className="text-[11px] text-emerald-400 mt-1 block">Complete History</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-semibold text-slate-400">Database Engine</span>
            <div className="mt-1 text-xl font-black text-white">PostgreSQL</div>
            <span className="text-[11px] text-emerald-400 mt-1 block">Prisma ORM Connected</span>
          </div>
        </div>
      </div>

      {/* Security & Access Policies Matrix */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-emerald-400" /> Platform Security & Access Control Policies
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Super Admin Gate
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Only users with <code className="text-amber-300">role: SUPER_ADMIN</code> can access <code className="text-slate-300">/superadmin/*</code> routes and administrative APIs. Unauthorized requests are rejected with 403 Forbidden.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Registration Approval Lock
            </div>
            <p className="text-xs text-slate-400 mt-2">
              All new user registrations default to <code className="text-amber-300">status: PENDING</code>. The system rejects login attempts until the Super Admin explicitly clicks Approve.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Tenant Data Isolation
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Every business tenant operates in isolated workspace scope (`companyId`). Regular business users can only view and modify their own business&apos;s invoices, items, parties, and expenses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
