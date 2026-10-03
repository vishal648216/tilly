"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  isValidEmail,
  isValidPhone,
  isValidGstin,
  isValidPincode,
  isValidPan,
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
  CreditCard,
  Briefcase,
  Sliders,
} from "lucide-react";

type PartyTab = "basic" | "advanced";

export default function NewPartyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramType = searchParams.get("type");
  const initialType = paramType === "VENDOR" ? "VENDOR" : paramType === "BOTH" ? "BOTH" : "CUSTOMER";
  const redirectUrl = searchParams.get("redirect") || "/parties";

  const [activeTab, setActiveTab] = useState<PartyTab>("basic");

  const [form, setForm] = useState({
    name: "",
    type: initialType,
    phone: "",
    email: "",
    gstin: "",
    pan: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    openingBalance: "",

    // Advanced & Financials
    contactPerson: "",
    code: "",
    billingAddress: "",
    shippingAddress: "",
    gstTreatment: "REGISTERED",
    creditLimit: "",
    creditDays: "",
    paymentTerms: "Net 30 Days",
    priceList: "RETAIL",
    bankDetails: "",
    salesperson: "",
    notes: "",
    tags: "",
  });

  // Dynamic Custom Fields
  const [customFieldsDef, setCustomFieldsDef] = useState<any[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  useEffect(() => {
    const targetEntityType = form.type === "VENDOR" ? "SUPPLIER" : "CUSTOMER";
    fetch(`/api/custom-fields?entityType=${targetEntityType}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.customFields)) {
          setCustomFieldsDef(data.customFields);
        }
      })
      .catch(() => {});
  }, [form.type]);

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

  const isPincodeValid = useMemo(() => {
    if (!form.pincode.trim()) return true;
    return isValidPincode(form.pincode);
  }, [form.pincode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    setTouched({
      name: true,
      phone: true,
      email: true,
      gstin: true,
      pan: true,
      pincode: true,
    });

    if (form.name.trim().length < 2) {
      setError("Party name must be at least 2 characters long.");
      setActiveTab("basic");
      return;
    }
    if (form.phone.trim() && !isPhoneValid) {
      setError("Please enter a valid 10-digit mobile number.");
      setActiveTab("basic");
      return;
    }
    if (form.email.trim() && !isEmailValid) {
      setError("Please enter a valid email address.");
      setActiveTab("basic");
      return;
    }
    if (form.gstin.trim() && !isGstinValid) {
      setError("Invalid GSTIN format (must be 15 alphanumeric characters).");
      setActiveTab("basic");
      return;
    }
    if (form.pan.trim() && !isPanValid) {
      setError("Invalid PAN format (must be 10 characters, e.g. ABCDE1234F).");
      setActiveTab("basic");
      return;
    }
    if (form.pincode.trim() && !isPincodeValid) {
      setError("PIN code must be exactly 6 digits.");
      setActiveTab("basic");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        type: form.type,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        gstin: form.gstin.trim() || null,
        pan: form.pan.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        pincode: form.pincode.trim() || null,
        openingBalance: form.openingBalance ? parseFloat(form.openingBalance) : 0,

        contactPerson: form.contactPerson.trim() || null,
        code: form.code.trim() || null,
        billingAddress: form.billingAddress.trim() || form.address.trim() || null,
        shippingAddress: form.shippingAddress.trim() || null,
        gstTreatment: form.gstTreatment,
        creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : 0,
        creditDays: form.creditDays ? parseInt(form.creditDays) : 0,
        paymentTerms: form.paymentTerms.trim() || null,
        priceList: form.priceList,
        bankDetails: form.bankDetails.trim() || null,
        salesperson: form.salesperson.trim() || null,
        notes: form.notes.trim() || null,
        tags: form.tags.trim() || null,

        customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : null,
      };

      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create party");

      router.push(redirectUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to save party");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Add New {form.type === "VENDOR" ? "Supplier / Vendor" : form.type === "BOTH" ? "Customer & Supplier" : "Customer"}
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Create unified master profile for billing, ledgers, and credit limits
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("basic")}
          className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition-colors ${
            activeTab === "basic"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Building className="h-4 w-4" />
          1. Basic & Contact Info
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("advanced")}
          className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition-colors ${
            activeTab === "advanced"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Sliders className="h-4 w-4" />
          2. Advanced Terms & Custom Fields
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* TAB 1: BASIC & CONTACT INFO */}
        {activeTab === "basic" && (
          <div className="card p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Party / Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Retail Pvt Ltd"
                  className="input font-semibold"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  onBlur={() => handleBlur("name")}
                />
              </div>

              <div>
                <label className="label">Party Type</label>
                <select
                  className="input"
                  value={form.type}
                  onChange={(e) => update("type", e.target.value)}
                >
                  <option value="CUSTOMER">Customer (Receives Sales Invoices)</option>
                  <option value="VENDOR">Supplier / Vendor (Bills & Purchases)</option>
                  <option value="BOTH">Both (Customer & Vendor)</option>
                </select>
              </div>

              <div>
                <label className="label">Customer / Vendor Code</label>
                <input
                  type="text"
                  placeholder="e.g. CUST-001 or VEN-452"
                  className="input"
                  value={form.code}
                  onChange={(e) => update("code", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Kumar"
                  className="input"
                  value={form.contactPerson}
                  onChange={(e) => update("contactPerson", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Mobile Number</label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  className="input"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  onBlur={() => handleBlur("phone")}
                />
              </div>

              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  placeholder="billing@example.com"
                  className="input"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                />
              </div>

              <div>
                <label className="label">GSTIN (15 Digits)</label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="e.g. 27ABCDE1234F1Z5"
                  className="input uppercase"
                  value={form.gstin}
                  onChange={(e) => update("gstin", e.target.value.toUpperCase())}
                  onBlur={() => handleBlur("gstin")}
                />
              </div>

              <div>
                <label className="label">PAN Number</label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="e.g. ABCDE1234F"
                  className="input uppercase"
                  value={form.pan}
                  onChange={(e) => update("pan", e.target.value.toUpperCase())}
                  onBlur={() => handleBlur("pan")}
                />
              </div>

              <div>
                <label className="label">GST Treatment</label>
                <select
                  className="input"
                  value={form.gstTreatment}
                  onChange={(e) => update("gstTreatment", e.target.value)}
                >
                  <option value="REGISTERED">Registered Business - Regular</option>
                  <option value="COMPOSITION">Composition Dealer</option>
                  <option value="UNREGISTERED">Unregistered Business</option>
                  <option value="CONSUMER">Consumer / End Customer</option>
                  <option value="OVERSEAS">Overseas / Export / SEZ</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="label">Billing Address</label>
                <textarea
                  rows={2}
                  placeholder="Shop / Building, Road, Area..."
                  className="input"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>

              <div>
                <label className="label">City</label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai, Surat"
                  className="input"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </div>

              <div>
                <label className="label">State</label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra, Gujarat"
                  className="input"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                />
              </div>

              <div>
                <label className="label">PIN Code</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="6-digit pincode"
                  className="input"
                  value={form.pincode}
                  onChange={(e) => update("pincode", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="input font-semibold"
                  value={form.openingBalance}
                  onChange={(e) => update("openingBalance", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ADVANCED TERMS & CUSTOM FIELDS */}
        {activeTab === "advanced" && (
          <div className="card p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Credit Terms & Commercial Settings
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Credit Limit (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 50000"
                  className="input"
                  value={form.creditLimit}
                  onChange={(e) => update("creditLimit", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Credit Period (Days)</label>
                <input
                  type="number"
                  placeholder="e.g. 30"
                  className="input"
                  value={form.creditDays}
                  onChange={(e) => update("creditDays", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Assigned Price List</label>
                <select
                  className="input"
                  value={form.priceList}
                  onChange={(e) => update("priceList", e.target.value)}
                >
                  <option value="RETAIL">Retail Rate</option>
                  <option value="WHOLESALE">Wholesale Rate</option>
                  <option value="DEALER">Dealer Rate</option>
                  <option value="DISTRIBUTOR">Distributor Rate</option>
                </select>
              </div>

              <div>
                <label className="label">Payment Terms</label>
                <input
                  type="text"
                  placeholder="e.g. Net 15, Immediate, PDC"
                  className="input"
                  value={form.paymentTerms}
                  onChange={(e) => update("paymentTerms", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Assigned Salesperson / Rep</label>
                <input
                  type="text"
                  placeholder="e.g. Amit Sharma"
                  className="input"
                  value={form.salesperson}
                  onChange={(e) => update("salesperson", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Tags / Labels</label>
                <input
                  type="text"
                  placeholder="e.g. VIP, Corporate, Local"
                  className="input"
                  value={form.tags}
                  onChange={(e) => update("tags", e.target.value)}
                />
              </div>

              <div className="md:col-span-3">
                <label className="label">Shipping / Delivery Address (if different from Billing)</label>
                <textarea
                  rows={2}
                  placeholder="Warehouse / Site delivery address..."
                  className="input"
                  value={form.shippingAddress}
                  onChange={(e) => update("shippingAddress", e.target.value)}
                />
              </div>

              <div className="md:col-span-3">
                <label className="label">Bank Account Details (for Vendor NEFT/RTGS)</label>
                <input
                  type="text"
                  placeholder="Bank Name, A/C Number, IFSC Code"
                  className="input"
                  value={form.bankDetails}
                  onChange={(e) => update("bankDetails", e.target.value)}
                />
              </div>

              <div className="md:col-span-3">
                <label className="label">Internal Notes</label>
                <textarea
                  rows={2}
                  placeholder="Payment habits, special discounts, or credit history..."
                  className="input"
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                />
              </div>
            </div>

            {/* DYNAMIC CUSTOM FIELDS */}
            {customFieldsDef.length > 0 && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-800">Industry Custom Fields</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFieldsDef.map((cf) => {
                    const val = customFieldValues[cf.fieldName] || "";
                    return (
                      <div key={cf.id}>
                        <label className="label">
                          {cf.fieldLabel} {cf.isRequired && "*"}
                        </label>
                        {cf.fieldType === "SELECT" ? (
                          <select
                            className="input"
                            value={val}
                            onChange={(e) =>
                              setCustomFieldValues({
                                ...customFieldValues,
                                [cf.fieldName]: e.target.value,
                              })
                            }
                          >
                            <option value="">Select option</option>
                            {cf.options &&
                              JSON.parse(cf.options).map((opt: string) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <input
                            type={cf.fieldType === "NUMBER" ? "number" : cf.fieldType === "DATE" ? "date" : "text"}
                            className="input"
                            value={val}
                            onChange={(e) =>
                              setCustomFieldValues({
                                ...customFieldValues,
                                [cf.fieldName]: e.target.value,
                              })
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => router.push(redirectUrl)}
            className="btn-secondary"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "Saving Master Record..." : "Save Party Master"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
