import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import Link from "next/link";
import {
  Building2,
  Users,
  UserCheck,
  Receipt,
  TrendingUp,
  Activity,
  ArrowRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PlusCircle,
  Crown,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") redirect("/login");

  const [
    totalCompanies,
    totalUsers,
    pendingUsers,
    approvedUsers,
    totalInvoices,
    allInvoices,
    recentActivities,
    recentCompanies,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    prisma.user.findMany({
      where: { status: "PENDING" },
      include: { memberships: { include: { company: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.user.count({ where: { status: "APPROVED" } }),
    prisma.invoice.count(),
    prisma.invoice.findMany({
      where: { type: "SALES" },
      select: { grandTotal: true },
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.company.findMany({
      include: {
        members: { include: { user: true } },
        invoices: { select: { id: true, grandTotal: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const totalTurnover = allInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.grandTotal.toString() || "0"),
    0
  );

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400 mb-3">
              <Crown className="h-3.5 w-3.5" /> MASTER CONTROL CENTER
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Super Admin Console
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-xl">
              Platform-wide user approvals, multi-tenant businesses monitoring, full CRUD permissions, and live audit tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/superadmin/approvals"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all"
            >
              <UserCheck className="h-4 w-4" />
              Approvals Queue
              {pendingUsers.length > 0 && (
                <span className="rounded-full bg-slate-950 px-2 py-0.5 text-xs text-amber-400 font-extrabold">
                  {pendingUsers.length}
                </span>
              )}
            </Link>
            <Link
              href="/superadmin/companies"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Building2 className="h-4 w-4 text-slate-400" /> All Businesses
            </Link>
          </div>
        </div>
      </div>

      {/* Pending Approvals Alert Banner */}
      {pendingUsers.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-slate-950 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {pendingUsers.length} New Registration Request{pendingUsers.length > 1 ? "s" : ""} Pending!
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  New businesses have signed up and are waiting for your approval before they can log in.
                </p>
              </div>
            </div>
            <Link
              href="/superadmin/approvals"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors shrink-0"
            >
              Review & Approve <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Businesses */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Businesses
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white">{totalCompanies}</p>
          <p className="mt-1 text-xs text-slate-400">Registered SaaS tenant companies</p>
        </div>

        {/* Total Users */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Users
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white">{totalUsers}</p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="text-emerald-400 font-semibold">{approvedUsers} Active</span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-400 font-semibold">{pendingUsers.length} Pending</span>
          </div>
        </div>

        {/* Total Platform Invoices */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Invoices
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white">{totalInvoices}</p>
          <p className="mt-1 text-xs text-slate-400">GST Bills & Inward Purchases</p>
        </div>

        {/* Platform Volume / Turnover */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Platform Volume
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-amber-400">
            {formatCurrency(totalTurnover)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Total Billed Sales GMV</p>
        </div>
      </div>

      {/* Two Columns: Recent Businesses & Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Registered Businesses */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="h-4 w-4 text-amber-400" /> Recent Businesses
            </h2>
            <Link
              href="/superadmin/companies"
              className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
            >
              View All ({totalCompanies}) <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-800/60">
            {recentCompanies.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">No businesses registered yet.</p>
            ) : (
              recentCompanies.map((c) => {
                const turnover = c.invoices
                  .filter((i) => i.type === "SALES")
                  .reduce((s, i) => s + parseFloat(i.grandTotal.toString()), 0);

                return (
                  <div key={c.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-200 truncate">{c.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {[c.city, c.state].filter(Boolean).join(", ") || c.email || "No location"} •{" "}
                        <span className="text-slate-400">{c.invoices.length} bills</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-amber-400">{formatCurrency(turnover)}</p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Audit Activity Log */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" /> Live Audit Trail
            </h2>
            <Link
              href="/superadmin/activity"
              className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1"
            >
              Full Logs <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-800/60">
            {recentActivities.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">No activity logged yet.</p>
            ) : (
              recentActivities.map((act) => (
                <div key={act.id} className="py-2.5 flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-300">
                        {act.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(act.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {act.details || act.userEmail || "—"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
