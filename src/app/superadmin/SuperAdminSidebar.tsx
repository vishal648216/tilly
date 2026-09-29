"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldAlert,
  LayoutDashboard,
  UserCheck,
  Building2,
  Users,
  FileText,
  Activity,
  Server,
  LogOut,
  ArrowRight,
  Menu,
  X,
  ExternalLink,
  Crown,
} from "lucide-react";

export default function SuperAdminSidebar({
  adminName,
  adminEmail,
  pendingCount,
}: {
  adminName: string;
  adminEmail: string;
  pendingCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const navItems = [
    {
      href: "/superadmin",
      label: "Super Dashboard",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: "/superadmin/approvals",
      label: "Pending Approvals",
      icon: UserCheck,
      badge: pendingCount > 0 ? `${pendingCount}` : undefined,
      badgeColor: "bg-amber-500 text-slate-950 font-bold",
    },
    {
      href: "/superadmin/companies",
      label: "All Businesses",
      icon: Building2,
    },
    {
      href: "/superadmin/invoices",
      label: "Global Invoices",
      icon: FileText,
    },
    {
      href: "/superadmin/users",
      label: "All Users",
      icon: Users,
    },
    {
      href: "/superadmin/activity",
      label: "Live Audit Trail",
      icon: Activity,
    },
    {
      href: "/superadmin/system",
      label: "System & Backup",
      icon: Server,
    },
  ];

  return (
    <>
      {/* Mobile Menu Trigger */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 shadow-xl"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col justify-between border-r border-slate-800/80 bg-slate-900/95 backdrop-blur-md transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Brand & Super Admin Badge */}
          <div className="p-5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 shadow-lg shadow-amber-500/20 text-slate-950 font-extrabold text-lg">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base text-white tracking-tight">Taily</span>
                  <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                    SUPER ADMIN
                  </span>
                </div>
                <p className="text-xs text-slate-400">Master Control Center</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-4 space-y-1.5">
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Platform Master
            </p>
            {navItems.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${active ? "text-slate-950" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        active ? "bg-slate-950 text-amber-400" : item.badgeColor || "bg-amber-500 text-slate-950"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            <div className="pt-4 mt-4 border-t border-slate-800/80">
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Tenant Portal
              </p>
              <Link
                href="/"
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ExternalLink className="h-4 w-4 text-emerald-400" />
                  <span>Open Business Panel</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
              </Link>
            </div>
          </div>
        </div>

        {/* Admin Profile & Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-bold text-white truncate">{adminName}</p>
              <p className="text-[11px] text-slate-400 font-mono truncate">{adminEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout from Super Admin"
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
