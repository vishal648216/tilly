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
  Trash2,
  AlertTriangle,
  X,
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

  // Platform Purge State (TEMPORARILY COMMENTED FOR TESTING)
  /*
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState("");
  const [purgeSuccess, setPurgeSuccess] = useState("");
  */

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

  // Purge Execution Handler (TEMPORARILY COMMENTED FOR TESTING)
  /*
  async function handleExecutePurge() {
    if (purgeConfirmText.trim() !== "PURGE") {
      setPurgeError("Please type PURGE in capital letters to confirm.");
      return;
    }

    setPurging(true);
    setPurgeError("");
    setPurgeSuccess("");

    try {
      const res = await fetch("/api/superadmin/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purge_all_except_superadmin",
          confirmation: "PURGE",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to execute purge.");

      setPurgeSuccess(`Purge successful! ${data.deletedUsersCount} regular users and all tenant data deleted. Super Admin accounts preserved.`);
      setTimeout(() => {
        window.location.reload();
      }, 2500);
    } catch (err: any) {
      setPurgeError(err.message || "An error occurred while purging data.");
      setPurging(false);
    }
  }
  */

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

      {/* TEMPORARILY COMMENTED FOR TESTING: Danger Zone Factory Reset & Modal
      <div className="rounded-2xl border border-rose-900/60 bg-gradient-to-r from-rose-950/30 via-slate-900/80 to-rose-950/30 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mt-0.5">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Danger Zone: Platform Factory Reset</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  Destructive
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Wipes all companies, invoices, products, stock, vouchers, expenses, and regular users.
                <strong> Super Admin account(s) are strictly preserved</strong> so you can start fresh without losing administrative access.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setPurgeConfirmText("");
              setPurgeError("");
              setPurgeSuccess("");
              setShowPurgeModal(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-lg shadow-rose-600/20 active:scale-95 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            <span>Purge All Data (Keep Super Admin)</span>
          </button>
        </div>
      </div>

      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 p-6 shadow-2xl border border-rose-800 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-rose-400 font-bold text-base">
                <AlertTriangle className="h-5 w-5" />
                <span>Confirm Platform Data Purge</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {purgeError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs font-semibold text-rose-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{purgeError}</span>
              </div>
            )}

            {purgeSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs font-semibold text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{purgeSuccess}</span>
              </div>
            )}

            <div className="space-y-3 text-xs text-slate-300">
              <p className="font-semibold text-rose-300">
                ⚠️ THIS ACTION CANNOT BE UNDONE.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li>All business companies, settings, and workspaces will be permanently erased.</li>
                <li>All invoices, delivery challans, bills, expenses, and ledger entries will be deleted.</li>
                <li>All products, items, inventory batches, and stock ledger entries will be deleted.</li>
                <li>All regular user accounts and memberships will be deleted.</li>
                <li><strong className="text-emerald-400">Your Super Admin login credentials will be preserved.</strong></li>
              </ul>
              <p className="text-slate-300 pt-2">
                To confirm, type <strong className="font-mono text-rose-400 font-bold">PURGE</strong> in the box below:
              </p>
              <input
                type="text"
                autoFocus
                placeholder="Type PURGE to confirm"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                className="w-full rounded-xl border border-rose-700/60 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                disabled={purging}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePurge}
                disabled={purging || purgeConfirmText.trim() !== "PURGE"}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2"
              >
                {purging ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Wiping Platform...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Permanently Wipe All Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      */}
    </div>
  );
}
