"use client";

import { useEffect, useState } from "react";
import {
  Palette,
  FileText,
  QrCode,
  Building,
  CheckCircle2,
  Save,
  Image as ImageIcon,
  PenTool,
  Lock,
  Sparkles,
} from "lucide-react";
import { InvoiceCustomizationData, InvoiceTemplateType } from "@/lib/invoiceTemplate";

interface TemplateDescriptor {
  id: InvoiceTemplateType;
  name: string;
  badge: string;
  description: string;
  bestFor: string;
  features: string[];
}

export default function BrandingSettingsPage() {
  const [customization, setCustomization] = useState<InvoiceCustomizationData | null>(null);
  const [templates, setTemplates] = useState<TemplateDescriptor[]>([]);
  const [customBrandingPermitted, setCustomBrandingPermitted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadBranding() {
      try {
        const res = await fetch("/api/settings/branding");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load branding settings.");
        setCustomization(json.customization);
        setTemplates(json.templates || []);
        setCustomBrandingPermitted(json.customBrandingPermitted ?? true);
      } catch (err: any) {
        setToast({ type: "error", text: err.message });
      } finally {
        setLoading(false);
      }
    }
    loadBranding();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!customization) return;

    setSaving(true);
    setToast(null);

    try {
      const res = await fetch("/api/settings/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customization),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save branding preferences.");

      setCustomization(json.customization);
      setToast({ type: "success", text: "Invoice branding preferences saved successfully." });
    } catch (err: any) {
      setToast({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto mb-3" />
        <p className="text-sm">Loading invoice branding preferences...</p>
      </div>
    );
  }

  if (!customization) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Palette className="h-6 w-6 text-emerald-400" />
            Invoice Customization & Business Branding
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Choose your professional invoice template, color palette, banking details, and UPI QR codes.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving Changes..." : "Save Branding"}
        </button>
      </div>

      {toast && (
        <div
          className={`p-4 rounded-xl text-sm ${
            toast.type === "success"
              ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
              : "bg-red-950/60 border border-red-800 text-red-300"
          }`}
        >
          {toast.text}
        </div>
      )}

      {!customBrandingPermitted && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/60 text-amber-200 flex items-center gap-3">
          <Lock className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Starter Plan Notice:</span> Custom branding and advanced templates require a Professional or Enterprise subscription.
          </div>
        </div>
      )}

      {/* 1. Template Selection Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-400" />
            Select Invoice Template
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Switch your layout instantly. Every invoice automatically renders with the selected template structure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {templates.map((tpl) => {
            const isSelected = customization.template === tpl.id;

            return (
              <div
                key={tpl.id}
                onClick={() => setCustomization({ ...customization, template: tpl.id })}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? "bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg"
                    : "bg-slate-800/40 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">{tpl.name}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {tpl.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 min-h-[36px]">{tpl.description}</p>
                  <div className="mt-3 text-[11px] text-emerald-400 font-semibold">
                    Best for: <span className="text-slate-300 font-normal">{tpl.bestFor}</span>
                  </div>

                  <ul className="mt-3 space-y-1 text-[11px] text-slate-400 border-t border-slate-800 pt-2">
                    {tpl.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className={isSelected ? "font-bold text-emerald-400" : "text-slate-500"}>
                    {isSelected ? "Active Template" : "Click to Select"}
                  </span>
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Color Palette & Typography */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Palette className="h-5 w-5 text-emerald-400" />
            Theme Colors & Font
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tailor invoice headers, table accents, and total badges to match your business brand identity.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Primary Brand Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customization.primaryColor}
                onChange={(e) => setCustomization({ ...customization, primaryColor: e.target.value })}
                className="h-9 w-12 rounded-lg cursor-pointer bg-slate-800 border border-slate-700"
              />
              <input
                type="text"
                value={customization.primaryColor}
                onChange={(e) => setCustomization({ ...customization, primaryColor: e.target.value })}
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Accent Header Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customization.accentColor}
                onChange={(e) => setCustomization({ ...customization, accentColor: e.target.value })}
                className="h-9 w-12 rounded-lg cursor-pointer bg-slate-800 border border-slate-700"
              />
              <input
                type="text"
                value={customization.accentColor}
                onChange={(e) => setCustomization({ ...customization, accentColor: e.target.value })}
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Invoice Typography</label>
            <select
              value={customization.fontFamily}
              onChange={(e) => setCustomization({ ...customization, fontFamily: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
            >
              <option value="Inter">Inter (Clean Modern Sans)</option>
              <option value="Roboto">Roboto (Technical Sans)</option>
              <option value="Outfit">Outfit (Geometric Display)</option>
              <option value="serif">Merriweather (Classic Serif)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Business Profile & Logo */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building className="h-5 w-5 text-emerald-400" />
            Display Identity & Logo
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure how your business name, address, and legal details appear on printed and PDF bills.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Display Business Name</label>
            <input
              type="text"
              value={customization.companyDisplayName || ""}
              onChange={(e) => setCustomization({ ...customization, companyDisplayName: e.target.value })}
              placeholder="Defaults to registered company legal name"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Company Logo URL</label>
            <input
              type="text"
              value={customization.logoUrl || ""}
              onChange={(e) => setCustomization({ ...customization, logoUrl: e.target.value })}
              placeholder="https://your-domain.com/logo.png"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-1">Custom Display Address</label>
            <textarea
              rows={2}
              value={customization.customAddress || ""}
              onChange={(e) => setCustomization({ ...customization, customAddress: e.target.value })}
              placeholder="Leave blank to use primary registered business address"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
            />
          </div>
        </div>
      </div>

      {/* 4. Bank & UPI QR Payment Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-400" />
            Bank Wire Details & UPI Payment QR
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Allow clients to pay instantly by scanning the dynamic UPI QR code printed directly on their bill.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Bank Name</label>
            <input
              type="text"
              value={customization.bankName || ""}
              onChange={(e) => setCustomization({ ...customization, bankName: e.target.value })}
              placeholder="e.g. HDFC Bank Ltd"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Account Number</label>
            <input
              type="text"
              value={customization.accountNo || ""}
              onChange={(e) => setCustomization({ ...customization, accountNo: e.target.value })}
              placeholder="e.g. 50200012345678"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">IFSC Code</label>
            <input
              type="text"
              value={customization.ifscCode || ""}
              onChange={(e) => setCustomization({ ...customization, ifscCode: e.target.value.toUpperCase() })}
              placeholder="e.g. HDFC0001234"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">UPI VPA (QR Code)</label>
            <input
              type="text"
              value={customization.upiId || ""}
              onChange={(e) => setCustomization({ ...customization, upiId: e.target.value })}
              placeholder="e.g. merchant@icici"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* 5. Terms, Signatory & Footer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <PenTool className="h-5 w-5 text-emerald-400" />
            Terms, Signatory & Footer Notes
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Default terms and conditions, authorized signature labels, and closing gratitude notes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Authorized Signatory Label</label>
            <input
              type="text"
              value={customization.signatureLabel}
              onChange={(e) => setCustomization({ ...customization, signatureLabel: e.target.value })}
              placeholder="Authorized Signatory"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Digital Signature Image URL</label>
            <input
              type="text"
              value={customization.signatureUrl || ""}
              onChange={(e) => setCustomization({ ...customization, signatureUrl: e.target.value })}
              placeholder="https://your-domain.com/signature.png"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-1">Standard Terms & Conditions</label>
            <textarea
              rows={3}
              value={customization.termsAndConditions || ""}
              onChange={(e) => setCustomization({ ...customization, termsAndConditions: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-1">Footer Note</label>
            <input
              type="text"
              value={customization.footerNotes || ""}
              onChange={(e) => setCustomization({ ...customization, footerNotes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
