"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Key,
  Shield,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Phone,
  Building2,
  Crown,
  Check,
  Ban,
  Clock,
} from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  createdAt: string;
  memberships: Array<{
    role: string;
    company: {
      id: string;
      name: string;
    };
  }>;
}

export default function UsersClient({ initialUsers }: { initialUsers: UserItem[] }) {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [passwordModalUser, setPasswordModalUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteUser, setDeleteUser] = useState<UserItem | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filtered = users.filter((u) => {
    const s = searchTerm.toLowerCase();
    const matchSearch =
      u.name.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      (u.phone && u.phone.includes(s)) ||
      (u.memberships[0]?.company.name.toLowerCase().includes(s));

    const matchStatus = statusFilter === "ALL" || u.status === statusFilter;
    const matchRole = roleFilter === "ALL" || u.role === roleFilter;

    return matchSearch && matchStatus && matchRole;
  });

  async function handleUpdateUser(userId: string, updates: { status?: string; role?: string; newPassword?: string }) {
    setActionLoadingId(userId);
    setToast(null);
    try {
      const res = await fetch("/api/superadmin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...updates } : u))
      );
      setToast({ type: "success", text: "User updated successfully!" });
      if (updates.newPassword) {
        setPasswordModalUser(null);
        setNewPassword("");
      }
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", text: err.message });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDeleteUser() {
    if (!deleteUser) return;
    setActionLoadingId(deleteUser.id);
    setToast(null);
    try {
      const res = await fetch(`/api/superadmin/users?userId=${deleteUser.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");

      setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
      setToast({ type: "success", text: `User ${deleteUser.name} deleted.` });
      setDeleteUser(null);
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", text: err.message });
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-400" /> All Platform Users ({users.length})
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage user accounts, roles, access statuses, and password resets across all tenants.
          </p>
        </div>
      </div>

      {/* Toast */}
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

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="USER">User</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Business / Company</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Registered</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const comp = u.memberships[0]?.company;
                  const isSelf = u.email === "admin@admin.com";

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{u.name}</span>
                          {u.role === "SUPER_ADMIN" && (
                            <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20 flex items-center gap-1">
                              <Crown className="h-3 w-3" /> SUPER ADMIN
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span className="font-mono text-slate-300">{u.email}</span>
                          {u.phone && <span>• {u.phone}</span>}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs">
                        {comp ? (
                          <span className="inline-flex items-center gap-1 text-slate-200 font-medium">
                            <Building2 className="h-3.5 w-3.5 text-amber-400" />
                            {comp.name}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No business linked</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <select
                          disabled={isSelf}
                          value={u.role}
                          onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-200 outline-none disabled:opacity-50"
                        >
                          <option value="USER">USER</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        </select>
                      </td>

                      <td className="px-5 py-4">
                        <select
                          disabled={isSelf}
                          value={u.status}
                          onChange={(e) => handleUpdateUser(u.id, { status: e.target.value })}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold outline-none disabled:opacity-50 ${
                            u.status === "APPROVED"
                              ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-400"
                              : u.status === "PENDING"
                              ? "bg-amber-950/60 border-amber-500/30 text-amber-400"
                              : "bg-red-950/60 border-red-500/30 text-red-400"
                          }`}
                        >
                          <option value="APPROVED">APPROVED</option>
                          <option value="PENDING">PENDING</option>
                          <option value="SUSPENDED">SUSPENDED</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPasswordModalUser(u)}
                            title="Reset Password"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                          >
                            <Key className="h-4 w-4" />
                          </button>

                          {!isSelf && (
                            <button
                              onClick={() => setDeleteUser(u)}
                              title="Delete User"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Password Modal */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-400" /> Reset User Password
              </h3>
              <button onClick={() => setPasswordModalUser(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-300">
                Set a new password for <strong className="text-white">{passwordModalUser.name}</strong> ({passwordModalUser.email}).
              </p>

              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1">New Password (Min 6 chars)</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={newPassword.length < 6 || actionLoadingId !== null}
                  onClick={() => handleUpdateUser(passwordModalUser.id, { newPassword })}
                  className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50"
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-400" /> Delete User Account?
              </h3>
              <button onClick={() => setDeleteUser(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-300">
              <p>
                Are you sure you want to delete <strong className="text-white">{deleteUser.name}</strong> ({deleteUser.email})?
              </p>

              <div className="mt-6 flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setDeleteUser(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={actionLoadingId !== null}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
