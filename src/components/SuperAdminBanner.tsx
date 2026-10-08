"use client";

import { ShieldAlert, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SuperAdminBanner({ companyName }: { companyName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleExit() {
    setLoading(true);
    try {
      await fetch("/api/superadmin/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      router.push("/superadmin");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="no-print print:hidden bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 sm:px-6 py-2.5 text-xs font-medium flex items-center justify-between shadow-xs border-b border-orange-500/30 sticky top-0 z-40 backdrop-blur-xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/20 shrink-0">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-200" />
        </div>
        <div className="flex items-center gap-2 truncate">
          <span className="font-bold text-[10px] uppercase tracking-wider bg-black/25 text-amber-100 px-2 py-0.5 rounded-md border border-white/10 shrink-0">
            Inspection Mode
          </span>
          <span className="truncate text-xs">
            Viewing & managing:{" "}
            <strong className="font-bold text-white underline decoration-amber-300 underline-offset-2">
              {companyName}
            </strong>
          </span>
        </div>
      </div>
      <button
        onClick={handleExit}
        disabled={loading}
        className="shrink-0 ml-3 inline-flex items-center gap-1.5 bg-black/30 hover:bg-black/50 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all border border-white/20 active:scale-95 shadow-2xs hover:shadow-xs"
      >
        <span>{loading ? "Exiting..." : "Exit to Super Admin Console"}</span>
        <ArrowRight className="h-3.5 w-3.5 text-amber-200" />
      </button>
    </div>
  );
}
