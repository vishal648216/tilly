"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isValidHsn } from "@/lib/validators";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import {
  Package,
  Wrench,
  Plus,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Receipt,
  Sparkles,
  Sliders,
  Trash2,
} from "lucide-react";

type FormTab = "basic" | "inventory" | "pricing" | "tax" | "advanced";

export default function NewItemForm() {
  const router = useRouter();
  const { settings, businessType } = useCompanySettings();
  const isInventoryDisabled = !settings.inventoryEnabled;

  const [activeTab, setActiveTab] = useState<FormTab>("basic");

  const [form, setForm] = useState({
    name: "",
    type: isInventoryDisabled ? "SERVICE" : "PRODUCT",
    category: "",
    brand: "",
    description: "",
    active: true,

    // Inventory
    unit: "PCS",
    openingStock: "",
    openingStockCost: "",
    reorderLevel: "",
    minStock: "",
    stock: "",

    // Pricing (Tiered)
    mrp: "",
    salePrice: "", // Retail Price
    purchasePrice: "",
    wholesalePrice: "",
    dealerPrice: "",
    distributorPrice: "",

    // Tax
    hsn: "",
    gstRate: "18",
    taxMode: "EXCLUSIVE",

    // Advanced & Industry
    barcode: "",
    sku: "",
    batchNo: "",
    expiryDate: "",
    warrantyMonths: "",
    model: "",
    imei: "",
  });

  // Dynamic Custom Fields
  const [customFieldsDef, setCustomFieldsDef] = useState<any[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Variants Generator
  const [variants, setVariants] = useState<
    Array<{ size: string; color: string; sku: string; price: string; stock: string }>
  >([]);
  const [newVariant, setNewVariant] = useState({ size: "", color: "", sku: "", price: "", stock: "" });

  useEffect(() => {
    // Fetch custom field definitions for PRODUCT
    fetch("/api/custom-fields?entityType=PRODUCT")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.customFields)) {
          setCustomFieldsDef(data.customFields);
        }
      })
      .catch(() => {});
  }, []);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleBlur(key: string) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  const isHsnValid = useMemo(() => {
    if (!form.hsn.trim()) return true;
    return isValidHsn(form.hsn);
  }, [form.hsn]);

  function addVariant() {
    if (!newVariant.size && !newVariant.color) return;
    setVariants((prev) => [...prev, { ...newVariant }]);
    setNewVariant({ size: "", color: "", sku: "", price: form.salePrice || "", stock: "0" });
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    setTouched({
      name: true,
      hsn: true,
      salePrice: true,
      purchasePrice: true,
    });

    if (form.name.trim().length < 2) {
      setError("Item / Service name must be at least 2 characters long.");
      setActiveTab("basic");
      return;
    }

    if (form.hsn.trim() && !isHsnValid) {
      setError("HSN / SAC Code must be between 2 and 8 digits.");
      setActiveTab("tax");
      return;
    }

    const saleP = form.salePrice ? parseFloat(form.salePrice) : 0;
    const purP = form.purchasePrice ? parseFloat(form.purchasePrice) : 0;
    if (isNaN(saleP) || saleP < 0) {
      setError("Sale price must be 0 or greater.");
      setActiveTab("pricing");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        type: isInventoryDisabled ? "SERVICE" : form.type,
        category: form.category.trim() || null,
        brand: form.brand.trim() || null,
        description: form.description.trim() || null,
        active: form.active,

        unit: form.unit || "PCS",
        openingStock: form.openingStock ? parseFloat(form.openingStock) : 0,
        openingStockCost: form.openingStockCost ? parseFloat(form.openingStockCost) : 0,
        reorderLevel: form.reorderLevel ? parseFloat(form.reorderLevel) : 0,
        minStock: form.minStock ? parseFloat(form.minStock) : 0,
        stock: form.stock ? parseFloat(form.stock) : form.openingStock ? parseFloat(form.openingStock) : 0,

        mrp: form.mrp ? parseFloat(form.mrp) : 0,
        salePrice: saleP,
        purchasePrice: purP,
        wholesalePrice: form.wholesalePrice ? parseFloat(form.wholesalePrice) : 0,
        dealerPrice: form.dealerPrice ? parseFloat(form.dealerPrice) : 0,
        distributorPrice: form.distributorPrice ? parseFloat(form.distributorPrice) : 0,

        hsn: form.hsn.trim() || null,
        gstRate: parseFloat(form.gstRate) || 0,
        taxMode: form.taxMode,

        barcode: form.barcode.trim() || null,
        sku: form.sku.trim() || null,
        batchNo: form.batchNo.trim() || null,
        expiryDate: form.expiryDate ? form.expiryDate : null,
        warrantyMonths: form.warrantyMonths ? parseInt(form.warrantyMonths) : null,
        model: form.model.trim() || null,
        imei: form.imei.trim() || null,

        customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : null,
      };

      if (variants.length > 0) {
        payload.variants = variants.map((v) => ({
          options: {
            ...(v.size ? { Size: v.size } : {}),
            ...(v.color ? { Color: v.color } : {}),
          },
          attributes: [v.size, v.color].filter(Boolean).join(" / "),
          sku: v.sku || null,
          price: v.price ? parseFloat(v.price) : saleP,
          stock: v.stock ? parseFloat(v.stock) : 0,
        }));
      }

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create item");

      router.push("/items");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to save item");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            {isInventoryDisabled ? "New Service Master" : "New Product / Item Master"}
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Configured for <span className="font-bold text-slate-700">{businessType}</span> Industry
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 5-Section Tab Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("basic")}
          className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "basic"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Package className="h-4 w-4" />
          1. Basic Details
        </button>

        {!isInventoryDisabled && (
          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "inventory"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Sliders className="h-4 w-4" />
            2. Inventory & Stock
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab("pricing")}
          className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "pricing"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <DollarSign className="h-4 w-4" />
          3. Pricing & Rates
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tax")}
          className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "tax"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Receipt className="h-4 w-4" />
          4. GST & Tax
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("advanced")}
          className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "advanced"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          5. Advanced & Industry
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* TAB 1: BASIC DETAILS */}
        {activeTab === "basic" && (
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Core Identity
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Item / Service Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cotton Polo T-Shirt or Consultation Fee"
                  className="input font-semibold"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  onBlur={() => handleBlur("name")}
                />
              </div>

              {!isInventoryDisabled && (
                <div>
                  <label className="label">Item Type</label>
                  <select
                    className="input"
                    value={form.type}
                    onChange={(e) => update("type", e.target.value)}
                  >
                    <option value="PRODUCT">Physical Product (Stock Tracked)</option>
                    <option value="SERVICE">Service (No Physical Stock)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="label">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Menswear, Consumables, Hardware"
                  className="input"
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Brand / Manufacturer</label>
                <input
                  type="text"
                  placeholder="e.g. Samsung, Allen Solly, Havells"
                  className="input"
                  value={form.brand}
                  onChange={(e) => update("brand", e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => update("active", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ml-3 text-xs font-bold text-slate-800">Active for Billing</span>
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="label">Description / Specifications</label>
                <textarea
                  rows={2}
                  placeholder="Product description, technical specs, or packaging terms..."
                  className="input"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INVENTORY & STOCK */}
        {activeTab === "inventory" && !isInventoryDisabled && (
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Stock & Measurement Parameters
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Base Unit of Measure (UOM)</label>
                <select
                  className="input"
                  value={form.unit}
                  onChange={(e) => update("unit", e.target.value)}
                >
                  <option value="PCS">PCS (Pieces)</option>
                  <option value="NOS">NOS (Numbers)</option>
                  <option value="KGS">KGS (Kilograms)</option>
                  <option value="MTR">MTR (Meters)</option>
                  <option value="BOX">BOX (Boxes)</option>
                  <option value="LTR">LTR (Liters)</option>
                  <option value="SET">SET (Sets)</option>
                  <option value="PAC">PAC (Packs)</option>
                </select>
              </div>

              <div>
                <label className="label">Opening Stock Quantity</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  className="input"
                  value={form.openingStock}
                  onChange={(e) => update("openingStock", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Opening Stock Cost Rate (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="input"
                  value={form.openingStockCost}
                  onChange={(e) => update("openingStockCost", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Minimum Stock Alert</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  className="input"
                  value={form.minStock}
                  onChange={(e) => update("minStock", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Reorder Level Threshold</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  className="input"
                  value={form.reorderLevel}
                  onChange={(e) => update("reorderLevel", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRICING (TIERED) */}
        {activeTab === "pricing" && (
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Multi-Tier Pricing (Explicit Values - No Forced Markups)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Retail Sale Price (₹) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  className="input font-bold text-emerald-800"
                  value={form.salePrice}
                  onChange={(e) => update("salePrice", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Purchase / Cost Price (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="input"
                  value={form.purchasePrice}
                  onChange={(e) => update("purchasePrice", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Maximum Retail Price (MRP) (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="input"
                  value={form.mrp}
                  onChange={(e) => update("mrp", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Wholesale Price (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="input"
                  value={form.wholesalePrice}
                  onChange={(e) => update("wholesalePrice", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Dealer Price (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="input"
                  value={form.dealerPrice}
                  onChange={(e) => update("dealerPrice", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Distributor Price (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="input"
                  value={form.distributorPrice}
                  onChange={(e) => update("distributorPrice", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TAX & GST */}
        {activeTab === "tax" && (
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              GST Taxation & HSN/SAC Classification
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">HSN / SAC Code</label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="e.g. 6205 or 998311"
                  className="input"
                  value={form.hsn}
                  onChange={(e) => update("hsn", e.target.value)}
                />
              </div>

              <div>
                <label className="label">GST Rate (%)</label>
                <select
                  className="input font-semibold"
                  value={form.gstRate}
                  onChange={(e) => update("gstRate", e.target.value)}
                >
                  <option value="0">0% (Nil / Exempt)</option>
                  <option value="5">5% (Apparel / Essentials)</option>
                  <option value="12">12% (Standard Goods)</option>
                  <option value="18">18% (General / Services)</option>
                  <option value="28">28% (Luxury / Auto)</option>
                </select>
              </div>

              <div>
                <label className="label">Tax Mode</label>
                <select
                  className="input"
                  value={form.taxMode}
                  onChange={(e) => update("taxMode", e.target.value)}
                >
                  <option value="EXCLUSIVE">Exclusive of Tax (Tax added on bill)</option>
                  <option value="INCLUSIVE">Inclusive of Tax (MRP billing)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ADVANCED, INDUSTRY & CUSTOM FIELDS */}
        {activeTab === "advanced" && (
          <div className="card p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Industry Specifics & Barcodes
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">SKU (Stock Keeping Unit)</label>
                <input
                  type="text"
                  placeholder="e.g. TSH-RED-L"
                  className="input"
                  value={form.sku}
                  onChange={(e) => update("sku", e.target.value)}
                />
              </div>

              <div>
                <label className="label">Barcode / EAN / UPC</label>
                <input
                  type="text"
                  placeholder="e.g. 8901234567890"
                  className="input"
                  value={form.barcode}
                  onChange={(e) => update("barcode", e.target.value)}
                />
              </div>

              {(settings.batchEnabled || businessType === "Pharmacy/Cosmetics") && (
                <div>
                  <label className="label">Batch Number</label>
                  <input
                    type="text"
                    placeholder="e.g. BATCH-2026-X"
                    className="input"
                    value={form.batchNo}
                    onChange={(e) => update("batchNo", e.target.value)}
                  />
                </div>
              )}

              {(settings.expiryEnabled || businessType === "Pharmacy/Cosmetics") && (
                <div>
                  <label className="label">Expiry Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.expiryDate}
                    onChange={(e) => update("expiryDate", e.target.value)}
                  />
                </div>
              )}

              {(settings.serialEnabled || businessType === "Electronics") && (
                <>
                  <div>
                    <label className="label">Model Number</label>
                    <input
                      type="text"
                      placeholder="e.g. SM-S928B"
                      className="input"
                      value={form.model}
                      onChange={(e) => update("model", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Warranty (Months)</label>
                    <input
                      type="number"
                      placeholder="e.g. 12"
                      className="input"
                      value={form.warrantyMonths}
                      onChange={(e) => update("warrantyMonths", e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            {/* PRODUCT VARIANTS GENERATOR (For Garments / Multi-attribute retail) */}
            {(businessType === "Garments" || businessType === "Retail") && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800">
                    Product Variants (e.g. Size, Color, SKU)
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">Garments / Multi-Option Ready</span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="text"
                    placeholder="Size (S, M, L)"
                    className="input text-xs"
                    value={newVariant.size}
                    onChange={(e) => setNewVariant({ ...newVariant, size: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Color (Red, Blue)"
                    className="input text-xs"
                    value={newVariant.color}
                    onChange={(e) => setNewVariant({ ...newVariant, color: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="SKU suffix"
                    className="input text-xs"
                    value={newVariant.sku}
                    onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    className="input text-xs"
                    value={newVariant.price}
                    onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={addVariant}
                    className="btn-secondary text-xs flex items-center justify-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>

                {variants.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {variants.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                      >
                        <span className="font-bold text-slate-800">
                          {v.size || "-"} / {v.color || "-"} {v.sku && `(${v.sku})`}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-600">₹{v.price || form.salePrice || "0"}</span>
                          <button
                            type="button"
                            onClick={() => removeVariant(i)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DYNAMIC CUSTOM FIELDS */}
            {customFieldsDef.length > 0 && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-800">Industry Custom Fields</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFieldsDef.map((cf) => {
                    const val = customFieldValues[cf.fieldName] || "";
                    return (
                      <div key={cf.id}>
                        <label className="label">
                          {cf.fieldLabel} {cf.isRequired && "*"}
                        </label>
                        {cf.fieldType === "SELECT" ? (
                          <select
                            className="input"
                            value={val}
                            onChange={(e) =>
                              setCustomFieldValues({
                                ...customFieldValues,
                                [cf.fieldName]: e.target.value,
                              })
                            }
                          >
                            <option value="">Select option</option>
                            {cf.options &&
                              JSON.parse(cf.options).map((opt: string) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <input
                            type={cf.fieldType === "NUMBER" ? "number" : cf.fieldType === "DATE" ? "date" : "text"}
                            className="input"
                            value={val}
                            onChange={(e) =>
                              setCustomFieldValues({
                                ...customFieldValues,
                                [cf.fieldName]: e.target.value,
                              })
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => router.push("/items")}
            className="btn-secondary"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "Saving Master Record..." : "Save Product Master"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
