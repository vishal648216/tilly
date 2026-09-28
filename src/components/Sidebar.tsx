"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  ShoppingCart,
  Wallet,
  Users,
  Package,
  CalendarDays,
  BookOpen,
  FolderArchive,
  FileSpreadsheet,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Sparkles,
  Database,
  ArrowRight,
  ShieldCheck,
  ChevronRight
} from "lucide-react";

interface NavGroup {
  title: string;
  items: {
    href: string;
    label: string;
    icon: any;
    badge?: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Transactions",
    items: [
      { href: "/invoices", label: "Invoices (Sales)", icon: Receipt },
      { href: "/purchases", label: "Purchases", icon: ShoppingCart },
      { href: "/expenses", label: "Expenses", icon: Wallet },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/parties", label: "Parties (CRM)", icon: Users },
      { href: "/items", label: "Items & Stock", icon: Package },
      { href: "/day-book", label: "Day Book", icon: CalendarDays },
    ],
  },
  {
    title: "Accounting & Ledger",
    items: [
      { href: "/ledger", label: "Party Ledger", icon: BookOpen },
      { href: "/ledger/account", label: "Account Ledger", icon: FolderArchive },
      { href: "/vouchers", label: "Vouchers & Journal", icon: FileSpreadsheet },
    ],
  },
  {
    title: "Reports & Setup",
    items: [
      { href: "/reports", label: "Reports & Backup", icon: BarChart3 },
      { href: "/settings", label: "Settings & UPI QR", icon: Settings },
    ],
  },
];

export default function Sidebar({ companyName }: { companyName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/80 bg-white shadow-xs transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo & Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 font-extrabold text-slate-950 shadow-md shadow-emerald-500/20">
              T
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-white">Taily</span>
                <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-none">Smart Accounting</p>
            </div>
          </div>
        </div>

        {/* Company Quick Badge */}
        <div className="border-b border-slate-100 px-4 py-2.5 bg-slate-50/70 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Current Business</p>
            <p className="truncate text-xs font-bold text-slate-800">{companyName}</p>
          </div>
          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 ml-2" title="Database Connected" />
        </div>

        {/* Nav list */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : item.href === "/ledger"
                      ? pathname === "/ledger"
                      : pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                        active
                          ? "bg-emerald-50 text-emerald-800 font-bold shadow-2xs"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {active && (
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Database & Sync Status Mini-Widget */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="rounded-xl bg-white p-2.5 border border-slate-200/70 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[11px] font-bold text-slate-800">Double-Entry DB</span>
              </div>
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                Active
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Instant Excel export & UPI invoice ready
            </p>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-1.5 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile top bar with hamburger */}
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(!open)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-slate-900">Taily</span>
        </div>
      </div>
    </>
  );
}

