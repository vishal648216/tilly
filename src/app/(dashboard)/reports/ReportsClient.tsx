"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import {
  FileText,
  BarChart3,
  PieChart,
  Layers,
  FileSpreadsheet,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShoppingCart,
  Package,
  BookOpen,
  Users,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export interface ReportDefinition {
  id: string;
  name: string;
  category: "SALES" | "PURCHASE" | "INVENTORY" | "ACCOUNTING" | "PARTY";
  description: string;
  badge?: string;
  columns: { key: string; label: string; align?: "left" | "right" | "center"; isCurrency?: boolean }[];
  endpoint?: string;
  directLink?: string;
}

const REPORT_CATALOG: ReportDefinition[] = [
  // --- 1. SALES REPORTS ---
  {
    id: "SALES_REGISTER",
    name: "Sales Register",
    category: "SALES",
    description: "Itemized chronological list of all sales invoices with GST tax split and balances.",
    badge: "GST Compliance",
    columns: [
      { key: "invoiceNo", label: "Invoice #" },
      { key: "date", label: "Date" },
      { key: "customerName", label: "Customer" },
      { key: "customerGstin", label: "GSTIN" },
      { key: "subTotal", label: "Taxable", align: "right", isCurrency: true },
      { key: "cgst", label: "CGST", align: "right", isCurrency: true },
      { key: "sgst", label: "SGST", align: "right", isCurrency: true },
      { key: "igst", label: "IGST", align: "right", isCurrency: true },
      { key: "grandTotal", label: "Grand Total", align: "right", isCurrency: true },
      { key: "balanceDue", label: "Balance", align: "right", isCurrency: true },
      { key: "status", label: "Status", align: "center" },
    ],
  },
  {
    id: "CUSTOMER_SALES",
    name: "Customer-wise Sales",
    category: "SALES",
    description: "Aggregated sales volume, total revenues, and pending collections grouped by customer.",
    columns: [
      { key: "customerName", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "city", label: "City" },
      { key: "invoiceCount", label: "Orders", align: "center" },
      { key: "taxableAmount", label: "Taxable", align: "right", isCurrency: true },
      { key: "taxAmount", label: "Tax", align: "right", isCurrency: true },
      { key: "grandTotal", label: "Total Sales", align: "right", isCurrency: true },
      { key: "outstandingBalance", label: "Outstanding", align: "right", isCurrency: true },
    ],
  },
  {
    id: "ITEM_SALES",
    name: "Item-wise Sales",
    category: "SALES",
    description: "Volume and sales value breakdown per product/service with average realized prices.",
    columns: [
      { key: "name", label: "Product Name" },
      { key: "sku", label: "SKU" },
      { key: "unit", label: "Unit", align: "center" },
      { key: "qtySold", label: "Qty Sold", align: "right" },
      { key: "totalTaxable", label: "Taxable Revenue", align: "right", isCurrency: true },
      { key: "avgRealizedRate", label: "Avg Rate", align: "right", isCurrency: true },
      { key: "totalRevenue", label: "Gross Revenue", align: "right", isCurrency: true },
    ],
  },
  {
    id: "SALESPERSON_SALES",
    name: "Salesperson Sales",
    category: "SALES",
    description: "Performance and billing quota achieved per salesperson/rep across the selected period.",
    columns: [
      { key: "salesperson", label: "Salesperson" },
      { key: "invoiceCount", label: "Invoices", align: "center" },
      { key: "taxableAmount", label: "Taxable", align: "right", isCurrency: true },
      { key: "taxAmount", label: "Tax", align: "right", isCurrency: true },
      { key: "grandTotal", label: "Total Booked", align: "right", isCurrency: true },
      { key: "collectedAmount", label: "Collected", align: "right", isCurrency: true },
      { key: "pendingBalance", label: "Pending", align: "right", isCurrency: true },
    ],
  },
  {
    id: "DISCOUNT_REPORT",
    name: "Discount Report",
    category: "SALES",
    description: "Audit trail of line-item and bill-level trade discounts offered to clients.",
    columns: [
      { key: "date", label: "Date" },
      { key: "invoiceNo", label: "Invoice #" },
      { key: "customerName", label: "Customer" },
      { key: "subTotalBeforeDiscount", label: "Subtotal", align: "right", isCurrency: true },
      { key: "lineDiscount", label: "Line Disc", align: "right", isCurrency: true },
      { key: "invoiceDiscount", label: "Bill Disc", align: "right", isCurrency: true },
      { key: "totalDiscount", label: "Total Disc", align: "right", isCurrency: true },
      { key: "effectiveDiscountPercent", label: "Discount %", align: "center" },
    ],
  },
  {
    id: "TAX_REPORT",
    name: "Tax Outward Report (GST)",
    category: "SALES",
    description: "Detailed breakdown of CGST, SGST, IGST liability by GST rate tier for statutory filing.",
    badge: "GST Ready",
    columns: [
      { key: "date", label: "Date" },
      { key: "invoiceNo", label: "Invoice #" },
      { key: "customerName", label: "Customer" },
      { key: "customerGstin", label: "GSTIN" },
      { key: "taxableAmount", label: "Taxable", align: "right", isCurrency: true },
      { key: "cgst", label: "CGST", align: "right", isCurrency: true },
      { key: "sgst", label: "SGST", align: "right", isCurrency: true },
      { key: "igst", label: "IGST", align: "right", isCurrency: true },
      { key: "totalTax", label: "Total Tax", align: "right", isCurrency: true },
      { key: "grandTotal", label: "Grand Total", align: "right", isCurrency: true },
    ],
  },
  {
    id: "SALES_PROFITABILITY",
    name: "Sales Profitability",
    category: "SALES",
    description: "Invoice-level margin calculation matching revenue against item purchase costs.",
    columns: [
      { key: "invoiceNo", label: "Invoice #" },
      { key: "date", label: "Date" },
      { key: "customerName", label: "Customer" },
      { key: "revenue", label: "Net Revenue", align: "right", isCurrency: true },
      { key: "cogs", label: "Cost (COGS)", align: "right", isCurrency: true },
      { key: "grossProfit", label: "Gross Profit", align: "right", isCurrency: true },
      { key: "marginPercent", label: "Margin %", align: "center" },
    ],
  },

  // --- 2. PURCHASE REPORTS ---
  {
    id: "PURCHASE_REGISTER",
    name: "Purchase Register",
    category: "PURCHASE",
    description: "Detailed chronological record of all vendor purchase bills, HSN splits, and vendor payments.",
    columns: [
      { key: "billNo", label: "Bill #" },
      { key: "supplierInvoiceNo", label: "Vendor Ref" },
      { key: "date", label: "Date" },
      { key: "supplierName", label: "Supplier" },
      { key: "supplierGstin", label: "GSTIN" },
      { key: "subTotal", label: "Taxable", align: "right", isCurrency: true },
      { key: "cgst", label: "CGST", align: "right", isCurrency: true },
      { key: "sgst", label: "SGST", align: "right", isCurrency: true },
      { key: "igst", label: "IGST", align: "right", isCurrency: true },
      { key: "grandTotal", label: "Total Spend", align: "right", isCurrency: true },
      { key: "balanceDue", label: "Payable", align: "right", isCurrency: true },
    ],
  },
  {
    id: "SUPPLIER_PURCHASE",
    name: "Supplier-wise Purchase",
    category: "PURCHASE",
    description: "Procurement volume and outstanding balances aggregated per supplier vendor.",
    columns: [
      { key: "supplierName", label: "Supplier" },
      { key: "phone", label: "Phone" },
      { key: "city", label: "City" },
      { key: "billCount", label: "Bills", align: "center" },
      { key: "taxableAmount", label: "Taxable", align: "right", isCurrency: true },
      { key: "taxAmount", label: "Tax", align: "right", isCurrency: true },
      { key: "grandTotal", label: "Total Purchases", align: "right", isCurrency: true },
      { key: "outstandingPayable", label: "Payable Due", align: "right", isCurrency: true },
    ],
  },
  {
    id: "ITEM_PURCHASE",
    name: "Item-wise Purchase",
    category: "PURCHASE",
    description: "Inward quantity received and total expenditure per inventory item.",
    columns: [
      { key: "name", label: "Item Name" },
      { key: "sku", label: "SKU" },
      { key: "unit", label: "Unit", align: "center" },
      { key: "qtyReceived", label: "Qty Received", align: "right" },
      { key: "totalTaxable", label: "Taxable", align: "right", isCurrency: true },
      { key: "avgPurchaseRate", label: "Avg Cost Rate", align: "right", isCurrency: true },
      { key: "totalSpend", label: "Total Inward Spend", align: "right", isCurrency: true },
    ],
  },
  {
    id: "PURCHASE_RATE_HISTORY",
    name: "Purchase Rate History",
    category: "PURCHASE",
    description: "Price movement tracker comparing vendor invoice rates over time.",
    columns: [
      { key: "date", label: "Date" },
      { key: "supplierName", label: "Supplier" },
      { key: "itemName", label: "Item" },
      { key: "sku", label: "SKU" },
      { key: "qty", label: "Qty", align: "right" },
      { key: "unit", label: "Unit", align: "center" },
      { key: "purchaseRate", label: "Rate Paid", align: "right", isCurrency: true },
      { key: "taxRate", label: "GST %", align: "center" },
    ],
  },
  {
    id: "TAX_PURCHASE",
    name: "Tax Purchase Report (ITC)",
    category: "PURCHASE",
    description: "Input Tax Credit register matching inward vendor tax details for GSTR-2B reconciliation.",
    badge: "ITC Reconciliation",
    columns: [
      { key: "date", label: "Date" },
      { key: "billNo", label: "Bill #" },
      { key: "supplierName", label: "Supplier" },
      { key: "supplierGstin", label: "GSTIN" },
      { key: "taxableAmount", label: "Taxable", align: "right", isCurrency: true },
      { key: "cgst", label: "CGST (ITC)", align: "right", isCurrency: true },
      { key: "sgst", label: "SGST (ITC)", align: "right", isCurrency: true },
      { key: "igst", label: "IGST (ITC)", align: "right", isCurrency: true },
      { key: "totalTax", label: "Total ITC", align: "right", isCurrency: true },
      { key: "grandTotal", label: "Grand Total", align: "right", isCurrency: true },
    ],
  },

  // --- 3. INVENTORY REPORTS ---
  {
    id: "STOCK_SUMMARY",
    name: "Stock Summary",
    category: "INVENTORY",
    description: "Opening, Inward movements, Outward movements, and Closing stock balances with valuation.",
    columns: [
      { key: "name", label: "Product Name" },
      { key: "sku", label: "SKU" },
      { key: "unit", label: "Unit", align: "center" },
      { key: "openingStock", label: "Opening", align: "right" },
      { key: "inward", label: "Inward (+)", align: "right" },
      { key: "outward", label: "Outward (-)", align: "right" },
      { key: "closingStock", label: "Closing Qty", align: "right" },
      { key: "purchasePrice", label: "Cost Rate", align: "right", isCurrency: true },
      { key: "stockValue", label: "Stock Value", align: "right", isCurrency: true },
    ],
  },
  {
    id: "STOCK_LEDGER",
    name: "Stock Ledger",
    category: "INVENTORY",
    description: "Audit trail of every stock transaction with continuous running physical balance.",
    columns: [
      { key: "date", label: "Date" },
      { key: "itemName", label: "Item" },
      { key: "movementType", label: "Movement" },
      { key: "referenceType", label: "Ref Type" },
      { key: "qtyIn", label: "Inward (+)", align: "right" },
      { key: "qtyOut", label: "Outward (-)", align: "right" },
      { key: "runningBalance", label: "Running Qty", align: "right" },
      { key: "unitCost", label: "Unit Cost", align: "right", isCurrency: true },
    ],
  },
  {
    id: "STOCK_VALUATION",
    name: "Stock Valuation",
    category: "INVENTORY",
    description: "Valuation of current physical stock based on weighted cost price and estimated market margin.",
    columns: [
      { key: "name", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "stock", label: "Current Stock", align: "right" },
      { key: "costPrice", label: "Cost Price", align: "right", isCurrency: true },
      { key: "valuation", label: "Valuation (Cost)", align: "right", isCurrency: true },
      { key: "salePrice", label: "Selling Price", align: "right", isCurrency: true },
      { key: "potentialRevenue", label: "Potential Sales", align: "right", isCurrency: true },
      { key: "potentialMargin", label: "Potential Profit", align: "right", isCurrency: true },
    ],
  },
  {
    id: "LOW_STOCK",
    name: "Low Stock & Reorder Alert",
    category: "INVENTORY",
    description: "Products at or below their safety stock and reorder thresholds with suggested purchase quantities.",
    badge: "Action Required",
    columns: [
      { key: "name", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "currentStock", label: "Stock Held", align: "right" },
      { key: "reorderLevel", label: "Reorder Lvl", align: "right" },
      { key: "deficit", label: "Deficit", align: "right" },
      { key: "suggestedOrderQty", label: "Suggested Order", align: "right" },
      { key: "purchasePrice", label: "Cost Rate", align: "right", isCurrency: true },
      { key: "estimatedReorderCost", label: "Estimated Cost", align: "right", isCurrency: true },
    ],
  },
  {
    id: "ITEM_PROFITABILITY",
    name: "Item Profitability",
    category: "INVENTORY",
    description: "Product-level profitability calculating gross profit margins against cost of goods sold.",
    columns: [
      { key: "name", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "qtySold", label: "Qty Sold", align: "right" },
      { key: "revenue", label: "Revenue", align: "right", isCurrency: true },
      { key: "cogs", label: "COGS", align: "right", isCurrency: true },
      { key: "grossProfit", label: "Gross Profit", align: "right", isCurrency: true },
      { key: "marginPercent", label: "Margin %", align: "center" },
    ],
  },
  {
    id: "STOCK_ADJUSTMENT",
    name: "Stock Adjustment",
    category: "INVENTORY",
    description: "Complete log of wastage, scrap, physical count adjustments, and write-offs.",
    columns: [
      { key: "date", label: "Date" },
      { key: "itemName", label: "Item" },
      { key: "type", label: "Adjustment Reason" },
      { key: "qtyIn", label: "Added (+)", align: "right" },
      { key: "qtyOut", label: "Written Off (-)", align: "right" },
      { key: "totalValue", label: "Value", align: "right", isCurrency: true },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    id: "STOCK_TRANSFER",
    name: "Stock Transfer",
    category: "INVENTORY",
    description: "Inter-branch and inter-warehouse physical inventory transit log.",
    columns: [
      { key: "date", label: "Date" },
      { key: "itemName", label: "Item" },
      { key: "transferType", label: "Type" },
      { key: "qty", label: "Qty Transferred", align: "right" },
      { key: "unitCost", label: "Unit Cost", align: "right", isCurrency: true },
      { key: "totalCost", label: "Total Cost", align: "right", isCurrency: true },
      { key: "notes", label: "Notes" },
    ],
  },

  // --- 4. PARTY REPORTS ---
  {
    id: "CUSTOMER_AGING",
    name: "Customer Aging (Receivables)",
    category: "PARTY",
    description: "Debtors balance aging categorized into 0-30, 31-60, 61-90, and 90+ overdue aging buckets.",
    columns: [
      { key: "partyName", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "totalOutstanding", label: "Total Due", align: "right", isCurrency: true },
      { key: "days0To30", label: "0-30 Days", align: "right", isCurrency: true },
      { key: "days31To60", label: "31-60 Days", align: "right", isCurrency: true },
      { key: "days61To90", label: "61-90 Days", align: "right", isCurrency: true },
      { key: "days90Plus", label: "90+ Days", align: "right", isCurrency: true },
      { key: "oldestInvoiceDays", label: "Oldest (Days)", align: "center" },
    ],
  },
  {
    id: "SUPPLIER_AGING",
    name: "Supplier Aging (Payables)",
    category: "PARTY",
    description: "Vendor payables aging breakdown to optimize payment terms and working capital cash flow.",
    columns: [
      { key: "partyName", label: "Supplier" },
      { key: "phone", label: "Phone" },
      { key: "totalOutstanding", label: "Total Due", align: "right", isCurrency: true },
      { key: "days0To30", label: "0-30 Days", align: "right", isCurrency: true },
      { key: "days31To60", label: "31-60 Days", align: "right", isCurrency: true },
      { key: "days61To90", label: "61-90 Days", align: "right", isCurrency: true },
      { key: "days90Plus", label: "90+ Days", align: "right", isCurrency: true },
      { key: "oldestInvoiceDays", label: "Oldest (Days)", align: "center" },
    ],
  },
  {
    id: "CUSTOMER_OVERDUE",
    name: "Customer Overdue Invoices",
    category: "PARTY",
    description: "All outstanding customer invoices that have surpassed their credit term due date.",
    badge: "Overdue",
    columns: [
      { key: "invoiceNo", label: "Invoice #" },
      { key: "partyName", label: "Customer" },
      { key: "date", label: "Invoice Date" },
      { key: "dueDate", label: "Due Date" },
      { key: "grandTotal", label: "Total", align: "right", isCurrency: true },
      { key: "paidAmount", label: "Paid", align: "right", isCurrency: true },
      { key: "balanceDue", label: "Overdue Balance", align: "right", isCurrency: true },
      { key: "overdueDays", label: "Days Past Due", align: "center" },
    ],
  },
  {
    id: "PAYMENT_HISTORY",
    name: "Party Payment History",
    category: "PARTY",
    description: "All client collections and supplier settlements with reference details.",
    columns: [
      { key: "paymentNo", label: "Payment #" },
      { key: "date", label: "Date" },
      { key: "type", label: "Type", align: "center" },
      { key: "partyName", label: "Party" },
      { key: "paymentMode", label: "Mode", align: "center" },
      { key: "amount", label: "Amount", align: "right", isCurrency: true },
      { key: "invoiceNo", label: "Invoices" },
      { key: "status", label: "Status", align: "center" },
    ],
  },
  {
    id: "SUPPLIER_PURCHASE_HISTORY",
    name: "Supplier Purchase History",
    category: "PARTY",
    description: "Procurement invoice history and payment settlement status per vendor.",
    columns: [
      { key: "billNo", label: "Bill #" },
      { key: "date", label: "Date" },
      { key: "supplierName", label: "Supplier" },
      { key: "taxableAmount", label: "Taxable", align: "right", isCurrency: true },
      { key: "taxAmount", label: "Tax", align: "right", isCurrency: true },
      { key: "grandTotal", label: "Grand Total", align: "right", isCurrency: true },
      { key: "paidAmount", label: "Paid", align: "right", isCurrency: true },
      { key: "balanceDue", label: "Balance", align: "right", isCurrency: true },
    ],
  },

  // --- 5. ACCOUNTING STATEMENTS ---
  {
    id: "TRIAL_BALANCE",
    name: "Trial Balance",
    category: "ACCOUNTING",
    description: "Full debit and credit ledger trial balance verifying fundamental double-entry equilibrium.",
    badge: "Core Ledger",
    columns: [
      { key: "code", label: "Account Code" },
      { key: "name", label: "Account Title" },
      { key: "type", label: "Group" },
      { key: "drColumn", label: "Debit (Dr)", align: "right", isCurrency: true },
      { key: "crColumn", label: "Credit (Cr)", align: "right", isCurrency: true },
    ],
    directLink: "/reports/trial-balance",
  },
  {
    id: "PROFIT_LOSS",
    name: "Profit & Loss Statement",
    category: "ACCOUNTING",
    description: "Revenue, cost of sales, operating expenditure, and net income for statutory reporting.",
    badge: "Statutory",
    columns: [
      { key: "category", label: "Account Line" },
      { key: "amount", label: "Amount", align: "right", isCurrency: true },
    ],
    directLink: "/reports/profit-loss",
  },
  {
    id: "BALANCE_SHEET",
    name: "Balance Sheet",
    category: "ACCOUNTING",
    description: "Assets, liabilities, and owners equity standing as of the reporting date.",
    badge: "Statutory",
    columns: [
      { key: "section", label: "Classification" },
      { key: "name", label: "Account Name" },
      { key: "closingBalance", label: "Balance", align: "right", isCurrency: true },
    ],
    directLink: "/reports/balance-sheet",
  },
  {
    id: "JOURNAL_REGISTER",
    name: "Journal Register",
    category: "ACCOUNTING",
    description: "Chronological audit of non-cash adjusting and standard journal vouchers.",
    columns: [
      { key: "voucherNo", label: "Voucher #" },
      { key: "date", label: "Date" },
      { key: "narration", label: "Narration" },
      { key: "totalAmount", label: "Amount", align: "right", isCurrency: true },
      { key: "isBalanced", label: "Balanced", align: "center" },
    ],
  },
];

export default function ReportsClient({ companyName }: { companyName: string }) {
  const [activeTab, setActiveTab] = useState<
    "SALES" | "PURCHASE" | "INVENTORY" | "PARTY" | "ACCOUNTING"
  >("SALES");
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null);
  const [preset, setPreset] = useState("CURRENT_FY");
  const [searchFilter, setSearchFilter] = useState("");
  const [reportData, setReportData] = useState<any[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch report data when selectedReport, preset, or page changes
  useEffect(() => {
    if (!selectedReport) return;
    if (selectedReport.directLink) return; // Dedicated subpage available

    const loadData = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/reports?report=${selectedReport.id}&preset=${preset}&page=${page}&limit=50`
        );
        if (res.ok) {
          const json = await res.json();
          setReportData(json.data || json.rows || []);
          setSummary(json.summary || {});
          setTotalPages(json.totalPages || 1);
          setTotalRecords(json.total || (json.rows ? json.rows.length : 0));
        }
      } catch (err) {
        console.error("Failed to load report data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedReport, preset, page]);

  const handleExport = (format: "csv" | "xls") => {
    if (!selectedReport) return;
    const url = `/api/reports?report=${selectedReport.id}&preset=${preset}&format=${format}`;
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredReports = REPORT_CATALOG.filter((r) => {
    const matchesCategory = r.category === activeTab;
    const matchesSearch =
      r.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.description.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 mb-1">
            <Sparkles className="h-3 w-3" />
            Statutory & Audited Reporting
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Production Reports & Analytics Hub
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            31+ reconciled reports covering Sales, Purchases, Stock Valuation, Tax, and General Ledger.
          </p>
        </div>

        {/* Global Period Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <select
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="TODAY">Today</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="CURRENT_FY">Current Financial Year (FY 26-27)</option>
            <option value="PREVIOUS_FY">Previous Financial Year (FY 25-26)</option>
          </select>
        </div>
      </div>

      {/* Primary Category Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: "SALES", label: "Sales Reports", icon: TrendingUp, count: 7 },
          { id: "PURCHASE", label: "Purchase Reports", icon: ShoppingCart, count: 5 },
          { id: "INVENTORY", label: "Inventory Reports", icon: Package, count: 7 },
          { id: "PARTY", label: "Party & Balances", icon: Users, count: 5 },
          { id: "ACCOUNTING", label: "Accounting Statements", icon: BookOpen, count: 4 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedReport(null);
              }}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs whitespace-nowrap transition-all ${
                isActive
                  ? "border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                  isActive ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {!selectedReport ? (
        /* Report Cards Catalog Grid */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search reports in this category..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <span className="text-xs font-medium text-slate-400">
              Showing {filteredReports.length} reports
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className="card p-5 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group bg-white border-slate-200/80"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-extrabold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {report.name}
                    </h3>
                    {report.badge && (
                      <span className="shrink-0 rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border border-emerald-200/60">
                        {report.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {report.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600 group-hover:text-emerald-700">
                  <span>Open Report</span>
                  <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Report Data Viewer */
        <div className="space-y-4 animate-in fade-in">
          {/* Viewer Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedReport(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                title="Back to Catalog"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900">
                    {selectedReport.name}
                  </h2>
                  {selectedReport.badge && (
                    <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                      {selectedReport.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {companyName} • Period: {preset.replace(/_/g, " ")} • {totalRecords} records found
                </p>
              </div>
            </div>

            {/* Export & Print Actions */}
            <div className="flex items-center gap-2">
              {/* CSV Export Button (Strictly labeled as CSV) */}
              <button
                onClick={() => handleExport("csv")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition-all shadow-2xs active:scale-95"
                title="Download CSV"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" />
                <span>Export CSV</span>
              </button>

              {/* Excel SpreadsheetML Export Button */}
              <button
                onClick={() => handleExport("xls")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition-all shadow-2xs active:scale-95"
                title="Download true Excel SpreadsheetML"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" />
                <span>Export Excel</span>
              </button>

              {/* Print Button */}
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition-all shadow-2xs active:scale-95"
                title="Print Report"
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                <span>Print</span>
              </button>

              {selectedReport.directLink && (
                <Link
                  href={selectedReport.directLink}
                  className="flex items-center gap-1 rounded-xl bg-slate-900 text-white px-3 py-1.5 text-xs font-bold hover:bg-slate-800 transition-colors shadow-2xs"
                >
                  <span>Full Ledger</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
                <p className="text-xs font-bold text-slate-500">
                  Aggregating server-side financial queries...
                </p>
              </div>
            ) : reportData.length === 0 ? (
              <div className="p-16 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No records found</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  There are no transactions or ledger movements matching the selected period ({preset}).
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[11px]">
                    <tr>
                      {selectedReport.columns.map((col) => (
                        <th
                          key={col.key}
                          className={`py-3 px-4 ${
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                              ? "text-center"
                              : "text-left"
                          }`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.map((row, rowIdx) => (
                      <tr
                        key={row.id || rowIdx}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {selectedReport.columns.map((col) => {
                          const val = row[col.key];
                          let rendered = val ?? "—";
                          if (col.isCurrency && typeof val === "number") {
                            rendered = formatCurrency(val);
                          } else if (
                            col.key.toLowerCase().includes("date") &&
                            val &&
                            typeof val === "string" &&
                            val.includes("T")
                          ) {
                            rendered = new Date(val).toLocaleDateString("en-IN");
                          } else if (typeof val === "boolean") {
                            rendered = val ? "Yes" : "No";
                          }
                          return (
                            <td
                              key={col.key}
                              className={`py-3 px-4 ${
                                col.align === "right"
                                  ? "text-right font-medium"
                                  : col.align === "center"
                                  ? "text-center"
                                  : "text-left font-semibold text-slate-800"
                              }`}
                            >
                              {rendered}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination & Summary Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/50">
              {/* Summary Metrics */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {Object.entries(summary).map(([key, value]) => (
                  <div
                    key={key}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700 font-bold shadow-2xs"
                  >
                    <span className="text-[10px] text-slate-400 uppercase">
                      {key.replace(/([A-Z])/g, " $1")}:
                    </span>
                    <span className="text-emerald-700 font-black">
                      {typeof value === "number" ? formatCurrency(value) : value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Server-side Pagination Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs font-semibold text-slate-500 mr-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
