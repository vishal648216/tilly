"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { roundTo2, formatCurrency } from "@/lib/currency";
import {
  Plus,
  Trash2,
  UserPlus,
  X,
  AlertCircle,
  CheckCircle2,
  Barcode,
  FileText,
  CheckCircle,
  Printer,
  PlusCircle,
  Building2,
  Calendar,
  CreditCard,
  Truck,
  Percent,
} from "lucide-react";

type Party = {
  id: string;
  name: string;
  state: string | null;
  gstin: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  salesperson?: string | null;
  creditLimit?: any;
};

type Item = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  hsn: string | null;
  purchasePrice: any;
  salePrice: any;
  gstRate: any;
  stock: any;
};

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
  isDefault: boolean;
};

type Line = {
  key: number;
  itemId: string;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  hsn: string;
  qty: number;
  rate: number;
  discount: number;
  gstRate: number;
};

const emptyLine: Line = {
  key: 0,
  itemId: "",
  name: "",
  sku: "",
  barcode: "",
  unit: "PCS",
  hsn: "",
  qty: 1,
  rate: 0,
  discount: 0,
  gstRate: 0,
};

export type InitialWorkflowData = {
  partyId?: string;
  warehouseId?: string;
  orderNo?: string;
  notes?: string;
  lines?: Line[];
  sourceDocType?: string;
  sourceDocId?: string;
  sourceDocLabel?: string;
  quotationId?: string;
  salesOrderId?: string;
  deliveryChallanId?: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
  skipStockMovement?: boolean;
};

