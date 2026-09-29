"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  Search,
  Building2,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  Clock,
  Loader2,
  AlertCircle,
  Receipt,
  X,
} from "lucide-react";

interface PendingUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  status: string;
  memberships: Array<{
    role: string;
    company: {
      id: string;
      name: string;
      city: string | null;
      state: string | null;
      gstin: string | null;
      phone: string | null;
    };
  }>;
}

export default function ApprovalsClient({
  initialUsers,
}: {
  initialUsers: PendingUser[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState<PendingUser[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rejectModalUser, setRejectModalUser] = useState<PendingUser | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filtered = users.filter((u) => {
    const comp = u.memberships[0]?.company;
    const matchSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (comp && comp.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (comp && comp.city && comp.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (comp && comp.gstin && comp.gstin.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchSearch;
  });

  async function handleApprove(userId: string) {
    setActionLoadingId(userId);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/superadmin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "APPROVE" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setStatusMessage({ type: "success", text: data.message || "Account successfully approved and activated!" });
      router.refresh();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReject() {
    if (!rejectModalUser) return;
    setActionLoadingId(rejectModalUser.id);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/superadmin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: rejectModalUser.id,
          action: "REJECT",
          rejectionReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rejection failed");

      setUsers((prev) => prev.filter((u) => u.id !== rejectModalUser.id));
      setStatusMessage({ type: "success", text: `${rejectModalUser.name} registration request has been rejected.` });
      setRejectModalUser(null);
      setRejectionReason("");
      router.refresh();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-amber-400" /> Pending Approvals Queue
            </h1>
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/30">
              {users.length} Pending
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Review and approve new businesses & client registrations before they can log in.
          </p>
        </div>
      </div>

      {/* Status Toast */}
      {statusMessage && (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium border animate-in fade-in duration-150 ${
            statusMessage.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/60 border-red-500/30 text-red-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Search Filter */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by user name, email, business name, GSTIN, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
        </div>
      </div>

      {/* Pending List */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-white">All Clear! No Pending Approvals</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            Whenever a new client or business registers on the platform, their verification request will appear right here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((u) => {
            const comp = u.memberships[0]?.company;
            const isLoading = actionLoadingId === u.id;

            return (
              <div
                key={u.id}
                className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-lg hover:border-slate-700 transition-all flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5"
              >
                {/* Left: User & Business Details */}
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-white">{u.name}</span>
                    <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400 border border-amber-500/20">
                      ⏳ Pending Approval
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(u.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-mono text-slate-300">
                      <Mail className="h-3.5 w-3.5 text-slate-500" /> {u.email}
                    </span>
                    {u.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-slate-500" /> {u.phone}
                      </span>
                    )}
                  </div>

                  {comp && (
                    <div className="mt-2 rounded-xl bg-slate-950/70 p-3 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center gap-2 text-slate-200 font-semibold">
                        <Building2 className="h-4 w-4 text-amber-400" />
                        <span>Business: {comp.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 pl-6">
                        {(comp.city || comp.state) && (
                          <span>
                            Location: {[comp.city, comp.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {comp.gstin && (
                          <span className="font-mono text-amber-300/80">
                            GSTIN: {comp.gstin}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => setRejectModalUser(u)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-950/50 hover:border-red-500/50 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </button>

                  <button
                    onClick={() => handleApprove(u.id)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Accept / Approve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {rejectModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-400" /> Reject Registration Request
              </h3>
              <button
                onClick={() => setRejectModalUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-300">
              <p>
                Are you sure you want to reject registration for{" "}
                <strong className="text-white">{rejectModalUser.name}</strong> ({rejectModalUser.email})?
              </p>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Rejection Reason (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Invalid GSTIN / Unverified phone number..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-red-500"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setRejectModalUser(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition-colors"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
