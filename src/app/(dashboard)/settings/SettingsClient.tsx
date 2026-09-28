"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UpiQrCode from "@/components/UpiQrCode";
import { 
  Settings, 
  QrCode, 
  Landmark, 
  Building2, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Save 
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

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
            Configure UPI QR payments, bank details, tax settings, and invoice print layout
          </p>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          Settings updated successfully! Dynamic UPI QR code and bank details are now live on all invoices.
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
                    This UPI ID will generate a scannable QR code on all invoices for Google Pay, PhonePe, and Paytm.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  UPI ID / VPA *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210@paytm or businessname@okhdfcbank"
                  value={form.upiId}
                  onChange={(e) => update("upiId", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter your registered Google Pay, PhonePe, Paytm, or Bank UPI handle.
                </p>
              </div>
            </div>

            {/* Live QR Preview */}
            <div className="flex flex-col items-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Live QR Preview
              </p>
              <UpiQrCode
                upiId={form.upiId}
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
              <label className="label">Account Number</label>
              <input
                className="input font-mono"
                placeholder="e.g. 50200012345678"
                value={form.accountNo}
                onChange={(e) => update("accountNo", e.target.value)}
              />
            </div>

            <div>
              <label className="label">IFSC Code</label>
              <input
                className="input font-mono uppercase"
                placeholder="e.g. HDFC0001234"
                value={form.ifscCode}
                onChange={(e) => update("ifscCode", e.target.value)}
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
              <label className="label">GSTIN (15-digit)</label>
              <input
                className="input font-mono uppercase"
                placeholder="24ABCDE1234F1Z5"
                value={form.gstin}
                onChange={(e) => update("gstin", e.target.value)}
              />
            </div>

            <div>
              <label className="label">PAN Number</label>
              <input
                className="input font-mono uppercase"
                placeholder="ABCDE1234F"
                value={form.pan}
                onChange={(e) => update("pan", e.target.value)}
              />
            </div>

            <div>
              <label className="label">Phone / Mobile</label>
              <input
                className="input"
                placeholder="9876543210"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>

            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="billing@mybusiness.in"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
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
            disabled={loading}
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
