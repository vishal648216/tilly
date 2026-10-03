"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  Users,
  Building,
  Package,
  FileText,
  Scan,
  ShieldAlert,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

interface SubData {
  subscription: {
    id: string;
    status: string;
    companyStatus: string;
    plan: {
      id: string;
      code: string;
      name: string;
      description: string;
      price: number;
      billingCycle: string;
      trialDays: number;
    };
    trialStartDate: string | null;
    trialEndDate: string | null;
    trialDaysRemaining: number | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
  usage: {
    users: { current: number; max: number };
    warehouses: { current: number; max: number };
    products: { current: number; max: number };
    monthlyInvoices: { current: number; max: number };
    ocrScans: { current: number; max: number };
    apiCalls: { current: number; max: number };
  };
  features: Record<string, { planPermits: boolean; accessible: boolean }>;
  availablePlans: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
    price: number;
    billingCycle: string;
    limits: any;
    features: string[];
  }>;
}

const FEATURE_NAMES: Record<string, string> = {
  OCR: "Smart Bill OCR Scanning",
  BARCODE: "Barcode Scanning & Label Printing",
  MULTI_WAREHOUSE: "Multi-Warehouse Inventory",
  ADVANCED_INVENTORY: "Batch & Serial Tracking",
  QUOTATION_WORKFLOW: "Quotation & Delivery Challan Workflow",
  PRICE_LISTS: "Wholesale & Tiered Price Lists",
  CUSTOM_BRANDING: "White-Label & Custom Invoicing",
  REPORTS_ADVANCED: "Advanced P&L & Balance Sheet Analytics",
  API: "Developer REST API Access",
  AUDIT_TRAIL: "Forensic Audit Logging",
};

