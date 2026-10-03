// Taily - Phase 7: Global Search Engine
// High-performance multi-entity search for Ctrl + K Command Palette.

import { prisma } from "./prisma";

export interface SearchResultItem {
  id: string;
  category: "CUSTOMERS" | "SUPPLIERS" | "PRODUCTS" | "INVOICES" | "PURCHASES" | "PAYMENTS" | "EXPENSES" | "VOUCHERS";
  title: string;
  subtitle: string;
  badge?: string;
  url: string;
}

export interface GlobalSearchResponse {
  query: string;
  totalResults: number;
  results: Record<string, SearchResultItem[]>;
}

export async function executeGlobalSearch(params: {
  companyId: string;
  query: string;
  limitPerCategory?: number;
}): Promise<GlobalSearchResponse> {
  const { companyId, query, limitPerCategory = 5 } = params;
  const cleanQ = query.trim();

  if (!cleanQ || cleanQ.length < 1) {
    return {
      query: cleanQ,
      totalResults: 0,
      results: {},
    };
  }

  // Run parallel queries across all 8 entity types with indexed limits
  const [
    customers,
    suppliers,
    products,
    invoices,
    purchases,
    payments,
    expenses,
    vouchers,
  ] = await Promise.all([
    // 1. Customers (Name, Phone, GSTIN, Code)
    prisma.party.findMany({
      where: {
        companyId,
        type: { in: ["CUSTOMER", "BOTH"] },
        OR: [
          { name: { contains: cleanQ } },
          { phone: { contains: cleanQ } },
          { gstin: { contains: cleanQ } },
          { code: { contains: cleanQ } },
        ],
      },
      take: limitPerCategory,
      select: { id: true, name: true, phone: true, gstin: true, code: true },
    }),

    // 2. Suppliers (Name, Phone, GSTIN, Code)
    prisma.party.findMany({
      where: {
        companyId,
        type: { in: ["VENDOR", "BOTH"] },
        OR: [
          { name: { contains: cleanQ } },
          { phone: { contains: cleanQ } },
          { gstin: { contains: cleanQ } },
          { code: { contains: cleanQ } },
        ],
      },
      take: limitPerCategory,
      select: { id: true, name: true, phone: true, gstin: true, code: true },
    }),

    // 3. Products (Name, SKU, Barcode)
    prisma.item.findMany({
      where: {
        companyId,
        active: true,
        OR: [
          { name: { contains: cleanQ } },
          { sku: { contains: cleanQ } },
          { barcode: { contains: cleanQ } },
        ],
      },
      take: limitPerCategory,
      select: { id: true, name: true, sku: true, barcode: true, salePrice: true, stock: true, unit: true },
    }),

    // 4. Sales Invoices (Invoice #, Order #)
    prisma.invoice.findMany({
      where: {
        companyId,
        type: "SALES",
        OR: [
          { invoiceNo: { contains: cleanQ } },
          { orderNo: { contains: cleanQ } },
        ],
      },
      take: limitPerCategory,
      include: { party: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),

    // 5. Purchases (Bill #, Supplier Invoice #, Order #)
    prisma.invoice.findMany({
      where: {
        companyId,
        type: "PURCHASE",
        OR: [
          { invoiceNo: { contains: cleanQ } },
          { supplierInvoiceNo: { contains: cleanQ } },
          { orderNo: { contains: cleanQ } },
        ],
      },
      take: limitPerCategory,
      include: { party: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),

    // 6. Payments (Payment #, Reference, Cheque #)
    prisma.payment.findMany({
      where: {
        companyId,
        OR: [
          { paymentNo: { contains: cleanQ } },
          { reference: { contains: cleanQ } },
          { chequeNo: { contains: cleanQ } },
        ],
      },
      take: limitPerCategory,
      include: { party: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),

    // 7. Expenses (Category, Notes)
    prisma.expense.findMany({
      where: {
        companyId,
        OR: [
          { category: { contains: cleanQ } },
          { notes: { contains: cleanQ } },
        ],
      },
      take: limitPerCategory,
      orderBy: { expenseDate: "desc" },
    }),

    // 8. Vouchers (Voucher #, Narration)
    prisma.voucher.findMany({
      where: {
        companyId,
        OR: [
          { voucherNo: { contains: cleanQ } },
          { narration: { contains: cleanQ } },
        ],
      },
      take: limitPerCategory,
      orderBy: { date: "desc" },
    }),
  ]);

  const results: Record<string, SearchResultItem[]> = {};
  let totalResults = 0;

  if (customers.length > 0) {
    results.CUSTOMERS = customers.map((c) => ({
      id: c.id,
      category: "CUSTOMERS",
      title: c.name,
      subtitle: [c.phone, c.gstin ? `GST: ${c.gstin}` : null, c.code ? `Code: ${c.code}` : null]
        .filter(Boolean)
        .join(" • ") || "Customer",
      badge: "Customer",
      url: `/parties/${c.id}`,
    }));
    totalResults += customers.length;
  }

  if (suppliers.length > 0) {
    results.SUPPLIERS = suppliers.map((s) => ({
      id: s.id,
      category: "SUPPLIERS",
      title: s.name,
      subtitle: [s.phone, s.gstin ? `GST: ${s.gstin}` : null, s.code ? `Code: ${s.code}` : null]
        .filter(Boolean)
        .join(" • ") || "Supplier",
      badge: "Supplier",
      url: `/parties/${s.id}`,
    }));
    totalResults += suppliers.length;
  }

  if (products.length > 0) {
    results.PRODUCTS = products.map((p) => ({
      id: p.id,
      category: "PRODUCTS",
      title: p.name,
      subtitle: [p.sku ? `SKU: ${p.sku}` : null, `Stock: ${p.stock} ${p.unit}`, `₹${p.salePrice}`]
        .filter(Boolean)
        .join(" • "),
      badge: "Item",
      url: `/items`,
    }));
    totalResults += products.length;
  }

  if (invoices.length > 0) {
    results.INVOICES = invoices.map((inv) => ({
      id: inv.id,
      category: "INVOICES",
      title: inv.invoiceNo,
      subtitle: `${inv.party?.name || "Direct Customer"} • ₹${inv.grandTotal} • ${inv.status}`,
      badge: "Sale",
      url: `/invoices/${inv.id}`,
    }));
    totalResults += invoices.length;
  }

  if (purchases.length > 0) {
    results.PURCHASES = purchases.map((pur) => ({
      id: pur.id,
      category: "PURCHASES",
      title: pur.invoiceNo,
      subtitle: `${pur.party?.name || "Supplier"} • ${pur.supplierInvoiceNo ? `Bill: ${pur.supplierInvoiceNo}` : ""} • ₹${pur.grandTotal}`,
      badge: "Purchase",
      url: `/invoices/${pur.id}`,
    }));
    totalResults += purchases.length;
  }

  if (payments.length > 0) {
    results.PAYMENTS = payments.map((pay) => ({
      id: pay.id,
      category: "PAYMENTS",
      title: pay.paymentNo,
      subtitle: `${pay.type}: ₹${pay.amount} • ${pay.mode} ${pay.reference ? `Ref: ${pay.reference}` : ""}`,
      badge: pay.type,
      url: `/payments`,
    }));
    totalResults += payments.length;
  }

  if (expenses.length > 0) {
    results.EXPENSES = expenses.map((e) => ({
      id: e.id,
      category: "EXPENSES",
      title: e.category,
      subtitle: `₹${e.amount} • ${e.paymentMode} ${e.notes ? `• ${e.notes}` : ""}`,
      badge: "Expense",
      url: `/expenses`,
    }));
    totalResults += expenses.length;
  }

  if (vouchers.length > 0) {
    results.VOUCHERS = vouchers.map((v) => ({
      id: v.id,
      category: "VOUCHERS",
      title: v.voucherNo,
      subtitle: `${v.type} • ${v.narration || "Accounting Voucher"}`,
      badge: v.type,
      url: `/vouchers`,
    }));
    totalResults += vouchers.length;
  }

  return {
    query: cleanQ,
    totalResults,
    results,
  };
}

export async function performGlobalSearch(
  companyId: string,
  query: string,
  limitPerCategory = 5
): Promise<GlobalSearchResponse> {
  return executeGlobalSearch({ companyId, query, limitPerCategory });
}
