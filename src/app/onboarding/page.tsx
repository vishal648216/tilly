"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    city: "",
    state: "",
    gstin: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-lg">
            T
          </div>
          <h1 className="text-2xl font-bold">Welcome! Let&apos;s set up your company</h1>
          <p className="text-sm text-slate-500">Ye 2 minute ka setup hai</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="label">Company / Shop Name *</label>
            <input
              className="input"
              placeholder="Aapki dukan ka naam"
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">City</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>
            <div>
              <label className="label">State</label>
              <input
                className="input"
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">GSTIN (optional)</label>
            <input
              className="input"
              placeholder="27ABCDE1234F1Z5"
              maxLength={15}
              value={form.gstin}
              onChange={(e) => update("gstin", e.target.value.toUpperCase())}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating..." : "Start Taily →"}
          </button>
        </form>
      </div>
    </div>
  );
}
