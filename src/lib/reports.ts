// Taily - Production-Grade Reports Engine
// Phase 7: Sales, Purchases, Inventory, Party, and Accounting Analytics
// Efficient querying, server-side pagination, date filtering, and reconciliation metrics.

import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { roundTo2 } from "./currency";
import { getAvailableStock } from "./inventory";

// ============================================================================
// COMMON REPORT TYPES
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary?: Record<string, number>;
}

export interface DateFilterParams {
  companyId: string;
  from?: Date;
  to?: Date;
}

// ============================================================================
// 1. SALES REPORTS
// ============================================================================

/**
 * 1.1 Sales Register Report
 * Detailed list of all GST sales invoices in the selected period.
 */
export async function getSalesRegisterReport(
  params: DateFilterParams & PaginationParams & { partyId?: string; status?: string }
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50, partyId, status } = params;
  const skip = (page - 1) * limit;

  const where: any = {
    companyId,
    type: "SALES",
    status: status ? status : { notIn: ["CANCELLED", "REVERSED"] },
  };

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  if (partyId) where.partyId = partyId;

  const [total, invoices, aggregate] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { party: true },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.invoice.aggregate({
      where,
      _sum: {
        subTotal: true,
        cgstTotal: true,
        sgstTotal: true,
        igstTotal: true,
        discount: true,
        grandTotal: true,
        paidAmount: true,
      },
    }),
  ]);

  const data = invoices.map((inv) => ({
    id: inv.id,
    date: inv.date,
    invoiceNo: inv.invoiceNo,
    customerName: inv.party?.name || "Cash Customer",
    customerGstin: inv.party?.gstin || "—",
    placeOfSupply: inv.placeOfSupply || "—",
    salesperson: inv.salesperson || "—",
    subTotal: Number(inv.subTotal),
    discount: Number(inv.discount),
    cgst: Number(inv.cgstTotal),
    sgst: Number(inv.sgstTotal),
    igst: Number(inv.igstTotal),
    taxTotal: Number(inv.cgstTotal) + Number(inv.sgstTotal) + Number(inv.igstTotal),
    grandTotal: Number(inv.grandTotal),
    paidAmount: Number(inv.paidAmount),
    balanceDue: Math.max(0, Number(inv.grandTotal) - Number(inv.paidAmount)),
    status: inv.status,
  }));

  const summary = {
    totalTaxable: Number(aggregate._sum.subTotal || 0),
    totalCgst: Number(aggregate._sum.cgstTotal || 0),
    totalSgst: Number(aggregate._sum.sgstTotal || 0),
    totalIgst: Number(aggregate._sum.igstTotal || 0),
    totalTax:
      Number(aggregate._sum.cgstTotal || 0) +
      Number(aggregate._sum.sgstTotal || 0) +
      Number(aggregate._sum.igstTotal || 0),
    totalDiscount: Number(aggregate._sum.discount || 0),
    totalGrand: Number(aggregate._sum.grandTotal || 0),
    totalPaid: Number(aggregate._sum.paidAmount || 0),
    totalBalanceDue: Math.max(
      0,
      Number(aggregate._sum.grandTotal || 0) - Number(aggregate._sum.paidAmount || 0)
    ),
  };

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary,
  };
}

/**
 * 1.2 Customer-wise Sales Report
 * Aggregates revenue, invoices, tax, and average order value per customer.
 */
export async function getCustomerWiseSalesReport(
  params: DateFilterParams & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50 } = params;

  const where: any = {
    companyId,
    type: "SALES",
    status: { notIn: ["CANCELLED", "REVERSED"] },
  };

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      partyId: true,
      subTotal: true,
      grandTotal: true,
      cgstTotal: true,
      sgstTotal: true,
      igstTotal: true,
      paidAmount: true,
      party: {
        select: { id: true, name: true, phone: true, gstin: true, city: true },
      },
    },
  });

  const customerMap = new Map<string, any>();

  for (const inv of invoices) {
    const key = inv.partyId || "WALK_IN";
    const name = inv.party?.name || "Cash / Direct Customer";
    const gstin = inv.party?.gstin || "—";
    const phone = inv.party?.phone || "—";
    const city = inv.party?.city || "—";

    const current = customerMap.get(key) || {
      partyId: inv.partyId,
      customerName: name,
      gstin,
      phone,
      city,
      invoiceCount: 0,
      taxableAmount: 0,
      taxAmount: 0,
      grandTotal: 0,
      paidAmount: 0,
    };

    current.invoiceCount += 1;
    current.taxableAmount += Number(inv.subTotal);
    current.taxAmount +=
      Number(inv.cgstTotal) + Number(inv.sgstTotal) + Number(inv.igstTotal);
    current.grandTotal += Number(inv.grandTotal);
    current.paidAmount += Number(inv.paidAmount);

    customerMap.set(key, current);
  }

  const aggregatedList = Array.from(customerMap.values())
    .map((c) => ({
      ...c,
      taxableAmount: roundTo2(c.taxableAmount),
      taxAmount: roundTo2(c.taxAmount),
      grandTotal: roundTo2(c.grandTotal),
      paidAmount: roundTo2(c.paidAmount),
      outstandingAmount: roundTo2(Math.max(0, c.grandTotal - c.paidAmount)),
      avgOrderValue: c.invoiceCount > 0 ? roundTo2(c.grandTotal / c.invoiceCount) : 0,
    }))
    .sort((a, b) => b.grandTotal - a.grandTotal);

  const total = aggregatedList.length;
  const skip = (page - 1) * limit;
  const data = aggregatedList.slice(skip, skip + limit);

  const summary = {
    totalCustomers: total,
    totalSales: roundTo2(aggregatedList.reduce((acc, c) => acc + c.grandTotal, 0)),
    totalTaxable: roundTo2(aggregatedList.reduce((acc, c) => acc + c.taxableAmount, 0)),
    totalTax: roundTo2(aggregatedList.reduce((acc, c) => acc + c.taxAmount, 0)),
    totalOutstanding: roundTo2(aggregatedList.reduce((acc, c) => acc + c.outstandingAmount, 0)),
  };

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary,
  };
}

/**
 * 1.3 Item-wise Sales Report
 * Total quantities, revenues, discounts, and margins per product sold.
 */
