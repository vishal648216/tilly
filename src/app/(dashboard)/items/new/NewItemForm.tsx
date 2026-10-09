"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  Barcode,
  Building2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Plus,
  Tag,
  Layers,
  ShieldAlert,
  Percent,
  CheckCircle2,
} from "lucide-react";

const RETAIL_UNITS = [
  { value: "PCS", label: "PCS (Pieces)" },
  { value: "PACK", label: "PACK (Packets)" },
  { value: "BOX", label: "BOX (Boxes)" },
  { value: "KG", label: "KG (Kilograms)" },
  { value: "GM", label: "GM (Grams)" },
  { value: "LTR", label: "LTR (Litres)" },
  { value: "ML", label: "ML (Millilitres)" },
  { value: "MTR", label: "MTR (Metres)" },
  { value: "DOZ", label: "DOZ (Dozens)" },
  { value: "BTL", label: "BTL (Bottles)" },
  { value: "BAG", label: "BAG (Bags)" },
  { value: "HOURS", label: "HOURS (Service)" },
  { value: "DAYS", label: "DAYS (Service)" },
];

export default function NewItemForm() {
  const router = useRouter();

  // Vendors list from CRM
  const [vendors, setVendors] = useState<Array<{ id: string; name: string; city?: string }>>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [customSupplierName, setCustomSupplierName] = useState("");
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState(false);

  // Form State
  const [form, setForm] = useState({
    type: "PRODUCT", // PRODUCT, SERVICE
    name: "",
    sku: "",
    barcode: "",
    category: "",
    brand: "",
    hsn: "",
    unit: "PCS",
    purchasePrice: "", // Cost Price
    salePrice: "", // Selling Price
    mrp: "", // Max Retail Price
    openingStock: "0",
    minStock: "0",
    gstRate: "18",
    taxMode: "EXCLUSIVE", // EXCLUSIVE, INCLUSIVE
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch Suppliers / Vendors
  useEffect(() => {
    fetch("/api/parties?type=VENDOR")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.parties)) {
          setVendors(data.parties);
        }
      })
      .catch(() => {});
  }, []);

  // Deduplicated vendors list
  const uniqueVendors = useMemo(() => {
    const map = new Map<string, (typeof vendors)[0]>();
    for (const v of vendors) {
      const key = v.name.trim().toLowerCase();
      if (!map.has(key)) map.set(key, v);
    }
    return Array.from(map.values());
  }, [vendors]);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleBlur(key: string) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  // Quick Barcode Generator
  function handleGenerateBarcode() {
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000);
    update("barcode", `890${randomDigits}`);
  }

  // Live Simple Profit & Margin Indicator
  const profitMetrics = useMemo(() => {
    const sale = parseFloat(form.salePrice) || 0;
    const cost = parseFloat(form.purchasePrice) || 0;
    const mrp = parseFloat(form.mrp) || 0;

    const profit = sale > 0 && cost > 0 ? sale - cost : 0;
    const margin = sale > 0 && cost > 0 ? Math.round(((sale - cost) / sale) * 100) : 0;

    return {
      profit: Math.round(profit * 100) / 100,
      margin,
      isExceedingMrp: mrp > 0 && sale > mrp,
      isLoss: cost > 0 && sale > 0 && sale < cost,
    };
  }, [form.salePrice, form.purchasePrice, form.mrp]);

  // Validations
  const validationErrors = useMemo(() => {
    const errs: Record<string, string> = {};

    if (!form.name.trim()) {
      errs.name = "Item or service name is required.";
    } else if (form.name.trim().length < 2) {
      errs.name = "Name must be at least 2 characters.";
    }

    const saleP = parseFloat(form.salePrice);
    if (!form.salePrice || isNaN(saleP) || saleP < 0) {
      errs.salePrice = "Selling price is required and cannot be negative.";
    }

    const purP = parseFloat(form.purchasePrice);
    if (form.purchasePrice && (isNaN(purP) || purP < 0)) {
      errs.purchasePrice = "Purchase price cannot be negative.";
    }

    const mrpP = parseFloat(form.mrp);
    if (form.mrp && !isNaN(mrpP)) {
      if (mrpP <= 0) {
        errs.mrp = "MRP must be greater than 0.";
      } else if (saleP > mrpP) {
        errs.mrp = `Selling price (₹${saleP}) cannot exceed MRP (₹${mrpP}).`;
      }
    }

    if (form.type === "PRODUCT") {
      const openS = parseFloat(form.openingStock);
      if (form.openingStock && (isNaN(openS) || openS < 0)) {
        errs.openingStock = "Opening stock cannot be negative.";
      }
      const minS = parseFloat(form.minStock);
      if (form.minStock && (isNaN(minS) || minS < 0)) {
        errs.minStock = "Minimum stock cannot be negative.";
      }
    }

    return errs;
  }, [form.name, form.salePrice, form.purchasePrice, form.mrp, form.openingStock, form.minStock, form.type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    setTouched({
      name: true,
      salePrice: true,
      purchasePrice: true,
      mrp: true,
      openingStock: true,
      minStock: true,
    });

    if (Object.keys(validationErrors).length > 0) {
      const first = Object.values(validationErrors)[0];
      setError(first);
      return;
    }

    setLoading(true);
    try {
      let supplierIdToUse = selectedSupplierId || null;
      let supplierNameToUse = "";

      if (selectedSupplierId) {
        const found = uniqueVendors.find((v) => v.id === selectedSupplierId);
        supplierNameToUse = found ? found.name : "";
      } else if (customSupplierName.trim()) {
        const cleanName = customSupplierName.trim();
        supplierNameToUse = cleanName;

        const existing = uniqueVendors.find(
          (v) => v.name.trim().toLowerCase() === cleanName.toLowerCase()
        );
        if (existing) {
          supplierIdToUse = existing.id;
        } else {
          // Immediately create party in CRM so it is permanently available!
          try {
            const pRes = await fetch("/api/parties", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: cleanName,
                type: "VENDOR",
              }),
            });
            const pData = await pRes.json();
            if (pRes.ok && pData.party) {
              supplierIdToUse = pData.party.id;
              setVendors((prev) => [pData.party, ...prev]);
            }
          } catch {}
        }
      }

      const isService = form.type === "SERVICE";
      const payload = {
        name: form.name.trim(),
        type: form.type,
        category: form.category.trim() || null,
        brand: form.brand.trim() || null,
        hsn: form.hsn.trim() || null,
        unit: form.unit || (isService ? "HOURS" : "PCS"),
        barcode: !isService && form.barcode.trim() ? form.barcode.trim() : null,
        sku: form.sku.trim()
          ? form.sku.trim()
          : form.barcode.trim()
          ? `SKU-${form.barcode.trim().slice(-6)}`
          : null,

        purchasePrice: parseFloat(form.purchasePrice) || 0,
        salePrice: parseFloat(form.salePrice) || 0,
        mrp: form.mrp ? parseFloat(form.mrp) : 0,

        openingStock: isService ? 0 : form.openingStock ? parseFloat(form.openingStock) : 0,
        openingStockCost: parseFloat(form.purchasePrice) || 0,
        stock: isService ? 0 : form.openingStock ? parseFloat(form.openingStock) : 0,
        minStock: isService ? 0 : form.minStock ? parseFloat(form.minStock) : 0,

        gstRate: parseFloat(form.gstRate) || 0,
        taxMode: form.taxMode,

        supplierId: supplierIdToUse,
        supplierName: supplierNameToUse || null,
        purchasedFrom: supplierNameToUse || null,
        customFields: {
          supplierId: supplierIdToUse,
          supplierName: supplierNameToUse || null,
          purchasedFrom: supplierNameToUse || null,
          category: form.category.trim() || null,
          brand: form.brand.trim() || null,
        },
      };

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add item");

      router.push("/items");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to add item");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <Link
            href="/items"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-brand-600" /> Add Item / Service
            </h1>
            <p className="text-xs text-slate-500">
              Configure product details, GST rates, tax mode, and inventory stock
            </p>
          </div>
        </div>

        <Link
          href="/items"
          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          Cancel
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Clean Form Card */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        {/* Type Selector (Product vs Service) */}
        <div className="flex items-center gap-3 p-1.5 bg-slate-100 rounded-xl max-w-sm">
          <button
            type="button"
            onClick={() => update("type", "PRODUCT")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              form.type === "PRODUCT"
                ? "bg-white text-brand-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📦 Physical Product
          </button>
          <button
            type="button"
            onClick={() => update("type", "SERVICE")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              form.type === "SERVICE"
                ? "bg-white text-brand-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🛠️ Service / Labor
          </button>
        </div>

        {/* 1. Item Name */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            {form.type === "SERVICE" ? "Service Name" : "Item / Product Name"} <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            autoFocus
            className={`input text-sm h-10 w-full font-medium ${
              touched.name && validationErrors.name
                ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                : ""
            }`}
            placeholder={
              form.type === "SERVICE"
                ? "e.g. Tailoring / Alteration, Computer Repair, Consultation"
                : "e.g. Parle-G 100g, Amul Milk 500ml, Cotton T-Shirt (M)"
            }
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            onBlur={() => handleBlur("name")}
          />
          {touched.name && validationErrors.name && (
            <p className="text-[11px] text-rose-600 font-semibold mt-1">{validationErrors.name}</p>
          )}
        </div>

        {/* 2. Category, Brand & HSN/SAC */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <Layers className="h-3 w-3 text-slate-400" /> Category (Optional)
            </label>
            <input
              type="text"
              list="categories-list"
              className="input text-xs h-9 w-full"
              placeholder="e.g. Grocery, Apparel"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
            />
            <datalist id="categories-list">
              <option value="General" />
              <option value="Grocery" />
              <option value="Electronics" />
              <option value="Apparel & Clothing" />
              <option value="Stationery" />
              <option value="Hardware" />
              <option value="Pharmacy & Health" />
              <option value="Services" />
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <Tag className="h-3 w-3 text-slate-400" /> Brand (Optional)
            </label>
            <input
              type="text"
              className="input text-xs h-9 w-full"
              placeholder="e.g. Nestle, Britannia"
              value={form.brand}
              onChange={(e) => update("brand", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              HSN / SAC Code (Optional)
            </label>
            <input
              type="text"
              className="input text-xs h-9 w-full font-mono"
              placeholder="e.g. 1905, 9983"
              value={form.hsn}
              onChange={(e) => update("hsn", e.target.value)}
            />
          </div>
        </div>

        {/* 3. Barcode & Unit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Barcode className="h-3.5 w-3.5 text-brand-600" /> Barcode / SKU (Optional)
              </label>
              {form.type === "PRODUCT" && (
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Auto
                </button>
              )}
            </div>
            <input
              type="text"
              className="input text-xs h-10 w-full font-mono"
              placeholder={form.type === "SERVICE" ? "Optional service code" : "Scan or enter barcode"}
              value={form.barcode}
              onChange={(e) => update("barcode", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Unit of Measurement <span className="text-rose-500">*</span>
            </label>
            <select
              className="input text-xs h-10 w-full bg-white font-semibold"
              value={form.unit}
              onChange={(e) => update("unit", e.target.value)}
            >
              {RETAIL_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4. Supplier / Vendor (Optional) */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-brand-600" /> Supplier / Vendor{" "}
              <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <button
              type="button"
              onClick={() => setIsAddingNewSupplier(!isAddingNewSupplier)}
              className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" /> {isAddingNewSupplier ? "Select Existing" : "Add New Supplier"}
            </button>
          </div>

          {!isAddingNewSupplier ? (
            <select
              className="input text-xs h-10 w-full bg-white font-medium"
              value={selectedSupplierId}
              onChange={(e) => {
                if (e.target.value === "__NEW__") {
                  setIsAddingNewSupplier(true);
                  setSelectedSupplierId("");
                  setCustomSupplierName("");
                } else {
                  setSelectedSupplierId(e.target.value);
                  setCustomSupplierName("");
                }
              }}
            >
              <option value="">-- No Supplier / Direct / Self (Optional) --</option>
              {uniqueVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.city ? `(${v.city})` : ""}
                </option>
              ))}
              <option value="__NEW__" className="font-semibold text-emerald-700">
                ➕ + Add New Supplier / Vendor...
              </option>
            </select>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  list="supplier-options"
                  className="input text-xs h-10 flex-1"
                  placeholder="Type supplier name (e.g. Vishal, Ramesh Traders)..."
                  value={customSupplierName}
                  onChange={(e) => {
                    setCustomSupplierName(e.target.value);
                    setSelectedSupplierId("");
                  }}
                />
                <datalist id="supplier-options">
                  {uniqueVendors.map((v) => (
                    <option key={v.id} value={v.name} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNewSupplier(false);
                    setCustomSupplierName("");
                  }}
                  className="rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Choose Existing
                </button>
              </div>
              <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <span>✓ Will be saved in vendor CRM automatically</span>
              </p>
            </div>
          )}
        </div>

        {/* 5. Pricing (Purchase Price, Selling Price, MRP) */}
        <div className="pt-2 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Purchase Price */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Purchase Cost ₹{" "}
                <span className="text-slate-400 font-normal">
                  {form.type === "SERVICE" ? "(Optional)" : "(Cost)"}
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className={`input text-sm h-10 pl-7 w-full font-bold ${
                    touched.purchasePrice && validationErrors.purchasePrice
                      ? "border-rose-400 bg-rose-50/20"
                      : ""
                  }`}
                  placeholder="0.00"
                  value={form.purchasePrice}
                  onChange={(e) => update("purchasePrice", e.target.value)}
                  onBlur={() => handleBlur("purchasePrice")}
                />
              </div>
              {touched.purchasePrice && validationErrors.purchasePrice && (
                <p className="text-[10px] text-rose-600 font-semibold mt-1">{validationErrors.purchasePrice}</p>
              )}
            </div>

            {/* Selling Price */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Selling Price ₹ <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-emerald-600">₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  className={`input text-sm h-10 pl-7 w-full font-bold text-emerald-700 ${
                    touched.salePrice && validationErrors.salePrice ? "border-rose-400 bg-rose-50/20" : ""
                  }`}
                  placeholder="0.00"
                  value={form.salePrice}
                  onChange={(e) => update("salePrice", e.target.value)}
                  onBlur={() => handleBlur("salePrice")}
                />
              </div>
              {touched.salePrice && validationErrors.salePrice && (
                <p className="text-[10px] text-rose-600 font-semibold mt-1">{validationErrors.salePrice}</p>
              )}
            </div>

            {/* MRP */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">MRP ₹ (Optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className={`input text-sm h-10 pl-7 w-full font-bold text-slate-700 ${
                    touched.mrp && validationErrors.mrp ? "border-rose-400 bg-rose-50/20" : ""
                  }`}
                  placeholder="0.00"
                  value={form.mrp}
                  onChange={(e) => update("mrp", e.target.value)}
                  onBlur={() => handleBlur("mrp")}
                />
              </div>
              {touched.mrp && validationErrors.mrp && (
                <p className="text-[10px] text-rose-600 font-semibold mt-1">{validationErrors.mrp}</p>
              )}
            </div>
          </div>

          {/* Simple Inline Profit Info */}
          {profitMetrics.profit !== 0 && (
            <div className="mt-2 text-xs font-semibold flex items-center justify-between text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span>
                Profit per unit:{" "}
                <strong className={profitMetrics.profit > 0 ? "text-emerald-700" : "text-rose-600"}>
                  {profitMetrics.profit > 0 ? `+₹${profitMetrics.profit}` : `-₹${Math.abs(profitMetrics.profit)}`}
                </strong>{" "}
                ({profitMetrics.margin}% margin)
              </span>
              {profitMetrics.isExceedingMrp && (
                <span className="text-[11px] text-rose-600 font-bold">⚠️ Selling price exceeds MRP</span>
              )}
            </div>
          )}
        </div>

        {/* 6. Tax Mode & GST Configuration */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Tax Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update("taxMode", "EXCLUSIVE")}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  form.taxMode === "EXCLUSIVE"
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                + Tax Exclusive
                <span className="block text-[10px] text-slate-400 font-normal">GST added on top</span>
              </button>
              <button
                type="button"
                onClick={() => update("taxMode", "INCLUSIVE")}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  form.taxMode === "INCLUSIVE"
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                = Tax Inclusive
                <span className="block text-[10px] text-slate-400 font-normal">MRP / Price incl. GST</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">GST Rate (%)</label>
            <select
              className="input text-xs h-10 w-full bg-white font-semibold"
              value={form.gstRate}
              onChange={(e) => update("gstRate", e.target.value)}
            >
              <option value="0">0% (Nil / Exempt)</option>
              <option value="5">5% GST</option>
              <option value="12">12% GST</option>
              <option value="18">18% GST (Standard)</option>
              <option value="28">28% GST</option>
            </select>
          </div>
        </div>

        {/* 7. Stock Tracking (only for physical goods) */}
        {form.type === "PRODUCT" && (
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Opening Stock (Current Quantity)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="input text-xs h-10 w-full font-bold"
                placeholder="0"
                value={form.openingStock}
                onChange={(e) => update("openingStock", e.target.value)}
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Present in shop right now</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> Low Stock Alert Level
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="input text-xs h-10 w-full font-medium"
                placeholder="e.g. 5"
                value={form.minStock}
                onChange={(e) => update("minStock", e.target.value)}
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Alerts when inventory drops below</span>
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
          <Link
            href="/items"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-brand-600 hover:bg-brand-700 px-6 py-2.5 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50"
          >
            {loading ? "Saving Item..." : "Save Item"}
          </button>
        </div>
      </form>
    </div>
  );
}
