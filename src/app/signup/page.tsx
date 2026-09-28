"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-lg">
            T
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create your Taily account</h1>
          <p className="text-sm text-slate-500">2 minute me ready — bilkul free</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="border-b border-slate-100 pb-2 text-sm font-semibold text-slate-500">
            Aapki Jaankari
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full Name</label>
              <input className="input" placeholder="Pransh Sharma" value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="you@email.com" value={form.email} onChange={(e) => update("email", e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Password</label>
              <input type="password" className="input" placeholder="Minimum 8 characters" value={form.password} onChange={(e) => update("password", e.target.value)} required minLength={8} />
            </div>
          </div>

          <div className="border-b border-slate-100 pb-2 pt-2 text-sm font-semibold text-slate-500">
            Aapki Company / Dukan
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Company / Shop Name</label>
              <input className="input" placeholder="Sharma General Store" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} required />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" placeholder="Mumbai" value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input" placeholder="Maharashtra" value={form.state} onChange={(e) => update("state", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">GSTIN (optional)</label>
              <input className="input" placeholder="27ABCDE1234F1Z5" value={form.gstin} onChange={(e) => update("gstin", e.target.value.toUpperCase())} maxLength={15} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account..." : "Create Account & Start"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Pehle se account hai?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
