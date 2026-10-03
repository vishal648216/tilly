"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import UpiQrCode from "@/components/UpiQrCode";
import { BUSINESS_TEMPLATES, BusinessType } from "@/lib/businessTemplates";
import { CompanySettingsData, FeatureFlagKey } from "@/lib/featureFlags";
import {
  isValidEmail,
  isValidPhone,
  isValidGstin,
  isValidPan,
  isValidIfsc,
  isValidUpi,
} from "@/lib/validators";
import {
  Building2,
  Sparkles,
  Sliders,
  Tag,
  Landmark,
  Save,
  CheckCircle2,
  AlertCircle,
  QrCode,
  FileSpreadsheet,
  Download,
  Trash2,
  Plus,
  Layers,
  Check,
} from "lucide-react";

type SettingsTab = "profile" | "templates" | "features" | "customFields" | "banking" | "backup";

export default function SettingsClient({
  company,
  initialSettings,
  initialCustomFields,
}: {
  company: any;
  initialSettings: CompanySettingsData;
  initialCustomFields: any[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: company.name || "",
    legalName: company.legalName || "",
    businessType: company.businessType || "Retail",
    industry: company.industry || "Retail & Consumer Goods",
    logo: company.logo || "",
    website: company.website || "",
    email: company.email || "",
    phone: company.phone || "",
    address: company.address || "",
    city: company.city || "",
    state: company.state || "",
    country: company.country || "India",
    pincode: company.pincode || "",
    gstin: company.gstin || "",
    pan: company.pan || "",
    currency: company.currency || "INR",
    financialYear: company.financialYear || "2026-27",
    timezone: company.timezone || "Asia/Kolkata",
  });

  // Feature Flags State
  const [settingsForm, setSettingsForm] = useState<CompanySettingsData>({
    ...initialSettings,
  });

  // Banking State
  const [bankingForm, setBankingForm] = useState({
    upiId: company.upiId || "taily@upi",
    bankName: company.bankName || "State Bank of India",
    accountNo: company.accountNo || "123456789012",
    ifscCode: company.ifscCode || "SBIN0001234",
    branchName: company.branchName || "Main Branch",
    terms:
      company.terms ||
      "1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged on delayed payments after due date.\n3. Subject to local jurisdiction.",
  });

  // Custom Fields State
  const [customFields, setCustomFields] = useState<any[]>(initialCustomFields || []);
  const [newCustomField, setNewCustomField] = useState({
    entityType: "PRODUCT",
    fieldName: "",
    fieldLabel: "",
    fieldType: "TEXT",
    isRequired: false,
    options: "",
  });

  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  function triggerSuccess(msg: string) {
    setSavedMsg(msg);
    setErrorMsg("");
    setTimeout(() => setSavedMsg(""), 4000);
  }

  // --- Save Profile & Settings ---
  async function handleSaveSettings() {
    setLoading(true);
    setErrorMsg("");
    try {
      const payload = {
        ...profileForm,
        ...bankingForm,
        settings: settingsForm,
      };

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");

      triggerSuccess("Company profile & settings saved successfully!");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  }

  // --- Apply Business Template ---
  async function handleApplyTemplate(templateType: BusinessType) {
    setTemplateLoading(templateType);
    setErrorMsg("");
    try {
      const res = await fetch("/api/settings/templates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateType }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply template");

      setProfileForm((f) => ({
        ...f,
        businessType: templateType,
        industry: data.template.industry,
      }));
      setSettingsForm(data.settings);

      // Refresh custom fields
      const cfRes = await fetch("/api/custom-fields");
      const cfData = await cfRes.json();
      if (cfData.ok) {
        setCustomFields(cfData.customFields);
      }

      triggerSuccess(`Successfully applied '${templateType}' industry template!`);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to apply template");
    } finally {
      setTemplateLoading(null);
    }
  }

  // --- Create Custom Field ---
  async function handleCreateCustomField(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustomField.fieldLabel.trim()) return;
    setLoading(true);
    try {
      const opts = newCustomField.options
        ? newCustomField.options.split(",").map((s) => s.trim()).filter(Boolean)
        : null;

      const res = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: newCustomField.entityType,
          fieldLabel: newCustomField.fieldLabel.trim(),
          fieldType: newCustomField.fieldType,
          isRequired: newCustomField.isRequired,
          options: opts,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create custom field");

      setCustomFields((prev) => [...prev, data.customField]);
      setNewCustomField({
        entityType: "PRODUCT",
        fieldName: "",
        fieldLabel: "",
        fieldType: "TEXT",
        isRequired: false,
        options: "",
      });
      triggerSuccess("Custom field added successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add custom field");
    } finally {
      setLoading(false);
    }
  }

  // --- Delete Custom Field ---
  async function handleDeleteCustomField(id: string) {
    try {
      const res = await fetch(`/api/custom-fields?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setCustomFields((prev) => prev.filter((c) => c.id !== id));
      triggerSuccess("Custom field removed.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete custom field");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Company Settings & Configuration
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Current Business Type: <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{profileForm.businessType}</span>
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={loading}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {loading ? "Saving Changes..." : "Save All Settings"}
        </button>
      </div>

      {savedMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-xs font-bold text-emerald-800 border border-emerald-200 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{savedMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 pb-3 px-3.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "profile"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Building2 className="h-4 w-4" />
          1. Business Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-2 pb-3 px-3.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "templates"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          2. Industry Templates
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("features")}
          className={`flex items-center gap-2 pb-3 px-3.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "features"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Sliders className="h-4 w-4" />
          3. Module Feature Flags
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("customFields")}
          className={`flex items-center gap-2 pb-3 px-3.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "customFields"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Tag className="h-4 w-4" />
          4. Custom Fields
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("banking")}
          className={`flex items-center gap-2 pb-3 px-3.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "banking"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Landmark className="h-4 w-4" />
          5. Banking & UPI QR
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("backup")}
          className={`flex items-center gap-2 pb-3 px-3.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "backup"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Download className="h-4 w-4" />
          6. Backup & Export
        </button>
      </div>

      {/* TAB 1: BUSINESS PROFILE */}
      {activeTab === "profile" && (
        <div className="card p-6 space-y-6">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Company Master Setup
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Business Name *</label>
              <input
                type="text"
                className="input font-semibold"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Legal Name</label>
              <input
                type="text"
                className="input"
                value={profileForm.legalName}
                onChange={(e) => setProfileForm({ ...profileForm, legalName: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Business Type</label>
              <select
                className="input font-bold text-emerald-700"
                value={profileForm.businessType}
                onChange={(e) => setProfileForm({ ...profileForm, businessType: e.target.value })}
              >
                {Object.keys(BUSINESS_TEMPLATES).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Industry Classification</label>
              <input
                type="text"
                className="input"
                value={profileForm.industry}
                onChange={(e) => setProfileForm({ ...profileForm, industry: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Company Logo URL</label>
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                className="input"
                value={profileForm.logo}
                onChange={(e) => setProfileForm({ ...profileForm, logo: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Website</label>
              <input
                type="text"
                placeholder="www.mybusiness.com"
                className="input"
                value={profileForm.website}
                onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Phone / Mobile</label>
              <input
                type="tel"
                className="input"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Country</label>
              <input
                type="text"
                className="input"
                value={profileForm.country}
                onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Registered Address</label>
              <textarea
                rows={2}
                className="input"
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
              />
            </div>

            <div>
              <label className="label">State</label>
              <input
                type="text"
                className="input"
                value={profileForm.state}
                onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
              />
            </div>

            <div>
              <label className="label">City</label>
              <input
                type="text"
                className="input"
                value={profileForm.city}
                onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Pincode</label>
              <input
                type="text"
                className="input"
                value={profileForm.pincode}
                onChange={(e) => setProfileForm({ ...profileForm, pincode: e.target.value })}
              />
            </div>

            <div>
              <label className="label">GSTIN (15 Digits)</label>
              <input
                type="text"
                maxLength={15}
                className="input uppercase font-mono"
                value={profileForm.gstin}
                onChange={(e) => setProfileForm({ ...profileForm, gstin: e.target.value.toUpperCase() })}
              />
            </div>

            <div>
              <label className="label">PAN Number</label>
              <input
                type="text"
                maxLength={10}
                className="input uppercase font-mono"
                value={profileForm.pan}
                onChange={(e) => setProfileForm({ ...profileForm, pan: e.target.value.toUpperCase() })}
              />
            </div>

            <div>
              <label className="label">Base Currency</label>
              <select
                className="input font-bold"
                value={profileForm.currency}
                onChange={(e) => setProfileForm({ ...profileForm, currency: e.target.value })}
              >
                <option value="INR">INR (₹ - Indian Rupee)</option>
                <option value="USD">USD ($ - US Dollar)</option>
                <option value="EUR">EUR (€ - Euro)</option>
                <option value="AED">AED (د.إ - UAE Dirham)</option>
              </select>
            </div>

            <div>
              <label className="label">Financial Year</label>
              <input
                type="text"
                placeholder="2026-27"
                className="input"
                value={profileForm.financialYear}
                onChange={(e) => setProfileForm({ ...profileForm, financialYear: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Timezone</label>
              <input
                type="text"
                placeholder="Asia/Kolkata"
                className="input"
                value={profileForm.timezone}
                onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INDUSTRY TEMPLATES (1-CLICK APPLY) */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="card p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
            <h2 className="text-base font-black flex items-center gap-2 text-emerald-400">
              <Sparkles className="h-5 w-5" /> 1-Click Business Template Presets
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Applying a template automatically configures module visibility, enables required industry fields,
              and provisions default custom fields. You can fine-tune any toggle in the Feature Flags tab.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(BUSINESS_TEMPLATES).map((tmpl) => {
              const isActive = profileForm.businessType === tmpl.id;
              const isApplying = templateLoading === tmpl.id;

              return (
                <div
                  key={tmpl.id}
                  className={`card p-5 flex flex-col justify-between transition-all border ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50/20 shadow-md ring-2 ring-emerald-500/20"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-slate-900">{tmpl.name}</span>
                      {isActive && (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3 stroke-[3]" /> Active
                        </span>
                      )}
                    </div>
                    <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 mb-2">
                      {tmpl.industry}
                    </span>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      {tmpl.description}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      disabled={isActive || isApplying}
                      onClick={() => handleApplyTemplate(tmpl.id)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? "bg-slate-100 text-slate-400 cursor-default"
                          : "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                      }`}
                    >
                      {isApplying ? "Applying Template..." : isActive ? "Currently Active" : `Apply ${tmpl.id} Setup`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: MODULE FEATURE FLAGS */}
      {activeTab === "features" && (
        <div className="card p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Configurable Feature Flags</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Toggle specific business modules and system rules without modifying any React code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                key: "inventoryEnabled",
                title: "Inventory & Physical Stock",
                desc: "Enable physical stock tracking, items list, and stock ledger. (Disable for service-only businesses).",
              },
              {
                key: "gstEnabled",
                title: "GST Billing & Tax Invoices",
                desc: "Calculate CGST/SGST/IGST tax rates, HSN codes, and GSTR reporting.",
              },
              {
                key: "warehouseEnabled",
                title: "Warehouses & Godowns",
                desc: "Track stock across physical warehouse locations.",
              },
              {
                key: "multiWarehouseEnabled",
                title: "Multi-Warehouse Transfers",
                desc: "Allow inter-warehouse stock transfer vouchers.",
              },
              {
                key: "barcodeEnabled",
                title: "Barcode & QR Code Scanning",
                desc: "Enable barcode lookup on billing and product masters.",
              },
              {
                key: "batchEnabled",
                title: "Batch Number Tracking",
                desc: "Track batch numbers on pharmaceuticals and perishable inventory.",
              },
              {
                key: "expiryEnabled",
                title: "Expiry Date Tracking",
                desc: "Record expiry dates and warn when billing near-expiry goods.",
              },
              {
                key: "serialEnabled",
                title: "Serial Number & IMEI",
                desc: "Individual tracking for electronics and mobile devices.",
              },
              {
                key: "manufacturingEnabled",
                title: "Manufacturing & BOM",
                desc: "Enable raw material tracking, production runs, and finished goods.",
              },
              {
                key: "quotationEnabled",
                title: "Quotations & Estimates",
                desc: "Create pre-sales quotations before generating final invoices.",
              },
              {
                key: "salesOrderEnabled",
                title: "Sales Orders Workflow",
                desc: "Track customer sales orders before delivery challans.",
              },
              {
                key: "purchaseOrderEnabled",
                title: "Purchase Orders (PO)",
                desc: "Issue formal POs to vendors before receiving bills.",
              },
              {
                key: "deliveryChallanEnabled",
                title: "Delivery Challans",
                desc: "Generate dispatch challans for goods transport before final invoice.",
              },
              {
                key: "goodsReceiptEnabled",
                title: "Goods Receipts (GRN)",
                desc: "Record physical goods arrival and verify against Purchase Orders before billing.",
              },
              {
                key: "salespersonEnabled",
                title: "Salesperson & Executive Tracking",
                desc: "Assign sales agents to customers and invoices for commission calculation.",
              },
              {
                key: "priceListsEnabled",
                title: "Tiered Price Lists",
                desc: "Support wholesale, dealer, and distributor pricing levels.",
              },
              {
                key: "negativeStockAllowed",
                title: "Allow Negative Stock",
                desc: "Allow invoices to be saved even if physical stock is below zero.",
              },
              {
                key: "taxInclusivePricing",
                title: "Tax-Inclusive Rates",
                desc: "Prices entered on invoices default to inclusive of GST (e.g. Restaurants, Retail).",
              },
              {
                key: "roundOffEnabled",
                title: "Auto Round-Off",
                desc: "Automatically round off final bill grand total to the nearest integer rupee.",
              },
            ].map((f) => {
              const isChecked = Boolean(settingsForm[f.key as FeatureFlagKey]);
              return (
                <div
                  key={f.key}
                  className="flex items-start justify-between p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white transition-colors"
                >
                  <div className="pr-4">
                    <span className="text-xs font-bold text-slate-800">{f.title}</span>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{f.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          [f.key as FeatureFlagKey]: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: CONFIGURABLE CUSTOM FIELDS */}
      {activeTab === "customFields" && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Add New Custom Field
            </h2>
            <form onSubmit={handleCreateCustomField} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="label">Target Entity</label>
                <select
                  className="input"
                  value={newCustomField.entityType}
                  onChange={(e) => setNewCustomField({ ...newCustomField, entityType: e.target.value })}
                >
                  <option value="PRODUCT">Product / Item</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="SUPPLIER">Supplier / Vendor</option>
                  <option value="INVOICE">Invoice</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </div>

              <div>
                <label className="label">Field Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Doctor License or Fabric Type"
                  className="input"
                  value={newCustomField.fieldLabel}
                  onChange={(e) => setNewCustomField({ ...newCustomField, fieldLabel: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Field Type</label>
                <select
                  className="input"
                  value={newCustomField.fieldType}
                  onChange={(e) => setNewCustomField({ ...newCustomField, fieldType: e.target.value })}
                >
                  <option value="TEXT">Text</option>
                  <option value="NUMBER">Number</option>
                  <option value="DATE">Date</option>
                  <option value="SELECT">Dropdown Select</option>
                  <option value="BOOLEAN">Yes / No</option>
                </select>
              </div>

              <div>
                <button type="submit" disabled={loading} className="btn-primary w-full inline-flex items-center justify-center gap-1.5">
                  <Plus className="h-4 w-4" /> Add Field
                </button>
              </div>

              {newCustomField.fieldType === "SELECT" && (
                <div className="md:col-span-4">
                  <label className="label">Dropdown Options (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Cotton, Silk, Polyester, Wool"
                    className="input"
                    value={newCustomField.options}
                    onChange={(e) => setNewCustomField({ ...newCustomField, options: e.target.value })}
                  />
                </div>
              )}
            </form>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Existing Custom Fields ({customFields.length})
            </h2>

            {customFields.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No custom fields defined yet. Add one above or apply an Industry Template.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {customFields.map((cf) => (
                  <div key={cf.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{cf.fieldLabel}</span>
                      <span className="text-slate-400 font-mono text-[10px] ml-2">({cf.fieldName})</span>
                      <div className="flex gap-2 mt-0.5">
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-bold">
                          {cf.entityType}
                        </span>
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded text-[10px] font-bold">
                          {cf.fieldType}
                        </span>
                        {cf.isRequired && (
                          <span className="bg-red-50 text-red-700 px-1.5 py-0.2 rounded text-[10px] font-bold">
                            Required
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomField(cf.id)}
                      className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"
                      title="Delete Custom Field"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: BANKING & UPI */}
      {activeTab === "banking" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Banking & Payment Settlement
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">UPI ID (VPA) *</label>
                <input
                  type="text"
                  placeholder="e.g. business@okaxis"
                  className="input font-mono"
                  value={bankingForm.upiId}
                  onChange={(e) => setBankingForm({ ...bankingForm, upiId: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Bank Name</label>
                <input
                  type="text"
                  className="input"
                  value={bankingForm.bankName}
                  onChange={(e) => setBankingForm({ ...bankingForm, bankName: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Account Number</label>
                <input
                  type="text"
                  className="input font-mono"
                  value={bankingForm.accountNo}
                  onChange={(e) => setBankingForm({ ...bankingForm, accountNo: e.target.value })}
                />
              </div>

              <div>
                <label className="label">IFSC Code</label>
                <input
                  type="text"
                  className="input uppercase font-mono"
                  value={bankingForm.ifscCode}
                  onChange={(e) => setBankingForm({ ...bankingForm, ifscCode: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Branch Name</label>
                <input
                  type="text"
                  className="input"
                  value={bankingForm.branchName}
                  onChange={(e) => setBankingForm({ ...bankingForm, branchName: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Invoice Terms & Conditions</label>
                <textarea
                  rows={4}
                  className="input font-mono text-xs"
                  value={bankingForm.terms}
                  onChange={(e) => setBankingForm({ ...bankingForm, terms: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="card p-6 flex flex-col items-center justify-center text-center">
            <h3 className="text-xs font-bold text-slate-800 mb-2">Live UPI QR Code Preview</h3>
            <p className="text-[11px] text-slate-500 mb-4">Printed dynamically on sales invoices</p>
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200">
              <UpiQrCode upiId={bankingForm.upiId || "taily@upi"} payeeName={profileForm.name || "Business"} amount={100} invoiceNo="PREVIEW-001" />
            </div>
            <p className="text-[11px] font-mono font-bold text-slate-700 mt-3">{bankingForm.upiId}</p>
          </div>
        </div>
      )}

      {/* TAB 6: BACKUP & DATA */}
      {activeTab === "backup" && (
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Data Portability & Full Exports
          </h2>
          <p className="text-xs text-slate-600">
            Export all double-entry ledger data, invoices, items, and parties into industry standard formats.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="/api/backup?format=json"
              target="_blank"
              download
              className="btn-secondary inline-flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> Download JSON Backup
            </a>
            <a
              href="/api/backup?format=csv"
              target="_blank"
              download
              className="btn-secondary inline-flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" /> Export Excel / CSV Sheets
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
