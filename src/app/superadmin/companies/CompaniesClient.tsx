"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/currency";
import {
  Building2,
  Plus,
  Search,
  Users,
  Receipt,
  Eye,
  Edit2,
  Trash2,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";

interface CompanyItem {
  id: string;
  name: string;
  legalName: string | null;
  status: string;
  suspendedReason?: string | null;
  planName?: string;
  planCode?: string;
  subscriptionStatus?: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  gstin: string | null;
  pan: string | null;
  createdAt: string;
  membersCount: number;
  members: Array<{
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      status: string;
    };
  }>;
  totalInvoices: number;
  totalTurnover: number;
  partiesCount: number;
  itemsCount: number;
}

export default function CompaniesClient({
  initialCompanies,
  availablePlans,
}: {
  initialCompanies: CompanyItem[];
  availablePlans?: Array<{ id: string; code: string; name: string; price: number }>;
}) {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyItem[]>(initialCompanies);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCompany, setEditCompany] = useState<CompanyItem | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<CompanyItem | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Status & Subscription Plan Modal state
  const [statusModalComp, setStatusModalComp] = useState<CompanyItem | null>(null);
  const [newStatus, setNewStatus] = useState("ACTIVE");
  const [suspendReason, setSuspendReason] = useState("");
  const [selectedPlanCode, setSelectedPlanCode] = useState("STARTER");
  const [savingStatus, setSavingStatus] = useState(false);

  function openStatusModal(comp: CompanyItem) {
    setStatusModalComp(comp);
    setNewStatus(comp.status || "ACTIVE");
    setSuspendReason(comp.suspendedReason || "");
    setSelectedPlanCode(comp.planCode || "STARTER");
  }

  async function handleSaveStatus() {
    if (!statusModalComp) return;
    if (newStatus === "SUSPENDED" && !suspendReason.trim()) {
      setToast({ type: "error", text: "A suspension reason is required when suspending an account." });
      return;
    }

    setSavingStatus(true);
    try {
      const res = await fetch(`/api/superadmin/companies/${statusModalComp.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          suspendedReason: newStatus === "SUSPENDED" ? suspendReason.trim() : null,
          planCode: selectedPlanCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status.");

      const resolvedPlanName = availablePlans?.find((p) => p.code === selectedPlanCode)?.name || selectedPlanCode;

      setCompanies((prev) =>
        prev.map((c) =>
          c.id === statusModalComp.id
            ? {
                ...c,
                status: newStatus,
                suspendedReason: newStatus === "SUSPENDED" ? suspendReason.trim() : null,
                planCode: selectedPlanCode,
                planName: resolvedPlanName,
              }
            : c
        )
      );

      setToast({ type: "success", text: `Company status successfully updated to ${newStatus}.` });
      setStatusModalComp(null);
    } catch (err: any) {
      setToast({ type: "error", text: err.message });
    } finally {
      setSavingStatus(false);
    }
  }

  // New Company Form State
  const [newComp, setNewComp] = useState({
    name: "",
    legalName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    gstin: "",
    pan: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
  });

  const filtered = companies.filter((c) => {
    const s = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.legalName && c.legalName.toLowerCase().includes(s)) ||
      (c.email && c.email.toLowerCase().includes(s)) ||
      (c.gstin && c.gstin.toLowerCase().includes(s)) ||
      (c.city && c.city.toLowerCase().includes(s))
    );
  });

  const totalPlatformTurnover = companies.reduce((sum, c) => sum + c.totalTurnover, 0);

  async function handleAddCompany(e: React.FormEvent) {
    e.preventDefault();
    setLoadingAction(true);
    setToast(null);
    try {
      const res = await fetch("/api/superadmin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newComp),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create company");

      setToast({ type: "success", text: `Business "${newComp.name}" onboarded successfully!` });
      setShowAddModal(false);
      setNewComp({
        name: "",
        legalName: "",
        email: "",
        phone: "",
        city: "",
        state: "",
        gstin: "",
        pan: "",
        ownerName: "",
        ownerEmail: "",
        ownerPassword: "",
      });
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", text: err.message });
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleEditCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!editCompany) return;
    setLoadingAction(true);
    setToast(null);
    try {
      const res = await fetch("/api/superadmin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: editCompany.id,
          name: editCompany.name,
          legalName: editCompany.legalName,
          email: editCompany.email,
          phone: editCompany.phone,
          city: editCompany.city,
          state: editCompany.state,
          address: editCompany.address,
          gstin: editCompany.gstin,
          pan: editCompany.pan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update company");

      setCompanies((prev) =>
        prev.map((c) => (c.id === editCompany.id ? { ...c, ...editCompany } : c))
      );
      setToast({ type: "success", text: `Company "${editCompany.name}" updated successfully!` });
      setEditCompany(null);
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", text: err.message });
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleDeleteCompany() {
    if (!deleteCompany) return;
    setLoadingAction(true);
    setToast(null);
    try {
      const res = await fetch(`/api/superadmin/companies?companyId=${deleteCompany.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete company");

      setCompanies((prev) => prev.filter((c) => c.id !== deleteCompany.id));
      setToast({ type: "success", text: `Company "${deleteCompany.name}" deleted.` });
      setDeleteCompany(null);
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", text: err.message });
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleSwitchToCompany(companyId: string) {
    setSwitchingId(companyId);
    try {
      const res = await fetch("/api/superadmin/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (!res.ok) throw new Error("Failed to switch company");
      window.location.href = "/";
    } catch (err: any) {
      alert(err.message);
      setSwitchingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="h-6 w-6 text-amber-400" /> All Tenant Businesses ({companies.length})
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage all onboarded business stores, edit settings, inspect financials, or onboard new clients.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all shrink-0"
        >
          <Plus className="h-4 w-4" /> Onboard New Business
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium border animate-in fade-in duration-150 ${
            toast.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/60 border-red-500/30 text-red-300"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Search & KPIs Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search business by name, legal name, GSTIN, city, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-4">
          <div>
            Total Turnover:{" "}
            <span className="text-amber-400 font-bold">{formatCurrency(totalPlatformTurnover)}</span>
          </div>
        </div>
      </div>

      {/* Companies List */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-500">
            <Building2 className="h-10 w-10 text-slate-600 mx-auto mb-2" />
            <p className="text-base font-semibold text-slate-300">No businesses found</p>
          </div>
        ) : (
          filtered.map((comp) => {
            const isSwitching = switchingId === comp.id;
            const owner = comp.members[0]?.user;

            return (
              <div
                key={comp.id}
                className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-lg hover:border-slate-700 transition-all flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5"
              >
                {/* Details */}
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-white">{comp.name}</span>
                    {comp.legalName && comp.legalName !== comp.name && (
                      <span className="text-xs text-slate-400 italic">({comp.legalName})</span>
                    )}
                    {/* Status Badge */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        comp.status === "ACTIVE"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : comp.status === "TRIAL"
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                          : comp.status === "SUSPENDED"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      }`}
                    >
                      {comp.status}
                    </span>
                    {/* Plan Badge */}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Plan: {comp.planName || "Trial"}
                    </span>
                    {comp.gstin && (
                      <span className="font-mono rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-slate-700">
                        GST: {comp.gstin}
                      </span>
                    )}
                  </div>
                  {comp.status === "SUSPENDED" && comp.suspendedReason && (
                    <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 px-3 py-1.5 rounded-xl font-medium">
                      ⚠️ Account Suspended: {comp.suspendedReason}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    {(comp.city || comp.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        {[comp.city, comp.state].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {comp.email && (
                      <span className="flex items-center gap-1 font-mono text-slate-300">
                        <Mail className="h-3.5 w-3.5 text-slate-500" /> {comp.email}
                      </span>
                    )}
                    {comp.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-slate-500" /> {comp.phone}
                      </span>
                    )}
                    {owner && (
                      <span className="text-slate-500">
                        Owner: <strong className="text-slate-300">{owner.name}</strong> ({owner.email})
                      </span>
                    )}
                  </div>

                  {/* Badges Metrics */}
                  <div className="flex flex-wrap gap-2 pt-1 text-xs">
                    <span className="rounded-lg bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-1 font-bold text-emerald-400">
                      💰 Turnover: {formatCurrency(comp.totalTurnover)}
                    </span>
                    <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300">
                      🧾 {comp.totalInvoices} Invoices
                    </span>
                    <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300">
                      👥 {comp.partiesCount} Parties
                    </span>
                    <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300">
                      📦 {comp.itemsCount} Items
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => openStatusModal(comp)}
                    title="Manage Subscription Plan & Account Status (Suspend/Activate)"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-500/20 border border-purple-500/30 px-3.5 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500 hover:text-slate-950 transition-colors"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Status & Plan
                  </button>

                  <button
                    onClick={() => handleSwitchToCompany(comp.id)}
                    disabled={isSwitching}
                    title="Open and view this business panel directly"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition-colors disabled:opacity-50"
                  >
                    {isSwitching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    Inspect / View Store
                  </button>

                  <button
                    onClick={() => setEditCompany(comp)}
                    title="Edit Business Information"
                    className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => setDeleteCompany(comp)}
                    title="Delete Business & All Records"
                    className="rounded-xl border border-red-500/30 bg-red-950/20 p-2 text-red-400 hover:bg-red-950/50 hover:border-red-500/50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Onboard New Business Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-400" /> Onboard New Business / Client
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddCompany} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">Company / Store Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Hardware"
                    value={newComp.name}
                    onChange={(e) => setNewComp({ ...newComp, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">Legal / Registered Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Hardware Pvt Ltd"
                    value={newComp.legalName}
                    onChange={(e) => setNewComp({ ...newComp, legalName: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Mumbai"
                    value={newComp.city}
                    onChange={(e) => setNewComp({ ...newComp, city: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">State</label>
                  <input
                    type="text"
                    placeholder="Maharashtra"
                    value={newComp.state}
                    onChange={(e) => setNewComp({ ...newComp, state: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    placeholder="27ABCDE1234F1Z5"
                    value={newComp.gstin}
                    onChange={(e) => setNewComp({ ...newComp, gstin: e.target.value.toUpperCase() })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white font-mono outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={newComp.phone}
                    onChange={(e) => setNewComp({ ...newComp, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <p className="font-bold text-amber-400 text-xs mb-2">Owner / Admin Account Setup</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 uppercase font-semibold mb-1">Owner Name</label>
                    <input
                      type="text"
                      placeholder="Ramesh Kumar"
                      value={newComp.ownerName}
                      onChange={(e) => setNewComp({ ...newComp, ownerName: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase font-semibold mb-1">Owner Login Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="ramesh@example.com"
                      value={newComp.ownerEmail}
                      onChange={(e) => setNewComp({ ...newComp, ownerEmail: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white font-mono outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-slate-400 uppercase font-semibold mb-1">Initial Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min 6 characters password"
                    value={newComp.ownerPassword}
                    onChange={(e) => setNewComp({ ...newComp, ownerPassword: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50"
                >
                  {loadingAction ? "Onboarding..." : "Create Business Store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Business Modal */}
      {editCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-amber-400" /> Edit Business Details
              </h3>
              <button onClick={() => setEditCompany(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditCompany} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">Company Name</label>
                  <input
                    type="text"
                    required
                    value={editCompany.name}
                    onChange={(e) => setEditCompany({ ...editCompany, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">Legal Name</label>
                  <input
                    type="text"
                    value={editCompany.legalName || ""}
                    onChange={(e) => setEditCompany({ ...editCompany, legalName: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={editCompany.gstin || ""}
                    onChange={(e) => setEditCompany({ ...editCompany, gstin: e.target.value.toUpperCase() })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white font-mono outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={editCompany.phone || ""}
                    onChange={(e) => setEditCompany({ ...editCompany, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={editCompany.city || ""}
                    onChange={(e) => setEditCompany({ ...editCompany, city: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">State</label>
                  <input
                    type="text"
                    value={editCompany.state || ""}
                    onChange={(e) => setEditCompany({ ...editCompany, state: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditCompany(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50"
                >
                  {loadingAction ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Business Confirmation */}
      {deleteCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-400" /> Delete Business Store?
              </h3>
              <button onClick={() => setDeleteCompany(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-300">
              <p>
                Are you sure you want to permanently delete{" "}
                <strong className="text-white">{deleteCompany.name}</strong>?
              </p>
              <p className="text-red-400">
                ⚠️ Warning: This will delete all linked invoices, parties, items, vouchers, and accounts for this business.
              </p>

              <div className="mt-6 flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setDeleteCompany(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCompany}
                  disabled={loadingAction}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {loadingAction ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Status & Plan Modal */}
      {statusModalComp && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-purple-400" />
                Manage Status & Plan
              </h2>
              <button
                onClick={() => setStatusModalComp(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800">
              <p className="text-sm font-semibold text-white">{statusModalComp.name}</p>
              <p className="text-xs text-slate-400">
                Current Plan: <span className="text-purple-400 font-bold">{statusModalComp.planName}</span> | Status: <span className="font-bold text-slate-200">{statusModalComp.status}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Account Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-purple-500 focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE - Fully Operational</option>
                <option value="TRIAL">TRIAL - 14-Day Free Evaluation</option>
                <option value="SUSPENDED">SUSPENDED - Block Transactions & Mutations</option>
                <option value="EXPIRED">EXPIRED - Trial/Subscription Expired</option>
                <option value="CANCELLED">CANCELLED - Account Decommissioned</option>
              </select>
            </div>

            {newStatus === "SUSPENDED" && (
              <div>
                <label className="block text-xs font-semibold text-rose-400 mb-1">
                  Suspension Reason (Required)
                </label>
                <textarea
                  rows={2}
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Specify why this business account is suspended..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-rose-800 text-white text-sm focus:outline-none placeholder-slate-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Subscription Plan
              </label>
              <select
                value={selectedPlanCode}
                onChange={(e) => setSelectedPlanCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-purple-500 focus:outline-none"
              >
                {availablePlans && availablePlans.length > 0 ? (
                  availablePlans.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name} (₹{p.price}/mo)
                    </option>
                  ))
                ) : (
                  <>
                    <option value="TRIAL">Free Trial</option>
                    <option value="STARTER">Starter Plan (₹499/mo)</option>
                    <option value="PRO">Professional Plan (₹1,499/mo)</option>
                    <option value="ENTERPRISE">Enterprise Plan (₹4,999/mo)</option>
                  </>
                )}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStatusModalComp(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={savingStatus}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg disabled:opacity-50"
              >
                {savingStatus ? "Saving..." : "Apply Status & Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
