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
    <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-md z-50 sticky top-0">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-200 animate-bounce" />
        <span>
          <strong className="font-bold">Super Admin Inspection Mode:</strong> You are currently viewing & managing{" "}
          <span className="underline decoration-amber-300 font-bold">{companyName}</span>
        </span>
      </div>
      <button
        onClick={handleExit}
        disabled={loading}
        className="inline-flex items-center gap-1.5 bg-black/40 hover:bg-black/60 px-3 py-1 rounded-lg text-xs font-bold text-amber-100 hover:text-white transition-all border border-amber-400/30 active:scale-95"
      >
        <span>{loading ? "Exiting..." : "Exit to Super Admin Console"}</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
