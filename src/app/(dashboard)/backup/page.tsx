"use client";

import { useState, useEffect } from "react";
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  Clock,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileJson,
} from "lucide-react";

export default function BackupDashboardPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [autoConfig, setAutoConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    fetchBackupStatus();
  }, []);

  async function fetchBackupStatus() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/backup");
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setAutoConfig(data.autoConfig || null);
      }
    } catch (err: any) {
      setErrorBanner("Failed to load backup logs.");
    } finally {
      setIsLoading(false);
    }
  }

  async function triggerManualDbBackup() {
    setIsBackingUp(true);
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "BACKUP_DB", notes: "Manual user snapshot" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessBanner(`Database snapshot '${data.result.fileName}' created successfully with SHA-256 integrity verification.`);
      fetchBackupStatus();
    } catch (err: any) {
      setErrorBanner(err.message);
    } finally {
      setIsBackingUp(false);
    }
  }

  async function triggerDataExport() {
    setIsExporting(true);
    setErrorBanner(null);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Data export failed.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `company_export_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setSuccessBanner("Company data exported safely (zero passwords/secrets included).");
      fetchBackupStatus();
    } catch (err: any) {
      setErrorBanner(err.message);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-emerald-600" />
            Backup & Data Governance
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Separate point-in-time database backups from sanitized tenant data exports.
          </p>
        </div>
        <button
          onClick={fetchBackupStatus}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {errorBanner && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* TWO SEPARATE ACTIONS: DB BACKUP VS DATA EXPORT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Full Database Backup */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Database Snapshot (.db)</h3>
                <p className="text-xs text-slate-500">System-level point-in-time SQLite snapshot</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Creates a verified binary snapshot of the SQLite database. Preserves ledger transactions,
              immutable voucher journals, and audit tables. Verified with SHA-256 checksum.
            </p>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Atomic File Lock Safe
            </span>
            <button
              onClick={triggerManualDbBackup}
              disabled={isBackingUp}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2"
            >
              {isBackingUp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Create DB Backup</span>
            </button>
          </div>
        </div>

        {/* Card 2: Safe Tenant Data Export */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Tenant Data Export (JSON)</h3>
                <p className="text-xs text-slate-500">Sanitized business records & master catalog</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Exports customers, suppliers, inventory items, invoices, and vouchers in structured JSON format.
              <strong className="text-slate-800 font-semibold block mt-1">
                Zero Secrets Guarantee: Automatically strips user password hashes, session tokens, and API credentials.
              </strong>
            </p>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between">
            <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 font-bold">
              ✓ Secrets Excluded
            </span>
            <button
              onClick={triggerDataExport}
              disabled={isExporting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2"
            >
              {isExporting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <Download className="w-3.5 h-3.5" />
              <span>Export Company Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* AUTOMATIC BACKUP ARCHITECTURE */}
      {autoConfig && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Automatic Backup Schedule</p>
              <p className="text-xs text-slate-500">
                Frequency: <span className="font-semibold text-slate-800">{autoConfig.frequency}</span> | Retention:{" "}
                <span className="font-semibold text-slate-800">{autoConfig.retentionDays} Days</span> (Keep last{" "}
                {autoConfig.maxBackupsCount} snapshots)
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/60 px-3 py-1 rounded-full border border-emerald-200">
            Automated Retention Active
          </span>
        </div>
      )}

      {/* BACKUP & EXPORT LOGS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-900">Backup & Export Audit Trail</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Date & Time</th>
                <th className="py-2.5 px-4">Operation Type</th>
                <th className="py-2.5 px-4">File Name</th>
                <th className="py-2.5 px-4">File Size</th>
                <th className="py-2.5 px-4">Checksum (SHA-256)</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No backup operations recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 text-slate-600">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                      {log.type}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 font-mono text-[11px]">
                      {log.fileName}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {log.fileSize ? `${(log.fileSize / 1024).toFixed(1)} KB` : "-"}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500">
                      {log.checksum ? `${log.checksum.slice(0, 16)}...` : "-"}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {log.status}
                      </span>
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
