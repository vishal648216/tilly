"use client";

import { useState } from "react";
import {
  Layers,
  CheckCircle2,
  XCircle,
  Plus,
  Edit2,
  Users,
  Building,
  Package,
  FileText,
  Scan,
  Key,
  Shield,
  Palette,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface PlanFeature {
  id: string;
  featureKey: string;
  isEnabled?: boolean;
  enabled?: boolean;
}

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  billingCycle: string;
  trialDays: number;
  maxUsers: number;
  maxWarehouses: number;
  maxProducts: number;
  maxBranches: number;
  maxCompanies: number;
  maxMonthlyInvoices: number;
  ocrLimit: number;
  apiLimit: number;
  isActive?: boolean;
  active?: boolean;
  features: PlanFeature[];
  _count?: { subscriptions: number };
}

const ALL_FEATURES = [
  { key: "OCR", label: "Smart OCR Bill Extraction", icon: Scan },
  { key: "BARCODE", label: "Barcode Scanning & Label Printing", icon: Key },
  { key: "MULTI_WAREHOUSE", label: "Multi-Warehouse Management", icon: Building },
  { key: "ADVANCED_INVENTORY", label: "Batch & Serial Tracking", icon: Package },
  { key: "QUOTATION_WORKFLOW", label: "Quotes & Delivery Challan Workflow", icon: FileText },
  { key: "PRICE_LISTS", label: "Tiered Price Lists (Wholesale/Retail)", icon: Sparkles },
  { key: "CUSTOM_BRANDING", label: "White-Label & Custom Invoicing", icon: Palette },
  { key: "REPORTS_ADVANCED", label: "Advanced Audit & Profitability Reports", icon: Shield },
  { key: "API", label: "REST Developer API Access", icon: Key },
  { key: "AUDIT_TRAIL", label: "Immutable Platform Audit Trail", icon: Shield },
];

