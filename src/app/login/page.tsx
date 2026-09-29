"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const isEmailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTouched({ email: true, password: true });

    if (!email.trim()) {
      setError("Kripya email address enter karein.");
      return;
    }

    if (!isEmailValid) {
      setError("Kripya valid email address enter karein (jaise: demo@taily.in).");
      return;
    }

    if (!password) {
      setError("Kripya password enter karein.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setEmail("demo@taily.in");
    setPassword("demo1234");
    setError("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white shadow-xl shadow-emerald-600/20">
            T
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Welcome to Taily
          </h1>
          <p className="mt-1 text-sm text-slate-500">Tally se bhi easy, modern accounting</p>
        </div>

        {/* Login Form Card */}
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-xl backdrop-blur-sm sm:p-8 space-y-4"
        >
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-sm text-red-800 animate-in fade-in duration-200">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
              <div className="flex-1">
                <p className="font-semibold text-xs text-red-800">Authentication Alert</p>
                <p className="mt-0.5 text-xs text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-4 ${
                  touched.email && email && !isEmailValid
                    ? "border-red-300 bg-red-50/20 focus:border-red-500 focus:ring-red-500/10 text-slate-900"
                    : "border-slate-200 bg-slate-50/50 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/10 text-slate-900"
                }`}
                placeholder="demo@taily.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                required
              />
            </div>
            {touched.email && email && !isEmailValid && (
              <p className="mt-1 text-xs text-red-600">
                Valid email format enter karein (jaise: demo@taily.in)
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Password <span className="text-red-500">*</span>
              </label>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 py-2.5 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Logging in...</span>
                </div>
              ) : (
                <>
                  <span>Login to Dashboard</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>

          {/* Demo Account Quick Access Box */}
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-center">
            <p className="text-xs text-slate-600">
              Testing ke liye demo account use karein:
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <code className="rounded-md bg-white border border-emerald-200 px-2 py-1 text-xs font-mono text-emerald-800">
                demo@taily.in / demo1234
              </code>
              <button
                type="button"
                onClick={fillDemo}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition"
              >
                <Sparkles className="h-3 w-3" /> Auto Fill
              </button>
            </div>
          </div>
        </form>

        {/* Footer Signup Link */}
        <p className="mt-6 text-center text-sm text-slate-500">
          Naya account banana hai?{" "}
          <Link
            href="/signup"
            className="font-semibold text-emerald-600 transition hover:text-emerald-700 hover:underline"
          >
            Create an account (Sign up)
          </Link>
        </p>
      </div>
    </div>
  );
}
