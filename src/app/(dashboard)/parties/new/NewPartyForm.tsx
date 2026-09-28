"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPartyForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    type: "CUSTOMER",
    phone: "",
    email: "",
    gstin: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    openingBalance: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          openingBalance: form.openingBalance ? parseFloat(form.openingBalance) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push("/parties");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Add Party</h1>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className="label">Name *</label>
          <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.type} onChange={(e) => update("type", e.target.value)}>
            <option value="CUSTOMER">Customer</option>
            <option value="VENDOR">Vendor / Supplier</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div>
          <label className="label">GSTIN</label>
          <input className="input" maxLength={15} value={form.gstin} onChange={(e) => update("gstin", e.target.value.toUpperCase())} />
        </div>
        <div>
          <label className="label">Opening Balance (₹)</label>
          <input type="number" step="any" className="input" value={form.openingBalance} onChange={(e) => update("openingBalance", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={(e) => update("address", e.target.value)} />
        </div>
        <div>
          <label className="label">City</label>
          <input className="input" value={form.city} onChange={(e) => update("city", e.target.value)} />
        </div>
        <div>
          <label className="label">State</label>
          <input className="input" value={form.state} onChange={(e) => update("state", e.target.value)} />
        </div>
        <div>
          <label className="label">Pincode</label>
          <input className="input" value={form.pincode} onChange={(e) => update("pincode", e.target.value)} />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save Party"}
        </button>
        <button type="button" onClick={() => router.push("/parties")} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