export async function getItemWiseSalesReport(
  params: DateFilterParams & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50 } = params;

  const invoiceWhere: any = {
    companyId,
    type: "SALES",
    status: { notIn: ["CANCELLED", "REVERSED"] },
  };

  if (from || to) {
    invoiceWhere.date = {};
    if (from) invoiceWhere.date.gte = from;
    if (to) invoiceWhere.date.lte = to;
  }

  const lines = await prisma.invoiceLine.findMany({
    where: {
      invoice: invoiceWhere,
    },
    include: {
      item: true,
      invoice: { select: { date: true, invoiceNo: true } },
    },
  });

  const itemMap = new Map<string, any>();

  for (const line of lines) {
    const key = line.itemId || line.name;
    const current = itemMap.get(key) || {
      itemId: line.itemId,
      name: line.name,
      sku: line.sku || line.item?.sku || "—",
      unit: line.unit || line.item?.unit || "PCS",
      hsn: line.hsn || line.item?.hsn || "—",
      qtySold: 0,
      totalTaxable: 0,
      totalDiscount: 0,
      totalTax: 0,
      totalAmount: 0,
      avgRate: 0,
      purchasePrice: Number(line.item?.purchasePrice || 0),
    };

    const qty = Number(line.qty);
    const taxable = Number(line.taxableAmount);
    const discount = Number(line.discount || 0);
    const tax = Number(line.cgst) + Number(line.sgst) + Number(line.igst);
    const amount = Number(line.amount);

    current.qtySold += qty;
    current.totalTaxable += taxable;
    current.totalDiscount += discount;
    current.totalTax += tax;
    current.totalAmount += amount;

    itemMap.set(key, current);
  }

  const aggregatedList = Array.from(itemMap.values())
    .map((item) => {
      const avgRate = item.qtySold > 0 ? roundTo2(item.totalTaxable / item.qtySold) : 0;
      const cogs = roundTo2(item.qtySold * item.purchasePrice);
      const grossProfit = roundTo2(item.totalTaxable - cogs);
      const profitMargin = item.totalTaxable > 0 ? roundTo2((grossProfit / item.totalTaxable) * 100) : 0;

      return {
        ...item,
        qtySold: roundTo2(item.qtySold),
        totalTaxable: roundTo2(item.totalTaxable),
        totalDiscount: roundTo2(item.totalDiscount),
        totalTax: roundTo2(item.totalTax),
        totalAmount: roundTo2(item.totalAmount),
        avgRate,
        cogs,
        grossProfit,
        profitMargin,
      };
    })
    .sort((a, b) => b.totalTaxable - a.totalTaxable);

  const total = aggregatedList.length;
  const skip = (page - 1) * limit;
  const data = aggregatedList.slice(skip, skip + limit);

  const summary = {
    totalItemsSold: total,
    totalQty: roundTo2(aggregatedList.reduce((acc, i) => acc + i.qtySold, 0)),
    totalTaxable: roundTo2(aggregatedList.reduce((acc, i) => acc + i.totalTaxable, 0)),
    totalGrossProfit: roundTo2(aggregatedList.reduce((acc, i) => acc + i.grossProfit, 0)),
  };

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary,
  };
}

/**
 * 1.4 Salesperson Sales Report
 */
export async function getSalespersonSalesReport(
  params: DateFilterParams & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50 } = params;

  const where: any = {
    companyId,
    type: "SALES",
    status: { notIn: ["CANCELLED", "REVERSED"] },
  };

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      salesperson: true,
      subTotal: true,
      grandTotal: true,
      paidAmount: true,
    },
  });

  const repMap = new Map<string, any>();

  for (const inv of invoices) {
    const name = inv.salesperson?.trim() || "Unassigned";
    const current = repMap.get(name) || {
      salesperson: name,
      invoiceCount: 0,
      taxableAmount: 0,
      grandTotal: 0,
      collectedAmount: 0,
    };

    current.invoiceCount += 1;
    current.taxableAmount += Number(inv.subTotal);
    current.grandTotal += Number(inv.grandTotal);
    current.collectedAmount += Number(inv.paidAmount);

    repMap.set(name, current);
  }

  const aggregatedList = Array.from(repMap.values())
    .map((r) => ({
      ...r,
      taxableAmount: roundTo2(r.taxableAmount),
      grandTotal: roundTo2(r.grandTotal),
      collectedAmount: roundTo2(r.collectedAmount),
      pendingCollection: roundTo2(Math.max(0, r.grandTotal - r.collectedAmount)),
    }))
    .sort((a, b) => b.grandTotal - a.grandTotal);

  const total = aggregatedList.length;
  const skip = (page - 1) * limit;
  const data = aggregatedList.slice(skip, skip + limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary: {
      totalSales: roundTo2(aggregatedList.reduce((acc, r) => acc + r.grandTotal, 0)),
      totalCollected: roundTo2(aggregatedList.reduce((acc, r) => acc + r.collectedAmount, 0)),
    },
  };
}

/**
 * 1.5 Discount Report
 * Tracks all line-level and invoice-level discounts offered to customers.
 */
export async function getDiscountReport(
  params: DateFilterParams & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50 } = params;

  const where: any = {
    companyId,
    type: "SALES",
    status: { notIn: ["CANCELLED", "REVERSED"] },
  };

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      party: true,
      lines: {
        where: { discount: { gt: 0 } },
      },
    },
    orderBy: { date: "desc" },
  });

  const discountRows: any[] = [];

  for (const inv of invoices) {
    const invDiscount = Number(inv.discount || 0);
    const lineDiscountTotal = inv.lines.reduce((acc, l) => acc + Number(l.discount || 0), 0);
    const totalDiscount = invDiscount + lineDiscountTotal;

    if (totalDiscount > 0) {
      const grossAmount = Number(inv.subTotal) + totalDiscount;
      const discountPercent = grossAmount > 0 ? roundTo2((totalDiscount / grossAmount) * 100) : 0;

      discountRows.push({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        date: inv.date,
        customerName: inv.party?.name || "Direct Customer",
        lineDiscounts: roundTo2(lineDiscountTotal),
        invoiceDiscount: roundTo2(invDiscount),
        totalDiscount: roundTo2(totalDiscount),
        grossBeforeDiscount: roundTo2(grossAmount),
        grandTotal: Number(inv.grandTotal),
        discountPercent,
      });
    }
  }

  const total = discountRows.length;
  const skip = (page - 1) * limit;
  const data = discountRows.slice(skip, skip + limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary: {
      totalDiscountsGiven: roundTo2(discountRows.reduce((a, r) => a + r.totalDiscount, 0)),
    },
  };
}

/**
 * 1.6 GST Tax Report (Output & Input breakdown by tax rates)
 */
export async function getTaxReport(
  params: DateFilterParams & { type?: "SALES" | "PURCHASE" | "ALL" }
) {
  const { companyId, from, to, type = "SALES" } = params;

  const where: any = {
    companyId,
    status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
  };

  if (type !== "ALL") where.type = type;

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const lines = await prisma.invoiceLine.findMany({
    where: { invoice: where },
    include: { invoice: { select: { type: true } } },
  });

  // Rates: 0, 5, 12, 18, 28
  const rateSlabs = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }>();

  for (const slab of [0, 5, 12, 18, 28]) {
    rateSlabs.set(slab, { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });
  }

  for (const line of lines) {
    const rate = Number(line.gstRate || 0);
    const existing = rateSlabs.get(rate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };

    existing.taxable += Number(line.taxableAmount);
    existing.cgst += Number(line.cgst);
    existing.sgst += Number(line.sgst);
    existing.igst += Number(line.igst);
    existing.totalTax += Number(line.cgst) + Number(line.sgst) + Number(line.igst);

    rateSlabs.set(rate, existing);
  }

  const slabs = Array.from(rateSlabs.entries())
    .map(([rate, vals]) => ({
      rate: `${rate}%`,
      taxable: roundTo2(vals.taxable),
      cgst: roundTo2(vals.cgst),
      sgst: roundTo2(vals.sgst),
      igst: roundTo2(vals.igst),
      totalTax: roundTo2(vals.totalTax),
    }))
    .filter((s) => s.taxable > 0 || s.totalTax > 0);

  const totalTaxable = roundTo2(slabs.reduce((acc, s) => acc + s.taxable, 0));
  const totalCgst = roundTo2(slabs.reduce((acc, s) => acc + s.cgst, 0));
  const totalSgst = roundTo2(slabs.reduce((acc, s) => acc + s.sgst, 0));
  const totalIgst = roundTo2(slabs.reduce((acc, s) => acc + s.igst, 0));
  const totalTax = roundTo2(slabs.reduce((acc, s) => acc + s.totalTax, 0));

  return {
    type,
    slabs,
    summary: { totalTaxable, totalCgst, totalSgst, totalIgst, totalTax },
  };
}

