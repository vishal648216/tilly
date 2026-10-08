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
import { isValidIndianMobile, isValidGstin, INDIAN_STATES } from "@/lib/validators";

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
  purchasePrice?: number;
  salePrice?: number;
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
  purchasePrice: 0,
  salePrice: 0,
  discount: 0,
  gstRate: 18,
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
  existingOrderNos = [],
}: {
  parties: Party[];
  items: any[];
  warehouses?: Warehouse[];
  companyState: string | null;
  invoiceType?: "SALES" | "PURCHASE";
  initialData?: InitialWorkflowData | null;
  salespersons?: string[];
  existingOrderNos?: string[];
}) {
  const router = useRouter();
  const isPurchase = invoiceType === "PURCHASE";
  const currentYear = new Date().getFullYear();

  function computeNextPo(orderList: string[]): string {
    const yr = new Date().getFullYear();
    let max = 0;
    for (const no of orderList) {
      if (!no) continue;
      const clean = no.trim().toUpperCase();
      const match = clean.match(/^PO-(\d{4})-(\d+)$/);
      if (match && parseInt(match[1], 10) === yr) {
        const seq = parseInt(match[2], 10);
        if (seq > max) max = seq;
      }
    }
    return `PO-${yr}-${String(max + 1).padStart(3, "0")}`;
  }

  function validatePoNumber(val: string, orderList: string[]): { isValid: boolean; error: string } {
    const clean = val.trim().toUpperCase();
    if (!clean) {
      return { isValid: false, error: "Customer PO / Order Ref is required." };
    }
    const yr = new Date().getFullYear();
    const match = clean.match(/^PO-(\d{4})-(\d{3,})$/i);
    if (!match) {
      return {
        isValid: false,
        error: `Format must be PO-YYYY-XXX (e.g. PO-${yr}-001). The format cannot be changed.`,
      };
    }
    const enteredYear = parseInt(match[1], 10);
    if (enteredYear !== yr) {
      return {
        isValid: false,
        error: `Year in PO number must be the current year (${yr}). Year ${enteredYear} is not allowed.`,
      };
    }
    const isDup = orderList.some(
      (existing) => existing && existing.trim().toUpperCase() === clean
    );
    if (isDup) {
      return {
        isValid: false,
        error: `PO Reference "${clean}" already exists! Duplicate references are not allowed.`,
      };
    }
    return { isValid: true, error: "" };
  }

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
  const [existingOrderNosList, setExistingOrderNosList] = useState<string[]>(existingOrderNos);
  const [orderNo, setOrderNo] = useState(
    initialData?.orderNo || computeNextPo(existingOrderNos)
  );
  const [orderNoError, setOrderNoError] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Immediate");
  const [notes, setNotes] = useState(initialData?.notes || "");

  function handleOrderNoChange(val: string) {
    const clean = val.toUpperCase();
    setOrderNo(clean);
    const result = validatePoNumber(clean, existingOrderNosList);
    setOrderNoError(result.isValid ? "" : result.error);
  }

  function handleRegeneratePoNumber() {
    const nextVal = computeNextPo(existingOrderNosList);
    setOrderNo(nextVal);
    setOrderNoError("");
  }

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
    let grossTotal = 0,
      itemDiscounts = 0,
      subTotal = 0,
      cgst = 0,
      sgst = 0,
      igst = 0;

    for (const l of lines) {
      const baseAmt = roundTo2(Number(l.qty || 0) * Number(l.rate || 0));
      const lineDiscAmt = roundTo2((baseAmt * Number(l.discount || 0)) / 100);
      const taxable = Math.max(0, roundTo2(baseAmt - lineDiscAmt));
      const gst = roundTo2((taxable * Number(l.gstRate || 0)) / 100);

      grossTotal += baseAmt;
      itemDiscounts += lineDiscAmt;
      subTotal += taxable;
      if (isInterState) {
        igst += gst;
      } else {
        cgst += roundTo2(gst / 2);
        sgst += roundTo2(gst / 2);
      }
    }

    const disc = Number(discountTotal || 0);
    const totalDiscount = roundTo2(itemDiscounts + disc);
    const freight = Number(freightTotal || 0);
    const other = Number(otherChargesTotal || 0);

    const beforeRound = roundTo2(subTotal - disc + freight + other + cgst + sgst + igst);
    const grand = Math.round(beforeRound);
    const roundOff = roundTo2(grand - beforeRound);
    const paid = Math.min(grand, Math.max(0, Number(paidAmount || 0)));
    const balance = roundTo2(grand - paid);

    return {
      grossTotal: roundTo2(grossTotal),
      itemDiscounts: roundTo2(itemDiscounts),
      totalDiscount,
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
      const pPrice = Number(item.purchasePrice || 0);
      const sPrice = Number(item.salePrice || 0);
      const gRate =
        item.gstRate !== undefined && item.gstRate !== null && !isNaN(Number(item.gstRate))
          ? Number(item.gstRate)
          : 18;

      setLines((ls) =>
        ls.map((l) =>
          l.key === key
            ? {
                ...l,
                itemId,
                name: item.name,
                sku: item.sku || "",
                barcode: item.barcode || "",
                unit: item.unit || "PCS",
                hsn: item.hsn || "",
                rate: isPurchase ? (pPrice || sPrice || 0) : (sPrice || pPrice || 0),
                purchasePrice: pPrice || (isPurchase ? Number(l.rate || 0) : 0),
                salePrice: sPrice || 0,
                gstRate: gRate,
              }
            : l
        )
      );
    } else {
      setLines((ls) =>
        ls.map((l) =>
          l.key === key
            ? {
                ...l,
                itemId: "",
              }
            : l
        )
      );
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

    const partyRole = isPurchase ? "Vendor" : "Customer";
    const cleanName = newPartyData.name.trim();
    if (!cleanName) {
      setModalError(`${partyRole} name is required.`);
      return;
    }
    if (cleanName.length < 2) {
      setModalError(`${partyRole} name must be at least 2 characters long.`);
      return;
    }

    const rawPhone = newPartyData.phone.trim();
    if (!rawPhone) {
      setModalError("Mobile number is required.");
      return;
    }
    let digits = rawPhone.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      digits = digits.slice(1);
    }
    if (digits.length !== 10) {
      setModalError("Mobile number must be exactly 10 digits (e.g. 9876543210).");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setModalError("Mobile number must start with 6, 7, 8, or 9.");
      return;
    }

    const cleanState = newPartyData.state.trim();
    if (!cleanState) {
      setModalError("State is required. Please select or enter a valid state.");
      return;
    }

    if (newPartyData.gstin && newPartyData.gstin.trim()) {
      const cleanGstin = newPartyData.gstin.trim().toUpperCase();
      if (!isValidGstin(cleanGstin)) {
        setModalError("Invalid GSTIN format. Must be 15 alphanumeric characters (e.g. 27ABCDE1234F1Z5).");
        return;
      }
    }

    setModalLoading(true);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          type: isPurchase ? "VENDOR" : "CUSTOMER",
          phone: digits,
          gstin: newPartyData.gstin ? newPartyData.gstin.trim().toUpperCase() : null,
          state: cleanState,
          address: newPartyData.address ? newPartyData.address.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create party");

      setPartiesList((prev) => [data.party, ...prev]);
      handlePartyChange(data.party.id);
      setShowAddPartyModal(false);
      setNewPartyData({ name: "", phone: "", gstin: "", state: companyState || "", address: "" });
      setPartySuccessMsg(`${partyRole} "${cleanName}" created and selected successfully!`);
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

    if (orderNo) {
      const poCheck = validatePoNumber(orderNo, existingOrderNosList);
      if (!poCheck.isValid) {
        setOrderNoError(poCheck.error);
        setError(poCheck.error);
        return;
      }
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
          orderNo: orderNo ? orderNo.trim().toUpperCase() : null,
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
          lines: validLines.map((l) => {
            const base = roundTo2(Number(l.qty) * Number(l.rate));
            const discAmt = roundTo2((base * Number(l.discount || 0)) / 100);
            return {
              itemId: l.itemId || undefined,
              name: l.name,
              sku: l.sku || undefined,
              barcode: l.barcode || undefined,
              unit: l.unit || "PCS",
              hsn: l.hsn || undefined,
              qty: Number(l.qty),
              rate: Number(l.rate),
              purchasePrice: Number(l.purchasePrice || l.rate),
              salePrice: Number(l.salePrice || 0),
              discount: discAmt,
              gstRate: Number(l.gstRate),
            };
          }),
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
        const nextOrderList = [...existingOrderNosList, orderNo.trim().toUpperCase()];
        setExistingOrderNosList(nextOrderList);
        setOrderNo(computeNextPo(nextOrderList));
        setOrderNoError("");
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

        {/* Extended Fields: Reference, Supplier Bill */}
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isPurchase ? "lg:grid-cols-3" : "lg:grid-cols-2"} pt-2`}>
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
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                {isPurchase ? "Purchase Order / PO #" : "Customer PO / Order Ref"}
              </label>
              <button
                type="button"
                onClick={handleRegeneratePoNumber}
                className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                title="Regenerate next unique PO number"
              >
                <span>⚡ Auto-Generate</span>
              </button>
            </div>
            <input
              type="text"
              placeholder={`e.g. PO-${currentYear}-001`}
              className={`input mt-1 w-full font-mono uppercase text-xs ${
                orderNoError
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20 text-red-900"
                  : "border-slate-200 focus:border-emerald-500 text-slate-900"
              }`}
              value={orderNo}
              onChange={(e) => handleOrderNoChange(e.target.value)}
            />
            {orderNoError ? (
              <p className="mt-1 text-[11px] font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{orderNoError}</span>
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-400">
                Format: <span className="font-mono font-medium text-slate-600">PO-{currentYear}-XXX</span> (Unique for {currentYear})
              </p>
            )}
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
          <table className="w-full text-sm min-w-[1260px]">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-medium min-w-[220px]">Product / Item</th>
                <th className="px-3 py-2.5 font-medium w-24 min-w-[90px]">SKU</th>
                <th className="px-3 py-2.5 text-right font-medium w-28 min-w-[105px]">Qty</th>
                <th className="px-3 py-2.5 font-medium w-24 min-w-[95px]">Unit</th>
                <th className="px-3 py-2.5 text-right font-medium w-28 min-w-[115px]">
                  {isPurchase ? "Purchase Price (₹)" : "Rate (₹)"}
                </th>
                {isPurchase && (
                  <th className="px-3 py-2.5 text-right font-medium w-28 min-w-[115px] text-emerald-700 bg-emerald-50/50">
                    Selling Price (₹)
                  </th>
                )}
                <th className="px-3 py-2.5 text-right font-medium w-28 min-w-[95px]">Disc (%)</th>
                <th className="px-3 py-2.5 text-right font-medium w-24 min-w-[95px]">GST %</th>
                <th className="px-3 py-2.5 text-right font-medium w-28 min-w-[105px]">Taxable (₹)</th>
                <th className="px-3 py-2.5 text-right font-medium w-36 min-w-[140px]">
                  {isPurchase ? "Total Purchase Price (₹)" : "Total (₹)"}
                </th>
                <th className="px-3 py-2.5 w-10 min-w-[40px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line) => {
                const baseAmt = roundTo2(Number(line.qty || 0) * Number(line.rate || 0));
                const lineDiscAmt = roundTo2((baseAmt * Number(line.discount || 0)) / 100);
                const taxable = Math.max(0, roundTo2(baseAmt - lineDiscAmt));
                const lineGst = roundTo2((taxable * Number(line.gstRate || 0)) / 100);
                const lineTotal = roundTo2(taxable + lineGst);

                return (
                  <tr key={line.key} className="hover:bg-slate-50/50">
                    {/* Item selector & name */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <select
                          className="input flex-1 min-w-[140px] text-xs px-2.5 py-1.5"
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
                        className="input mt-1 w-full text-xs px-2.5 py-1.5"
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
                        className="input w-full text-xs font-mono px-2.5 py-1.5"
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
                        placeholder="1"
                        className="input w-full text-right text-xs px-2.5 py-1.5 font-medium"
                        value={line.qty || ""}
                        onChange={(e) => updateLine(line.key, "qty", parseFloat(e.target.value) || 0)}
                        required
                      />
                    </td>

                    {/* Unit */}
                    <td className="px-3 py-2">
                      <select
                        className="input w-full text-xs px-2 py-1.5 font-medium"
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

                    {/* Rate / Purchase Price */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="input w-full text-right text-xs font-mono px-2.5 py-1.5"
                        value={line.rate || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          updateLine(line.key, "rate", val);
                          updateLine(line.key, "purchasePrice", val);
                        }}
                        required
                      />
                    </td>

                    {/* Selling Price (for Purchase Bill) */}
                    {isPurchase && (
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="input w-full text-right text-xs font-mono px-2.5 py-1.5 border-emerald-300 focus:border-emerald-500 bg-emerald-50/30 font-medium"
                          value={line.salePrice || ""}
                          onChange={(e) =>
                            updateLine(line.key, "salePrice", parseFloat(e.target.value) || 0)
                          }
                          title="Selling Price for this item"
                        />
                      </td>
                    )}

                    {/* Line Discount % */}
                    <td className="px-3 py-2">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="0"
                          className="input w-full text-right text-xs font-mono pr-5 pl-2 py-1.5"
                          value={line.discount || ""}
                          onChange={(e) =>
                            updateLine(line.key, "discount", parseFloat(e.target.value) || 0)
                          }
                        />
                        <span className="absolute right-2 top-2 text-[11px] text-slate-400 font-bold pointer-events-none">
                          %
                        </span>
                      </div>
                      {Number(line.discount) > 0 && (
                        <div className="text-[10px] text-right text-emerald-600 font-mono mt-0.5">
                          -₹{lineDiscAmt.toFixed(2)}
                        </div>
                      )}
                    </td>

                    {/* GST % */}
                    <td className="px-3 py-2">
                      <select
                        className="input w-full text-right text-xs font-semibold px-2 py-1.5"
                        value={Number(line.gstRate !== undefined ? line.gstRate : 18)}
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
              <span>Gross Amount</span>
              <span className="font-mono">₹{totals.grossTotal.toFixed(2)}</span>
            </div>

            {/* Total Discount of the whole bill */}
            <div className="flex justify-between items-center bg-emerald-50/70 px-2.5 py-1.5 rounded-lg border border-emerald-100">
              <span className="flex items-center gap-1.5 font-bold text-slate-800">
                <Percent className="h-3.5 w-3.5 text-emerald-600" />
                <span>Total Discount</span>
              </span>
              <span className="font-mono font-bold text-sm text-emerald-700">
                -₹{totals.totalDiscount.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span>Subtotal (Taxable Value)</span>
              <span className="font-mono font-semibold">₹{totals.subTotal.toFixed(2)}</span>
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
                onClick={() => {
                  setShowAddPartyModal(false);
                  setModalError("");
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateParty}>
              {modalError && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="mt-4 space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <span>Party Name</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={`Enter ${isPurchase ? "vendor" : "customer"} business or contact name`}
                    className="input mt-1 w-full"
                    value={newPartyData.name}
                    onChange={(e) => {
                      setNewPartyData((d) => ({ ...d, name: e.target.value }));
                      if (modalError) setModalError("");
                    }}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span>Mobile Number</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">10 digits</span>
                  </label>
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-semibold text-slate-400">
                      +91
                    </div>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      className="input w-full pl-11 font-mono tracking-wider"
                      value={newPartyData.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setNewPartyData((d) => ({ ...d, phone: val }));
                        if (modalError) setModalError("");
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Must be 10 digits starting with 6, 7, 8, or 9.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>GSTIN</span>
                    <span className="text-[11px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    className="input mt-1 w-full uppercase font-mono"
                    value={newPartyData.gstin}
                    onChange={(e) => setNewPartyData((d) => ({ ...d, gstin: e.target.value.toUpperCase() }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <span>State</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="quick-party-states"
                    placeholder="e.g. Maharashtra"
                    className="input mt-1 w-full"
                    value={newPartyData.state}
                    onChange={(e) => {
                      setNewPartyData((d) => ({ ...d, state: e.target.value }));
                      if (modalError) setModalError("");
                    }}
                  />
                  <datalist id="quick-party-states">
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Required for GST determination (Intra-state CGST+SGST vs Inter-state IGST).
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPartyModal(false);
                    setModalError("");
                  }}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="btn-primary text-xs"
                >
                  {modalLoading ? "Saving..." : "Create & Select"}
                </button>
              </div>
            </form>
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
                onClick={() => {
                  setShowAddItemModal(false);
                  setItemModalError("");
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateItem}>
              {itemModalError && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{itemModalError}</span>
                </div>
              )}

              <div className="mt-4 space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <span>Item Name</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Basmati Rice 5kg or Wireless Mouse"
                    className="input mt-1 w-full"
                    value={newItemData.name}
                    onChange={(e) => {
                      setNewItemData((d) => ({ ...d, name: e.target.value }));
                      if (itemModalError) setItemModalError("");
                    }}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Sale Price (₹)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      className="input mt-1 w-full"
                      value={newItemData.salePrice}
                      onChange={(e) => setNewItemData((d) => ({ ...d, salePrice: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Purchase Price (₹)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      className="input mt-1 w-full"
                      value={newItemData.purchasePrice}
                      onChange={(e) => setNewItemData((d) => ({ ...d, purchasePrice: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">GST Rate %</label>
                    <select
                      className="input mt-1 w-full font-medium"
                      value={newItemData.gstRate}
                      onChange={(e) => setNewItemData((d) => ({ ...d, gstRate: e.target.value }))}
                    >
                      <option value="0">0% (Nil / Exempt)</option>
                      <option value="3">3% (Precious Items)</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18% (Standard)</option>
                      <option value="28">28% (Luxury / Higher)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Unit</label>
                    <select
                      className="input mt-1 w-full font-medium"
                      value={newItemData.unit}
                      onChange={(e) => setNewItemData((d) => ({ ...d, unit: e.target.value }))}
                    >
                      <option value="PCS">PCS (Pieces)</option>
                      <option value="NOS">NOS (Numbers)</option>
                      <option value="BOX">BOX (Boxes)</option>
                      <option value="KGS">KGS (Kilograms)</option>
                      <option value="GMS">GMS (Grams)</option>
                      <option value="LTR">LTR (Liters)</option>
                      <option value="ML">ML (Milliliters)</option>
                      <option value="MTR">MTR (Meters)</option>
                      <option value="PAC">PAC (Packs)</option>
                      <option value="SET">SET (Sets)</option>
                      <option value="ROLL">ROLL (Rolls)</option>
                      <option value="PAIR">PAIR (Pairs)</option>
                      <option value="BAG">BAG (Bags)</option>
                      <option value="DOZ">DOZ (Dozen)</option>
                      <option value="QTL">QTL (Quintal)</option>
                      <option value="TON">TON (Metric Ton)</option>
                      <option value="HRS">HRS (Hours)</option>
                      <option value="DAY">DAY (Days)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddItemModal(false);
                    setItemModalError("");
                  }}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={itemModalLoading}
                  className="btn-primary text-xs"
                >
                  {itemModalLoading ? "Saving..." : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
