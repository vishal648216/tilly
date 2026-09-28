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

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md shadow-xs">
      {/* Left side: Business context & Today's date */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-1.5 border border-slate-200/80 shadow-2xs">
          <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800 truncate max-w-[160px] sm:max-w-[220px]">
            {companyName}
          </span>
          <span className="hidden sm:inline-flex items-center rounded-md bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
            FY 24-25
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50/60 px-2.5 py-1.5 rounded-xl border border-slate-100">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{today}</span>
        </div>
      </div>

      {/* Right side: Live Sync, Quick Create, Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Cloud/DB sync indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live & Synced
        </div>

        {/* Quick Action: New Invoice */}
        <Link
          href="/invoices/new"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/30 hover:from-emerald-700 hover:to-teal-700 hover:shadow-md transition-all active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Invoice</span>
        </Link>

        {/* Quick Actions Dropdown / User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-slate-900 to-slate-700 text-xs font-bold text-white shadow-sm">
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
  );
}