/**
 * 1.7 Sales Profitability Report (Invoice & Item level)
 */
export async function getSalesProfitabilityReport(
  params: DateFilterParams & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50 } = params;

  const where: any = {
    companyId,
    type: "SALES",
    status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
  };

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: {
        party: true,
        lines: { include: { item: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const rows = invoices.map((inv) => {
    let invoiceCost = 0;
    const netRevenue = Number(inv.subTotal);

    for (const line of inv.lines) {
      const unitCost = Number(line.item?.purchasePrice || 0);
      invoiceCost += Number(line.qty) * unitCost;
    }

    const grossMargin = roundTo2(netRevenue - invoiceCost);
    const marginPercent = netRevenue > 0 ? roundTo2((grossMargin / netRevenue) * 100) : 0;

    return {
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      date: inv.date,
      customerName: inv.party?.name || "Direct Customer",
      netRevenue: roundTo2(netRevenue),
      cogs: roundTo2(invoiceCost),
      grossMargin,
      marginPercent,
      isProfitable: grossMargin >= 0,
    };
  });

  const totalRevenue = roundTo2(rows.reduce((acc, r) => acc + r.netRevenue, 0));
  const totalCOGS = roundTo2(rows.reduce((acc, r) => acc + r.cogs, 0));
  const totalProfit = roundTo2(totalRevenue - totalCOGS);
  const overallMargin = totalRevenue > 0 ? roundTo2((totalProfit / totalRevenue) * 100) : 0;

  return {
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary: { totalRevenue, totalCOGS, totalProfit, overallMargin },
  };
}

// ============================================================================
// 2. PURCHASE REPORTS
// ============================================================================

/**
 * 2.1 Purchase Register Report
 */
export async function getPurchaseRegisterReport(
  params: DateFilterParams & PaginationParams & { partyId?: string }
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50, partyId } = params;
  const skip = (page - 1) * limit;

  const where: any = {
    companyId,
    type: "PURCHASE",
    status: { notIn: ["CANCELLED", "REVERSED"] },
  };

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  if (partyId) where.partyId = partyId;

  const [total, bills, aggregate] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { party: true },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.invoice.aggregate({
      where,
      _sum: {
        subTotal: true,
        cgstTotal: true,
        sgstTotal: true,
        igstTotal: true,
        grandTotal: true,
        paidAmount: true,
      },
    }),
  ]);

  const data = bills.map((b) => ({
    id: b.id,
    date: b.date,
    billNo: b.invoiceNo,
    supplierInvoiceNo: b.supplierInvoiceNo || "—",
    supplierName: b.party?.name || "Direct Supplier",
    supplierGstin: b.party?.gstin || "—",
    subTotal: Number(b.subTotal),
    cgst: Number(b.cgstTotal),
    sgst: Number(b.sgstTotal),
    igst: Number(b.igstTotal),
    taxTotal: Number(b.cgstTotal) + Number(b.sgstTotal) + Number(b.igstTotal),
    grandTotal: Number(b.grandTotal),
    paidAmount: Number(b.paidAmount),
    balanceDue: Math.max(0, Number(b.grandTotal) - Number(b.paidAmount)),
    status: b.status,
  }));

  const summary = {
    totalTaxable: Number(aggregate._sum.subTotal || 0),
    totalCgst: Number(aggregate._sum.cgstTotal || 0),
    totalSgst: Number(aggregate._sum.sgstTotal || 0),
    totalIgst: Number(aggregate._sum.igstTotal || 0),
    totalTax:
      Number(aggregate._sum.cgstTotal || 0) +
      Number(aggregate._sum.sgstTotal || 0) +
      Number(aggregate._sum.igstTotal || 0),
    totalGrand: Number(aggregate._sum.grandTotal || 0),
    totalPaid: Number(aggregate._sum.paidAmount || 0),
    totalBalanceDue: Math.max(
      0,
      Number(aggregate._sum.grandTotal || 0) - Number(aggregate._sum.paidAmount || 0)
    ),
  };

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary,
  };
}

/**
 * 2.2 Supplier-wise Purchase Report
 */
export async function getSupplierWisePurchaseReport(
  params: DateFilterParams & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50 } = params;

  const where: any = {
    companyId,
    type: "PURCHASE",
    status: { notIn: ["CANCELLED", "REVERSED"] },
  };

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const bills = await prisma.invoice.findMany({
    where,
    select: {
      partyId: true,
      subTotal: true,
      grandTotal: true,
      cgstTotal: true,
      sgstTotal: true,
      igstTotal: true,
      paidAmount: true,
      party: {
        select: { id: true, name: true, phone: true, gstin: true, city: true },
      },
    },
  });

  const supplierMap = new Map<string, any>();

  for (const b of bills) {
    const key = b.partyId || "DIRECT";
    const name = b.party?.name || "Direct Vendor";
    const gstin = b.party?.gstin || "—";
    const phone = b.party?.phone || "—";
    const city = b.party?.city || "—";

    const current = supplierMap.get(key) || {
      partyId: b.partyId,
      supplierName: name,
      gstin,
      phone,
      city,
      billCount: 0,
      taxableAmount: 0,
      taxAmount: 0,
      grandTotal: 0,
      paidAmount: 0,
    };

    current.billCount += 1;
    current.taxableAmount += Number(b.subTotal);
    current.taxAmount += Number(b.cgstTotal) + Number(b.sgstTotal) + Number(b.igstTotal);
    current.grandTotal += Number(b.grandTotal);
    current.paidAmount += Number(b.paidAmount);

    supplierMap.set(key, current);
  }

  const aggregatedList = Array.from(supplierMap.values())
    .map((s) => ({
      ...s,
      taxableAmount: roundTo2(s.taxableAmount),
      taxAmount: roundTo2(s.taxAmount),
      grandTotal: roundTo2(s.grandTotal),
      paidAmount: roundTo2(s.paidAmount),
      outstandingPayable: roundTo2(Math.max(0, s.grandTotal - s.paidAmount)),
    }))
    .sort((a, b) => b.grandTotal - a.grandTotal);

  const total = aggregatedList.length;
  const skip = (page - 1) * limit;
  const data = aggregatedList.slice(skip, skip + limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary: {
      totalSuppliers: total,
      totalPurchases: roundTo2(aggregatedList.reduce((acc, s) => acc + s.grandTotal, 0)),
      totalPayable: roundTo2(aggregatedList.reduce((acc, s) => acc + s.outstandingPayable, 0)),
    },
  };
}

/**
 * 2.3 Item-wise Purchase Report
 */
