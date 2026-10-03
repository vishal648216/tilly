import { prisma } from "@/lib/prisma";
import { roundTo2 } from "@/lib/currency";

export interface OutstandingPartySummary {
  partyId: string;
  name: string;
  phone?: string | null;
  gstin?: string | null;
  type: string;
  creditLimit: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  overdueAmount: number;
  invoiceCount: number;
}

export interface AgingBuckets {
  current: number; // 0-30 days
  days31to60: number; // 31-60 days
  days61to90: number; // 61-90 days
  days90Plus: number; // >90 days
  total: number;
}

export interface OutstandingReport {
  summary: {
    totalReceivable: number;
    totalPayable: number;
    totalSalesPaid: number;
    totalPurchasePaid: number;
    totalOverdueReceivable: number;
    totalOverduePayable: number;
  };
  receivableAging: AgingBuckets;
  payableAging: AgingBuckets;
  customers: OutstandingPartySummary[];
  suppliers: OutstandingPartySummary[];
}

/**
 * Authoritative financial outstanding & aging engine.
 * Computes live receivables, payables, party-level ledgers, and 30-day aging buckets.
 */
export async function getOutstandingReport(companyId: string): Promise<OutstandingReport> {
  const now = new Date();

  // Fetch all active, non-cancelled invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
    },
    include: {
      party: true,
    },
    orderBy: { date: "asc" },
  });

  let totalReceivable = 0;
  let totalPayable = 0;
  let totalSalesPaid = 0;
  let totalPurchasePaid = 0;
  let totalOverdueReceivable = 0;
  let totalOverduePayable = 0;

  const receivableAging: AgingBuckets = { current: 0, days31to60: 0, days61to90: 0, days90Plus: 0, total: 0 };
  const payableAging: AgingBuckets = { current: 0, days31to60: 0, days61to90: 0, days90Plus: 0, total: 0 };

  const customerMap = new Map<string, OutstandingPartySummary>();
  const supplierMap = new Map<string, OutstandingPartySummary>();

  for (const inv of invoices) {
    const grandTotal = Number(inv.grandTotal);
    const paidAmount = Number(inv.paidAmount);
    const pendingBalance = Math.max(0, roundTo2(grandTotal - paidAmount));
    const isSales = inv.type === "SALES";
    const isPurchase = inv.type === "PURCHASE";

    if (!isSales && !isPurchase) continue;

    // Calculate days elapsed / aging
    const invoiceDate = new Date(inv.date);
    const dueDate = inv.dueDate ? new Date(inv.dueDate) : invoiceDate;
    const daysOld = Math.max(0, Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)));
    const isOverdue = pendingBalance > 0.01 && now.getTime() > dueDate.getTime();

    if (isSales) {
      totalReceivable = roundTo2(totalReceivable + pendingBalance);
      totalSalesPaid = roundTo2(totalSalesPaid + paidAmount);
      if (isOverdue) totalOverdueReceivable = roundTo2(totalOverdueReceivable + pendingBalance);

      if (pendingBalance > 0) {
        receivableAging.total = roundTo2(receivableAging.total + pendingBalance);
        if (daysOld <= 30) receivableAging.current = roundTo2(receivableAging.current + pendingBalance);
        else if (daysOld <= 60) receivableAging.days31to60 = roundTo2(receivableAging.days31to60 + pendingBalance);
        else if (daysOld <= 90) receivableAging.days61to90 = roundTo2(receivableAging.days61to90 + pendingBalance);
        else receivableAging.days90Plus = roundTo2(receivableAging.days90Plus + pendingBalance);
      }

      if (inv.partyId && inv.party) {
        const existing = customerMap.get(inv.partyId) || {
          partyId: inv.partyId,
          name: inv.party.name,
          phone: inv.party.phone,
          gstin: inv.party.gstin,
          type: inv.party.type,
          creditLimit: Number(inv.party.creditLimit || 0),
          totalAmount: 0,
          paidAmount: 0,
          balance: 0,
          overdueAmount: 0,
          invoiceCount: 0,
        };

        existing.totalAmount = roundTo2(existing.totalAmount + grandTotal);
        existing.paidAmount = roundTo2(existing.paidAmount + paidAmount);
        existing.balance = roundTo2(existing.balance + pendingBalance);
        if (isOverdue) existing.overdueAmount = roundTo2(existing.overdueAmount + pendingBalance);
        existing.invoiceCount += 1;
        customerMap.set(inv.partyId, existing);
      }
    } else if (isPurchase) {
      totalPayable = roundTo2(totalPayable + pendingBalance);
      totalPurchasePaid = roundTo2(totalPurchasePaid + paidAmount);
      if (isOverdue) totalOverduePayable = roundTo2(totalOverduePayable + pendingBalance);

      if (pendingBalance > 0) {
        payableAging.total = roundTo2(payableAging.total + pendingBalance);
        if (daysOld <= 30) payableAging.current = roundTo2(payableAging.current + pendingBalance);
        else if (daysOld <= 60) payableAging.days31to60 = roundTo2(payableAging.days31to60 + pendingBalance);
        else if (daysOld <= 90) payableAging.days61to90 = roundTo2(payableAging.days61to90 + pendingBalance);
        else payableAging.days90Plus = roundTo2(payableAging.days90Plus + pendingBalance);
      }

      if (inv.partyId && inv.party) {
        const existing = supplierMap.get(inv.partyId) || {
          partyId: inv.partyId,
          name: inv.party.name,
          phone: inv.party.phone,
          gstin: inv.party.gstin,
          type: inv.party.type,
          creditLimit: Number(inv.party.creditLimit || 0),
          totalAmount: 0,
          paidAmount: 0,
          balance: 0,
          overdueAmount: 0,
          invoiceCount: 0,
        };

        existing.totalAmount = roundTo2(existing.totalAmount + grandTotal);
        existing.paidAmount = roundTo2(existing.paidAmount + paidAmount);
        existing.balance = roundTo2(existing.balance + pendingBalance);
        if (isOverdue) existing.overdueAmount = roundTo2(existing.overdueAmount + pendingBalance);
        existing.invoiceCount += 1;
        supplierMap.set(inv.partyId, existing);
      }
    }
  }

  return {
    summary: {
      totalReceivable,
      totalPayable,
      totalSalesPaid,
      totalPurchasePaid,
      totalOverdueReceivable,
      totalOverduePayable,
    },
    receivableAging,
    payableAging,
    customers: Array.from(customerMap.values()).sort((a, b) => b.balance - a.balance),
    suppliers: Array.from(supplierMap.values()).sort((a, b) => b.balance - a.balance),
  };
}

/**
 * Calculates current outstanding balance for a specific party.
 */
export async function getPartyOutstanding(
  companyId: string,
  partyId: string,
  type: "SALES" | "PURCHASE" = "SALES"
): Promise<{ totalInvoiced: number; totalPaid: number; balance: number; overdue: number }> {
  const now = new Date();
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      partyId,
      type,
      status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
    },
  });

  let totalInvoiced = 0;
  let totalPaid = 0;
  let balance = 0;
  let overdue = 0;

  for (const inv of invoices) {
    const grand = Number(inv.grandTotal);
    const paid = Number(inv.paidAmount);
    const pending = Math.max(0, roundTo2(grand - paid));
    const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);

    totalInvoiced = roundTo2(totalInvoiced + grand);
    totalPaid = roundTo2(totalPaid + paid);
    balance = roundTo2(balance + pending);

    if (pending > 0.01 && now.getTime() > dueDate.getTime()) {
      overdue = roundTo2(overdue + pending);
    }
  }

  return { totalInvoiced, totalPaid, balance, overdue };
}
