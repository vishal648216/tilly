// Taily - Phase 7: Notifications & Proactive Operational Alerts Engine
// Real-time detection of low stock, overdue receivables, supplier dues, and system events.

import { prisma } from "./prisma";

export interface SystemNotification {
  id: string;
  type:
    | "LOW_STOCK"
    | "INVOICE_OVERDUE"
    | "PAYMENT_DUE"
    | "SUPPLIER_PAYMENT_DUE"
    | "SUBSCRIPTION_EXPIRING"
    | "IMPORT_FAILED"
    | "BACKUP_FAILED"
    | "SYSTEM";
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

/**
 * Returns all active operational alerts and stored notifications for a company.
 * Scans database proactively for critical financial and inventory thresholds.
 */
export async function getCompanyNotifications(companyId: string): Promise<{
  unreadCount: number;
  notifications: SystemNotification[];
}> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const threeDaysAhead = new Date(today);
  threeDaysAhead.setDate(today.getDate() + 3);

  // 1. Fetch persistent stored notifications from DB
  const storedNotifications = await prisma.notification.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const alerts: SystemNotification[] = storedNotifications.map((n) => ({
    id: n.id,
    type: n.type as any,
    title: n.title,
    message: n.message,
    severity: n.severity as any,
    link: n.link || undefined,
    isRead: n.isRead,
    createdAt: n.createdAt,
  }));

  // 2. Proactive Alert: Low Stock Detection
  const lowStockItems = await prisma.item.findMany({
    where: { companyId, active: true, type: "PRODUCT" },
    select: { id: true, name: true, stock: true, minStock: true, reorderLevel: true, unit: true },
  });

  const deficitItems = lowStockItems.filter((i) => {
    const threshold = Number(i.reorderLevel || i.minStock || 0);
    return threshold > 0 && Number(i.stock) <= threshold;
  });

  if (deficitItems.length > 0) {
    alerts.push({
      id: "dyn-low-stock",
      type: "LOW_STOCK",
      title: `${deficitItems.length} Products Low in Stock`,
      message: `Critical inventory reorder level reached for: ${deficitItems
        .slice(0, 3)
        .map((i) => `${i.name} (${i.stock} ${i.unit})`)
        .join(", ")}${deficitItems.length > 3 ? ` and ${deficitItems.length - 3} more` : ""}.`,
      severity: "WARNING",
      link: "/items",
      isRead: false,
      createdAt: now,
    });
  }

  // 3. Proactive Alert: Overdue Customer Invoices
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      type: "SALES",
      status: { notIn: ["PAID", "CANCELLED", "REVERSED", "DRAFT"] },
      dueDate: { lt: today },
    },
    include: { party: true },
    take: 5,
  });

  if (overdueInvoices.length > 0) {
    const totalOverdue = overdueInvoices.reduce(
      (acc, inv) => acc + (Number(inv.grandTotal) - Number(inv.paidAmount)),
      0
    );
    alerts.push({
      id: "dyn-overdue-sales",
      type: "INVOICE_OVERDUE",
      title: `${overdueInvoices.length} Invoices Overdue for Collection`,
      message: `Total overdue: ₹${totalOverdue.toLocaleString("en-IN")}. Recent: ${
        overdueInvoices[0].party?.name || "Customer"
      } (${overdueInvoices[0].invoiceNo}).`,
      severity: "ERROR",
      link: "/invoices",
      isRead: false,
      createdAt: now,
    });
  }

  // 4. Proactive Alert: Customer Payments Due in Next 3 Days
  const upcomingInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      type: "SALES",
      status: { notIn: ["PAID", "CANCELLED", "REVERSED", "DRAFT"] },
      dueDate: { gte: today, lte: threeDaysAhead },
    },
    include: { party: true },
    take: 3,
  });

  if (upcomingInvoices.length > 0) {
    alerts.push({
      id: "dyn-payment-due",
      type: "PAYMENT_DUE",
      title: `${upcomingInvoices.length} Customer Payments Due Soon`,
      message: `Due within 3 days: ${upcomingInvoices.map((i) => i.invoiceNo).join(", ")}.`,
      severity: "INFO",
      link: "/invoices",
      isRead: false,
      createdAt: now,
    });
  }

  // 5. Proactive Alert: Supplier Payments Due / Overdue
  const overdueBills = await prisma.invoice.findMany({
    where: {
      companyId,
      type: "PURCHASE",
      status: { notIn: ["PAID", "CANCELLED", "REVERSED", "DRAFT"] },
      dueDate: { lt: today },
    },
    include: { party: true },
    take: 5,
  });

  if (overdueBills.length > 0) {
    alerts.push({
      id: "dyn-supplier-due",
      type: "SUPPLIER_PAYMENT_DUE",
      title: `${overdueBills.length} Supplier Bills Pending Payment`,
      message: `Supplier payment due for ${overdueBills[0].party?.name || "Vendor"} (${
        overdueBills[0].invoiceNo
      }).`,
      severity: "WARNING",
      link: "/purchases",
      isRead: false,
      createdAt: now,
    });
  }

  // Sort by severity (ERROR -> WARNING -> INFO) and date
  const severityScore = { ERROR: 3, WARNING: 2, INFO: 1, SUCCESS: 0 };
  alerts.sort((a, b) => severityScore[b.severity] - severityScore[a.severity]);

  const unreadCount = alerts.filter((n) => !n.isRead).length;

  return {
    unreadCount,
    notifications: alerts,
  };
}

/**
 * Creates a persistent notification in the database (e.g. Backup Failed, Import Failed, System).
 */
export async function createSystemNotification(params: {
  companyId: string;
  type: SystemNotification["type"];
  title: string;
  message: string;
  severity?: SystemNotification["severity"];
  link?: string;
  metadata?: any;
}) {
  const { companyId, type, title, message, severity = "INFO", link, metadata } = params;

  return await prisma.notification.create({
    data: {
      companyId,
      type,
      title,
      message,
      severity,
      link,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

/**
 * Marks a notification as read.
 */
export async function markNotificationAsRead(id: string, companyId: string) {
  if (id.startsWith("dyn-")) {
    return { ok: true, dynamic: true };
  }
  return await prisma.notification.updateMany({
    where: { id, companyId },
    data: { isRead: true },
  });
}

/**
 * Marks all notifications as read for a company.
 */
export async function markAllNotificationsAsRead(companyId: string) {
  return await prisma.notification.updateMany({
    where: { companyId },
    data: { isRead: true },
  });
}
