import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/lib/audit";

export type StockMovementType =
  | "OPENING"
  | "PURCHASE"
  | "PURCHASE_RETURN"
  | "SALE"
  | "SALE_RETURN"
  | "STOCK_ADJUSTMENT"
  | "DAMAGE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "PRODUCTION_IN"
  | "PRODUCTION_OUT"
  | "WASTAGE";

export type StockAdjustmentReason =
  | "Physical Count"
  | "Damage"
  | "Lost"
  | "Expired"
  | "Opening Correction"
  | "Other";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * 1. GET OR PROVISION DEFAULT WAREHOUSE
 * Guarantees every company has at least one active warehouse.
 */
export async function getDefaultWarehouse(companyId: string, tx: DbClient = prisma) {
  let warehouse = await tx.warehouse.findFirst({
    where: { companyId, isDefault: true, active: true },
  });

  if (!warehouse) {
    warehouse = await tx.warehouse.findFirst({
      where: { companyId, active: true },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!warehouse) {
    warehouse = await tx.warehouse.create({
      data: {
        companyId,
        name: "Main Godown / Store",
        code: "WH-MAIN",
        isDefault: true,
        active: true,
      },
    });
  }

  return warehouse;
}

/**
 * 2. GET AVAILABLE STOCK
 * Checks warehouse-specific stock or aggregate company stock.
 */
export async function getAvailableStock(
  params: {
    companyId: string;
    itemId: string;
    warehouseId?: string | null;
    variantId?: string | null;
  },
  tx: DbClient = prisma
): Promise<number> {
  const { companyId, itemId, warehouseId, variantId } = params;

  if (warehouseId) {
    const whStock = await tx.warehouseStock.findFirst({
      where: {
        companyId,
        warehouseId,
        itemId,
        variantId: variantId || null,
      },
    });
    return whStock ? whStock.quantity : 0;
  }

  // If no warehouse specified, return item's aggregate stock
  const item = await tx.item.findUnique({
    where: { id: itemId },
    select: { stock: true },
  });
  return item ? Number(item.stock) : 0;
}

/**
 * 3. RECORD STOCK MOVEMENT
 * The authoritative atomic inventory transaction handler.
 */
export async function recordStockMovement(
  params: {
    companyId: string;
    itemId: string;
    warehouseId?: string | null;
    branchId?: string | null;
    variantId?: string | null;
    movementType: StockMovementType;
    referenceType?: string | null;
    referenceId?: string | null;
    qtyIn?: number;
    qtyOut?: number;
    unitCost?: number;
    totalCost?: number;
    date?: Date;
    notes?: string | null;
    createdBy?: string | null;
    allowNegative?: boolean;
  },
  tx: DbClient = prisma
) {
  const {
    companyId,
    itemId,
    branchId,
    variantId,
    movementType,
    referenceType,
    referenceId,
    notes,
    createdBy,
    date = new Date(),
    allowNegative = false,
  } = params;

  const qtyIn = Math.max(0, Number(params.qtyIn || 0));
  const qtyOut = Math.max(0, Number(params.qtyOut || 0));

  if (qtyIn > 0 && qtyOut > 0) {
    throw new Error("A single stock movement cannot have both qtyIn and qtyOut positive.");
  }
  if (qtyIn === 0 && qtyOut === 0) {
    throw new Error("Stock movement quantity must be greater than zero.");
  }

  // 1. Resolve Warehouse
  let targetWarehouseId = params.warehouseId;
  if (!targetWarehouseId) {
    const defWh = await getDefaultWarehouse(companyId, tx);
    targetWarehouseId = defWh.id;
  }

  // 2. Resolve Item
  const item = await tx.item.findFirst({
    where: { id: itemId, companyId },
  });
  if (!item) {
    throw new Error(`Item ${itemId} not found for company ${companyId}`);
  }

  // Do not track inventory for service items
  if (item.type === "SERVICE") {
    return null;
  }

  const warehouse = await tx.warehouse.findUnique({
    where: { id: targetWarehouseId },
  });
  if (!warehouse) {
    throw new Error(`Warehouse ${targetWarehouseId} not found`);
  }

  // 3. Negative Stock Enforcement (Backend rule)
  if (qtyOut > 0 && !allowNegative) {
    const currentWhStock = await getAvailableStock(
      { companyId, itemId, warehouseId: targetWarehouseId, variantId },
      tx
    );

    if (currentWhStock < qtyOut) {
      throw new Error(
        `Insufficient stock for '${item.name}' in warehouse '${warehouse.name}'. Available: ${currentWhStock}, Requested: ${qtyOut}. Negative stock is disabled for this business.`
      );
    }
  }

  // 4. Weighted Average Cost & Valuation Calculation
  let resolvedUnitCost = Number(params.unitCost || 0);
  const currentItemStock = Number(item.stock);
  const currentPurchasePrice = Number(item.purchasePrice || 0);

  if (qtyIn > 0) {
    if (resolvedUnitCost <= 0) {
      resolvedUnitCost = currentPurchasePrice > 0 ? currentPurchasePrice : Number(item.salePrice);
    }
    // Update Weighted Average Cost when purchasing or adding opening stock
    const oldValuation = Math.max(0, currentItemStock) * currentPurchasePrice;
    const incomingValuation = qtyIn * resolvedUnitCost;
    const newTotalQty = Math.max(0, currentItemStock) + qtyIn;
    const newWeightedAvgCost = newTotalQty > 0 ? (oldValuation + incomingValuation) / newTotalQty : resolvedUnitCost;

    await tx.item.update({
      where: { id: itemId },
      data: {
        stock: { increment: qtyIn },
        purchasePrice: newWeightedAvgCost,
      },
    });
  } else if (qtyOut > 0) {
    if (resolvedUnitCost <= 0) {
      resolvedUnitCost = currentPurchasePrice;
    }
    await tx.item.update({
      where: { id: itemId },
      data: {
        stock: { decrement: qtyOut },
      },
    });
  }

  const calculatedTotalCost = params.totalCost !== undefined ? Number(params.totalCost) : resolvedUnitCost * (qtyIn || qtyOut);
  const netDelta = qtyIn - qtyOut;

  // 5. Update WarehouseStock
  const existingWhStock = await tx.warehouseStock.findFirst({
    where: {
      companyId,
      warehouseId: targetWarehouseId,
      itemId,
      variantId: variantId || null,
    },
  });

  if (existingWhStock) {
    await tx.warehouseStock.update({
      where: { id: existingWhStock.id },
      data: {
        quantity: existingWhStock.quantity + netDelta,
      },
    });
  } else {
    await tx.warehouseStock.create({
      data: {
        companyId,
        warehouseId: targetWarehouseId,
        itemId,
        variantId: variantId || null,
        quantity: netDelta,
      },
    });
  }

  // 6. Update ProductVariant stock if variant exists
  if (variantId) {
    await tx.productVariant.update({
      where: { id: variantId },
      data: {
        stock: { increment: netDelta },
      },
    });
  }

  // 7. Insert Immutable StockMovement Record
  const movement = await tx.stockMovement.create({
    data: {
      companyId,
      warehouseId: targetWarehouseId,
      branchId: branchId || null,
      itemId,
      variantId: variantId || null,
      movementType,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
      qtyIn,
      qtyOut,
      unitCost: resolvedUnitCost,
      totalCost: calculatedTotalCost,
      date,
      notes: notes || null,
      createdBy: createdBy || null,
    },
  });

  return movement;
}

/**
 * 4. STOCK TRANSFER (Atomic Transfer between Warehouses)
 */
export async function transferStock(
  params: {
    companyId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    itemId: string;
    variantId?: string | null;
    quantity: number;
    notes?: string | null;
    createdBy?: string | null;
    date?: Date;
    allowNegative?: boolean;
    clientMetadata?: any;
  },
  parentTx?: Prisma.TransactionClient
) {
  const {
    companyId,
    fromWarehouseId,
    toWarehouseId,
    itemId,
    variantId,
    quantity,
    notes,
    createdBy,
    date = new Date(),
    allowNegative = false,
  } = params;

  if (fromWarehouseId === toWarehouseId) {
    throw new Error("Source and destination warehouse cannot be the same.");
  }
  if (quantity <= 0) {
    throw new Error("Transfer quantity must be greater than zero.");
  }

  const transferRef = `TRF-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

  const executeTransfer = async (tx: DbClient) => {
    // 1. Deduct from Source Warehouse (TRANSFER_OUT)
    const outMovement = await recordStockMovement(
      {
        companyId,
        itemId,
        warehouseId: fromWarehouseId,
        variantId,
        movementType: "TRANSFER_OUT",
        referenceType: "TRANSFER",
        referenceId: transferRef,
        qtyIn: 0,
        qtyOut: quantity,
        date,
        notes: `Transfer Out to warehouse. ${notes || ""}`.trim(),
        createdBy,
        allowNegative,
      },
      tx
    );

    // 2. Add to Destination Warehouse (TRANSFER_IN)
    const inMovement = await recordStockMovement(
      {
        companyId,
        itemId,
        warehouseId: toWarehouseId,
        variantId,
        movementType: "TRANSFER_IN",
        referenceType: "TRANSFER",
        referenceId: transferRef,
        qtyIn: quantity,
        qtyOut: 0,
        unitCost: outMovement?.unitCost || 0,
        date,
        notes: `Transfer In from warehouse. ${notes || ""}`.trim(),
        createdBy,
        allowNegative: true, // Incoming always permitted
      },
      tx
    );

    // 3. Audit Log
    if (params.clientMetadata) {
      await recordAuditLog({
        companyId,
        userId: createdBy,
        action: "STOCK_TRANSFER",
        entity: "StockMovement",
        entityId: transferRef,
        details: `Transferred ${quantity} units of item ${itemId} from WH ${fromWarehouseId} to WH ${toWarehouseId}`,
        ipAddress: params.clientMetadata.ipAddress,
        userAgent: params.clientMetadata.userAgent,
      });
    }

    return { transferRef, outMovement, inMovement };
  };

  if (parentTx) {
    return await executeTransfer(parentTx);
  } else {
    return await prisma.$transaction(async (tx) => {
      return await executeTransfer(tx);
    });
  }
}

/**
 * 5. STOCK ADJUSTMENT (Physical Count, Damage, Wastage, Correction)
 */
export async function adjustStock(
  params: {
    companyId: string;
    warehouseId: string;
    itemId: string;
    variantId?: string | null;
    quantity: number;
    direction: "INCREASE" | "DECREASE";
    reason: StockAdjustmentReason;
    notes?: string | null;
    createdBy?: string | null;
    date?: Date;
    allowNegative?: boolean;
    clientMetadata?: any;
  },
  parentTx?: Prisma.TransactionClient
) {
  const {
    companyId,
    warehouseId,
    itemId,
    variantId,
    quantity,
    direction,
    reason,
    notes,
    createdBy,
    date = new Date(),
    allowNegative = false,
  } = params;

  if (quantity <= 0) {
    throw new Error("Adjustment quantity must be greater than zero.");
  }

  let movementType: StockMovementType = "STOCK_ADJUSTMENT";
  if (reason === "Damage") movementType = "DAMAGE";
  else if (reason === "Expired" || reason === "Lost") movementType = "WASTAGE";
  else if (reason === "Opening Correction") movementType = "OPENING";

  const adjustmentRef = `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

  const executeAdjustment = async (tx: DbClient) => {
    const isIncrease = direction === "INCREASE";
    const movement = await recordStockMovement(
      {
        companyId,
        warehouseId,
        itemId,
        variantId,
        movementType,
        referenceType: "ADJUSTMENT",
        referenceId: adjustmentRef,
        qtyIn: isIncrease ? quantity : 0,
        qtyOut: isIncrease ? 0 : quantity,
        date,
        notes: `Reason: ${reason}. ${notes || ""}`.trim(),
        createdBy,
        allowNegative,
      },
      tx
    );

    // Audit Log
    if (params.clientMetadata) {
      await recordAuditLog({
        companyId,
        userId: createdBy,
        action: "STOCK_ADJUSTMENT",
        entity: "StockMovement",
        entityId: adjustmentRef,
        details: `Adjusted ${direction} ${quantity} units of item ${itemId} in WH ${warehouseId} (Reason: ${reason})`,
        ipAddress: params.clientMetadata.ipAddress,
        userAgent: params.clientMetadata.userAgent,
      });
    }

    return { adjustmentRef, movement };
  };

  if (parentTx) {
    return await executeAdjustment(parentTx);
  } else {
    return await prisma.$transaction(async (tx) => {
      return await executeAdjustment(tx);
    });
  }
}

/**
 * 6. STOCK LEDGER QUERY
 * Computes running balances chronologically for auditing.
 */
export async function getStockLedger(
  companyId: string,
  filters: {
    itemId?: string;
    warehouseId?: string;
    movementType?: string;
    referenceId?: string;
    startDate?: Date;
    endDate?: Date;
  }
) {
  const where: Prisma.StockMovementWhereInput = { companyId };

  if (filters.itemId) where.itemId = filters.itemId;
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.movementType) where.movementType = filters.movementType;
  if (filters.referenceId) {
    where.referenceId = { contains: filters.referenceId };
  }

  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) where.date.gte = filters.startDate;
    if (filters.endDate) where.date.lte = filters.endDate;
  }

  const movements = await prisma.stockMovement.findMany({
    where,
    include: {
      item: { select: { id: true, name: true, sku: true, unit: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      variant: { select: { id: true, options: true, attributes: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  // Calculate Running Balance
  let runningBalance = 0;
  const ledgerRows = movements.map((m) => {
    runningBalance += m.qtyIn - m.qtyOut;
    return {
      id: m.id,
      date: m.date,
      createdAt: m.createdAt,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      movementType: m.movementType,
      warehouse: m.warehouse ? m.warehouse.name : "Default",
      warehouseCode: m.warehouse?.code || "",
      item: m.item.name,
      itemId: m.itemId,
      sku: m.item.sku,
      unit: m.item.unit,
      variant: m.variant?.attributes || null,
      qtyIn: m.qtyIn,
      qtyOut: m.qtyOut,
      balance: runningBalance,
      unitCost: m.unitCost,
      totalCost: m.totalCost,
      notes: m.notes,
      createdBy: m.createdBy,
    };
  });

  return ledgerRows;
}
