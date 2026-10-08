"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Plus, ShieldCheck, Loader2 } from "lucide-react";

interface CompanyItem {
  id: string;
  name: string;
  legalName: string | null;
  gstin: string | null;
  role: string;
  isActive: boolean;
}

export default function CompanySwitcher({ activeCompanyName }: { activeCompanyName: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadCompanies() {
    try {
      setLoading(true);
      const res = await fetch("/api/companies");
      const data = await res.json();
      if (data.ok || data.companies) {
        setCompanies(data.companies || []);
      }
    } catch (e) {
      console.error("Failed to load companies:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    if (!isOpen) {
      loadCompanies();
    }
    setIsOpen(!isOpen);
  }

  async function handleSwitch(companyId: string) {
    try {
      setSwitchingId(companyId);
      const res = await fetch("/api/companies/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (data.ok) {
        setIsOpen(false);
        router.refresh();
        window.location.reload();
      } else {
        alert(data.error || "Failed to switch company");
      }
    } catch (err: any) {
      alert(err.message || "Failed to switch company");
    } finally {
      setSwitchingId(null);
    }
  }

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
    COMPANY_ADMIN: "bg-emerald-100 text-emerald-800 border-emerald-200",
    ACCOUNTANT: "bg-blue-100 text-blue-800 border-blue-200",
    SALES_USER: "bg-amber-100 text-amber-800 border-amber-200",
    PURCHASE_USER: "bg-indigo-100 text-indigo-800 border-indigo-200",
    INVENTORY_USER: "bg-cyan-100 text-cyan-800 border-cyan-200",
    VIEWER: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 rounded-xl bg-slate-50/90 hover:bg-white px-2.5 sm:px-3 py-1.5 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all text-left group"
        title="Switch active organization"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-700 shrink-0">
          <Building2 className="h-3 w-3" />
        </div>
        <span className="text-xs font-bold text-slate-800 truncate max-w-[140px] sm:max-w-[200px]">
          {activeCompanyName}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-2 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Switch Business Organization
            </span>
            {loading && <Loader2 className="h-3.5 w-3.5 text-emerald-600 animate-spin" />}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 py-1">
            {companies.map((c) => {
              const isCurrent = c.name === activeCompanyName || c.isActive;
              const isSwitching = switchingId === c.id;
              const badgeClass = roleColors[c.role] || "bg-slate-100 text-slate-700 border-slate-200";

              return (
                <button
                  key={c.id}
                  onClick={() => !isCurrent && handleSwitch(c.id)}
                  disabled={isCurrent || isSwitching}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left transition-all ${
                    isCurrent
                      ? "bg-emerald-50/80 border border-emerald-200/70"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        isCurrent ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {c.gstin ? `GST: ${c.gstin}` : "No GSTIN"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${badgeClass}`}
                    >
                      {c.role.replace("_", " ")}
                    </span>
                    {isCurrent && <Check className="h-4 w-4 text-emerald-600" />}
                    {isSwitching && <Loader2 className="h-3.5 w-3.5 text-emerald-600 animate-spin" />}
                  </div>
                </button>
              );
            })}

            {!loading && companies.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">No other companies found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
