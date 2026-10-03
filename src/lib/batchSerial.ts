import { prisma } from "./prisma";

export interface BatchInput {
  companyId: string;
  itemId: string;
  batchNumber: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  mrp?: number;
  cost?: number;
  quantity: number;
}

export interface SerialInput {
  companyId: string;
  itemId: string;
  serialNumber: string;
  purchaseInvoiceId?: string;
  purchaseReference?: string;
  warranty?: string;
}

export interface ExpiryReportSummary {
  expiredCount: number;
  expiringSoonCount: number;
  expiredStockValue: number;
  expiringSoonStockValue: number;
  expiredBatches: any[];
  expiringSoonBatches: any[];
}

/**
 * Creates or updates an inventory batch record with stock tracking.
 */
export async function createOrUpdateBatch(input: BatchInput) {
  const existing = await prisma.batch.findUnique({
    where: {
      companyId_itemId_batchNumber: {
        companyId: input.companyId,
        itemId: input.itemId,
        batchNumber: input.batchNumber.trim(),
      },
    },
  });

  if (existing) {
    return prisma.batch.update({
      where: { id: existing.id },
      data: {
        quantity: { increment: input.quantity },
        mrp: input.mrp !== undefined ? input.mrp : existing.mrp,
        cost: input.cost !== undefined ? input.cost : existing.cost,
        expiryDate: input.expiryDate || existing.expiryDate,
        manufacturingDate: input.manufacturingDate || existing.manufacturingDate,
      },
    });
  }

  return prisma.batch.create({
    data: {
      companyId: input.companyId,
      itemId: input.itemId,
      batchNumber: input.batchNumber.trim(),
      manufacturingDate: input.manufacturingDate,
      expiryDate: input.expiryDate,
      mrp: input.mrp,
      cost: input.cost,
      quantity: input.quantity,
    },
  });
}

/**
 * Deducts batch-specific stock upon sale with availability validation.
 */
export async function deductBatchStock(
  companyId: string,
  itemId: string,
  batchNumber: string,
  quantityToDeduct: number,
  allowNegative = false
) {
  const batch = await prisma.batch.findUnique({
    where: {
      companyId_itemId_batchNumber: {
        companyId,
        itemId,
        batchNumber: batchNumber.trim(),
      },
    },
  });

  if (!batch) {
    throw new Error(`Batch '${batchNumber}' does not exist for this item.`);
  }

  if (!allowNegative && batch.quantity < quantityToDeduct) {
    throw new Error(
      `Insufficient batch stock. Batch '${batchNumber}' has ${batch.quantity} available, but ${quantityToDeduct} was requested.`
    );
  }

  return prisma.batch.update({
    where: { id: batch.id },
    data: {
      quantity: { decrement: quantityToDeduct },
    },
  });
}

/**
 * Retrieves all batches for an item sorted by FEFO (First Expiring, First Out).
 */
