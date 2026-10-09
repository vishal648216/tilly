"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import {
  Search,
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  CreditCard,
  Banknote,
  QrCode,
  User,
  X,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  Receipt,
  Layers,
} from "lucide-react";

interface POSItem {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit: string;
  salePrice: number;
  mrp: number;
  gstRate: number;
  stock: number;
  taxMode: string;
  type: string;
}

interface POSParty {
  id: string;
  name: string;
  phone: string | null;
  gstin: string | null;
  state: string | null;
}

interface CartItem {
  cartId: string;
  itemId?: string;
  name: string;
  unit: string;
  qty: number;
  rate: number;
  mrp: number;
  discount: number;
  gstRate: number;
  stock: number;
  taxMode: string;
}

interface HeldSale {
  id: string;
  heldAt: string;
  customerName: string;
  itemsCount: number;
  total: number;
  cart: CartItem[];
  customerPhone?: string;
  partyId?: string;
}

interface CompletedSaleReceipt {
  invoiceNo: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  items: CartItem[];
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paidAmount: number;
  changeDue: number;
  paymentMode: string;
}

export default function PosClient({
  items,
  parties,
  company,
  defaultWarehouseId,
}: {
  items: POSItem[];
  parties: POSParty[];
  company: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    gstin: string | null;
  };
  defaultWarehouseId: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [partyId, setPartyId] = useState("");
  const [customerName, setCustomerName] = useState("Walk-in Cash Customer");
  const [customerPhone, setCustomerPhone] = useState("");

  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CARD" | "OTHER">("CASH");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);

  const [completedReceipt, setCompletedReceipt] = useState<CompletedSaleReceipt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Extract categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category && i.category.trim()) set.add(i.category.trim());
    });
    return ["ALL", ...Array.from(set)];
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return items.filter((item) => {
      const matchCat = selectedCategory === "ALL" || item.category === selectedCategory;
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.sku && item.sku.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [items, searchTerm, selectedCategory]);

  // Cart calculations
  const cartCalculations = useMemo(() => {
    let subTotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    cart.forEach((c) => {
      const gross = c.qty * c.rate;
      const disc = c.discount || 0;
      discountTotal += disc;
      const taxable = Math.max(0, gross - disc);
      subTotal += gross;
      const tax = (taxable * (c.gstRate || 0)) / 100;
      taxTotal += tax;
    });

    const grandTotal = Math.round((subTotal - discountTotal + taxTotal) * 100) / 100;
    const received = parseFloat(cashReceived) || (paymentMode !== "CASH" ? grandTotal : 0);
    const changeDue = Math.max(0, received - grandTotal);

    return {
      subTotal,
      discountTotal,
      taxTotal,
      grandTotal,
      changeDue: Math.round(changeDue * 100) / 100,
    };
  }, [cart, cashReceived, paymentMode]);

  // Auto set cash received to exact amount initially if empty
  useEffect(() => {
    if (paymentMode === "CASH" && !cashReceived && cartCalculations.grandTotal > 0) {
      setCashReceived(cartCalculations.grandTotal.toString());
    }
  }, [cartCalculations.grandTotal, paymentMode]);

  // Add item to cart
  const addToCart = (item: POSItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [
        ...prev,
        {
          cartId: Math.random().toString(),
          itemId: item.id,
          name: item.name,
          unit: item.unit,
          qty: 1,
          rate: item.salePrice,
          mrp: item.mrp,
          discount: 0,
          gstRate: item.gstRate,
          stock: item.stock,
          taxMode: item.taxMode,
        },
      ];
    });
  };

  // Fast Barcode scanning
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    // Search exact barcode or exact SKU
    const matched = items.find(
      (i) =>
        (i.barcode && i.barcode.toLowerCase() === searchTerm.trim().toLowerCase()) ||
        (i.sku && i.sku.toLowerCase() === searchTerm.trim().toLowerCase())
    );

    if (matched) {
      addToCart(matched);
      setSearchTerm("");
    } else if (filteredItems.length === 1) {
      addToCart(filteredItems[0]);
      setSearchTerm("");
    }
  };

  const updateCartQty = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.cartId === cartId) {
            const newQty = c.qty + delta;
            return newQty > 0 ? { ...c, qty: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeCartItem = (cartId: string) => {
    setCart((prev) => prev.filter((c) => c.cartId !== cartId));
  };

  // Hold Sale
  const handleHoldSale = () => {
    if (cart.length === 0) return;
    const newHold: HeldSale = {
      id: Math.random().toString(),
      heldAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      customerName: customerName || "Walk-in Customer",
      customerPhone,
      partyId,
      itemsCount: cart.reduce((s, c) => s + c.qty, 0),
      total: cartCalculations.grandTotal,
      cart: [...cart],
    };

    setHeldSales((prev) => [newHold, ...prev]);
    setCart([]);
    setCashReceived("");
    setCustomerName("Walk-in Cash Customer");
    setCustomerPhone("");
    setPartyId("");
  };

  // Resume Sale
  const handleResumeSale = (held: HeldSale) => {
    setCart(held.cart);
    setCustomerName(held.customerName);
    setCustomerPhone(held.customerPhone || "");
    setPartyId(held.partyId || "");
    setHeldSales((prev) => prev.filter((h) => h.id !== held.id));
    setShowHeldModal(false);
  };

  // Clear Cart
  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (confirm("Are you sure you want to clear the entire cart?")) {
      setCart([]);
      setCashReceived("");
    }
  };

  // Quick denomination click
  const handleQuickCash = (amount: number) => {
    setCashReceived(amount.toString());
  };

  // Handle Customer Selection
  const handleSelectParty = (selectedId: string) => {
    setPartyId(selectedId);
    if (!selectedId) {
      setCustomerName("Walk-in Cash Customer");
      setCustomerPhone("");
      return;
    }
    const found = parties.find((p) => p.id === selectedId);
    if (found) {
      setCustomerName(found.name);
      setCustomerPhone(found.phone || "");
    }
  };

  // Complete Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      alert("Cart is empty! Scan or select products to begin checkout.");
      return;
    }

    const { grandTotal, changeDue } = cartCalculations;
    const paidAmt = paymentMode === "CASH" ? (parseFloat(cashReceived) || grandTotal) : grandTotal;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "SALES",
          partyId: partyId || undefined,
          warehouseId: defaultWarehouseId || undefined,
          date: new Date().toISOString(),
          paymentMode,
          paidAmount: Math.min(paidAmt, grandTotal),
          notes: `POS Counter Sale - ${customerName} ${customerPhone ? `(${customerPhone})` : ""}`,
          lines: cart.map((c) => ({
            itemId: c.itemId || undefined,
            name: c.name,
            qty: c.qty,
            rate: c.rate,
            unit: c.unit,
            discount: c.discount || 0,
            gstRate: c.gstRate || 0,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to finalize counter sale");
      }

      // Generate Receipt Data
      const receipt: CompletedSaleReceipt = {
        invoiceNo: data.invoice?.invoiceNo || `POS-${Date.now().toString().slice(-6)}`,
        date: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        customerName: customerName || "Walk-in Customer",
        customerPhone,
        items: [...cart],
        subTotal: cartCalculations.subTotal,
        taxTotal: cartCalculations.taxTotal,
        discountTotal: cartCalculations.discountTotal,
        grandTotal,
        paidAmount: paidAmt,
        changeDue,
        paymentMode,
      };

      setCompletedReceipt(receipt);
      setCart([]);
      setCashReceived("");
      setCustomerName("Walk-in Cash Customer");
      setCustomerPhone("");
      setPartyId("");
    } catch (err: any) {
      alert(err.message || "Checkout failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8">
      {/* Top POS Navbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Back to Sales Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-brand-600" />
              <span>POS Counter Sale</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                FAST CHECKOUT
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              {company.name} • Register #1 • {new Date().toLocaleDateString("en-IN")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {heldSales.length > 0 && (
            <button
              onClick={() => setShowHeldModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors"
            >
              <PauseCircle className="h-4 w-4 text-amber-600" />
              <span>Resume Held ({heldSales.length})</span>
            </button>
          )}

          <button
            onClick={handleHoldSale}
            disabled={cart.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-40 transition-colors"
          >
            <PauseCircle className="h-4 w-4 text-slate-400" />
            <span>Hold Sale</span>
          </button>

          <button
            onClick={handleClearCart}
            disabled={cart.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-700 text-xs font-semibold disabled:opacity-40 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Clear Cart</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Retail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Product Search, Categories & Catalog Grid (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Barcode & Search Input */}
          <form onSubmit={handleBarcodeSubmit} className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                ref={barcodeInputRef}
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Scan barcode or type item name / SKU... (Press Enter to add)"
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 py-2.5 text-xs font-medium outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
              />
              <Barcode className="absolute right-3.5 top-3 h-4 w-4 text-brand-600" />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs shrink-0"
            >
              Add
            </button>
          </form>

          {/* Category Filter Pills */}
          {categories.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {cat === "ALL" ? "All Items" : cat}
                </button>
              ))}
            </div>
          )}

          {/* Product Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[580px] overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                <ShoppingCart className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No matching items found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Try another search or scan a different barcode.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item)}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-brand-500 hover:shadow-md transition-all text-left flex flex-col justify-between group active:scale-98"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                        {item.category || item.unit}
                      </span>
                      {item.type === "PRODUCT" && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            item.stock > 0
                              ? "bg-slate-100 text-slate-600"
                              : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          Stock: {item.stock}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-900 line-clamp-2 group-hover:text-brand-600 transition-colors">
                      {item.name}
                    </p>
                    {item.barcode && (
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                        {item.barcode}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                    <div>
                      <span className="text-sm font-extrabold text-slate-900">
                        {formatCurrency(item.salePrice)}
                      </span>
                      {item.mrp > item.salePrice && (
                        <span className="text-[10px] text-slate-400 line-through ml-1.5">
                          {formatCurrency(item.mrp)}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-brand-600 group-hover:translate-x-0.5 transition-transform">
                      + Add
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Active Cart & Checkout (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            {/* Customer Header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-brand-600" /> Customer Information
                </label>
                <select
                  value={partyId}
                  onChange={(e) => handleSelectParty(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-500 font-medium"
                >
                  <option value="">Walk-in Cash</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.phone ? `(${p.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {!partyId && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-brand-500"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-brand-500"
                  />
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="border-t border-b border-slate-100 py-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                <span>Items ({cart.reduce((s, c) => s + c.qty, 0)})</span>
                <span>Amount</span>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <p className="text-xs">Cart is empty</p>
                    <p className="text-[11px] text-slate-400">Scan or click items to add</p>
                  </div>
                ) : (
                  cart.map((c) => {
                    const lineTotal = c.qty * c.rate - (c.discount || 0);
                    return (
                      <div
                        key={c.cartId}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {formatCurrency(c.rate)} / {c.unit}
                            {c.gstRate > 0 && <span className="text-[10px] ml-1">({c.gstRate}% GST)</span>}
                          </p>
                        </div>

                        {/* Qty Controller */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateCartQty(c.cartId, -1)}
                            className="p-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold text-slate-900 w-6 text-center">
                            {c.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(c.cartId, 1)}
                            className="p-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="text-right pl-2">
                          <p className="text-xs font-bold text-slate-900">
                            {formatCurrency(lineTotal)}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeCartItem(c.cartId)}
                            className="text-[10px] text-slate-400 hover:text-rose-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 text-xs text-slate-600 pt-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(cartCalculations.subTotal)}
                </span>
              </div>
              {cartCalculations.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discounts:</span>
                  <span className="font-semibold">
                    -{formatCurrency(cartCalculations.discountTotal)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST Tax:</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(cartCalculations.taxTotal)}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-900">Net Payable:</span>
                <span className="text-xl font-extrabold text-brand-600">
                  {formatCurrency(cartCalculations.grandTotal)}
                </span>
              </div>
            </div>

            {/* Payment Modes */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("CASH")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMode === "CASH"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Banknote className="h-4 w-4 text-emerald-600" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode("UPI")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMode === "UPI"
                        ? "border-brand-500 bg-brand-50 text-brand-800 shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <QrCode className="h-4 w-4 text-brand-600" />
                    <span>UPI / QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode("CARD")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMode === "CARD"
                        ? "border-purple-500 bg-purple-50 text-purple-800 shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CreditCard className="h-4 w-4 text-purple-600" />
                    <span>Card / POS</span>
                  </button>
                </div>
              </div>

              {/* Cash Tendered & Change Due */}
              {paymentMode === "CASH" && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700">Cash Received ₹</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0.00"
                      className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-right outline-none focus:border-brand-500"
                    />
                  </div>

                  {/* Fast Denominations */}
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleQuickCash(cartCalculations.grandTotal)}
                      className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Exact
                    </button>
                    {[100, 200, 500, 2000].map((denom) => (
                      <button
                        key={denom}
                        type="button"
                        onClick={() => handleQuickCash(denom)}
                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        ₹{denom}
                      </button>
                    ))}
                  </div>

                  {/* Change Due Display */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Change Due:</span>
                    <span className="text-base font-extrabold text-emerald-600">
                      {formatCurrency(cartCalculations.changeDue)}
                    </span>
                  </div>
                </div>
              )}

              {/* Complete & Checkout Button */}
              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={isSubmitting || cart.length === 0}
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-extrabold shadow-md shadow-brand-600/20 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {isSubmitting ? "Finalizing Sale..." : `Charge ${formatCurrency(cartCalculations.grandTotal)} & Print`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Held Sales Modal */}
      {showHeldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PauseCircle className="h-4 w-4 text-amber-600" /> Held Sales
              </h3>
              <button
                onClick={() => setShowHeldModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {heldSales.map((h) => (
                <div
                  key={h.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900">{h.customerName}</p>
                    <p className="text-[11px] text-slate-500">
                      Held at {h.heldAt} • {h.itemsCount} items
                    </p>
                    <p className="text-xs font-bold text-brand-600 mt-0.5">
                      {formatCurrency(h.total)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleResumeSale(h)}
                    className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs flex items-center gap-1"
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {completedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Sale Successful
              </span>
              <button
                onClick={() => setCompletedReceipt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Receipt Preview Card */}
            <div
              id="printable-pos-receipt"
              className="border border-slate-200 rounded-xl p-4 bg-slate-50 font-mono text-[11px] text-slate-800 space-y-3"
            >
              <div className="text-center space-y-0.5">
                <p className="font-bold text-xs uppercase">{company.name}</p>
                {company.address && <p className="text-[10px] text-slate-500">{company.address}</p>}
                {company.phone && <p className="text-[10px] text-slate-500">Ph: {company.phone}</p>}
                {company.gstin && <p className="text-[10px] text-slate-500">GSTIN: {company.gstin}</p>}
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-1.5 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>Bill: {completedReceipt.invoiceNo}</span>
                  <span>{completedReceipt.date}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer: {completedReceipt.customerName}</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1">
                {completedReceipt.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate pr-2">
                      {it.name} x{it.qty}
                    </span>
                    <span>{formatCurrency(it.qty * it.rate)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(completedReceipt.subTotal)}</span>
                </div>
                {completedReceipt.taxTotal > 0 && (
                  <div className="flex justify-between">
                    <span>GST:</span>
                    <span>{formatCurrency(completedReceipt.taxTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300">
                  <span>Total:</span>
                  <span>{formatCurrency(completedReceipt.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-[10px] pt-1">
                  <span>Paid ({completedReceipt.paymentMode}):</span>
                  <span>{formatCurrency(completedReceipt.paidAmount)}</span>
                </div>
                {completedReceipt.changeDue > 0 && (
                  <div className="flex justify-between text-[10px] font-bold text-emerald-700">
                    <span>Change Returned:</span>
                    <span>{formatCurrency(completedReceipt.changeDue)}</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-400">
                Thank you! Visit again.
              </div>
            </div>

            {/* Print & Next Sale Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" /> Print Thermal
              </button>
              <button
                type="button"
                onClick={() => setCompletedReceipt(null)}
                className="flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <span>New Sale</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
