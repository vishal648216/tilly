"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Star,
  MapPin,
  Package,
  ArrowRightLeft,
  X,
  AlertCircle,
} from "lucide-react";

interface Warehouse {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  isDefault: boolean;
  active: boolean;
  itemCount: number;
  movementCount: number;
  totalQuantity: number;
  createdAt: string;
}

export default function WarehouseClient({ initialWarehouses }: { initialWarehouses: Warehouse[] }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    isDefault: false,
    active: true,
  });

  function openCreateModal() {
    setEditingId(null);
    setForm({ name: "", code: "", address: "", isDefault: warehouses.length === 0, active: true });
    setError("");
    setShowModal(true);
  }

  function openEditModal(wh: Warehouse) {
    setEditingId(wh.id);
    setForm({
      name: wh.name,
      code: wh.code || "",
      address: wh.address || "",
      isDefault: wh.isDefault,
      active: wh.active,
    });
    setError("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || form.name.trim().length < 2) {
      setError("Warehouse name must be at least 2 characters.");
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        // Edit existing
        const res = await fetch(`/api/warehouses/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update warehouse");

        setWarehouses((prev) =>
          prev.map((w) => {
            if (w.id === editingId) {
              return { ...w, ...data.warehouse };
            }
            if (form.isDefault) {
              return { ...w, isDefault: false };
            }
            return w;
          })
        );
        setSuccessMsg(`Warehouse '${data.warehouse.name}' updated!`);
      } else {
        // Create new
        const res = await fetch("/api/warehouses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create warehouse");

        const newWh: Warehouse = {
          ...data.warehouse,
          itemCount: 0,
          movementCount: 0,
          totalQuantity: 0,
          createdAt: new Date().toISOString(),
        };

        setWarehouses((prev) => [
          newWh,
          ...prev.map((w) => (newWh.isDefault ? { ...w, isDefault: false } : w)),
        ]);
        setSuccessMsg(`Warehouse '${newWh.name}' created!`);
      }

      setShowModal(false);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(wh: Warehouse) {
    if (wh.isDefault) {
      alert("Cannot deactivate the default warehouse.");
      return;
    }
    const newActive = !wh.active;
    if (!confirm(`Are you sure you want to ${newActive ? "activate" : "deactivate"} warehouse '${wh.name}'?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/warehouses/${wh.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      setWarehouses((prev) => prev.map((w) => (w.id === wh.id ? { ...w, active: newActive } : w)));
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-brand-600" /> Warehouses & Godowns
          </h1>
          <p className="text-sm text-slate-500">
            Multi-location inventory tracking, godown transfers, and stock balance management
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/inventory/transfers"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <ArrowRightLeft className="h-4 w-4 text-brand-600" /> Stock Transfers
          </Link>
          <button
            onClick={openCreateModal}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Godown / Warehouse
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {warehouses.map((wh) => (
          <div
            key={wh.id}
            className={`rounded-xl border bg-white p-5 shadow-xs transition-all relative ${
              wh.isDefault ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200 hover:border-slate-300"
            } ${!wh.active ? "opacity-60 bg-slate-50" : ""}`}
          >
            {wh.isDefault && (
              <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 border border-brand-200">
                <Star className="h-3 w-3 fill-brand-600 text-brand-600" /> Primary Godown
              </span>
            )}

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 pr-14">
                <h3 className="font-bold text-slate-900 text-base">{wh.name}</h3>
                {wh.code && (
                  <p className="text-xs font-mono text-slate-400 uppercase font-semibold">
                    Code: {wh.code}
                  </p>
                )}
              </div>
            </div>

            {wh.address && (
              <div className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 mt-0.5" />
                <span className="line-clamp-2">{wh.address}</span>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-400 block text-[11px]">Stocked Items</span>
                <span className="font-bold text-slate-800 text-sm">{wh.itemCount}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-400 block text-[11px]">Total Quantity</span>
                <span className="font-bold text-brand-700 text-sm">{wh.totalQuantity}</span>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    wh.active ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
                <span className="text-slate-500 font-medium">
                  {wh.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(wh)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1"
                >
                  <Edit2 className="h-3 w-3" /> Edit
                </button>
                {!wh.isDefault && (
                  <button
                    onClick={() => handleToggleActive(wh)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      wh.active
                        ? "text-rose-600 hover:bg-rose-50"
                        : "text-emerald-600 hover:bg-emerald-50"
                    }`}
                  >
                    {wh.active ? "Deactivate" : "Activate"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-brand-600" />
                {editingId ? "Edit Warehouse / Godown" : "Add New Warehouse / Godown"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Warehouse / Godown Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. Ahmedabad Central Godown"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Code / Short Identifier
                </label>
                <input
                  className="input font-mono uppercase"
                  placeholder="e.g. WH-AHD-01"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address / Location Details
                </label>
                <textarea
                  className="input min-h-[70px]"
                  placeholder="Plot 12, GIDC Industrial Estate, Naroda, Ahmedabad"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                  />
                  <span>Set as Primary / Default Godown</span>
                </label>

                {editingId && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                      className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                    />
                    <span>Active Godown</span>
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary text-xs"
                >
                  {loading ? "Saving..." : editingId ? "Save Changes" : "Create Godown"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