export async function getItemWisePurchaseReport(
  params: DateFilterParams & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50 } = params;

  const billWhere: any = {
    companyId,
    type: "PURCHASE",
    status: { notIn: ["CANCELLED", "REVERSED"] },
  };

  if (from || to) {
    billWhere.date = {};
    if (from) billWhere.date.gte = from;
    if (to) billWhere.date.lte = to;
  }

  const lines = await prisma.invoiceLine.findMany({
    where: { invoice: billWhere },
    include: { item: true },
  });

  const itemMap = new Map<string, any>();

  for (const line of lines) {
    const key = line.itemId || line.name;
    const current = itemMap.get(key) || {
      itemId: line.itemId,
      name: line.name,
      sku: line.sku || line.item?.sku || "—",
      unit: line.unit || line.item?.unit || "PCS",
      qtyReceived: 0,
      totalTaxable: 0,
      totalTax: 0,
      totalSpend: 0,
    };

    current.qtyReceived += Number(line.qty);
    current.totalTaxable += Number(line.taxableAmount);
    current.totalTax += Number(line.cgst) + Number(line.sgst) + Number(line.igst);
    current.totalSpend += Number(line.amount);

    itemMap.set(key, current);
  }

  const aggregatedList = Array.from(itemMap.values())
    .map((i) => ({
      ...i,
      qtyReceived: roundTo2(i.qtyReceived),
      totalTaxable: roundTo2(i.totalTaxable),
      totalTax: roundTo2(i.totalTax),
      totalSpend: roundTo2(i.totalSpend),
      avgPurchaseRate: i.qtyReceived > 0 ? roundTo2(i.totalTaxable / i.qtyReceived) : 0,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);

  const total = aggregatedList.length;
  const skip = (page - 1) * limit;
  const data = aggregatedList.slice(skip, skip + limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary: {
      totalQtyReceived: roundTo2(aggregatedList.reduce((acc, i) => acc + i.qtyReceived, 0)),
      totalSpend: roundTo2(aggregatedList.reduce((acc, i) => acc + i.totalSpend, 0)),
    },
  };
}

/**
 * 2.4 Purchase Rate History Report (Price trends across vendors)
 */
export async function getPurchaseRateHistoryReport(params: {
  companyId: string;
  itemId?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<any>> {
  const { companyId, itemId, page = 1, limit = 50 } = params;

  const where: any = {
    invoice: { companyId, type: "PURCHASE", status: { notIn: ["CANCELLED", "REVERSED"] } },
  };

  if (itemId) where.itemId = itemId;

  const [total, lines] = await Promise.all([
    prisma.invoiceLine.count({ where }),
    prisma.invoiceLine.findMany({
      where,
      include: {
        invoice: { include: { party: true } },
        item: true,
      },
      orderBy: { invoice: { date: "desc" } },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const data = lines.map((l) => ({
    id: l.id,
    date: l.invoice.date,
    billNo: l.invoice.invoiceNo,
    supplierInvoiceNo: l.invoice.supplierInvoiceNo || "—",
    supplierName: l.invoice.party?.name || "Direct Supplier",
    itemName: l.name,
    sku: l.sku || l.item?.sku || "—",
    qty: Number(l.qty),
    unit: l.unit,
    purchaseRate: Number(l.rate),
    taxRate: Number(l.gstRate),
    taxableAmount: Number(l.taxableAmount),
  }));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * 2.5 Tax Purchase Report (Input Tax Credit / Inward Supplies Register)
 */
export async function getTaxPurchaseReport(
  params: DateFilterParams & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50 } = params;

  const where: any = {
    companyId,
    type: "PURCHASE",
    status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
  };

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const [total, bills] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { party: true },
      orderBy: { date: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const data = bills.map((b) => {
    const cgst = Number(b.cgstTotal);
    const sgst = Number(b.sgstTotal);
    const igst = Number(b.igstTotal);
    const totalTax = roundTo2(cgst + sgst + igst);

    return {
      id: b.id,
      date: b.date,
      billNo: b.invoiceNo,
      supplierInvoiceNo: b.supplierInvoiceNo || "—",
      supplierName: b.party?.name || "Direct Supplier",
      supplierGstin: b.party?.gstin || "URP",
      taxableAmount: Number(b.subTotal),
      cgst,
      sgst,
      igst,
      totalTax,
      grandTotal: Number(b.grandTotal),
    };
  });

  const allFiltered = await prisma.invoice.findMany({
    where,
    select: { subTotal: true, cgstTotal: true, sgstTotal: true, igstTotal: true, grandTotal: true },
  });

  const summary = {
    totalTaxable: roundTo2(allFiltered.reduce((acc, b) => acc + Number(b.subTotal), 0)),
    totalCGST: roundTo2(allFiltered.reduce((acc, b) => acc + Number(b.cgstTotal), 0)),
    totalSGST: roundTo2(allFiltered.reduce((acc, b) => acc + Number(b.sgstTotal), 0)),
    totalIGST: roundTo2(allFiltered.reduce((acc, b) => acc + Number(b.igstTotal), 0)),
    totalTax: roundTo2(allFiltered.reduce((acc, b) => acc + Number(b.cgstTotal) + Number(b.sgstTotal) + Number(b.igstTotal), 0)),
    totalGrandTotal: roundTo2(allFiltered.reduce((acc, b) => acc + Number(b.grandTotal), 0)),
  };

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary,
  };
}

// ============================================================================
// 3. INVENTORY REPORTS
// ============================================================================

/**
 * 3.1 Stock Summary Report (Opening, Inward, Outward, Closing)
 */
export async function getStockSummaryReport(
  params: DateFilterParams & PaginationParams & { warehouseId?: string }
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, warehouseId, page = 1, limit = 50 } = params;

  const itemWhere: any = { companyId, active: true };

  const [total, items] = await Promise.all([
    prisma.item.count({ where: itemWhere }),
    prisma.item.findMany({
      where: itemWhere,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
    }),
  ]);

  // Aggregate stock movements for these items
  const itemIds = items.map((i) => i.id);

  const mvWhere: any = {
    companyId,
    itemId: { in: itemIds },
  };
  if (warehouseId) mvWhere.warehouseId = warehouseId;
  if (from || to) {
    mvWhere.date = {};
    if (from) mvWhere.date.gte = from;
    if (to) mvWhere.date.lte = to;
  }

  const movements = await prisma.stockMovement.findMany({
    where: mvWhere,
  });

  const data = items.map((item) => {
    const itemMvs = movements.filter((m) => m.itemId === item.id);
    const inward = itemMvs.reduce((acc, m) => acc + m.qtyIn, 0);
    const outward = itemMvs.reduce((acc, m) => acc + m.qtyOut, 0);
    const closingStock = Number(item.stock);
    const openingStock = roundTo2(closingStock - inward + outward);
    const valuationRate = Number(item.purchasePrice || 0);
    const stockValue = roundTo2(closingStock * valuationRate);

    return {
      id: item.id,
      name: item.name,
      sku: item.sku || "—",
      category: item.category || "General",
      unit: item.unit,
      openingStock,
      inward: roundTo2(inward),
      outward: roundTo2(outward),
      closingStock,
      purchasePrice: valuationRate,
      stockValue,
      reorderLevel: Number(item.reorderLevel || item.minStock || 0),
    };
  });

  const totalValue = data.reduce((acc, i) => acc + i.stockValue, 0);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary: { totalStockValue: roundTo2(totalValue) },
  };
}

/**
 * 3.2 Stock Valuation Report (Value by item & warehouse)
 */
export async function getStockValuationReport(
  params: { companyId: string; warehouseId?: string } & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, warehouseId, page = 1, limit = 50 } = params;

  const where: any = { companyId, active: true, type: "PRODUCT" };

  const [total, items] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
    }),
  ]);

  const data = items.map((i) => {
    const qty = Number(i.stock);
    const cost = Number(i.purchasePrice || 0);
    const salePrice = Number(i.salePrice || 0);
    const valuation = roundTo2(qty * cost);
    const potentialRevenue = roundTo2(qty * salePrice);

    return {
      id: i.id,
      name: i.name,
      sku: i.sku || "—",
      unit: i.unit,
      stock: qty,
      costPrice: cost,
      salePrice,
      valuation,
      potentialRevenue,
      potentialMargin: roundTo2(potentialRevenue - valuation),
    };
  });

  const allItems = await prisma.item.findMany({ where, select: { stock: true, purchasePrice: true } });
  const totalValuation = allItems.reduce((acc, i) => acc + Number(i.stock) * Number(i.purchasePrice || 0), 0);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary: { totalInventoryValuation: roundTo2(totalValuation) },
  };
}

