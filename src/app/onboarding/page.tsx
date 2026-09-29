"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isValidGstin } from "@/lib/validators";
import { Building2, AlertCircle, ArrowRight, FileText, MapPin } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    city: "",
    state: "",
    gstin: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const isGstinValid = useMemo(() => {
    if (!form.gstin.trim()) return true;
    return isValidGstin(form.gstin);
  }, [form.gstin]);

  const isFormValid = form.companyName.trim().length >= 2 && isGstinValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    setTouched({ companyName: true, gstin: true });

    if (form.companyName.trim().length < 2) {
      setError("Company / Dukan ka naam kam se kam 2 characters ka hona chahiye.");
      return;
    }

    if (form.gstin.trim() && !isGstinValid) {
      setError("GSTIN ka format galat hai (15 characters: 27ABCDE1234F1Z5).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          gstin: form.gstin.trim().toUpperCase() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set up company");
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white shadow-xl shadow-emerald-600/20">
            T
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome! Set up your Business
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            2 minute me aapki company ka chart of accounts ready ho jayega
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="card space-y-4 p-6 shadow-xl border-slate-200/80 bg-white/95 backdrop-blur-sm"
        >
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
              <div className="text-xs">{error}</div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Company / Shop Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Building2 className="h-4 w-4" />
              </div>
              <input
                className="input pl-10"
                placeholder="Sharma Traders Pvt Ltd"
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">City</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <MapPin className="h-4 w-4" />
                </div>
                <input
                  className="input pl-10"
                  placeholder="Mumbai"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">State</label>
              <input
                className="input"
                placeholder="Maharashtra"
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                GSTIN <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              {form.gstin && (
                <span className={`text-[11px] font-medium ${isGstinValid ? "text-emerald-600" : "text-red-500"}`}>
                  {isGstinValid ? "✓ Valid GSTIN" : "✕ 15 characters"}
                </span>
              )}
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <FileText className="h-4 w-4" />
              </div>
              <input
                className="input pl-10 font-mono uppercase"
                placeholder="27ABCDE1234F1Z5"
                maxLength={15}
                value={form.gstin}
                onChange={(e) => update("gstin", e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
          >
            {loading ? "Setting up Company..." : "Start Accounting"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>
      </div>
    </div>
  );
}
