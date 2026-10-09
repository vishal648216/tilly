"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isValidHsn } from "@/lib/validators";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import {
  Package,
  Barcode,
  Building2,
  DollarSign,
  Boxes,
  Receipt,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  TrendingUp,
  Percent,
  Coins,
  ShieldCheck,
  Calendar,
  Layers,
  HelpCircle,
  Store,
} from "lucide-react";

const RETAIL_CATEGORIES = [
  "Grocery & Staples",
  "Packaged Foods & Snacks",
  "Beverages & Drinks",
  "Dairy & Bakery",
  "Personal Care & Hygiene",
  "Home Care & Cleaning",
  "Apparel & Footwear",
  "Electronics & Mobiles",
  "Stationery & Office",
  "Hardware & Tools",
  "General Merchandise",
];

const RETAIL_UNITS = [
  { value: "PCS", label: "PCS (Pieces / Units)" },
  { value: "PACK", label: "PACK (Packets)" },
  { value: "BOX", label: "BOX (Boxes / Cartons)" },
  { value: "KG", label: "KG (Kilograms)" },
  { value: "GM", label: "GM (Grams)" },
  { value: "LTR", label: "LTR (Litres)" },
  { value: "ML", label: "ML (Millilitres)" },
  { value: "MTR", label: "MTR (Metres)" },
  { value: "DOZ", label: "DOZ (Dozens)" },
  { value: "BTL", label: "BTL (Bottles)" },
  { value: "CAN", label: "CAN (Cans / Tins)" },
  { value: "BAG", label: "BAG (Bags / Sacks)" },
  { value: "SET", label: "SET (Sets)" },
  { value: "PAIR", label: "PAIR (Pairs)" },
];