/**
 * 3.3 Low Stock & Reorder Alert Report
 */
export async function getLowStockReport(
  params: { companyId: string; warehouseId?: string } & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, page = 1, limit = 50 } = params;

  const items = await prisma.item.findMany({
    where: { companyId, active: true, type: "PRODUCT" },
  });

  const lowStockItems = items
    .filter((i) => {
      const stock = Number(i.stock);
      const min = Number(i.minStock || 0);
      const reorder = Number(i.reorderLevel || min);
      return stock <= reorder;
    })
    .map((i) => {
      const current = Number(i.stock);
      const min = Number(i.minStock || 0);
      const reorder = Number(i.reorderLevel || min);
      const suggestedOrderQty = Math.max(0, reorder * 2 - current);

      return {
        id: i.id,
        name: i.name,
        sku: i.sku || "—",
        unit: i.unit,
        currentStock: current,
        minStock: min,
        reorderLevel: reorder,
        suggestedOrderQty,
        deficit: Math.max(0, reorder - current),
        purchasePrice: Number(i.purchasePrice || 0),
        estimatedReorderCost: roundTo2(suggestedOrderQty * Number(i.purchasePrice || 0)),
      };
    })
    .sort((a, b) => b.deficit - a.deficit);

  const total = lowStockItems.length;
  const skip = (page - 1) * limit;
  const data = lowStockItems.slice(skip, skip + limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary: {
      lowStockItemCount: total,
      totalReorderInvestment: roundTo2(lowStockItems.reduce((acc, i) => acc + i.estimatedReorderCost, 0)),
    },
  };
}

/**
 * 3.4 Fast Moving, Slow Moving, & Dead Stock Analysis
 */
export async function getInventoryMovementVelocityReport(
  params: DateFilterParams & { limit?: number }
) {
  const { companyId, from, to, limit = 10 } = params;

  const invoiceWhere: any = {
    companyId,
    type: "SALES",
    status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
  };
  if (from || to) {
    invoiceWhere.date = {};
    if (from) invoiceWhere.date.gte = from;
    if (to) invoiceWhere.date.lte = to;
  }

  const [lines, allItems] = await Promise.all([
    prisma.invoiceLine.findMany({
      where: { invoice: invoiceWhere, itemId: { not: null } },
      select: { itemId: true, qty: true, taxableAmount: true },
    }),
    prisma.item.findMany({
      where: { companyId, active: true, type: "PRODUCT" },
      select: { id: true, name: true, sku: true, stock: true, purchasePrice: true },
    }),
  ]);

  const salesMap = new Map<string, { qty: number; revenue: number }>();
  for (const l of lines) {
    if (!l.itemId) continue;
    const curr = salesMap.get(l.itemId) || { qty: 0, revenue: 0 };
    curr.qty += Number(l.qty);
    curr.revenue += Number(l.taxableAmount);
    salesMap.set(l.itemId, curr);
  }

  const analyzed = allItems.map((item) => {
    const sold = salesMap.get(item.id) || { qty: 0, revenue: 0 };
    return {
      id: item.id,
      name: item.name,
      sku: item.sku || "—",
      currentStock: Number(item.stock),
      qtySold: roundTo2(sold.qty),
      revenue: roundTo2(sold.revenue),
      stockValue: roundTo2(Number(item.stock) * Number(item.purchasePrice || 0)),
    };
  });

  const fastMoving = [...analyzed].sort((a, b) => b.qtySold - a.qtySold).slice(0, limit);
  const slowMoving = [...analyzed].filter((i) => i.qtySold > 0).sort((a, b) => a.qtySold - b.qtySold).slice(0, limit);
  const deadStock = [...analyzed].filter((i) => i.qtySold === 0 && i.currentStock > 0).slice(0, limit);

  return {
    fastMoving,
    slowMoving,
    deadStock,
  };
}

/**
 * 3.5 Stock Ledger Report (Running Stock History per Item)
 */