export default function PlansClient({ initialPlans }: { initialPlans: Plan[] }) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function startEdit(plan?: Plan) {
    if (plan) {
      setEditingPlan({ ...plan });
      setSelectedFeatures(plan.features.map((f) => f.featureKey));
    } else {
      setEditingPlan({
        code: "CUSTOM",
        name: "Custom Enterprise",
        description: "Tailored limits and dedicated features for large operations.",
        price: 9999,
        billingCycle: "MONTHLY",
        trialDays: 14,
        maxUsers: 50,
        maxWarehouses: 10,
        maxProducts: 25000,
        maxBranches: 5,
        maxCompanies: 5,
        maxMonthlyInvoices: 5000,
        ocrLimit: 500,
        apiLimit: 50000,
      });
      setSelectedFeatures(["OCR", "BARCODE", "MULTI_WAREHOUSE", "ADVANCED_INVENTORY", "QUOTATION_WORKFLOW", "PRICE_LISTS", "CUSTOM_BRANDING", "REPORTS_ADVANCED", "API", "AUDIT_TRAIL"]);
    }
    setIsEditing(true);
    setMsg(null);
  }

  function toggleFeature(key: string) {
    setSelectedFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSave() {
    if (!editingPlan?.name || !editingPlan?.code) {
      setMsg({ type: "error", text: "Plan code and name are required." });
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const res = await fetch("/api/superadmin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editingPlan,
          features: selectedFeatures,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save plan.");
      }

      setMsg({ type: "success", text: `Plan '${data.plan.name}' saved successfully.` });
      // Refresh list
      const updated = plans.some((p) => p.id === data.plan.id)
        ? plans.map((p) => (p.id === data.plan.id ? data.plan : p))
        : [...plans, data.plan];
      setPlans(updated);
      setIsEditing(false);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-emerald-400" />
            Plans, Quotas & Feature Toggles
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure subscription tiers, server-side resource limits, and granular platform feature entitlements.
          </p>
        </div>
        <button
          onClick={() => startEdit()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-900/30"
        >
          <Plus className="h-4 w-4" />
          Create New Plan
        </button>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm ${
            msg.type === "success"
              ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
              : "bg-red-950/60 border border-red-800 text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const featureKeys = new Set(plan.features.map((f) => f.featureKey));
          const subscriberCount = plan._count?.subscriptions || 0;

          return (
            <div
              key={plan.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition shadow-xl relative overflow-hidden"
            >
              {plan.code === "PRO" && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-bold px-3 py-0.5 rounded-bl-lg uppercase tracking-wider">
                  Popular
                </div>
              )}
              {plan.code === "TRIAL" && (
                <div className="absolute top-0 right-0 bg-blue-500 text-slate-950 text-[10px] font-bold px-3 py-0.5 rounded-bl-lg uppercase tracking-wider">
                  Default Trial
                </div>
              )}

              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {plan.code}
                    </span>
                  </div>
                  <button
                    onClick={() => startEdit(plan)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Edit Plan Limits & Features"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">
                    {plan.price === 0 ? "Free" : `₹${plan.price.toLocaleString("en-IN")}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-xs text-slate-400">/{plan.billingCycle.toLowerCase()}</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2 min-h-[32px]">{plan.description}</p>

                {/* Subscribers Badge */}
                <div className="mt-3 py-1.5 px-2.5 rounded-lg bg-slate-800/60 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                  <span>Active Tenants</span>
                  <span className="font-semibold text-emerald-400">{subscriberCount}</span>
                </div>

                {/* Resource Limits List */}
                <div className="mt-4 space-y-2 border-t border-slate-800/80 pt-3 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-500" /> Max Users
                    </span>
                    <span className="font-semibold">{plan.maxUsers >= 9999 ? "Unlimited" : plan.maxUsers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-slate-500" /> Warehouses
                    </span>
                    <span className="font-semibold">{plan.maxWarehouses}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-slate-500" /> Catalog Products
                    </span>
                    <span className="font-semibold">{plan.maxProducts >= 99999 ? "Unlimited" : plan.maxProducts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-500" /> Monthly Invoices
                    </span>
                    <span className="font-semibold">{plan.maxMonthlyInvoices >= 99999 ? "Unlimited" : plan.maxMonthlyInvoices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Scan className="h-3.5 w-3.5 text-slate-500" /> OCR Scans/mo
                    </span>
                    <span className="font-semibold">{plan.ocrLimit}</span>
                  </div>
                </div>

                {/* Features Check */}
                <div className="mt-4 border-t border-slate-800/80 pt-3">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Key Features
                  </div>
                  <div className="space-y-1.5">
                    {ALL_FEATURES.slice(0, 6).map((feat) => {
                      const active = featureKeys.has(feat.key);
                      return (
                        <div
                          key={feat.key}
                          className={`flex items-center gap-2 text-xs ${
                            active ? "text-slate-200" : "text-slate-500 line-through opacity-60"
                          }`}
                        >
                          {active ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                          )}
                          <span className="truncate">{feat.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800">
                <button
                  onClick={() => startEdit(plan)}
                  className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition text-center"
                >
                  Configure Limits & Flags
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Modal */}
      {isEditing && editingPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">
                {editingPlan.id ? `Edit Plan: ${editingPlan.name}` : "Create New Subscription Plan"}
              </h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Plan Name</label>
                <input
                  type="text"
                  value={editingPlan.name || ""}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Plan Code</label>
                <input
                  type="text"
                  disabled={Boolean(editingPlan.id)}
                  value={editingPlan.code || ""}
                  onChange={(e) => setEditingPlan({ ...editingPlan, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Price (₹ INR)</label>
                <input
                  type="number"
                  value={editingPlan.price || 0}
                  onChange={(e) => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Trial Days</label>
                <input
                  type="number"
                  value={editingPlan.trialDays ?? 14}
                  onChange={(e) => setEditingPlan({ ...editingPlan, trialDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                value={editingPlan.description || ""}
                onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Server-Side Limits */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                Server-Side Enforcement Limits
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Max Users</label>
                  <input
                    type="number"
                    value={editingPlan.maxUsers ?? 5}
                    onChange={(e) => setEditingPlan({ ...editingPlan, maxUsers: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Max Warehouses</label>
                  <input
                    type="number"
                    value={editingPlan.maxWarehouses ?? 1}
                    onChange={(e) => setEditingPlan({ ...editingPlan, maxWarehouses: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Max Products</label>
                  <input
                    type="number"
                    value={editingPlan.maxProducts ?? 500}
                    onChange={(e) => setEditingPlan({ ...editingPlan, maxProducts: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Monthly Invoices</label>
                  <input
                    type="number"
                    value={editingPlan.maxMonthlyInvoices ?? 100}
                    onChange={(e) => setEditingPlan({ ...editingPlan, maxMonthlyInvoices: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">OCR Scans / Mo</label>
                  <input
                    type="number"
                    value={editingPlan.ocrLimit ?? 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, ocrLimit: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">API Calls / Mo</label>
                  <input
                    type="number"
                    value={editingPlan.apiLimit ?? 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, apiLimit: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Feature Toggles */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                Feature Permissions Matrix
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_FEATURES.map((feat) => {
                  const active = selectedFeatures.includes(feat.key);
                  return (
                    <button
                      type="button"
                      key={feat.key}
                      onClick={() => toggleFeature(feat.key)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition ${
                        active
                          ? "bg-emerald-950/40 border-emerald-600/60 text-white"
                          : "bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <feat.icon className={`h-4 w-4 ${active ? "text-emerald-400" : "text-slate-500"}`} />
                        <span className="text-xs font-medium">{feat.label}</span>
                      </div>
                      {active ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-slate-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Plan Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
