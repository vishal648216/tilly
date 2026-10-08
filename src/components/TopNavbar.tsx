"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Plus, 
  Bell, 
  Receipt, 
  ShoppingBag, 
  Wallet, 
  Database,
  Building2,
  Calendar,
  Sparkles,
  LogOut,
  ChevronDown
} from "lucide-react";
import { useState } from "react";

import CompanySwitcher from "./CompanySwitcher";
import NotificationBell from "./NotificationBell";
import CommandPalette from "./CommandPalette";

interface TopNavbarProps {
  companyName: string;
  userName: string;
}

export default function TopNavbar({ companyName, userName }: { companyName: string; userName: string }) {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function handleOpenSearch() {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  }

  return (
    <>
      <CommandPalette />
      <header className="no-print sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 lg:px-8 backdrop-blur-md shadow-xs transition-colors">
        {/* Left side: Business context & Today's date */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <CompanySwitcher activeCompanyName={companyName} />

          <div className="hidden sm:inline-flex items-center rounded-xl bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/70 shadow-2xs">
            FY 26-27
          </div>

          <div className="hidden xl:flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50/90 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>{today}</span>
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <button
            onClick={handleOpenSearch}
            className="w-full flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/80 px-3.5 py-2 text-xs text-slate-400 hover:border-slate-300 hover:bg-white hover:text-slate-600 transition-all shadow-2xs group focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              <span className="truncate">Search invoices, parties, items, vouchers...</span>
            </div>
            <kbd className="rounded-lg bg-white px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-400 border border-slate-200/80 shadow-2xs">
              ctrl k
            </kbd>
          </button>
        </div>

        {/* Right side: Search (mobile), Notifications, Quick Create, Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Mobile search trigger */}
          <button
            onClick={handleOpenSearch}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors border border-slate-200/80 shadow-2xs"
            title="Search (Ctrl + K)"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Operational Notification Bell */}
          <NotificationBell />

          {/* Quick Action: New Invoice */}
          <Link
            href="/invoices/new"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Invoice</span>
          </Link>

          {/* Quick Actions Dropdown / User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2.5 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 hover:bg-slate-100/80 transition-all border border-transparent hover:border-slate-200/80 active:scale-98"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-xs font-extrabold text-white shadow-2xs ring-2 ring-slate-100">
                {userName ? userName.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-bold text-slate-900 leading-tight">{userName}</p>
                <p className="text-[10px] text-slate-400 font-medium">Administrator</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
            </button>

          {showUserMenu && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2"
              onMouseLeave={() => setShowUserMenu(false)}
            >
              <div className="border-b border-slate-100 p-2.5 mb-1">
                <p className="text-xs font-bold text-slate-900">{userName}</p>
                <p className="text-[11px] text-slate-500 truncate">{companyName}</p>
              </div>

              <Link
                href="/settings"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Building2 className="h-4 w-4 text-slate-400" />
                Company Settings & UPI
              </Link>

              <Link
                href="/reports"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Database className="h-4 w-4 text-slate-400" />
                Backup & Excel Export
              </Link>

              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4 text-red-500" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  </>
  );
}