export async function getStockLedgerReport(
  params: DateFilterParams & PaginationParams & { itemId?: string; warehouseId?: string }
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, itemId, warehouseId, page = 1, limit = 50 } = params;

  const where: any = { companyId };
  if (itemId) where.itemId = itemId;
  if (warehouseId) where.warehouseId = warehouseId;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  // 1. Calculate prior opening balances for items before 'from'
  const itemBalances = new Map<string, number>();
  if (from) {
    const priorWhere: any = {
      companyId,
      date: { lt: from },
    };
    if (itemId) priorWhere.itemId = itemId;
    if (warehouseId) priorWhere.warehouseId = warehouseId;

    const priorGrouped = await prisma.stockMovement.groupBy({
      by: ["itemId"],
      where: priorWhere,
      _sum: { qtyIn: true, qtyOut: true },
    });

    for (const pg of priorGrouped) {
      itemBalances.set(
        pg.itemId,
        roundTo2((pg._sum.qtyIn || 0) - (pg._sum.qtyOut || 0))
      );
    }
  }

  // 2. Accumulate movements from preceding pages so running balances remain continuous
  if (page > 1) {
    const prevMovements = await prisma.stockMovement.findMany({
      where,
      select: { itemId: true, qtyIn: true, qtyOut: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      take: (page - 1) * limit,
    });
    for (const pm of prevMovements) {
      const prev = itemBalances.get(pm.itemId) || 0;
      itemBalances.set(pm.itemId, roundTo2(prev + pm.qtyIn - pm.qtyOut));
    }
  }

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: { item: true, warehouse: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const data = movements.map((m) => {
    const prev = itemBalances.get(m.itemId) || 0;
    const current = roundTo2(prev + m.qtyIn - m.qtyOut);
    itemBalances.set(m.itemId, current);

    const effectiveUnitCost =
      m.unitCost > 0 ? m.unitCost : Number(m.item.purchasePrice || 0);

    const totalCost =
      m.totalCost > 0
        ? m.totalCost
        : roundTo2((m.qtyIn > 0 ? m.qtyIn : m.qtyOut) * effectiveUnitCost);

    return {
      id: m.id,
      date: m.date,
      itemName: m.item.name,
      sku: m.item.sku || "—",
      unit: m.item.unit,
      warehouseName: m.warehouse?.name || "Main Warehouse",
      movementType: m.movementType,
      referenceType: m.referenceType || "MANUAL",
      referenceId: m.referenceId || "—",
      qtyIn: m.qtyIn,
      qtyOut: m.qtyOut,
      unitCost: effectiveUnitCost,
      totalCost,
      runningBalance: current,
      notes: m.notes || "",
    };
  });

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * 3.6 Stock Adjustment Report (Wastage, Damage, Adjustments)
 */
export async function getStockAdjustmentReport(
  params: DateFilterParams & PaginationParams & { warehouseId?: string }
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, warehouseId, page = 1, limit = 50 } = params;

  const where: any = {
    companyId,
    movementType: { in: ["STOCK_ADJUSTMENT", "DAMAGE", "WASTAGE"] },
  };
  if (warehouseId) where.warehouseId = warehouseId;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: { item: true, warehouse: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const data = movements.map((m) => ({
    id: m.id,
    date: m.date,
    itemName: m.item.name,
    sku: m.item.sku || "—",
    unit: m.item.unit,
    warehouseName: m.warehouse?.name || "Default",
    type: m.movementType,
    qtyIn: m.qtyIn,
    qtyOut: m.qtyOut,
    unitCost: m.unitCost,
    totalValue: m.totalCost,
    notes: m.notes || "Stock Adjustment",
  }));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * 3.7 Stock Transfer Report (Inter-Warehouse Transfers)
 */
export async function getStockTransferReport(
  params: DateFilterParams & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50 } = params;

  const where: any = {
    companyId,
    movementType: { in: ["TRANSFER_IN", "TRANSFER_OUT"] },
  };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: { item: true, warehouse: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const data = movements.map((m) => ({
    id: m.id,
    date: m.date,
    itemName: m.item.name,
    sku: m.item.sku || "—",
    unit: m.item.unit,
    warehouseName: m.warehouse?.name || "Default",
    transferType: m.movementType,
    qty: m.qtyIn > 0 ? m.qtyIn : m.qtyOut,
    unitCost: m.unitCost,
    totalCost: m.totalCost,
    referenceId: m.referenceId || "—",
    notes: m.notes || "Stock Transfer",
  }));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * 3.8 Item Profitability Report (Sales, Cost of Goods, Gross Margin %)
 */
export async function getItemProfitabilityReport(
  params: DateFilterParams & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50 } = params;

  const invWhere: any = {
    companyId,
    type: "SALES",
    status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
  };
  if (from || to) {
    invWhere.date = {};
    if (from) invWhere.date.gte = from;
    if (to) invWhere.date.lte = to;
  }

  const lines = await prisma.invoiceLine.findMany({
    where: { invoice: invWhere },
    include: { item: true },
  });

  const itemMap = new Map<string, any>();

  for (const line of lines) {
    const key = line.itemId || line.name;
    const current = itemMap.get(key) || {
      itemId: line.itemId,
      name: line.name,
      sku: line.sku || line.item?.sku || "—",
      unit: line.unit || line.item?.unit || "PCS",
      qtySold: 0,
      revenue: 0,
      cogs: 0,
    };

    const costRate = Number(line.item?.purchasePrice || 0);
    const lineQty = Number(line.qty);
    const lineRevenue = Number(line.taxableAmount);
    const lineCogs = lineQty * costRate;

    current.qtySold += lineQty;
    current.revenue += lineRevenue;
    current.cogs += lineCogs;

    itemMap.set(key, current);
  }

  const aggregatedList = Array.from(itemMap.values())
    .map((item) => {
      const grossProfit = roundTo2(item.revenue - item.cogs);
      const marginPercent = item.revenue > 0 ? roundTo2((grossProfit / item.revenue) * 100) : 0;
      return {
        ...item,
        qtySold: roundTo2(item.qtySold),
        revenue: roundTo2(item.revenue),
        cogs: roundTo2(item.cogs),
        grossProfit,
        marginPercent,
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit);

  const total = aggregatedList.length;
  const skip = (page - 1) * limit;
  const data = aggregatedList.slice(skip, skip + limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary: {
      totalRevenue: roundTo2(aggregatedList.reduce((acc, i) => acc + i.revenue, 0)),
      totalCOGS: roundTo2(aggregatedList.reduce((acc, i) => acc + i.cogs, 0)),
      totalGrossProfit: roundTo2(aggregatedList.reduce((acc, i) => acc + i.grossProfit, 0)),
    },
  };
}

// ============================================================================
// 4. PARTY REPORTS (Customer & Supplier Balances, Aging, & Ledger)
// ============================================================================

/**
 * 4.1 Outstanding & Aging Analysis Report (Receivables or Payables)
 * Buckets: 0-30 days, 31-60 days, 61-90 days, 90+ days.
 */
export async function getPartyAgingReport(params: {
  companyId: string;
  type: "CUSTOMER" | "VENDOR";
  asOfDate?: Date;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<any>> {
  const { companyId, type, asOfDate = new Date(), page = 1, limit = 50 } = params;
  const isCustomer = type === "CUSTOMER";
  const invType = isCustomer ? "SALES" : "PURCHASE";

  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      type: invType,
      status: { notIn: ["PAID", "CANCELLED", "REVERSED", "DRAFT"] },
    },
    include: { party: true },
    orderBy: { date: "asc" },
  });

  const partyAgingMap = new Map<string, any>();

  for (const inv of unpaidInvoices) {
    const partyKey = inv.partyId || "UNREGISTERED";
    const partyName = inv.party?.name || (isCustomer ? "Cash Customer" : "Direct Vendor");
    const phone = inv.party?.phone || "—";
    const gstin = inv.party?.gstin || "—";

    const balance = Math.max(0, Number(inv.grandTotal) - Number(inv.paidAmount));
    if (balance <= 0) continue;

    const invoiceDate = new Date(inv.date);
    const diffTime = Math.abs(asOfDate.getTime() - invoiceDate.getTime());
    const daysOld = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const current = partyAgingMap.get(partyKey) || {
      partyId: inv.partyId,
      partyName,
      phone,
      gstin,
      totalOutstanding: 0,
      days0To30: 0,
      days31To60: 0,
      days61To90: 0,
      days90Plus: 0,
      oldestInvoiceDays: 0,
      overdueCount: 0,
    };

    current.totalOutstanding += balance;
    if (daysOld > current.oldestInvoiceDays) current.oldestInvoiceDays = daysOld;

    if (daysOld <= 30) current.days0To30 += balance;
    else if (daysOld <= 60) current.days31To60 += balance;
    else if (daysOld <= 90) current.days61To90 += balance;
    else current.days90Plus += balance;

    if (inv.dueDate && new Date(inv.dueDate) < asOfDate) {
      current.overdueCount += 1;
    }

    partyAgingMap.set(partyKey, current);
  }

  const list = Array.from(partyAgingMap.values())
    .map((p) => ({
      ...p,
      totalOutstanding: roundTo2(p.totalOutstanding),
      days0To30: roundTo2(p.days0To30),
      days31To60: roundTo2(p.days31To60),
      days61To90: roundTo2(p.days61To90),
      days90Plus: roundTo2(p.days90Plus),
    }))
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

  const total = list.length;
  const skip = (page - 1) * limit;
  const data = list.slice(skip, skip + limit);

  const summary = {
    totalOutstanding: roundTo2(list.reduce((acc, p) => acc + p.totalOutstanding, 0)),
    total0To30: roundTo2(list.reduce((acc, p) => acc + p.days0To30, 0)),
    total31To60: roundTo2(list.reduce((acc, p) => acc + p.days31To60, 0)),
    total61To90: roundTo2(list.reduce((acc, p) => acc + p.days61To90, 0)),
    total90Plus: roundTo2(list.reduce((acc, p) => acc + p.days90Plus, 0)),
  };

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary,
  };
}

/**
 * 4.2 Overdue Invoices Report (Customer or Vendor past due date)
 */
export async function getPartyOverdueReport(params: {
  companyId: string;
  type: "CUSTOMER" | "VENDOR";
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<any>> {
  const { companyId, type, page = 1, limit = 50 } = params;
  const isCustomer = type === "CUSTOMER";
  const invType = isCustomer ? "SALES" : "PURCHASE";
  const now = new Date();

  const where: any = {
    companyId,
    type: invType,
    status: { notIn: ["PAID", "CANCELLED", "REVERSED", "DRAFT"] },
    dueDate: { lt: now },
  };

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { party: true },
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const data = invoices.map((inv) => {
    const totalAmount = Number(inv.grandTotal);
    const paidAmount = Number(inv.paidAmount);
    const balanceDue = roundTo2(Math.max(0, totalAmount - paidAmount));
    const dueTime = inv.dueDate ? new Date(inv.dueDate).getTime() : new Date(inv.date).getTime();
    const overdueDays = Math.max(0, Math.floor((now.getTime() - dueTime) / (1000 * 60 * 60 * 24)));

    return {
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      date: inv.date,
      dueDate: inv.dueDate,
      partyName: inv.party?.name || (isCustomer ? "Direct Customer" : "Direct Vendor"),
      phone: inv.party?.phone || "—",
      gstin: inv.party?.gstin || "—",
      grandTotal: totalAmount,
      paidAmount,
      balanceDue,
      overdueDays,
      status: inv.status,
    };
  });

  const allOverdue = await prisma.invoice.findMany({
    where,
    select: { grandTotal: true, paidAmount: true },
  });
  const totalOverdueAmount = roundTo2(
    allOverdue.reduce((acc, i) => acc + Math.max(0, Number(i.grandTotal) - Number(i.paidAmount)), 0)
  );

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary: { totalOverdueAmount },
  };
}

/**
 * 4.3 Party Payment History (Receipts & Payments Log)
 */
export async function getPartyPaymentHistoryReport(
  params: DateFilterParams & PaginationParams & { partyId?: string; type?: "RECEIPT" | "PAYMENT" }
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, partyId, type, page = 1, limit = 50 } = params;

  const where: any = { companyId };
  if (partyId) where.partyId = partyId;
  if (type) where.type = type;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: {
        party: true,
        allocations: { include: { invoice: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const data = payments.map((p) => ({
    id: p.id,
    paymentNo: p.paymentNo,
    date: p.date,
    type: p.type,
    partyName: p.party?.name || "Direct Party",
    phone: p.party?.phone || "—",
    paymentMode: p.mode,
    amount: Number(p.amount),
    invoiceNo:
      p.allocations
        .map((a) => a.invoice?.invoiceNo)
        .filter(Boolean)
        .join(", ") || "—",
    reference: p.reference || "—",
    status: p.status,
  }));

  const allPayments = await prisma.payment.findMany({ where, select: { amount: true } });
  const totalAmount = roundTo2(allPayments.reduce((acc, p) => acc + Number(p.amount), 0));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    summary: { totalAmount },
  };
}

/**
 * 4.4 Supplier Purchase History (Purchases per supplier)
 */
export async function getSupplierPurchaseHistoryReport(
  params: DateFilterParams & PaginationParams & { supplierId?: string }
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, supplierId, page = 1, limit = 50 } = params;

  const where: any = {
    companyId,
    type: "PURCHASE",
    status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
  };
  if (supplierId) where.partyId = supplierId;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const [total, bills] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { party: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const data = bills.map((b) => ({
    id: b.id,
    date: b.date,
    billNo: b.invoiceNo,
    supplierInvoiceNo: b.supplierInvoiceNo || "—",
    supplierName: b.party?.name || "Direct Vendor",
    taxableAmount: Number(b.subTotal),
    taxAmount: Number(b.cgstTotal) + Number(b.sgstTotal) + Number(b.igstTotal),
    grandTotal: Number(b.grandTotal),
    paidAmount: Number(b.paidAmount),
    balanceDue: roundTo2(Math.max(0, Number(b.grandTotal) - Number(b.paidAmount))),
    status: b.status,
  }));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

// ============================================================================
// 5. ACCOUNTING: JOURNAL REGISTER
// ============================================================================

/**
 * 5.1 Journal Register Report
 * All journal adjusting vouchers with line-by-line debits and credits.
 */
export async function getJournalRegisterReport(
  params: DateFilterParams & PaginationParams
): Promise<PaginatedResult<any>> {
  const { companyId, from, to, page = 1, limit = 50 } = params;

  const where: any = {
    companyId,
    type: "JOURNAL",
  };

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const [total, vouchers] = await Promise.all([
    prisma.voucher.count({ where }),
    prisma.voucher.findMany({
      where,
      include: {
        entries: { include: { account: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const data = vouchers.map((v) => {
    const totalDr = v.entries.reduce((acc, e) => acc + Number(e.debit), 0);
    const totalCr = v.entries.reduce((acc, e) => acc + Number(e.credit), 0);
    return {
      id: v.id,
      voucherNo: v.voucherNo,
      date: v.date,
      narration: v.narration || "Journal Voucher",
      isBalanced: Math.abs(totalDr - totalCr) < 0.05,
      totalAmount: roundTo2(totalDr),
      entries: v.entries.map((e) => ({
        id: e.id,
        accountCode: e.account.code,
        accountName: e.account.name,
        accountType: e.account.type,
        debit: Number(e.debit),
        credit: Number(e.credit),
      })),
    };
  });

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

// ============================================================================
// 6. DASHBOARD MULTI-BUSINESS SUMMARY ENGINE
// ============================================================================

export interface DashboardSummaryData {
  periodLabel: string;
  from: Date;
  to: Date;
  // Core Period Metrics
  periodSales: number;
  periodPurchases: number;
  periodExpenses: number;
  periodCOGS: number;
  periodGrossProfit: number;
  // Point-in-Time Balances (Labeled clearly as As-Of-Date)
  asOfDateReceivables: number;
  asOfDatePayables: number;
  asOfDateStockValue: number;
  // Business Specific Sections
  businessType: string;
  retail: {
    todaySales: number;
    currentStockUnits: number;
    lowStockItemCount: number;
    topProducts: { name: string; qty: number; revenue: number }[];
  };
  service: {
    periodRevenue: number;
    currentOutstanding: number;
    periodExpenses: number;
    topClients: { name: string; amount: number }[];
  };
  distributor: {
    periodSales: number;
    periodPurchases: number;
    warehouseStock: { name: string; units: number; value: number }[];
    periodCollections: number;
    currentOutstanding: number;
  };
}

/**
 * 6.1 Unified Dashboard Data Aggregator
 * Respects date range filter, separates period metrics from point-in-time metrics,
 * and provisions business-type specific views (Retail, Service, Distributor).
 */
export async function getDashboardAnalytics(params: {
  companyId: string;
  from: Date;
  to: Date;
  periodLabel: string;
}): Promise<DashboardSummaryData> {
  const { companyId, from, to, periodLabel } = params;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // 1. Fetch Company Business Type
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { businessType: true },
  });
  const businessType = company?.businessType || "Retail";

  // 2. Fetch Period Sales
  const periodSalesAgg = await prisma.invoice.aggregate({
    where: {
      companyId,
      type: "SALES",
      status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
      date: { gte: from, lte: to },
    },
    _sum: { subTotal: true, grandTotal: true },
  });
  const periodSales = Number(periodSalesAgg._sum.grandTotal || 0);

  // 3. Fetch Period Purchases
  const periodPurAgg = await prisma.invoice.aggregate({
    where: {
      companyId,
      type: "PURCHASE",
      status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
      date: { gte: from, lte: to },
    },
    _sum: { grandTotal: true },
  });
  const periodPurchases = Number(periodPurAgg._sum.grandTotal || 0);

  // 4. Fetch Period Expenses
  const periodExpAgg = await prisma.expense.aggregate({
    where: {
      companyId,
      expenseDate: { gte: from, lte: to },
    },
    _sum: { amount: true },
  });
  const periodExpenses = Number(periodExpAgg._sum.amount || 0);

  // 5. Fetch COGS for Period from Accounting Ledger (COGS account 5400)
  const cogsEntries = await prisma.voucherEntry.findMany({
    where: {
      voucher: {
        companyId,
        date: { gte: from, lte: to },
        isReversed: false,
      },
      account: { code: "5400" },
    },
    select: { debit: true, credit: true },
  });
  const periodCOGS = roundTo2(
    cogsEntries.reduce((acc, e) => acc + Number(e.debit) - Number(e.credit), 0)
  );

  const periodGrossProfit = roundTo2(
    Number(periodSalesAgg._sum.subTotal || 0) - periodCOGS
  );

  // 6. Point-in-Time: Total Outstanding Receivables (All-time unpaid)
  const unpaidSales = await prisma.invoice.findMany({
    where: {
      companyId,
      type: "SALES",
      status: { notIn: ["PAID", "CANCELLED", "REVERSED", "DRAFT"] },
    },
    select: { grandTotal: true, paidAmount: true },
  });
  const asOfDateReceivables = roundTo2(
    unpaidSales.reduce((acc, inv) => acc + Math.max(0, Number(inv.grandTotal) - Number(inv.paidAmount)), 0)
  );

  // 7. Point-in-Time: Total Outstanding Payables (All-time unpaid)
  const unpaidPurchases = await prisma.invoice.findMany({
    where: {
      companyId,
      type: "PURCHASE",
      status: { notIn: ["PAID", "CANCELLED", "REVERSED", "DRAFT"] },
    },
    select: { grandTotal: true, paidAmount: true },
  });
  const asOfDatePayables = roundTo2(
    unpaidPurchases.reduce((acc, inv) => acc + Math.max(0, Number(inv.grandTotal) - Number(inv.paidAmount)), 0)
  );

  // 8. Point-in-Time: Inventory Valuation (All items)
  const activeItems = await prisma.item.findMany({
    where: { companyId, active: true, type: "PRODUCT" },
    select: { stock: true, purchasePrice: true, minStock: true, reorderLevel: true, name: true, id: true },
  });
  const asOfDateStockValue = roundTo2(
    activeItems.reduce((acc, i) => acc + Math.max(0, Number(i.stock)) * Number(i.purchasePrice || 0), 0)
  );
  const currentStockUnits = activeItems.reduce((acc, i) => acc + Math.max(0, Number(i.stock)), 0);
  const lowStockItemCount = activeItems.filter(
    (i) => Number(i.stock) <= Number(i.reorderLevel || i.minStock || 0)
  ).length;

  // 9. Retail Specific Metrics
  const todaySalesAgg = await prisma.invoice.aggregate({
    where: {
      companyId,
      type: "SALES",
      status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
      date: { gte: todayStart, lte: todayEnd },
    },
    _sum: { grandTotal: true },
  });
  const todaySales = Number(todaySalesAgg._sum.grandTotal || 0);

  const topLines = await prisma.invoiceLine.findMany({
    where: {
      invoice: {
        companyId,
        type: "SALES",
        date: { gte: from, lte: to },
        status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
      },
    },
    select: { name: true, qty: true, taxableAmount: true },
  });
  const topProductMap = new Map<string, { qty: number; revenue: number }>();
  for (const l of topLines) {
    const curr = topProductMap.get(l.name) || { qty: 0, revenue: 0 };
    curr.qty += Number(l.qty);
    curr.revenue += Number(l.taxableAmount);
    topProductMap.set(l.name, curr);
  }
  const topProducts = Array.from(topProductMap.entries())
    .map(([name, vals]) => ({ name, qty: vals.qty, revenue: roundTo2(vals.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // 10. Service Specific Metrics (Top Clients)
  const clientInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      type: "SALES",
      date: { gte: from, lte: to },
      status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
      partyId: { not: null },
    },
    include: { party: true },
  });
  const clientMap = new Map<string, number>();
  for (const inv of clientInvoices) {
    if (!inv.party) continue;
    clientMap.set(inv.party.name, (clientMap.get(inv.party.name) || 0) + Number(inv.grandTotal));
  }
  const topClients = Array.from(clientMap.entries())
    .map(([name, amount]) => ({ name, amount: roundTo2(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // 11. Distributor Specific Metrics (Warehouse Stock & Collections)
  const warehouses = await prisma.warehouse.findMany({
    where: { companyId, active: true },
    include: { warehouseStocks: { include: { item: true } } },
  });
  const warehouseStock = warehouses.map((wh) => {
    let units = 0;
    let value = 0;
    for (const ws of wh.warehouseStocks) {
      const q = ws.quantity;
      units += q;
      value += q * Number(ws.item.purchasePrice || 0);
    }
    return { name: wh.name, units: roundTo2(units), value: roundTo2(value) };
  });

  const periodReceiptsAgg = await prisma.payment.aggregate({
    where: {
      companyId,
      type: "RECEIPT",
      status: "COMPLETED",
      date: { gte: from, lte: to },
    },
    _sum: { amount: true },
  });
  const periodCollections = Number(periodReceiptsAgg._sum.amount || 0);

  return {
    periodLabel,
    from,
    to,
    periodSales: roundTo2(periodSales),
    periodPurchases: roundTo2(periodPurchases),
    periodExpenses: roundTo2(periodExpenses),
    periodCOGS,
    periodGrossProfit,
    asOfDateReceivables,
    asOfDatePayables,
    asOfDateStockValue,
    businessType,
    retail: {
      todaySales: roundTo2(todaySales),
      currentStockUnits: roundTo2(currentStockUnits),
      lowStockItemCount,
      topProducts,
    },
    service: {
      periodRevenue: roundTo2(periodSales),
      currentOutstanding: asOfDateReceivables,
      periodExpenses: roundTo2(periodExpenses),
      topClients,
    },
    distributor: {
      periodSales: roundTo2(periodSales),
      periodPurchases: roundTo2(periodPurchases),
      warehouseStock,
      periodCollections: roundTo2(periodCollections),
      currentOutstanding: asOfDateReceivables,
    },
  };
}
