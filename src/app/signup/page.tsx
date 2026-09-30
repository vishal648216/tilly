"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  FileText,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    companyName: "",
    city: "",
    state: "",
    gstin: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleBlur(key: string) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  // --- Validations ---
  const isEmailValid = useMemo(() => {
    if (!form.email) return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email.trim());
  }, [form.email]);

  const passwordRules = useMemo(() => {
    const p = form.password;
    return {
      length: p.length >= 8,
      hasLetter: /[a-zA-Z]/.test(p),
      hasNumber: /[0-9]/.test(p),
      hasSpecial: /[^a-zA-Z0-9]/.test(p),
    };
  }, [form.password]);

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (passwordRules.length) score += 35;
    if (passwordRules.hasLetter) score += 25;
    if (passwordRules.hasNumber) score += 25;
    if (passwordRules.hasSpecial) score += 15;
    return Math.min(score, 100);
  }, [passwordRules]);

  const isPasswordValid = passwordRules.length && passwordRules.hasLetter && passwordRules.hasNumber;
  const isConfirmPasswordValid = form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  const isGstinValid = useMemo(() => {
    if (!form.gstin) return true; // optional
    const clean = form.gstin.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return clean.length === 15 && /^[0-9]{2}[A-Z0-9]{13}$/.test(clean);
  }, [form.gstin]);

  const isPhoneValid = useMemo(() => {
    if (!form.phone) return true; // optional
    let digits = form.phone.replace(/[^0-9]/g, "");
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return digits.length === 10;
  }, [form.phone]);

  const isFormValid =
    form.name.trim().length >= 2 &&
    isEmailValid &&
    isPasswordValid &&
    isConfirmPasswordValid &&
    form.companyName.trim().length >= 2 &&
    isGstinValid &&
    isPhoneValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Mark all as touched
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
      companyName: true,
      gstin: true,
      phone: true,
    });

    if (!isEmailValid) {
      setError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }
    if (!isPasswordValid) {
      setError("Password must contain at least 8 characters, including a letter and a number.");
      return;
    }
    if (!isConfirmPasswordValid) {
      setError("Passwords do not match. Please re-enter your password.");
      return;
    }
    if (!form.companyName.trim()) {
      setError("Please enter your Company / Business name.");
      return;
    }
    if (form.gstin && !isGstinValid) {
      setError("Invalid GSTIN format (must be 15 alphanumeric characters, e.g. 27ABCDE1234F1Z5).");
      return;
    }
    if (form.phone && !isPhoneValid) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          phone: form.phone.trim(),
          companyName: form.companyName.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          gstin: form.gstin.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");

      if (data.pendingApproval) {
        setSubmittedSuccess(true);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (submittedSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50 px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl border border-emerald-100 bg-white p-8 shadow-2xl text-center animate-in fade-in zoom-in duration-200">
          <div className="mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-inner">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Registration Submitted!</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Aapka registration safalta-purvak receive ho gaya hai. Suraksha ke liye har naye business account ko{" "}
            <strong className="text-slate-800 font-semibold">Super Admin dwara verify</strong> kiya jata hai.
          </p>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-200/80 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Name:</span>
              <span className="font-semibold text-slate-800">{form.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Business / Company:</span>
              <span className="font-semibold text-slate-800">{form.companyName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="font-mono text-slate-800">{form.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                ⏳ Pending Admin Approval
              </span>
            </div>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            Jaise hi Super Admin aapki request accept karenge, aap apne email aur password se turant login kar sakenge.
          </p>

          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors"
            >
              Go to Login Page <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50 px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white shadow-xl shadow-emerald-600/20">
            T
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Create your Taily Account
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Smart, GST-Ready Accounting Software — 2 Minute Setup
          </p>
        </div>

        {/* Signup Form Card */}
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-xl backdrop-blur-sm sm:p-8"
        >
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-800 animate-in fade-in duration-200">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">Validation Error</p>
                <p className="mt-0.5 text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* SECTION 1: Personal Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <User className="h-4 w-4" />
              <span>1. Aapki Personal Details</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Full Name */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                    placeholder="Pransh Sharma"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    onBlur={() => handleBlur("name")}
                    required
                  />
                </div>
                {touched.name && form.name.trim().length < 2 && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" /> Naam kam se kam 2 akshar ka ho
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  {touched.email && form.email && (
                    <span className="flex items-center gap-1 text-[11px] font-medium">
                      {isEmailValid ? (
                        <span className="text-emerald-600 flex items-center gap-0.5">
                          <CheckCircle2 className="h-3 w-3" /> Valid
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-0.5">
                          <XCircle className="h-3 w-3" /> Invalid format
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-4 ${
                      touched.email && form.email && !isEmailValid
                        ? "border-red-300 bg-red-50/20 text-slate-900 focus:border-red-500 focus:ring-red-500/10"
                        : touched.email && isEmailValid
                        ? "border-emerald-300 bg-emerald-50/20 text-slate-900 focus:border-emerald-500 focus:ring-emerald-500/10"
                        : "border-slate-200 bg-slate-50/50 text-slate-900 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/10"
                    }`}
                    placeholder="you@email.com"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    required
                  />
                </div>
                {touched.email && form.email && !isEmailValid && (
                  <p className="mt-1 text-xs text-red-600">
                    Sahi email daalein (example: rahul@gmail.com)
                  </p>
                )}
              </div>
            </div>

            {/* Phone */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Mobile Number <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                {form.phone && !isPhoneValid && (
                  <span className="text-xs text-red-500">10 digit number daalein</span>
                )}
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Phone className="h-4 w-4" />
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={() => handleBlur("phone")}
                />
              </div>
            </div>

            {/* Passwords Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Password */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`w-full rounded-xl border pl-10 pr-10 py-2.5 text-sm transition focus:outline-none focus:ring-4 ${
                      touched.password && form.password && !isPasswordValid
                        ? "border-red-300 bg-red-50/20 focus:border-red-500 focus:ring-red-500/10"
                        : touched.password && isPasswordValid
                        ? "border-emerald-300 bg-emerald-50/20 focus:border-emerald-500 focus:ring-emerald-500/10"
                        : "border-slate-200 bg-slate-50/50 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/10"
                    }`}
                    placeholder="Min 8 chars (e.g. Pass@123)"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    onBlur={() => handleBlur("password")}
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

              {/* Confirm Password */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className={`w-full rounded-xl border pl-10 pr-10 py-2.5 text-sm transition focus:outline-none focus:ring-4 ${
                      touched.confirmPassword && form.confirmPassword && !isConfirmPasswordValid
                        ? "border-red-300 bg-red-50/20 focus:border-red-500 focus:ring-red-500/10"
                        : touched.confirmPassword && isConfirmPasswordValid
                        ? "border-emerald-300 bg-emerald-50/20 focus:border-emerald-500 focus:ring-emerald-500/10"
                        : "border-slate-200 bg-slate-50/50 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/10"
                    }`}
                    placeholder="Repeat password"
                    value={form.confirmPassword}
                    onChange={(e) => update("confirmPassword", e.target.value)}
                    onBlur={() => handleBlur("confirmPassword")}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Real-time Password Strength Meter & Rules */}
            {form.password && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 space-y-2.5 transition-all">
                {/* Progress bar */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Password Strength:</span>
                  <span
                    className={`font-bold ${
                      passwordStrength >= 80
                        ? "text-emerald-600"
                        : passwordStrength >= 50
                        ? "text-amber-600"
                        : "text-red-500"
                    }`}
                  >
                    {passwordStrength >= 80
                      ? "Strong 🔒"
                      : passwordStrength >= 50
                      ? "Medium ⚡"
                      : "Weak ⚠️"}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      passwordStrength >= 80
                        ? "bg-emerald-500"
                        : passwordStrength >= 50
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${passwordStrength}%` }}
                  />
                </div>

                {/* Requirement Checkpoints */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                  <div
                    className={`flex items-center gap-1.5 ${
                      passwordRules.length ? "text-emerald-700 font-medium" : "text-slate-500"
                    }`}
                  >
                    {passwordRules.length ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-slate-300" />
                    )}
                    Min 8 characters
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      passwordRules.hasLetter ? "text-emerald-700 font-medium" : "text-slate-500"
                    }`}
                  >
                    {passwordRules.hasLetter ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-slate-300" />
                    )}
                    At least 1 letter (A-Z)
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      passwordRules.hasNumber ? "text-emerald-700 font-medium" : "text-slate-500"
                    }`}
                  >
                    {passwordRules.hasNumber ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-slate-300" />
                    )}
                    At least 1 number (0-9)
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      isConfirmPasswordValid ? "text-emerald-700 font-medium" : "text-slate-500"
                    }`}
                  >
                    {isConfirmPasswordValid ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-slate-300" />
                    )}
                    Passwords match
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Company / Business Details */}
          <div className="mt-6 space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <Building2 className="h-4 w-4" />
              <span>2. Aapki Company / Dukan ki Details</span>
            </div>

            {/* Company / Shop Name */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Company / Shop Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Building2 className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                  placeholder="Sharma General Store Pvt Ltd"
                  value={form.companyName}
                  onChange={(e) => update("companyName", e.target.value)}
                  onBlur={() => handleBlur("companyName")}
                  required
                />
              </div>
            </div>

            {/* City and State */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">City</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                    placeholder="Mumbai"
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">State</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                  placeholder="Maharashtra"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                />
              </div>
            </div>

            {/* GSTIN */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  GSTIN <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                {form.gstin && (
                  <span className={`text-xs font-medium ${isGstinValid ? "text-emerald-600" : "text-red-500"}`}>
                    {isGstinValid ? "✓ Valid GSTIN format" : "✕ 15 characters valid GSTIN daalein"}
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <FileText className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  maxLength={15}
                  className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-sm uppercase transition focus:outline-none focus:ring-4 ${
                    form.gstin && !isGstinValid
                      ? "border-red-300 bg-red-50/20 focus:border-red-500 focus:ring-red-500/10"
                      : "border-slate-200 bg-slate-50/50 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/10"
                  }`}
                  placeholder="27ABCDE1234F1Z5"
                  value={form.gstin}
                  onChange={(e) => update("gstin", e.target.value.toUpperCase())}
                  onBlur={() => handleBlur("gstin")}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-8">
            <button
              type="submit"
              disabled={loading || (touched.email && !isFormValid)}
              className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Creating Account & Setting up Ledger...</span>
                </div>
              ) : (
                <>
                  <span>Create Account & Start Accounting</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer Login Link */}
        <p className="mt-6 text-center text-sm text-slate-500">
          Pehle se account hai?{" "}
          <Link
            href="/login"
            className="font-semibold text-emerald-600 transition hover:text-emerald-700 hover:underline"
          >
            Sign in / Login karein
          </Link>
        </p>
      </div>
    </div>
  );
}
