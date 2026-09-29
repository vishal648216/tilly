"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isValidHsn } from "@/lib/validators";
import { Package, Wrench, Plus, AlertCircle, CheckCircle2 } from "lucide-react";

export default function NewItemForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    type: "PRODUCT",
    category: "",
    barcode: "",
    sku: "",
    hsn: "",
    unit: "PCS",
    salePrice: "",
    purchasePrice: "",
    gstRate: "18",
    stock: "",
    minStock: "",
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleBlur(key: string) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  const isHsnValid = useMemo(() => {
    if (!form.hsn.trim()) return true; // optional
    return isValidHsn(form.hsn);
  }, [form.hsn]);

  const isSalePriceValid = useMemo(() => {
    if (!form.salePrice) return true;
    const p = parseFloat(form.salePrice);
    return !isNaN(p) && p >= 0;
  }, [form.salePrice]);

  const isPurchasePriceValid = useMemo(() => {
    if (!form.purchasePrice) return true;
    const p = parseFloat(form.purchasePrice);
    return !isNaN(p) && p >= 0;
  }, [form.purchasePrice]);

  const isStockValid = useMemo(() => {
    if (!form.stock) return true;
    const s = parseFloat(form.stock);
    return !isNaN(s) && s >= 0;
  }, [form.stock]);

  const isFormValid =
    form.name.trim().length >= 2 &&
    isHsnValid &&
    isSalePriceValid &&
    isPurchasePriceValid &&
    isStockValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    setTouched({
      name: true,
      hsn: true,
      salePrice: true,
      purchasePrice: true,
      stock: true,
    });

    if (form.name.trim().length < 2) {
      setError("Item / Service ka naam kam se kam 2 characters ka hona chahiye.");
      return;
    }

    if (form.hsn.trim() && !isHsnValid) {
      setError("HSN / SAC Code 2 se 8 digits ka number hona chahiye (jaise: 4820 ya 998714).");
      return;
    }

    const saleP = form.salePrice ? parseFloat(form.salePrice) : 0;
    const purP = form.purchasePrice ? parseFloat(form.purchasePrice) : 0;
    if (isNaN(saleP) || saleP < 0) {
      setError("Sale price 0 ya us se zyada honi chahiye.");
      return;
    }
    if (isNaN(purP) || purP < 0) {
      setError("Purchase price 0 ya us se zyada honi chahiye.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          hsn: form.hsn.trim() || null,
          sku: form.sku.trim() || null,
          barcode: form.barcode.trim() || null,
          category: form.category.trim() || null,
          salePrice: saleP,
          purchasePrice: purP,
          gstRate: parseFloat(form.gstRate) || 0,
          stock: form.type === "SERVICE" ? 0 : form.stock ? parseFloat(form.stock) : 0,
          minStock: form.type === "SERVICE" ? 0 : form.minStock ? parseFloat(form.minStock) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create item");
      router.push("/items");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Plus className="h-6 w-6 text-brand-600" /> Add New Item / Service
          </h1>
          <p className="text-sm text-slate-500">Products aur Services add karein with GST tax slabs</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-900">Validation Error</p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Item Type Selector */}
      <div className="card p-5">
        <label className="label mb-2">Item Classification</label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => update("type", "PRODUCT")}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
              form.type === "PRODUCT"
                ? "border-brand-600 bg-brand-50/50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <Package className="h-6 w-6 mb-1 text-brand-600" />
            <span className="font-bold text-sm">Product / Goods</span>
            <span className="text-xs text-slate-500 mt-0.5">Physical Inventory & Stock</span>
          </button>

          <button
            type="button"
            onClick={() => update("type", "SERVICE")}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
              form.type === "SERVICE"
                ? "border-brand-600 bg-brand-50/50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <Wrench className="h-6 w-6 mb-1 text-purple-600" />
            <span className="font-bold text-sm">Service / Labor</span>
            <span className="text-xs text-slate-500 mt-0.5">Labor Charges & SAC Code</span>
          </button>
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">
            {form.type === "SERVICE" ? "Service Name *" : "Product Name *"}
          </label>
          <input
            className={`input ${touched.name && form.name.trim().length < 2 ? "border-red-300 bg-red-50/20" : ""}`}
            placeholder={
              form.type === "SERVICE"
                ? "e.g. Engine Repair, General Service, Labor Charges"
                : "e.g. Castrol Engine Oil 20W40, Brake Shoe"
            }
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            onBlur={() => handleBlur("name")}
            required
          />
          {touched.name && form.name.trim().length < 2 && (
            <p className="mt-1 text-xs text-red-600">Naam kam se kam 2 characters ka ho</p>
          )}
        </div>

        <div>
          <label className="label">Category</label>
          <input
            className="input"
            placeholder="e.g. Spare Parts, Oils, Labor, Electronics"
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Barcode / QR Code</label>
          <input
            className="input font-mono"
            placeholder="Scan or enter barcode"
            value={form.barcode}
            onChange={(e) => update("barcode", e.target.value)}
          />
        </div>

        <div>
          <label className="label">SKU / Item Code</label>
          <input
            className="input font-mono"
            placeholder="e.g. SKU-1001"
            value={form.sku}
            onChange={(e) => update("sku", e.target.value)}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0">
              {form.type === "SERVICE" ? "SAC Code (2-8 Digits)" : "HSN Code (2-8 Digits)"}
            </label>
            {form.hsn && (
              <span className={`text-[11px] font-medium ${isHsnValid ? "text-emerald-600" : "text-red-500"}`}>
                {isHsnValid ? "✓ Valid HSN" : "✕ 2-8 digits daalein"}
              </span>
            )}
          </div>
          <input
            maxLength={8}
            className={`input font-mono ${form.hsn && !isHsnValid ? "border-red-300 bg-red-50/20" : ""}`}
            placeholder="e.g. 4820 / 998714"
            value={form.hsn}
            onChange={(e) => update("hsn", e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={() => handleBlur("hsn")}
          />
        </div>

        <div>
          <label className="label">Unit of Measurement</label>
          <select className="input" value={form.unit} onChange={(e) => update("unit", e.target.value)}>
            <option value="PCS">Pieces (PCS)</option>
            <option value="LTR">Liters (LTR)</option>
            <option value="KG">Kilograms (KG)</option>
            <option value="BOX">Box (BOX)</option>
            <option value="SET">Set (SET)</option>
            <option value="HRS">Hours (HRS)</option>
            <option value="NOS">Numbers (NOS)</option>
            <option value="MTR">Meters (MTR)</option>
          </select>
        </div>

        <div>
          <label className="label">GST Rate</label>
          <select className="input font-semibold" value={form.gstRate} onChange={(e) => update("gstRate", e.target.value)}>
            <option value="0">0% (Nil / Exempted)</option>
            <option value="5">5%</option>
            <option value="12">12%</option>
            <option value="18">18% (Standard)</option>
            <option value="28">28%</option>
          </select>
        </div>

        <div>
          <label className="label">Sale Price (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input font-semibold"
            placeholder="0.00"
            value={form.salePrice}
            onChange={(e) => update("salePrice", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Purchase / Cost Price (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            placeholder="0.00"
            value={form.purchasePrice}
            onChange={(e) => update("purchasePrice", e.target.value)}
          />
        </div>

        {form.type === "PRODUCT" && (
          <>
            <div>
              <label className="label">Opening Stock Quantity</label>
              <input
                type="number"
                min="0"
                step="any"
                className="input"
                placeholder="0"
                value={form.stock}
                onChange={(e) => update("stock", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Minimum Stock Alert Threshold</label>
              <input
                type="number"
                min="0"
                step="any"
                className="input"
                placeholder="5"
                value={form.minStock}
                onChange={(e) => update("minStock", e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading || !isFormValid} className="btn-primary">
          {loading ? "Saving..." : "Save Item"}
        </button>
        <button type="button" onClick={() => router.push("/items")} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