export default function SubscriptionPage() {
  const [data, setData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSub() {
      try {
        const res = await fetch("/api/subscription");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load subscription details.");
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSub();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto mb-3" />
        <p className="text-sm">Loading subscription and usage quotas...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-950/40 border border-red-800 rounded-2xl text-red-300">
        <p className="font-semibold">Subscription Error</p>
        <p className="text-sm mt-1">{error || "Unable to retrieve subscription."}</p>
      </div>
    );
  }

  const { subscription, usage, features, availablePlans } = data;
  const isSuspended = subscription.companyStatus === "SUSPENDED";
  const isTrial = subscription.status === "TRIAL";
  const isExpired = subscription.status === "EXPIRED" || subscription.companyStatus === "EXPIRED";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-emerald-400" />
            Plan & Subscription
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor plan entitlements, track server-side quotas, and view enabled business features.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider border ${
              isSuspended
                ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                : isTrial
                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                : isExpired
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
            }`}
          >
            {isSuspended ? "ACCOUNT SUSPENDED" : isTrial ? "14-DAY TRIAL" : subscription.status}
          </span>
        </div>
      </div>

      {/* Account Alerts */}
      {isSuspended && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 flex items-start gap-3 shadow-lg">
          <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-sm">Account Operations are Suspended</p>
            <p className="mt-0.5">
              All financial transactions (invoicing, payments, inventory adjustments) are temporarily locked by the platform administrator.
            </p>
          </div>
        </div>
      )}

      {isTrial && subscription.trialDaysRemaining !== null && (
        <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/80 text-blue-200 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-white text-sm">
                {subscription.trialDaysRemaining} days remaining in your Free Trial
              </span>
              <p className="text-slate-400">
                Your trial will expire on{" "}
                {subscription.trialEndDate
                  ? new Date(subscription.trialEndDate).toLocaleDateString("en-IN", {
                      dateStyle: "medium",
                    })
                  : "soon"}
                . Upgrade anytime to avoid interruptions.
              </p>
            </div>
          </div>
          <button className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md whitespace-nowrap">
            Upgrade Plan
          </button>
        </div>
      )}

      {/* Current Plan Overview Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Current Tier
          </span>
          <div>
            <h2 className="text-2xl font-black text-white">{subscription.plan.name}</h2>
            <p className="text-xs text-slate-400 mt-1">{subscription.plan.description}</p>
          </div>

          <div className="flex items-baseline gap-1 pt-2">
            <span className="text-3xl font-black text-white">
              {subscription.plan.price === 0
                ? "₹0"
                : `₹${subscription.plan.price.toLocaleString("en-IN")}`}
            </span>
            <span className="text-xs text-slate-400">
              /{subscription.plan.billingCycle.toLowerCase()}
            </span>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Billing Cycle:</span>
              <span className="font-semibold text-white">{subscription.plan.billingCycle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Account Status:</span>
              <span className="font-bold text-emerald-400">{subscription.companyStatus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Period Start:</span>
              <span>{new Date(subscription.currentPeriodStart).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Next Renewal:</span>
              <span>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Quota & Usage Progress Cards */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              Live Server-Side Limits & Resource Quotas
            </h3>
            <span className="text-xs text-slate-400">Strictly enforced on backend</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Users */}
            <QuotaBar
              title="Team Members"
              icon={Users}
              current={usage.users.current}
              max={usage.users.max}
              unit="users"
            />
            {/* Warehouses */}
            <QuotaBar
              title="Warehouses"
              icon={Building}
              current={usage.warehouses.current}
              max={usage.warehouses.max}
              unit="locations"
            />
            {/* Products */}
            <QuotaBar
              title="Catalog Products"
              icon={Package}
              current={usage.products.current}
              max={usage.products.max}
              unit="items"
            />
            {/* Monthly Invoices */}
            <QuotaBar
              title="Monthly Invoices"
              icon={FileText}
              current={usage.monthlyInvoices.current}
              max={usage.monthlyInvoices.max}
              unit="invoices/mo"
            />
            {/* OCR Scans */}
            <QuotaBar
              title="Smart OCR Scans"
              icon={Scan}
              current={usage.ocrScans.current}
              max={usage.ocrScans.max}
              unit="scans/mo"
            />
            {/* API Calls */}
            <QuotaBar
              title="API Developer Calls"
              icon={CreditCard}
              current={usage.apiCalls.current}
              max={usage.apiCalls.max}
              unit="calls/mo"
            />
          </div>
        </div>
      </div>

      {/* Dual Condition Feature Access Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            Feature Entitlements Matrix
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Features are accessible only when permitted by your Plan <strong>AND</strong> enabled in your Business Settings.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {Object.entries(features).map(([key, stat]) => {
            const label = FEATURE_NAMES[key] || key;
            const isFullyAvailable = stat.accessible;

            return (
              <div
                key={key}
                className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 transition ${
                  isFullyAvailable
                    ? "bg-emerald-950/20 border-emerald-500/30 text-slate-200"
                    : "bg-slate-800/40 border-slate-800 text-slate-400"
                }`}
              >
                <div>
                  <div className="text-xs font-semibold text-white">{label}</div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        stat.planPermits
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      Plan: {stat.planPermits ? "Included" : "Excluded"}
                    </span>
                  </div>
                </div>

                {isFullyAvailable ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-slate-600 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Available Plans Comparison */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-white">Compare Available Plans</h3>
          <p className="text-xs text-slate-400 mt-1">
            Scale your operations seamlessly as your business grows. Contact platform admin to upgrade.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {availablePlans
            .filter((p) => p.code !== "TRIAL")
            .map((p) => {
              const isCurrent = p.code === subscription.plan.code;

              return (
                <div
                  key={p.id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between ${
                    isCurrent
                      ? "bg-emerald-950/20 border-emerald-500/50 shadow-emerald-900/10 shadow-lg"
                      : "bg-slate-800/40 border-slate-800"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center">
                      <h4 className="text-base font-bold text-white">{p.name}</h4>
                      {isCurrent && (
                        <span className="bg-emerald-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded">
                          Current Plan
                        </span>
                      )}
                    </div>
                    <div className="mt-3 text-2xl font-black text-white">
                      ₹{p.price.toLocaleString("en-IN")}
                      <span className="text-xs text-slate-400 font-normal">
                        /{p.billingCycle.toLowerCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{p.description}</p>

                    <div className="mt-4 space-y-1.5 text-xs text-slate-300 border-t border-slate-800 pt-3">
                      <div>👥 {p.limits.maxUsers >= 9999 ? "Unlimited" : p.limits.maxUsers} Users</div>
                      <div>🏢 {p.limits.maxWarehouses} Warehouses</div>
                      <div>📦 {p.limits.maxProducts >= 99999 ? "Unlimited" : p.limits.maxProducts} Products</div>
                      <div>🧾 {p.limits.maxMonthlyInvoices} Invoices/mo</div>
                      <div>📷 {p.limits.ocrLimit} OCR Scans/mo</div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800">
                    <button
                      disabled={isCurrent}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition ${
                        isCurrent
                          ? "bg-slate-800 text-slate-500 cursor-default"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                      }`}
                    >
                      {isCurrent ? "Current Plan" : "Contact Admin to Upgrade"}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function QuotaBar({
  title,
  icon: Icon,
  current,
  max,
  unit,
}: {
  title: string;
  icon: any;
  current: number;
  max: number;
  unit: string;
}) {
  const isUnlimited = max >= 99999;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((current / max) * 100));
  const isNearLimit = !isUnlimited && pct >= 80;
  const isAtLimit = !isUnlimited && pct >= 100;

  return (
    <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-3.5 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-slate-400" />
          {title}
        </span>
        <span
          className={`font-mono font-bold ${
            isAtLimit ? "text-rose-400" : isNearLimit ? "text-amber-400" : "text-emerald-400"
          }`}
        >
          {current} / {isUnlimited ? "∞" : max} {unit}
        </span>
      </div>

      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isAtLimit ? "bg-rose-500" : isNearLimit ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${isUnlimited ? (current > 0 ? 10 : 0) : pct}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{pct}% used</span>
        <span>{isUnlimited ? "Unlimited quota" : `${max - current} remaining`}</span>
      </div>
    </div>
  );
}
