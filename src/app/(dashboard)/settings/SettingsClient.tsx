"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import UpiQrCode from "@/components/UpiQrCode";
import {
  isValidEmail,
  isValidPhone,
  isValidGstin,
  isValidPan,
  isValidIfsc,
  isValidUpi,
} from "@/lib/validators";
import {
  Settings,
  QrCode,
  Landmark,
  Building2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Save,
  Phone,
  Mail,
} from "lucide-react";

interface Company {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  pan: string | null;
  upiId: string | null;
  bankName: string | null;
  accountNo: string | null;
  ifscCode: string | null;
  branchName: string | null;
  terms: string | null;
}

export default function SettingsClient({ company }: { company: Company }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: company.name || "",
    legalName: company.legalName || "",
    email: company.email || "",
    phone: company.phone || "",
    address: company.address || "",
    city: company.city || "",
    state: company.state || "",
    pincode: company.pincode || "",
    gstin: company.gstin || "",
    pan: company.pan || "",
    upiId: company.upiId || "taily@upi",
    bankName: company.bankName || "State Bank of India",
    accountNo: company.accountNo || "123456789012",
    ifscCode: company.ifscCode || "SBIN0001234",
    branchName: company.branchName || "Main Branch",
    terms:
      company.terms ||
      "1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged on delayed payments after due date.\n3. Subject to local jurisdiction.",
  });

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleBlur(key: string) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  // --- Validations ---
  const isUpiValid = useMemo(() => {
    if (!form.upiId.trim()) return false;
    return isValidUpi(form.upiId);
  }, [form.upiId]);

  const isPhoneValid = useMemo(() => {
    if (!form.phone.trim()) return true;
    return isValidPhone(form.phone);
  }, [form.phone]);

  const isEmailValid = useMemo(() => {
    if (!form.email.trim()) return true;
    return isValidEmail(form.email);
  }, [form.email]);

  const isGstinValid = useMemo(() => {
    if (!form.gstin.trim()) return true;
    return isValidGstin(form.gstin);
  }, [form.gstin]);

  const isPanValid = useMemo(() => {
    if (!form.pan.trim()) return true;
    return isValidPan(form.pan);
  }, [form.pan]);

  const isIfscValid = useMemo(() => {
    if (!form.ifscCode.trim()) return true;
    return isValidIfsc(form.ifscCode);
  }, [form.ifscCode]);

  const isAccountNoValid = useMemo(() => {
    if (!form.accountNo.trim()) return true;
    const clean = form.accountNo.replace(/[^0-9]/g, "");
    return clean.length >= 9 && clean.length <= 18;
  }, [form.accountNo]);

  const isFormValid =
    form.name.trim().length >= 2 &&
    isUpiValid &&
    isPhoneValid &&
    isEmailValid &&
    isGstinValid &&
    isPanValid &&
    isIfscValid &&
    isAccountNoValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    setTouched({
      name: true,
      upiId: true,
      phone: true,
      email: true,
      gstin: true,
      pan: true,
      ifscCode: true,
      accountNo: true,
    });

    if (!form.name.trim()) {
      setError("Company Trade Name is required.");
      setLoading(false);
      return;
    }
    if (!isUpiValid) {
      setError("Please enter a valid UPI ID (e.g. 9876543210@paytm or business@okhdfcbank).");
      setLoading(false);
      return;
    }
    if (form.phone.trim() && !isPhoneValid) {
      setError("Please enter a valid 10-digit mobile number.");
      setLoading(false);
      return;
    }
    if (form.email.trim() && !isEmailValid) {
      setError("Please enter a valid email address (e.g. billing@mybusiness.in).");
      setLoading(false);
      return;
    }
    if (form.gstin.trim() && !isGstinValid) {
      setError("Invalid GSTIN format (must be 15 alphanumeric characters, e.g. 24ABCDE1234F1Z5).");
      setLoading(false);
      return;
    }
    if (form.pan.trim() && !isPanValid) {
      setError("Invalid PAN format (must be 10 characters: ABCDE1234F).");
      setLoading(false);
      return;
    }
    if (form.ifscCode.trim() && !isIfscValid) {
      setError("Invalid Bank IFSC code (11 characters: e.g. SBIN0001234).");
      setLoading(false);
      return;
    }
    if (form.accountNo.trim() && !isAccountNoValid) {
      setError("Bank Account Number must be between 9 and 18 digits.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          upiId: form.upiId.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim().toLowerCase() || null,
          gstin: form.gstin.trim().toUpperCase() || null,
          pan: form.pan.trim().toUpperCase() || null,
          ifscCode: form.ifscCode.trim().toUpperCase() || null,
          accountNo: form.accountNo.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");

      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Company & Invoice Settings</h1>
          <p className="text-sm text-slate-500">
            UPI QR payments, bank details, tax settings aur invoice print layout configure karein
          </p>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          Settings updated successfully! Dynamic UPI QR code aur bank details invoices par live ho chuki hain.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* UPI & Instant QR Code Section */}
        <div className="card p-6 bg-gradient-to-br from-emerald-50/40 to-teal-50/20 border-emerald-200/80">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2.5">
                <QrCode className="h-6 w-6 text-emerald-600" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Dynamic UPI QR Code (Instant Client Payments)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Yeh UPI ID sabhi sales invoices par scannable QR code banayegi (Google Pay, PhonePe, Paytm).
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    UPI ID / VPA *
                  </label>
                  {form.upiId && (
                    <span className={`text-[11px] font-medium ${isUpiValid ? "text-emerald-600" : "text-red-500"}`}>
                      {isUpiValid ? "✓ Valid UPI handle" : "✕ Format: user@bank"}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210@paytm or businessname@okhdfcbank"
                  value={form.upiId}
                  onChange={(e) => update("upiId", e.target.value)}
                  onBlur={() => handleBlur("upiId")}
                  className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:ring-4 ${
                    form.upiId && !isUpiValid
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
                      : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/10"
                  }`}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Registered Google Pay, PhonePe, Paytm ya Bank UPI ID enter karein.
                </p>
              </div>
            </div>

            {/* Live QR Preview */}
            <div className="flex flex-col items-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Live QR Preview
              </p>
              <UpiQrCode
                upiId={isUpiValid ? form.upiId : "demo@upi"}
                payeeName={form.name || "Business"}
                amount={999}
                invoiceNo="INV-SAMPLE"
              />
            </div>
          </div>
        </div>

        {/* Bank Account Details */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Landmark className="h-5 w-5 text-brand-600" />
            <h2 className="text-base font-bold text-slate-900">
              Bank Account Details (Printed on Invoices)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Bank Name</label>
              <input
                className="input"
                placeholder="e.g. HDFC Bank / State Bank of India"
                value={form.bankName}
                onChange={(e) => update("bankName", e.target.value)}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">Account Number (9-18 Digits)</label>
                {form.accountNo && (
                  <span className={`text-[11px] font-medium ${isAccountNoValid ? "text-emerald-600" : "text-red-500"}`}>
                    {isAccountNoValid ? "✓ Valid" : "✕ 9-18 digits daalein"}
                  </span>
                )}
              </div>
              <input
                className={`input font-mono ${form.accountNo && !isAccountNoValid ? "border-red-300 bg-red-50/20" : ""}`}
                placeholder="e.g. 50200012345678"
                value={form.accountNo}
                onChange={(e) => update("accountNo", e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={() => handleBlur("accountNo")}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">IFSC Code (11 Characters)</label>
                {form.ifscCode && (
                  <span className={`text-[11px] font-medium ${isIfscValid ? "text-emerald-600" : "text-red-500"}`}>
                    {isIfscValid ? "✓ Valid IFSC" : "✕ Format: SBIN0001234"}
                  </span>
                )}
              </div>
              <input
                maxLength={11}
                className={`input font-mono uppercase ${form.ifscCode && !isIfscValid ? "border-red-300 bg-red-50/20" : ""}`}
                placeholder="e.g. HDFC0001234"
                value={form.ifscCode}
                onChange={(e) => update("ifscCode", e.target.value.toUpperCase())}
                onBlur={() => handleBlur("ifscCode")}
              />
            </div>

            <div>
              <label className="label">Branch Name</label>
              <input
                className="input"
                placeholder="e.g. MG Road Branch, Ahmedabad"
                value={form.branchName}
                onChange={(e) => update("branchName", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Company Profile Details */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="h-5 w-5 text-brand-600" />
            <h2 className="text-base font-bold text-slate-900">
              Business Profile & Tax Registration
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Display Trade Name *</label>
              <input
                className="input font-semibold"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                onBlur={() => handleBlur("name")}
              />
            </div>

            <div>
              <label className="label">Legal Registered Name</label>
              <input
                className="input"
                placeholder="e.g. Sagar Enterprises Pvt. Ltd."
                value={form.legalName}
                onChange={(e) => update("legalName", e.target.value)}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">GSTIN (15 Characters)</label>
                {form.gstin && (
                  <span className={`text-[11px] font-medium ${isGstinValid ? "text-emerald-600" : "text-red-500"}`}>
                    {isGstinValid ? "✓ Valid GSTIN" : "✕ Format: 24ABCDE1234F1Z5"}
                  </span>
                )}
              </div>
              <input
                maxLength={15}
                className={`input font-mono uppercase ${form.gstin && !isGstinValid ? "border-red-300 bg-red-50/20" : ""}`}
                placeholder="24ABCDE1234F1Z5"
                value={form.gstin}
                onChange={(e) => update("gstin", e.target.value.toUpperCase())}
                onBlur={() => handleBlur("gstin")}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">PAN Number (10 Characters)</label>
                {form.pan && (
                  <span className={`text-[11px] font-medium ${isPanValid ? "text-emerald-600" : "text-red-500"}`}>
                    {isPanValid ? "✓ Valid PAN" : "✕ Format: ABCDE1234F"}
                  </span>
                )}
              </div>
              <input
                maxLength={10}
                className={`input font-mono uppercase ${form.pan && !isPanValid ? "border-red-300 bg-red-50/20" : ""}`}
                placeholder="ABCDE1234F"
                value={form.pan}
                onChange={(e) => update("pan", e.target.value.toUpperCase())}
                onBlur={() => handleBlur("pan")}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">Phone / Mobile (10 Digits)</label>
                {form.phone && (
                  <span className={`text-[11px] font-medium ${isPhoneValid ? "text-emerald-600" : "text-red-500"}`}>
                    {isPhoneValid ? "✓ Valid phone" : "✕ 10 digits daalein"}
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Phone className="h-4 w-4" />
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  className={`input pl-10 ${form.phone && !isPhoneValid ? "border-red-300 bg-red-50/20" : ""}`}
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={() => handleBlur("phone")}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">Email Address</label>
                {form.email && (
                  <span className={`text-[11px] font-medium ${isEmailValid ? "text-emerald-600" : "text-red-500"}`}>
                    {isEmailValid ? "✓ Valid email" : "✕ Invalid format"}
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  className={`input pl-10 ${form.email && !isEmailValid ? "border-red-300 bg-red-50/20" : ""}`}
                  placeholder="billing@mybusiness.in"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="label">Business Address</label>
              <input
                className="input"
                placeholder="Shop No. 4, Commercial Complex, Main Road"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>

            <div>
              <label className="label">City</label>
              <input
                className="input"
                placeholder="Ahmedabad"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>

            <div>
              <label className="label">State</label>
              <input
                className="input"
                placeholder="Gujarat"
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="h-5 w-5 text-brand-600" />
            <h2 className="text-base font-bold text-slate-900">
              Invoice Terms & Conditions
            </h2>
          </div>

          <div>
            <textarea
              rows={4}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm font-sans outline-none focus:border-brand-500"
              value={form.terms}
              onChange={(e) => update("terms", e.target.value)}
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-brand-700 disabled:opacity-50 transition-all"
          >
            <Save className="h-4 w-4" />
            {loading ? "Saving Settings..." : "Save All Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