export default function NewItemForm() {
  const router = useRouter();
  const { settings, businessType } = useCompanySettings();
  const isInventoryDisabled = !settings.inventoryEnabled;

  // Vendors / Suppliers List from CRM
  const [vendors, setVendors] = useState<
    Array<{ id: string; name: string; phone?: string; city?: string; gstin?: string }>
  >([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [customSupplierName, setCustomSupplierName] = useState("");
  const [purchaseInvoiceRef, setPurchaseInvoiceRef] = useState("");
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState(false);
  const [quickSupplierInput, setQuickSupplierInput] = useState("");

  // Optional toggles
  const [showWholesaleTiers, setShowWholesaleTiers] = useState(false);
  const [showBatchTracking, setShowBatchTracking] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: "",
    type: isInventoryDisabled ? "SERVICE" : "PRODUCT",
    category: "",
    brand: "",
    description: "",
    active: true,

    // Retail Barcode & SKU
    barcode: "",
    sku: "",

    // Pricing (Retail Focus)
    mrp: "",
    purchasePrice: "", // Cost Price
    salePrice: "", // Retail Selling Price
    wholesalePrice: "",
    dealerPrice: "",
    distributorPrice: "",

    // Inventory & Stock
    unit: "PCS",
    openingStock: "",
    openingStockCost: "",
    reorderLevel: "5",
    minStock: "0",

    // GST & Tax
    gstRate: "18",
    taxMode: "INCLUSIVE", // Retail default: MRP / selling price inclusive of GST
    hsn: "",

    // Optional Batch / Expiry
    batchNo: "",
    expiryDate: "",
    warrantyMonths: "",
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch Vendors / Suppliers on Mount
  useEffect(() => {
    setLoadingVendors(true);
    fetch("/api/parties?type=VENDOR")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.parties)) {
          setVendors(data.parties);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingVendors(false));
  }, []);

  function update(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleBlur(key: string) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  // Barcode Auto Generator (Retail 12/13 digits)
  function handleGenerateBarcode() {
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000);
    const code = `890${randomDigits}`;
    update("barcode", code);
    if (!form.sku) {
      update("sku", `SKU-${code.slice(-6)}`);
    }
  }

  const isHsnValid = useMemo(() => {
    if (!form.hsn.trim()) return true;
    return isValidHsn(form.hsn);
  }, [form.hsn]);

  // Live Retail Margin & Profit Calculations
  const retailMetrics = useMemo(() => {
    const sale = parseFloat(form.salePrice) || 0;
    const cost = parseFloat(form.purchasePrice) || 0;
    const mrp = parseFloat(form.mrp) || 0;

    const profitPerUnit = sale > 0 && cost > 0 ? sale - cost : 0;
    const marginPct = sale > 0 && cost > 0 ? ((sale - cost) / sale) * 100 : 0;
    const markupPct = cost > 0 && sale > 0 ? ((sale - cost) / cost) * 100 : 0;
    const discountFromMrp = mrp > 0 && sale > 0 && mrp >= sale ? mrp - sale : 0;
    const discountPct = mrp > 0 && sale > 0 && mrp >= sale ? ((mrp - sale) / mrp) * 100 : 0;

    const isExceedingMrp = mrp > 0 && sale > mrp;
    const isSellingAtLoss = cost > 0 && sale > 0 && sale < cost;

    return {
      profitPerUnit: Math.round(profitPerUnit * 100) / 100,
      marginPct: Math.round(marginPct * 10) / 10,
      markupPct: Math.round(markupPct * 10) / 10,
      discountFromMrp: Math.round(discountFromMrp * 100) / 100,
      discountPct: Math.round(discountPct * 10) / 10,
      isExceedingMrp,
      isSellingAtLoss,
    };
  }, [form.salePrice, form.purchasePrice, form.mrp]);

  // Field Validations
  const validationErrors = useMemo(() => {
    const errs: Record<string, string> = {};

    if (!form.name.trim()) {
      errs.name = "Product name is required.";
    } else if (form.name.trim().length < 3) {
      errs.name = "Product name must be at least 3 characters.";
    }

    const saleP = parseFloat(form.salePrice);
    if (!form.salePrice || isNaN(saleP) || saleP <= 0) {
      errs.salePrice = "Retail selling price is required and must be greater than ₹0.";
    }

    const purP = parseFloat(form.purchasePrice);
    if (!form.purchasePrice || isNaN(purP) || purP <= 0) {
      errs.purchasePrice = "Purchase cost price is required and must be greater than ₹0.";
    }

    const mrpP = parseFloat(form.mrp);
    if (form.mrp && !isNaN(mrpP)) {
      if (mrpP <= 0) {
        errs.mrp = "MRP must be greater than 0 if specified.";
      } else if (saleP > mrpP) {
        errs.mrp = `Selling price (₹${saleP}) cannot exceed MRP (₹${mrpP}).`;
      } else if (purP > mrpP) {
        errs.mrp = `Purchase cost (₹${purP}) cannot exceed MRP (₹${mrpP}).`;
      }
    }

    if (!form.unit.trim()) {
      errs.unit = "Unit of measurement is required.";
    }

    if (!selectedSupplierId && !customSupplierName.trim()) {
      errs.supplier = "Please select or enter the supplier/company purchased from.";
    }

    if (form.hsn.trim() && !isHsnValid) {
      errs.hsn = "HSN/SAC Code must be between 2 and 8 digits.";
    }

    if (form.openingStock) {
      const openS = parseFloat(form.openingStock);
      if (isNaN(openS) || openS < 0) {
        errs.openingStock = "Opening stock cannot be negative.";
      }
    }

    return errs;
  }, [
    form.name,
    form.salePrice,
    form.purchasePrice,
    form.mrp,
    form.unit,
    form.hsn,
    form.openingStock,
    selectedSupplierId,
    customSupplierName,
    isHsnValid,
  ]);

  const hasErrors = Object.keys(validationErrors).length > 0;

  function handleAddQuickSupplier() {
    if (!quickSupplierInput.trim()) return;
    setCustomSupplierName(quickSupplierInput.trim());
    setSelectedSupplierId("");
    setIsAddingNewSupplier(false);
    setQuickSupplierInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Touch all fields to reveal inline validation errors
    setTouched({
      name: true,
      salePrice: true,
      purchasePrice: true,
      mrp: true,
      unit: true,
      supplier: true,
      hsn: true,
      openingStock: true,
    });

    if (hasErrors) {
      const firstError = Object.values(validationErrors)[0];
      setError(firstError || "Please fill in all mandatory retail fields properly.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setLoading(true);
    try {
      const selectedVendorObj = vendors.find((v) => v.id === selectedSupplierId);
      const supplierNameToSend = selectedVendorObj ? selectedVendorObj.name : customSupplierName.trim();

      const payload: any = {
        name: form.name.trim(),
        type: isInventoryDisabled ? "SERVICE" : form.type,
        category: form.category.trim() || null,
        brand: form.brand.trim() || null,
        description: form.description.trim() || null,
        active: form.active,

        unit: form.unit || "PCS",
        openingStock: form.openingStock ? parseFloat(form.openingStock) : 0,
        openingStockCost: form.openingStockCost
          ? parseFloat(form.openingStockCost)
          : parseFloat(form.purchasePrice) || 0,
        reorderLevel: form.reorderLevel ? parseFloat(form.reorderLevel) : 0,
        minStock: form.minStock ? parseFloat(form.minStock) : 0,
        stock: form.openingStock ? parseFloat(form.openingStock) : 0,

        mrp: form.mrp ? parseFloat(form.mrp) : 0,
        salePrice: parseFloat(form.salePrice) || 0,
        purchasePrice: parseFloat(form.purchasePrice) || 0,
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

        supplierId: selectedSupplierId || null,
        supplierName: supplierNameToSend || null,
        purchasedFrom: supplierNameToSend || null,
        customFields: {
          supplierId: selectedSupplierId || null,
          supplierName: supplierNameToSend || null,
          purchasedFrom: supplierNameToSend || null,
          purchaseInvoiceRef: purchaseInvoiceRef.trim() || null,
        },
      };

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create retail item");

      router.push("/items");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to save retail product master.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/items"
              className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Store className="h-6 w-6 text-brand-600" /> New Product Master (Retail)
            </h1>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1 pl-7">
            Single-page retail item setup with live margin calculation, barcode generator & supplier tracking
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <Link
            href="/items"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-xs"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? "Saving Product..." : "Save Product Master"}
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-rose-50 p-4 text-xs font-semibold text-rose-800 border border-rose-200 shadow-xs animate-shake">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <span className="font-bold block text-sm mb-0.5">Please check form errors:</span>
            {error}
          </div>
        </div>
      )}

      {/* SECTION 1: Product Identity & Barcode */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-4 w-4 text-brand-600" /> 1. Retail Product Details & Barcode
          </h2>
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
            Mandatory Info
          </span>
        </div>

        <div className="space-y-4">
          {/* Product Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Item / Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              className={`input text-sm h-11 w-full font-medium ${
                touched.name && validationErrors.name
                  ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-200"
                  : ""
              }`}
              placeholder="e.g. Parle-G Gold Biscuits 100g, Amul Butter 500g, Men's Polo Shirt (L)"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              onBlur={() => handleBlur("name")}
            />
            {touched.name && validationErrors.name && (
              <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {validationErrors.name}
              </p>
            )}
          </div>

          {/* Category with Quick Selection Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Product Category</label>
            <input
              type="text"
              className="input text-xs h-9 w-full mb-2"
              placeholder="Select from chips below or type custom category..."
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {RETAIL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => update("category", cat)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                    form.category === cat
                      ? "bg-brand-50 border-brand-300 text-brand-700 font-bold"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Brand & Active Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Brand / Manufacturer</label>
              <input
                type="text"
                className="input text-xs h-9 w-full"
                placeholder="e.g. Nestle, Parle, Amul, Cadbury, Local"
                value={form.brand}
                onChange={(e) => update("brand", e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-4 sm:pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => update("active", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-2.5 text-xs font-bold text-slate-700">
                  {form.active ? "Active for POS & Billing" : "Inactive (Hidden from POS)"}
                </span>
              </label>
            </div>
          </div>

          {/* Barcode & SKU with Auto Generator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Barcode className="h-4 w-4 text-brand-600" /> Barcode / EAN-13
                </label>
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Auto-Generate
                </button>
              </div>
              <input
                type="text"
                className="input text-xs h-9 w-full font-mono font-semibold"
                placeholder="Scan with barcode scanner or click Auto-Generate..."
                value={form.barcode}
                onChange={(e) => update("barcode", e.target.value)}
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Can be scanned directly at checkout during POS billing
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Item Code / SKU</label>
              <input
                type="text"
                className="input text-xs h-9 w-full font-mono"
                placeholder="e.g. SKU-PRL-01 (Auto-filled or custom)"
                value={form.sku}
                onChange={(e) => update("sku", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Sourced From / Purchased From Company (Supplier) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-600" /> 2. Purchased From Company / Supplier
          </h2>
          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
            Purchase Source
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Supplier / Company Name <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsAddingNewSupplier(!isAddingNewSupplier)}
                className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                {isAddingNewSupplier ? "Select Existing Supplier" : "Quick Add New Supplier"}
              </button>
            </div>

            {!isAddingNewSupplier ? (
              <div className="space-y-2">
                <select
                  className={`input text-xs h-10 w-full bg-white font-medium ${
                    touched.supplier && validationErrors.supplier
                      ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                      : ""
                  }`}
                  value={selectedSupplierId}
                  onChange={(e) => {
                    setSelectedSupplierId(e.target.value);
                    setCustomSupplierName("");
                  }}
                  onBlur={() => handleBlur("supplier")}
                >
                  <option value="">-- Choose Supplier / Distributor from CRM --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.city ? `(${v.city})` : ""} {v.phone ? `• Ph: ${v.phone}` : ""}
                    </option>
                  ))}
                </select>

                {selectedSupplierId && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 flex items-center justify-between text-xs text-slate-700">
                    <div>
                      <span className="font-bold text-slate-900">
                        {vendors.find((v) => v.id === selectedSupplierId)?.name}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Verified Supplier in CRM • GSTIN:{" "}
                        {vendors.find((v) => v.id === selectedSupplierId)?.gstin || "Unregistered / Consumer"}
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                      Linked
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input text-xs h-9 flex-1 bg-white"
                    placeholder="Enter supplier / company name (e.g. Rajesh Trading Co, Nestle Distributor)..."
                    value={quickSupplierInput}
                    onChange={(e) => setQuickSupplierInput(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleAddQuickSupplier}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
                  >
                    Set Supplier
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  This supplier will be recorded as the purchase source for this product.
                </p>
              </div>
            )}

            {customSupplierName && !selectedSupplierId && (
              <div className="mt-2 rounded-lg bg-blue-50 border border-blue-200 p-2.5 flex items-center justify-between text-xs text-blue-900">
                <span>
                  Direct Supplier: <strong>{customSupplierName}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setCustomSupplierName("")}
                  className="text-xs text-rose-600 font-bold hover:underline"
                >
                  Change
                </button>
              </div>
            )}

            {touched.supplier && validationErrors.supplier && (
              <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {validationErrors.supplier}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Purchase Invoice / Bill Remark (Optional)
            </label>
            <input
              type="text"
              className="input text-xs h-9 w-full"
              placeholder="e.g. Bill #4820, Batch Sourced Oct-2026, Consignment Delivery"
              value={purchaseInvoiceRef}
              onChange={(e) => setPurchaseInvoiceRef(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: Retail Pricing, MRP & Live Profit Margin */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-brand-600" /> 3. Retail Pricing & Live Profit Margin
          </h2>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            Real-time Profit Analytics
          </span>
        </div>

        {/* 3 Main Prices (MRP, Purchase Cost, Retail Selling Price) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* MRP */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              MRP (Maximum Retail Price) ₹
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
              <input
                type="number"
                step="any"
                min="0"
                className={`input text-sm h-10 pl-7 w-full font-bold text-slate-800 ${
                  touched.mrp && validationErrors.mrp ? "border-rose-400 bg-rose-50/20" : ""
                }`}
                placeholder="0.00"
                value={form.mrp}
                onChange={(e) => update("mrp", e.target.value)}
                onBlur={() => handleBlur("mrp")}
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Printed on product package</span>
            {touched.mrp && validationErrors.mrp && (
              <p className="text-[11px] text-rose-600 font-semibold mt-1">{validationErrors.mrp}</p>
            )}
          </div>

          {/* Purchase Price (Cost) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Purchase Price (Cost) ₹ <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
              <input
                type="number"
                step="any"
                min="0"
                required
                className={`input text-sm h-10 pl-7 w-full font-bold text-slate-900 ${
                  touched.purchasePrice && validationErrors.purchasePrice
                    ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                    : ""
                }`}
                placeholder="0.00"
                value={form.purchasePrice}
                onChange={(e) => {
                  update("purchasePrice", e.target.value);
                  if (!form.openingStockCost) {
                    update("openingStockCost", e.target.value);
                  }
                }}
                onBlur={() => handleBlur("purchasePrice")}
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Rate paid to supplier / distributor</span>
            {touched.purchasePrice && validationErrors.purchasePrice && (
              <p className="text-[11px] text-rose-600 font-semibold mt-1">{validationErrors.purchasePrice}</p>
            )}
          </div>

          {/* Retail Sale Price */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Retail Sale Price ₹ <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-emerald-600">₹</span>
              <input
                type="number"
                step="any"
                min="0"
                required
                className={`input text-sm h-10 pl-7 w-full font-black text-emerald-700 ${
                  touched.salePrice && validationErrors.salePrice
                    ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                    : ""
                }`}
                placeholder="0.00"
                value={form.salePrice}
                onChange={(e) => update("salePrice", e.target.value)}
                onBlur={() => handleBlur("salePrice")}
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Price charged to walk-in customer</span>
            {touched.salePrice && validationErrors.salePrice && (
              <p className="text-[11px] text-rose-600 font-semibold mt-1">{validationErrors.salePrice}</p>
            )}
          </div>
        </div>

        {/* Live Retail Profit & Margin Card */}
        <div
          className={`rounded-xl p-4 border transition-all ${
            retailMetrics.isExceedingMrp
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : retailMetrics.isSellingAtLoss
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-emerald-50/60 border-emerald-200 text-emerald-950"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <TrendingUp className="h-4 w-4" /> Live Retail Margin & Profit Card
            </span>
            {retailMetrics.isExceedingMrp ? (
              <span className="text-[10px] font-bold bg-rose-200 text-rose-900 px-2 py-0.5 rounded">
                ILLEGAL: Exceeds MRP
              </span>
            ) : retailMetrics.isSellingAtLoss ? (
              <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                LOSS: Below Cost
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                Profitable
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="rounded-lg bg-white/80 p-2.5 shadow-xs">
              <span className="text-[10px] font-semibold text-slate-500 block uppercase">Gross Profit</span>
              <span
                className={`text-base font-black ${
                  retailMetrics.profitPerUnit < 0 ? "text-rose-600" : "text-emerald-700"
                }`}
              >
                {retailMetrics.profitPerUnit >= 0 ? `+₹${retailMetrics.profitPerUnit}` : `-₹${Math.abs(retailMetrics.profitPerUnit)}`}
              </span>
              <span className="text-[9px] text-slate-400 block">per unit</span>
            </div>

            <div className="rounded-lg bg-white/80 p-2.5 shadow-xs">
              <span className="text-[10px] font-semibold text-slate-500 block uppercase">Profit Margin</span>
              <span
                className={`text-base font-black ${
                  retailMetrics.marginPct < 0 ? "text-rose-600" : "text-emerald-700"
                }`}
              >
                {retailMetrics.marginPct}%
              </span>
              <span className="text-[9px] text-slate-400 block">on selling price</span>
            </div>

            <div className="rounded-lg bg-white/80 p-2.5 shadow-xs">
              <span className="text-[10px] font-semibold text-slate-500 block uppercase">Markup</span>
              <span className="text-base font-black text-slate-800">{retailMetrics.markupPct}%</span>
              <span className="text-[9px] text-slate-400 block">on purchase cost</span>
            </div>

            <div className="rounded-lg bg-white/80 p-2.5 shadow-xs">
              <span className="text-[10px] font-semibold text-slate-500 block uppercase">Customer Discount</span>
              <span className="text-base font-black text-blue-700">
                {retailMetrics.discountPct > 0 ? `${retailMetrics.discountPct}% OFF` : "At MRP"}
              </span>
              <span className="text-[9px] text-slate-400 block">
                {retailMetrics.discountFromMrp > 0 ? `₹${retailMetrics.discountFromMrp} saving` : "No discount"}
              </span>
            </div>
          </div>

          {retailMetrics.isExceedingMrp && (
            <p className="text-xs font-bold text-rose-700 mt-2 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> Warning: Retail selling price cannot exceed Maximum Retail Price (MRP).
            </p>
          )}
        </div>

        {/* Optional Wholesale & Tier Pricing Accordion */}
        <div className="border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => setShowWholesaleTiers(!showWholesaleTiers)}
            className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 py-1"
          >
            {showWholesaleTiers ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showWholesaleTiers ? "Hide Wholesale & Bulk Rates" : "Show Wholesale & Bulk Rates (Optional)"}
          </button>

          {showWholesaleTiers && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wholesale Price ₹</label>
                <input
                  type="number"
                  step="any"
                  className="input text-xs h-9 w-full"
                  placeholder="0.00"
                  value={form.wholesalePrice}
                  onChange={(e) => update("wholesalePrice", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dealer Price ₹</label>
                <input
                  type="number"
                  step="any"
                  className="input text-xs h-9 w-full"
                  placeholder="0.00"
                  value={form.dealerPrice}
                  onChange={(e) => update("dealerPrice", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Distributor Price ₹</label>
                <input
                  type="number"
                  step="any"
                  className="input text-xs h-9 w-full"
                  placeholder="0.00"
                  value={form.distributorPrice}
                  onChange={(e) => update("distributorPrice", e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: Inventory, Stock & Units */}
      {!isInventoryDisabled && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="h-4 w-4 text-brand-600" /> 4. Inventory, Units & Stock Tracking
            </h2>
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              Warehouse & Shop Stock
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Unit */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Unit of Measure <span className="text-rose-500">*</span>
              </label>
              <select
                required
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

            {/* Opening Stock */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Stock in Shop</label>
              <input
                type="number"
                step="any"
                min="0"
                className={`input text-xs h-10 w-full font-bold ${
                  touched.openingStock && validationErrors.openingStock ? "border-rose-400 bg-rose-50/20" : ""
                }`}
                placeholder="0"
                value={form.openingStock}
                onChange={(e) => update("openingStock", e.target.value)}
                onBlur={() => handleBlur("openingStock")}
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Quantity available right now</span>
            </div>

            {/* Opening Stock Cost */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Opening Stock Cost ₹</label>
              <input
                type="number"
                step="any"
                min="0"
                className="input text-xs h-10 w-full font-bold"
                placeholder={form.purchasePrice || "0.00"}
                value={form.openingStockCost}
                onChange={(e) => update("openingStockCost", e.target.value)}
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Defaults to purchase price</span>
            </div>

            {/* Low Stock Alert / Reorder Level */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Low Stock Alert Level</label>
              <input
                type="number"
                step="any"
                min="0"
                className="input text-xs h-10 w-full font-bold text-amber-700"
                placeholder="5"
                value={form.reorderLevel}
                onChange={(e) => update("reorderLevel", e.target.value)}
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Alerts POS when stock is below this</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: GST & Tax Details */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-brand-600" /> 5. GST Rate & Tax Mode
          </h2>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
            GST Compliance
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* GST Rate Selection */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">GST Rate (%)</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { rate: "0", label: "0% (Exempt)" },
                { rate: "5", label: "5% (Essential)" },
                { rate: "12", label: "12% (Std I)" },
                { rate: "18", label: "18% (Std II)" },
                { rate: "28", label: "28% (Luxury)" },
              ].map((r) => (
                <button
                  key={r.rate}
                  type="button"
                  onClick={() => update("gstRate", r.rate)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center ${
                    form.gstRate === r.rate
                      ? "bg-brand-600 border-brand-700 text-white shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="block text-sm">{r.rate}%</span>
                  <span className="text-[9px] font-normal opacity-80 block truncate">{r.label.split(" ")[1]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tax Mode (Retail Inclusive vs Exclusive) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Tax Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update("taxMode", "INCLUSIVE")}
                className={`p-2 rounded-xl text-xs font-bold border text-center transition-all ${
                  form.taxMode === "INCLUSIVE"
                    ? "bg-brand-50 border-brand-300 text-brand-700 font-black shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                Inclusive (MRP)
                <span className="text-[9px] font-normal block text-slate-500">Retail standard</span>
              </button>

              <button
                type="button"
                onClick={() => update("taxMode", "EXCLUSIVE")}
                className={`p-2 rounded-xl text-xs font-bold border text-center transition-all ${
                  form.taxMode === "EXCLUSIVE"
                    ? "bg-brand-50 border-brand-300 text-brand-700 font-black shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                Exclusive
                <span className="text-[9px] font-normal block text-slate-500">+ Tax extra</span>
              </button>
            </div>
          </div>
        </div>

        {/* HSN Code */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">HSN / SAC Code (Optional)</label>
          <input
            type="text"
            className={`input text-xs h-9 max-w-xs font-mono ${
              touched.hsn && validationErrors.hsn ? "border-rose-400 bg-rose-50/20" : ""
            }`}
            placeholder="e.g. 1905, 0402, 2106"
            value={form.hsn}
            onChange={(e) => update("hsn", e.target.value)}
            onBlur={() => handleBlur("hsn")}
          />
          {touched.hsn && validationErrors.hsn && (
            <p className="text-[11px] text-rose-600 font-semibold mt-1">{validationErrors.hsn}</p>
          )}
        </div>
      </div>

      {/* SECTION 6: Batch & Expiry (Perishables / FMCG / Pharmacy) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">6. Batch Number & Expiry Date (Optional)</h2>
              <p className="text-[11px] text-slate-500">For FMCG, grocery, dairy, and pharmaceutical products</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBatchTracking(!showBatchTracking)}
            className="text-xs font-bold text-brand-600 hover:text-brand-800"
          >
            {showBatchTracking ? "Hide Batch Fields" : "Enable Batch & Expiry"}
          </button>
        </div>

        {showBatchTracking && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Batch Number</label>
              <input
                type="text"
                className="input text-xs h-9 w-full font-mono"
                placeholder="e.g. BATCH-OCT26-01"
                value={form.batchNo}
                onChange={(e) => update("batchNo", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date</label>
              <input
                type="date"
                className="input text-xs h-9 w-full"
                value={form.expiryDate}
                onChange={(e) => update("expiryDate", e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-4 z-20 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-4 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs text-slate-600">
          <span className="font-bold text-slate-900">
            {form.name.trim() ? form.name : "New Product"}
          </span>
          {form.salePrice && (
            <span className="ml-2 font-semibold text-emerald-700">
              • ₹{parseFloat(form.salePrice).toLocaleString("en-IN")} Retail Price
            </span>
          )}
          {retailMetrics.marginPct > 0 && (
            <span className="ml-2 font-semibold text-slate-500">• {retailMetrics.marginPct}% Margin</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/items"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-xs"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-brand-600 hover:bg-brand-700 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? "Saving Retail Item..." : "Save Product Master"}
          </button>
        </div>
      </div>
    </form>
  );
}