export async function getBatchesForItem(companyId: string, itemId: string) {
  return prisma.batch.findMany({
    where: {
      companyId,
      itemId,
      quantity: { gt: 0 },
    },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Registers new serial numbers with strict duplicate prevention.
 */
export async function registerSerialNumbers(inputs: SerialInput[]) {
  const results = [];

  for (const input of inputs) {
    const cleanSerial = input.serialNumber.trim();

    // Check for existing duplicate serial for this company and item
    const existing = await prisma.serialNumber.findUnique({
      where: {
        companyId_itemId_serialNumber: {
          companyId: input.companyId,
          itemId: input.itemId,
          serialNumber: cleanSerial,
        },
      },
    });

    if (existing) {
      throw new Error(
        `Duplicate Serial Number: '${cleanSerial}' already exists for this item (Status: ${existing.status}).`
      );
    }

    const created = await prisma.serialNumber.create({
      data: {
        companyId: input.companyId,
        itemId: input.itemId,
        serialNumber: cleanSerial,
        purchaseInvoiceId: input.purchaseInvoiceId,
        purchaseReference: input.purchaseReference,
        warranty: input.warranty,
        status: "AVAILABLE",
      },
    });
    results.push(created);
  }

  return results;
}

/**
 * Assigns serial numbers to a sale invoice.
 * Validates that each serial is currently AVAILABLE.
 */
export async function assignSerialsToSale(
  companyId: string,
  itemId: string,
  serialNumbers: string[],
  saleInvoiceId: string,
  saleReference?: string
) {
  const updated = [];

  for (const sNum of serialNumbers) {
    const clean = sNum.trim();
    const serial = await prisma.serialNumber.findUnique({
      where: {
        companyId_itemId_serialNumber: {
          companyId,
          itemId,
          serialNumber: clean,
        },
      },
    });

    if (!serial) {
      throw new Error(`Serial Number '${clean}' was not found in registered inventory.`);
    }

    if (serial.status !== "AVAILABLE") {
      throw new Error(
        `Serial Number '${clean}' cannot be sold. Current status is '${serial.status}'.`
      );
    }

    const record = await prisma.serialNumber.update({
      where: { id: serial.id },
      data: {
        status: "SOLD",
        saleInvoiceId,
        saleReference: saleReference || saleInvoiceId,
      },
    });
    updated.push(record);
  }

  return updated;
}

/**
 * Comprehensive Expiry Report: Identifies Expired vs Expiring Soon batches.
 */
export async function getBatchExpiryReport(
  companyId: string,
  daysThreshold = 30
): Promise<ExpiryReportSummary> {
  const now = new Date();
  const futureThreshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

  const batches = await prisma.batch.findMany({
    where: {
      companyId,
      quantity: { gt: 0 },
      expiryDate: { not: null },
    },
    include: {
      item: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          purchasePrice: true,
        },
      },
    },
    orderBy: { expiryDate: "asc" },
  });

  const expiredBatches: any[] = [];
  const expiringSoonBatches: any[] = [];
  let expiredStockValue = 0;
  let expiringSoonStockValue = 0;

  for (const b of batches) {
    const expDate = b.expiryDate!;
    const unitCost = Number(b.cost ?? b.item.purchasePrice ?? 0);
    const stockVal = b.quantity * unitCost;

    if (expDate < now) {
      expiredBatches.push({
        ...b,
        status: "EXPIRED",
        stockValue: stockVal,
        daysOverdue: Math.floor((now.getTime() - expDate.getTime()) / (1000 * 3600 * 24)),
      });
      expiredStockValue += stockVal;
    } else if (expDate <= futureThreshold) {
      expiringSoonBatches.push({
        ...b,
        status: "EXPIRING_SOON",
        stockValue: stockVal,
        daysRemaining: Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24)),
      });
      expiringSoonStockValue += stockVal;
    }
  }

  return {
    expiredCount: expiredBatches.length,
    expiringSoonCount: expiringSoonBatches.length,
    expiredStockValue: Math.round(expiredStockValue * 100) / 100,
    expiringSoonStockValue: Math.round(expiringSoonStockValue * 100) / 100,
    expiredBatches,
    expiringSoonBatches,
  };
}

/**
 * Generates automated notifications for batches expiring soon or expired.
 */
export async function triggerExpiryNotifications(companyId: string, daysThreshold = 30) {
  const report = await getBatchExpiryReport(companyId, daysThreshold);

  if (report.expiredCount > 0) {
    await prisma.notification.create({
      data: {
        companyId,
        type: "LOW_STOCK",
        title: `⚠️ ${report.expiredCount} Batch(es) Have Expired`,
        message: `Inventory contains ${report.expiredCount} expired batches valued at ₹${report.expiredStockValue.toLocaleString("en-IN")}. Action required to quarantine or write off stock.`,
        severity: "ERROR",
        link: "/inventory/batches",
        metadata: JSON.stringify({ expiredCount: report.expiredCount, value: report.expiredStockValue }),
      },
    });
  }

  if (report.expiringSoonCount > 0) {
    await prisma.notification.create({
      data: {
        companyId,
        type: "LOW_STOCK",
        title: `⏰ ${report.expiringSoonCount} Batch(es) Expiring in Next ${daysThreshold} Days`,
        message: `${report.expiringSoonCount} batches valued at ₹${report.expiringSoonStockValue.toLocaleString("en-IN")} will expire soon. Prioritize FEFO sales.`,
        severity: "WARNING",
        link: "/inventory/batches",
        metadata: JSON.stringify({ expiringSoonCount: report.expiringSoonCount, value: report.expiringSoonStockValue }),
      },
    });
  }

  return report;
}
