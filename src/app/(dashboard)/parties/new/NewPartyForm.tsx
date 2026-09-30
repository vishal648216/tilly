"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  isValidEmail,
  isValidPhone,
  isValidGstin,
  isValidPincode,
} from "@/lib/validators";
import {
  UserPlus,
  Phone,
  Mail,
  FileText,
  MapPin,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  Building,
} from "lucide-react";

export default function NewPartyForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    type: "CUSTOMER",
    phone: "",
    email: "",
    gstin: "",
    pan: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    openingBalance: "",
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleBlur(key: string) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  const isPhoneValid = useMemo(() => {
    if (!form.phone.trim()) return true; // optional
    return isValidPhone(form.phone);
  }, [form.phone]);

  const isEmailValid = useMemo(() => {
    if (!form.email.trim()) return true; // optional
    return isValidEmail(form.email);
  }, [form.email]);

  const isGstinValid = useMemo(() => {
    if (!form.gstin.trim()) return true; // optional
    return isValidGstin(form.gstin);
  }, [form.gstin]);

  const isPincodeValid = useMemo(() => {
    if (!form.pincode.trim()) return true; // optional
    return isValidPincode(form.pincode);
  }, [form.pincode]);

  const isFormValid =
    form.name.trim().length >= 2 &&
    isPhoneValid &&
    isEmailValid &&
    isGstinValid &&
    isPincodeValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    setTouched({
      name: true,
      phone: true,
      email: true,
      gstin: true,
      pincode: true,
    });

    if (form.name.trim().length < 2) {
      setError("Party name must be at least 2 characters long.");
      return;
    }
    if (form.phone.trim() && !isPhoneValid) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (form.email.trim() && !isEmailValid) {
      setError("Please enter a valid email address (e.g. party@business.com).");
      return;
    }
    if (form.gstin.trim() && !isGstinValid) {
      setError("Invalid GSTIN format (must be 15 alphanumeric characters, e.g. 27ABCDE1234F1Z5).");
      return;
    }
    if (form.pincode.trim() && !isPincodeValid) {
      setError("PIN code must be exactly 6 digits (e.g. 400001).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          phone: form.phone.trim() || null,
          email: form.email.trim().toLowerCase() || null,
          gstin: form.gstin.trim().toUpperCase() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          pincode: form.pincode.trim() || null,
          openingBalance: form.openingBalance ? parseFloat(form.openingBalance) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create party");
      router.push("/parties");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add New Party</h1>
          <p className="text-sm text-slate-500">Customer ya Supplier create karein with complete GST profile</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-900">Validation Error</p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="card grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
        {/* Name */}
        <div>
          <label className="label">
            Party / Business Name <span className="text-red-500">*</span>
          </label>
          <input
            className={`input ${touched.name && form.name.trim().length < 2 ? "border-red-300 bg-red-50/20" : ""}`}
            placeholder="Ramesh Traders"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            onBlur={() => handleBlur("name")}
            required
          />
          {touched.name && form.name.trim().length < 2 && (
            <p className="mt-1 text-xs text-red-600">Naam kam se kam 2 characters ka ho</p>
          )}
        </div>

        {/* Type */}
        <div>
          <label className="label">Party Type</label>
          <select className="input" value={form.type} onChange={(e) => update("type", e.target.value)}>
            <option value="CUSTOMER">Customer (Grahak)</option>
            <option value="VENDOR">Vendor / Supplier (Vyapari)</option>
            <option value="BOTH">Both (Customer & Supplier)</option>
          </select>
        </div>

        {/* Phone */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0">Mobile Number (10 Digits)</label>
            {form.phone && (
              <span className={`text-[11px] font-medium ${isPhoneValid ? "text-emerald-600" : "text-red-500"}`}>
                {isPhoneValid ? "✓ Valid 10-digit" : "✕ 10 digit number daalein"}
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

        {/* Email */}
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
              placeholder="ramesh@traders.com"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              onBlur={() => handleBlur("email")}
            />
          </div>
        </div>

        {/* GSTIN */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0">GSTIN (15 Characters)</label>
            {form.gstin && (
              <span className={`text-[11px] font-medium ${isGstinValid ? "text-emerald-600" : "text-red-500"}`}>
                {isGstinValid ? "✓ Valid GSTIN" : "✕ Format: 27ABCDE1234F1Z5"}
              </span>
            )}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <FileText className="h-4 w-4" />
            </div>
            <input
              maxLength={15}
              className={`input pl-10 uppercase font-mono ${form.gstin && !isGstinValid ? "border-red-300 bg-red-50/20" : ""}`}
              placeholder="27ABCDE1234F1Z5"
              value={form.gstin}
              onChange={(e) => update("gstin", e.target.value.toUpperCase())}
              onBlur={() => handleBlur("gstin")}
            />
          </div>
        </div>

        {/* Opening Balance */}
        <div>
          <label className="label">Opening Balance (₹)</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <IndianRupee className="h-4 w-4" />
            </div>
            <input
              type="number"
              step="any"
              className="input pl-10"
              placeholder="0.00"
              value={form.openingBalance}
              onChange={(e) => update("openingBalance", e.target.value)}
            />
          </div>
        </div>

        {/* Address */}
        <div className="sm:col-span-2">
          <label className="label">Address / Shop Address</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <MapPin className="h-4 w-4" />
            </div>
            <input
              className="input pl-10"
              placeholder="Shop No. 12, Main Market Road"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>
        </div>

        {/* City */}
        <div>
          <label className="label">City</label>
          <input className="input" placeholder="Mumbai" value={form.city} onChange={(e) => update("city", e.target.value)} />
        </div>

        {/* State */}
        <div>
          <label className="label">State</label>
          <input className="input" placeholder="Maharashtra" value={form.state} onChange={(e) => update("state", e.target.value)} />
        </div>

        {/* Pincode */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0">Pincode (6 Digits)</label>
            {form.pincode && (
              <span className={`text-[11px] font-medium ${isPincodeValid ? "text-emerald-600" : "text-red-500"}`}>
                {isPincodeValid ? "✓ Valid Pincode" : "✕ 6 digits daalein"}
              </span>
            )}
          </div>
          <input
            maxLength={6}
            className={`input ${form.pincode && !isPincodeValid ? "border-red-300 bg-red-50/20" : ""}`}
            placeholder="400001"
            value={form.pincode}
            onChange={(e) => update("pincode", e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={() => handleBlur("pincode")}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !isFormValid}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? "Saving Party..." : "Save Party"}
        </button>
        <button type="button" onClick={() => router.push("/parties")} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