export default function NewInvoiceForm({
  parties,
  items,
  warehouses = [],
  companyState,
  invoiceType = "SALES",
  initialData,
  salespersons = [],
}: {
  parties: Party[];
  items: any[];
  warehouses?: Warehouse[];
  companyState: string | null;
  invoiceType?: "SALES" | "PURCHASE";
  initialData?: InitialWorkflowData | null;
  salespersons?: string[];
}) {
  const router = useRouter();
  const isPurchase = invoiceType === "PURCHASE";

  const defaultSalesReps = [
    "Direct / Counter Sales",
    "Amit Sharma (Field Sales)",
    "Rahul Verma (Key Accounts)",
    "Priya Patel (Retail Counter)",
    "Vikram Singh (Corporate)",
  ];

  const salesOptions = useMemo(() => {
    return Array.from(new Set([...salespersons, ...defaultSalesReps]));
  }, [salespersons]);

  const [partiesList, setPartiesList] = useState<Party[]>(parties);
  const [itemsList, setItemsList] = useState<any[]>(items);

  // Form Header State
  const [partyId, setPartyId] = useState(initialData?.partyId || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [warehouseId, setWarehouseId] = useState(
    initialData?.warehouseId || warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ""
  );
  const [orderNo, setOrderNo] = useState(initialData?.orderNo || "");
  const [paymentTerms, setPaymentTerms] = useState("Immediate");
  const [notes, setNotes] = useState(initialData?.notes || "");

  // Purchase Specific Fields
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState("");

  // Sales Specific Fields
  const [billingAddress, setBillingAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState(companyState || "");
  const [salesperson, setSalesperson] = useState("");
  const [isCustomSalesperson, setIsCustomSalesperson] = useState(false);

  // Lines State
  const [lines, setLines] = useState<Line[]>(
    initialData?.lines && initialData.lines.length > 0
      ? initialData.lines
      : [{ ...emptyLine, key: Date.now() }]
  );

  // Header Charges & Totals State
  const [discountTotal, setDiscountTotal] = useState<number>(0);
  const [freightTotal, setFreightTotal] = useState<number>(0);
  const [otherChargesTotal, setOtherChargesTotal] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "BANK" | "UPI" | "CARD" | "CHEQUE">("CASH");
  const [paymentReference, setPaymentReference] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [partySuccessMsg, setPartySuccessMsg] = useState("");

  // Quick Add Party Modal state
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [newPartyData, setNewPartyData] = useState({
    name: "",
    phone: "",
    gstin: "",
    state: companyState || "",
    address: "",
  });

  // Quick Add Product Modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemKey, setAddItemKey] = useState<number | null>(null);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState("");
  const [newItemData, setNewItemData] = useState({
    name: "",
    salePrice: "",
    purchasePrice: "",
    gstRate: "18",
    hsn: "",
    unit: "PCS",
    stock: "",
  });

  // Barcode input state
  const [barcodeInput, setBarcodeInput] = useState("");

  const selectedParty = partiesList.find((p) => p.id === partyId);

  // Sync addresses when party changes
  function handlePartyChange(id: string) {
    setPartyId(id);
    const p = partiesList.find((x) => x.id === id);
    if (p) {
      if (p.state) setPlaceOfSupply(p.state);
      if (p.billingAddress) setBillingAddress(p.billingAddress);
      if (p.shippingAddress) setShippingAddress(p.shippingAddress);
      if (p.salesperson) {
        setSalesperson(p.salesperson);
        setIsCustomSalesperson(false);
      }
    }
  }

  // Inter-state GST calculation check
  const isInterState = useMemo(() => {
    if (!companyState || !selectedParty?.state) return false;
    return companyState.toLowerCase() !== selectedParty.state.toLowerCase();
  }, [companyState, selectedParty]);

  // Live Totals calculation
  const totals = useMemo(() => {
    let subTotal = 0,
      cgst = 0,
      sgst = 0,
      igst = 0;

    for (const l of lines) {
      const baseAmt = roundTo2(Number(l.qty || 0) * Number(l.rate || 0));
      const lineDisc = roundTo2(Number(l.discount || 0));
      const taxable = Math.max(0, roundTo2(baseAmt - lineDisc));
      const gst = roundTo2((taxable * Number(l.gstRate || 0)) / 100);

      subTotal += taxable;
      if (isInterState) {
        igst += gst;
      } else {
        cgst += roundTo2(gst / 2);
        sgst += roundTo2(gst / 2);
      }
    }

    const disc = Number(discountTotal || 0);
    const freight = Number(freightTotal || 0);
    const other = Number(otherChargesTotal || 0);

    const beforeRound = roundTo2(subTotal - disc + freight + other + cgst + sgst + igst);
    const grand = Math.round(beforeRound);
    const roundOff = roundTo2(grand - beforeRound);
    const paid = Math.min(grand, Math.max(0, Number(paidAmount || 0)));
    const balance = roundTo2(grand - paid);

    return {
      subTotal: roundTo2(subTotal),
      cgst: roundTo2(cgst),
      sgst: roundTo2(sgst),
      igst: roundTo2(igst),
      totalGst: roundTo2(cgst + sgst + igst),
      roundOff,
      grand,
      paid,
      balance,
    };
  }, [lines, isInterState, discountTotal, freightTotal, otherChargesTotal, paidAmount]);

  function addLine() {
    setLines((ls) => [...ls, { ...emptyLine, key: Date.now() + Math.random() }]);
  }

  function removeLine(key: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  function updateLine(key: number, field: keyof Line, value: any) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  function selectItem(key: number, itemId: string) {
    const item = itemsList.find((i) => i.id === itemId);
    if (item) {
      updateLine(key, "itemId", itemId);
      updateLine(key, "name", item.name);
      updateLine(key, "sku", item.sku || "");
      updateLine(key, "barcode", item.barcode || "");
      updateLine(key, "unit", item.unit || "PCS");
      updateLine(key, "hsn", item.hsn || "");
      updateLine(
        key,
        "rate",
        isPurchase ? parseFloat(item.purchasePrice || 0) : parseFloat(item.salePrice || 0)
      );
      updateLine(key, "gstRate", parseFloat(item.gstRate || 0));
    } else {
      updateLine(key, "itemId", "");
    }
  }

  function handleBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = barcodeInput.trim();
      if (!code) return;

      const matched = itemsList.find(
        (i) =>
          (i.barcode && i.barcode.toLowerCase() === code.toLowerCase()) ||
          (i.sku && i.sku.toLowerCase() === code.toLowerCase()) ||
          i.name.toLowerCase() === code.toLowerCase()
      );

      if (matched) {
        const existingLine = lines.find((l) => l.itemId === matched.id);
        if (existingLine) {
          updateLine(existingLine.key, "qty", existingLine.qty + 1);
          setPartySuccessMsg(`Scanned: ${matched.name} (+1 Qty)`);
        } else {
          setLines((ls) => [
            ...ls,
            {
              key: Date.now() + Math.random(),
              itemId: matched.id,
              name: matched.name,
              sku: matched.sku || "",
              barcode: matched.barcode || "",
              unit: matched.unit || "PCS",
              hsn: matched.hsn || "",
              qty: 1,
              discount: 0,
              rate: isPurchase
                ? parseFloat(matched.purchasePrice || 0)
                : parseFloat(matched.salePrice || 0),
              gstRate: parseFloat(matched.gstRate || 0),
            },
          ]);
          setPartySuccessMsg(`Scanned & Added: ${matched.name}`);
        }
        setBarcodeInput("");
        setTimeout(() => setPartySuccessMsg(""), 3000);
      } else {
        setPartySuccessMsg(`Product with barcode/SKU "${code}" not found.`);
        setTimeout(() => setPartySuccessMsg(""), 4000);
      }
    }
  }

  async function handleQuickCreateParty(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");
    const cleanName = newPartyData.name.trim();
    if (!cleanName || cleanName.length < 2) {
      setModalError("Party name must be at least 2 characters long.");
      return;
    }

    setModalLoading(true);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          type: isPurchase ? "VENDOR" : "CUSTOMER",
          phone: newPartyData.phone || null,
          gstin: newPartyData.gstin ? newPartyData.gstin.trim().toUpperCase() : null,
          state: newPartyData.state ? newPartyData.state.trim() : null,
          address: newPartyData.address ? newPartyData.address.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create party");

      setPartiesList((prev) => [data.party, ...prev]);
      handlePartyChange(data.party.id);
      setShowAddPartyModal(false);
      setNewPartyData({ name: "", phone: "", gstin: "", state: companyState || "", address: "" });
      setPartySuccessMsg(`${isPurchase ? "Vendor" : "Customer"} created and selected!`);
      setTimeout(() => setPartySuccessMsg(""), 4000);
    } catch (err: any) {
      setModalError(err.message || "Failed to save party");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleQuickCreateItem(e: React.FormEvent) {
    e.preventDefault();
    setItemModalError("");
    const cleanName = newItemData.name.trim();
    if (!cleanName || cleanName.length < 2) {
      setItemModalError("Item name must be at least 2 characters long.");
      return;
    }

    setItemModalLoading(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          salePrice: parseFloat(newItemData.salePrice) || 0,
          purchasePrice: parseFloat(newItemData.purchasePrice) || 0,
          gstRate: parseFloat(newItemData.gstRate) || 0,
          hsn: newItemData.hsn ? newItemData.hsn.trim() : null,
          unit: newItemData.unit || "PCS",
          stock: parseFloat(newItemData.stock) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create item");

      setItemsList((prev) => [data.item, ...prev]);
      if (addItemKey !== null) {
        selectItem(addItemKey, data.item.id);
      }
      setShowAddItemModal(false);
      setNewItemData({ name: "", salePrice: "", purchasePrice: "", gstRate: "18", hsn: "", unit: "PCS", stock: "" });
    } catch (err: any) {
      setItemModalError(err.message || "Failed to save item");
    } finally {
      setItemModalLoading(false);
    }
  }

  // Quick Action execution handler
  async function executeSubmit(action: "SAVE_DRAFT" | "SAVE_POST" | "SAVE_PRINT" | "SAVE_NEW") {
    setError("");
    const validLines = lines.filter((l) => l.name && l.qty > 0 && l.rate >= 0);
    if (validLines.length === 0) {
      setError("Please add at least one line item with valid quantity and rate.");
      return;
    }

    if (isPurchase && !partyId) {
      setError("Please select a vendor / supplier for this purchase bill.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: invoiceType,
          partyId: partyId || null,
          date,
          dueDate: dueDate || null,
          warehouseId: warehouseId || null,
          supplierInvoiceNo: isPurchase ? supplierInvoiceNo : null,
          supplierInvoiceDate: isPurchase && supplierInvoiceDate ? supplierInvoiceDate : null,
          billingAddress: !isPurchase ? billingAddress : null,
          shippingAddress: !isPurchase ? shippingAddress : null,
          placeOfSupply: placeOfSupply || null,
          salesperson: !isPurchase ? salesperson : null,
          orderNo: orderNo || null,
          paymentTerms: paymentTerms || null,
          discount: Number(discountTotal || 0),
          freight: Number(freightTotal || 0),
          otherCharges: Number(otherChargesTotal || 0),
          paidAmount: Number(paidAmount || 0),
          paymentMode,
          paymentReference: paymentReference || null,
          status: action === "SAVE_DRAFT" ? "DRAFT" : "POSTED",
          quickAction: action,
          isInterState,
          notes,
          sourceDocType: initialData?.sourceDocType || null,
          sourceDocId: initialData?.sourceDocId || null,
          quotationId: initialData?.quotationId || null,
          salesOrderId: initialData?.salesOrderId || null,
          deliveryChallanId: initialData?.deliveryChallanId || null,
          purchaseOrderId: initialData?.purchaseOrderId || null,
          goodsReceiptId: initialData?.goodsReceiptId || null,
          skipStockMovement: Boolean(initialData?.skipStockMovement),
          lines: validLines.map((l) => ({
            itemId: l.itemId || undefined,
            name: l.name,
            sku: l.sku || undefined,
            barcode: l.barcode || undefined,
            unit: l.unit || "PCS",
            hsn: l.hsn || undefined,
            qty: Number(l.qty),
            rate: Number(l.rate),
            discount: Number(l.discount || 0),
            gstRate: Number(l.gstRate),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process transaction.");

      if (action === "SAVE_NEW") {
        setPartySuccessMsg(
          `✓ Successfully posted ${data.invoice.invoiceNo}! Form reset for next transaction.`
        );
        setLines([{ ...emptyLine, key: Date.now() }]);
        setSupplierInvoiceNo("");
        setOrderNo("");
        setPaidAmount(0);
        setDiscountTotal(0);
        setFreightTotal(0);
        setOtherChargesTotal(0);
        setTimeout(() => setPartySuccessMsg(""), 5000);
      } else if (action === "SAVE_PRINT") {
        router.push(`/invoices/${data.invoice.id}`);
        router.refresh();
      } else {
        router.push(isPurchase ? "/purchases" : "/invoices");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {initialData?.sourceDocLabel && (
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 p-4 text-emerald-950 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm shadow">
              ✓
            </span>
            <div>
              <p className="font-bold text-sm text-slate-900">
                Converted from {initialData.sourceDocLabel}
              </p>
              <p className="text-xs text-slate-600">
                Customer, items, quantities, and GST rates have been auto-populated from your workflow.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            Workflow Linked
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 flex items-center gap-2 shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {partySuccessMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-800 shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{partySuccessMsg}</span>
        </div>
      )}

      {/* Primary Transaction Header */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center justify-between">
          <span>{isPurchase ? "Vendor & Purchase Details" : "Customer & Sales Details"}</span>
          <span className="text-xs font-normal normal-case text-slate-400">
            GST Rule: {isInterState ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)"}
          </span>
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Party Selector */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isPurchase ? "Vendor / Supplier *" : "Customer / Party"}
              </label>
              <button
                type="button"
                onClick={() => {
                  setModalError("");
                  setShowAddPartyModal(true);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>+ New {isPurchase ? "Vendor" : "Customer"}</span>
              </button>
            </div>
            <select
              className="input w-full"
              value={partyId}
              onChange={(e) => handlePartyChange(e.target.value)}
            >
              <option value="">— Select {isPurchase ? "Vendor" : "Customer"} —</option>
              {partiesList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.gstin ? `(${p.gstin.slice(0, 7)}...)` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {isPurchase ? "Purchase Date *" : "Invoice Date *"}
            </label>
            <input
              type="date"
              className="input mt-1 w-full"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Extended Fields: Warehouse, Reference, Supplier Bill */}
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isPurchase ? "lg:grid-cols-4" : "lg:grid-cols-3"} pt-2`}>
          {isPurchase ? (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-700">Supplier Bill / Invoice #</label>
                <input
                  type="text"
                  placeholder="e.g. INV-9842"
                  className="input mt-1 w-full font-mono uppercase"
                  value={supplierInvoiceNo}
                  onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Supplier Invoice Date</label>
                <input
                  type="date"
                  className="input mt-1 w-full"
                  value={supplierInvoiceDate}
                  onChange={(e) => setSupplierInvoiceDate(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Salesperson</label>
                {isCustomSalesperson ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomSalesperson(false);
                      setSalesperson("");
                    }}
                    className="text-[11px] text-brand-600 hover:underline font-medium"
                  >
                    Select from List
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomSalesperson(true);
                      setSalesperson("");
                    }}
                    className="text-[11px] text-brand-600 hover:underline font-medium"
                  >
                    + Custom Name
                  </button>
                )}
              </div>

              {isCustomSalesperson ? (
                <input
                  type="text"
                  autoFocus
                  placeholder="Enter salesperson name..."
                  className="input w-full text-sm"
                  value={salesperson}
                  onChange={(e) => setSalesperson(e.target.value)}
                />
              ) : (
                <select
                  className="input w-full text-sm"
                  value={salesperson}
                  onChange={(e) => {
                    if (e.target.value === "__CUSTOM__") {
                      setIsCustomSalesperson(true);
                      setSalesperson("");
                    } else {
                      setSalesperson(e.target.value);
                    }
                  }}
                >
                  <option value="">— Select Salesperson —</option>
                  {salesOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value="__CUSTOM__">➕ + Enter Custom Salesperson...</option>
                </select>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700">Receiving / Shipping Warehouse</label>
            <select
              className="input mt-1 w-full"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.isDefault ? "(Main Store)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">
              {isPurchase ? "Purchase Order / PO #" : "Customer PO / Order Ref"}
            </label>
            <input
              type="text"
              placeholder="e.g. PO-2026-004"
              className="input mt-1 w-full font-mono"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
            />
          </div>
        </div>

        {/* Addresses for Sales */}
        {!isPurchase && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700">Billing Address</label>
              <textarea
                rows={2}
                className="input mt-1 w-full text-xs"
                placeholder="Customer registered billing address..."
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Shipping Address</label>
              <textarea
                rows={2}
                className="input mt-1 w-full text-xs"
                placeholder="Consignee delivery / shipping address..."
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Barcode Quick Scanner Banner */}
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
          <Barcode className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <input
            className="w-full bg-transparent text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
            placeholder="Barcode Scanner Ready: Scan physical barcode or type SKU / Name and press Enter..."
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeKeyDown}
          />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded">
          Auto-Adds Line
        </span>
      </div>

      {/* Line Items Grid */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Line Items</h3>
          <span className="text-xs text-slate-400">{lines.length} items entered</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Product / Item</th>
                <th className="px-3 py-2 font-medium w-24">SKU</th>
                <th className="px-3 py-2 text-right font-medium w-20">Qty</th>
                <th className="px-3 py-2 font-medium w-20">Unit</th>
                <th className="px-3 py-2 text-right font-medium w-28">Rate (₹)</th>
                <th className="px-3 py-2 text-right font-medium w-24">Disc (₹)</th>
                <th className="px-3 py-2 text-right font-medium w-20">GST %</th>
                <th className="px-3 py-2 text-right font-medium w-28">Taxable (₹)</th>
                <th className="px-3 py-2 text-right font-medium w-28">Total (₹)</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line) => {
                const baseAmt = roundTo2(Number(line.qty || 0) * Number(line.rate || 0));
                const lineDisc = roundTo2(Number(line.discount || 0));
                const taxable = Math.max(0, roundTo2(baseAmt - lineDisc));
                const lineGst = roundTo2((taxable * Number(line.gstRate || 0)) / 100);
                const lineTotal = roundTo2(taxable + lineGst);

                return (
                  <tr key={line.key} className="hover:bg-slate-50/50">
                    {/* Item selector & name */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <select
                          className="input flex-1 min-w-[140px] text-xs"
                          value={line.itemId}
                          onChange={(e) => selectItem(line.key, e.target.value)}
                        >
                          <option value="">Custom Item</option>
                          {itemsList.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} {i.sku ? `[${i.sku}]` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setAddItemKey(line.key);
                            setShowAddItemModal(true);
                          }}
                          title="Quick Add Product to Inventory"
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Item description / name"
                        className="input mt-1 w-full text-xs"
                        value={line.name}
                        onChange={(e) => updateLine(line.key, "name", e.target.value)}
                        required
                      />
                    </td>

                    {/* SKU */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="SKU"
                        className="input w-full text-xs font-mono"
                        value={line.sku}
                        onChange={(e) => updateLine(line.key, "sku", e.target.value)}
                      />
                    </td>

                    {/* Qty */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        className="input w-full text-right text-xs"
                        value={line.qty || ""}
                        onChange={(e) => updateLine(line.key, "qty", parseFloat(e.target.value) || 0)}
                        required
                      />
                    </td>

                    {/* Unit */}
                    <td className="px-3 py-2">
                      <select
                        className="input w-full text-xs"
                        value={line.unit}
                        onChange={(e) => updateLine(line.key, "unit", e.target.value)}
                      >
                        <option value="PCS">PCS</option>
                        <option value="KGS">KGS</option>
                        <option value="MTR">MTR</option>
                        <option value="BOX">BOX</option>
                        <option value="LTR">LTR</option>
                        <option value="SET">SET</option>
                      </select>
                    </td>

                    {/* Rate */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input w-full text-right text-xs font-mono"
                        value={line.rate || ""}
                        onChange={(e) => updateLine(line.key, "rate", parseFloat(e.target.value) || 0)}
                        required
                      />
                    </td>

                    {/* Line Discount */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input w-full text-right text-xs font-mono"
                        value={line.discount || ""}
                        onChange={(e) =>
                          updateLine(line.key, "discount", parseFloat(e.target.value) || 0)
                        }
                      />
                    </td>

                    {/* GST % */}
                    <td className="px-3 py-2">
                      <select
                        className="input w-full text-right text-xs"
                        value={line.gstRate}
                        onChange={(e) => updateLine(line.key, "gstRate", parseFloat(e.target.value))}
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>

                    {/* Taxable Amount */}
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">
                      ₹{taxable.toFixed(2)}
                    </td>

                    {/* Total Line Amount */}
                    <td className="px-3 py-2 text-right font-mono text-xs font-bold text-slate-900">
                      ₹{lineTotal.toFixed(2)}
                    </td>

                    {/* Delete */}
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length === 1}
                        className="p-1 rounded text-slate-400 hover:text-red-500 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={addLine}
            className="btn-secondary text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add Another Line
          </button>
        </div>
      </div>

      {/* Totals, Freight, Payment & Notes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Notes & Payment Terms */}
        <div className="card p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Payment Terms & Instructions
            </label>
            <select
              className="input mt-1 w-full text-xs"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            >
              <option value="Immediate">Immediate / Due on Receipt</option>
              <option value="Net 7">Net 7 Days</option>
              <option value="Net 15">Net 15 Days</option>
              <option value="Net 30">Net 30 Days</option>
              <option value="Net 60">Net 60 Days</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Notes & Remarks
            </label>
            <textarea
              className="input mt-1 w-full min-h-[90px] text-xs"
              placeholder="Terms, bank account details, or dispatch instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Upfront Payment Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-brand-600" />
              <span>Record Instant Payment (Optional)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Amount Paid (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input mt-0.5 w-full text-xs font-mono font-bold"
                  placeholder="0.00"
                  value={paidAmount || ""}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Payment Mode</label>
                <select
                  className="input mt-0.5 w-full text-xs"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Ref / Cheque #</label>
                <input
                  type="text"
                  placeholder="Txn ref..."
                  className="input mt-0.5 w-full text-xs font-mono"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary & Breakdown */}
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
            Invoice Summary
          </h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center text-slate-600">
              <span>Subtotal (Taxable Value)</span>
              <span className="font-mono">₹{totals.subTotal.toFixed(2)}</span>
            </div>

            {/* Overall Discount Input */}
            <div className="flex justify-between items-center text-slate-600">
              <span className="flex items-center gap-1">
                <Percent className="h-3.5 w-3.5 text-slate-400" />
                <span>Overall Discount</span>
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">-₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input py-1 px-2 w-28 text-right text-xs font-mono"
                  value={discountTotal || ""}
                  onChange={(e) => setDiscountTotal(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Freight Charges */}
            <div className="flex justify-between items-center text-slate-600">
              <span className="flex items-center gap-1">
                <Truck className="h-3.5 w-3.5 text-slate-400" />
                <span>Freight / Shipping</span>
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">+₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input py-1 px-2 w-28 text-right text-xs font-mono"
                  value={freightTotal || ""}
                  onChange={(e) => setFreightTotal(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Other Charges */}
            <div className="flex justify-between items-center text-slate-600">
              <span>Other Charges / Packaging</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">+₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input py-1 px-2 w-28 text-right text-xs font-mono"
                  value={otherChargesTotal || ""}
                  onChange={(e) => setOtherChargesTotal(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Taxes */}
            {isInterState ? (
              <div className="flex justify-between items-center text-slate-600">
                <span>Integrated GST (IGST)</span>
                <span className="font-mono">₹{totals.igst.toFixed(2)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Central GST (CGST)</span>
                  <span className="font-mono">₹{totals.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>State GST (SGST)</span>
                  <span className="font-mono">₹{totals.sgst.toFixed(2)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between items-center text-slate-500 text-xs">
              <span>Round Off</span>
              <span className="font-mono">{totals.roundOff >= 0 ? `+₹${totals.roundOff.toFixed(2)}` : `-₹${Math.abs(totals.roundOff).toFixed(2)}`}</span>
            </div>

            {/* Grand Total */}
            <div className="flex justify-between items-center border-t border-slate-200 pt-3 text-lg font-bold">
              <span className="text-slate-900">Grand Total</span>
              <span className="text-brand-700 font-mono">₹{totals.grand.toFixed(2)}</span>
            </div>

            {/* Paid & Balance */}
            <div className="flex justify-between items-center text-xs text-emerald-700 font-medium">
              <span>Amount Paid</span>
              <span className="font-mono">₹{totals.paid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-amber-700 font-bold border-t border-slate-100 pt-1">
              <span>Balance Due</span>
              <span className="font-mono">₹{totals.balance.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS BAR (Requirement 13) */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          disabled={loading}
          onClick={() => executeSubmit("SAVE_DRAFT")}
          className="btn-secondary flex items-center gap-2"
        >
          <FileText className="h-4 w-4 text-slate-500" />
          <span>Save Draft</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => executeSubmit("SAVE_POST")}
          className="btn-primary flex items-center gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          <span>{loading ? "Posting..." : "Save & Post"}</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => executeSubmit("SAVE_PRINT")}
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 flex items-center gap-2 transition-colors"
        >
          <Printer className="h-4 w-4" />
          <span>Save & Print</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => executeSubmit("SAVE_NEW")}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 flex items-center gap-2 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Save & New</span>
        </button>

        <button
          type="button"
          onClick={() => router.push(isPurchase ? "/purchases" : "/invoices")}
          className="btn-secondary ml-auto"
        >
          Cancel
        </button>
      </div>

      {/* Quick Add Party Modal */}
      {showAddPartyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Register New {isPurchase ? "Vendor" : "Customer"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPartyModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                {modalError}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Party Name *</label>
                <input
                  type="text"
                  className="input mt-1 w-full"
                  value={newPartyData.name}
                  onChange={(e) => setNewPartyData((d) => ({ ...d, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Phone</label>
                <input
                  type="text"
                  className="input mt-1 w-full"
                  value={newPartyData.phone}
                  onChange={(e) => setNewPartyData((d) => ({ ...d, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">GSTIN</label>
                <input
                  type="text"
                  className="input mt-1 w-full uppercase"
                  value={newPartyData.gstin}
                  onChange={(e) => setNewPartyData((d) => ({ ...d, gstin: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">State</label>
                <input
                  type="text"
                  className="input mt-1 w-full"
                  value={newPartyData.state}
                  onChange={(e) => setNewPartyData((d) => ({ ...d, state: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowAddPartyModal(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickCreateParty}
                disabled={modalLoading}
                className="btn-primary text-xs"
              >
                {modalLoading ? "Saving..." : "Create & Select"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Product to Inventory</h3>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {itemModalError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                {itemModalError}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Item Name *</label>
                <input
                  type="text"
                  className="input mt-1 w-full"
                  value={newItemData.name}
                  onChange={(e) => setNewItemData((d) => ({ ...d, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Sale Price (₹)</label>
                  <input
                    type="number"
                    className="input mt-1 w-full"
                    value={newItemData.salePrice}
                    onChange={(e) => setNewItemData((d) => ({ ...d, salePrice: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Purchase Price (₹)</label>
                  <input
                    type="number"
                    className="input mt-1 w-full"
                    value={newItemData.purchasePrice}
                    onChange={(e) => setNewItemData((d) => ({ ...d, purchasePrice: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">GST Rate %</label>
                  <select
                    className="input mt-1 w-full"
                    value={newItemData.gstRate}
                    onChange={(e) => setNewItemData((d) => ({ ...d, gstRate: e.target.value }))}
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Unit</label>
                  <input
                    type="text"
                    className="input mt-1 w-full"
                    value={newItemData.unit}
                    onChange={(e) => setNewItemData((d) => ({ ...d, unit: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickCreateItem}
                disabled={itemModalLoading}
                className="btn-primary text-xs"
              >
                {itemModalLoading ? "Saving..." : "Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
