import { prisma } from "./prisma";
import { checkCompanyStatus } from "./subscriptionEnforcement";

export interface BomRawMaterialInput {
  itemId: string;
  quantity: number;
  unitCostEstimate?: number;
  scrapPercentage?: number;
  notes?: string;
}

export interface CreateBomInput {
  companyId: string;
  name: string;
  code?: string;
  finishedItemId: string;
  outputQty?: number;
  laborCost?: number;
  overheadCost?: number;
  notes?: string;
  rawMaterials: BomRawMaterialInput[];
}

export interface CreateProductionOrderInput {
  companyId: string;
  orderNo?: string;
  bomId: string;
  plannedQty: number;
  warehouseId?: string;
  rawWarehouseId?: string;
  notes?: string;
  createdBy?: string;
}

export interface ExecuteProductionInput {
  companyId: string;
  productionOrderId: string;
  producedQty: number;
  wastageQty?: number;
  wastageReason?: string;
  laborCostOverride?: number;
  overheadCostOverride?: number;
  userId?: string;
}

/**
 * Creates a new Bill of Materials (BOM) specifying raw material recipe for a finished product.
 */
export async function createBillOfMaterials(input: CreateBomInput) {
  await checkCompanyStatus(input.companyId);

  // Validate finished item
  const finishedItem = await prisma.item.findFirst({
    where: { id: input.finishedItemId, companyId: input.companyId },
  });
  if (!finishedItem) {
    throw new Error(`Finished Item with id '${input.finishedItemId}' not found.`);
  }

  if (!input.rawMaterials || input.rawMaterials.length === 0) {
    throw new Error("A Bill of Materials must contain at least one raw material.");
  }

  // Validate all raw material items
  for (const rm of input.rawMaterials) {
    if (rm.itemId === input.finishedItemId) {
      throw new Error("A finished item cannot consume itself as a raw material.");
    }
    const rawItem = await prisma.item.findFirst({
      where: { id: rm.itemId, companyId: input.companyId },
    });
    if (!rawItem) {
      throw new Error(`Raw material Item with id '${rm.itemId}' not found.`);
    }
    if (rm.quantity <= 0) {
      throw new Error(`Raw material '${rawItem.name}' quantity must be greater than 0.`);
    }
  }

  return prisma.billOfMaterials.create({
    data: {
      companyId: input.companyId,
      name: input.name.trim(),
      code: input.code?.trim(),
      finishedItemId: input.finishedItemId,
      outputQty: input.outputQty && input.outputQty > 0 ? input.outputQty : 1,
      laborCost: input.laborCost || 0,
      overheadCost: input.overheadCost || 0,
      notes: input.notes,
      items: {
        create: input.rawMaterials.map((rm) => ({
          itemId: rm.itemId,
          quantity: rm.quantity,
          unitCostEstimate: rm.unitCostEstimate || 0,
          scrapPercentage: rm.scrapPercentage || 0,
          notes: rm.notes,
        })),
      },
    },
    include: {
      items: {
        include: {
          item: { select: { id: true, name: true, sku: true, unit: true } },
        },
      },
      finishedItem: { select: { id: true, name: true, sku: true, unit: true } },
    },
  });
}

/**
 * Creates a Production Order / Run based on a Bill of Materials.
 */
export async function createProductionOrder(input: CreateProductionOrderInput) {
  await checkCompanyStatus(input.companyId);

  const bom = await prisma.billOfMaterials.findFirst({
    where: { id: input.bomId, companyId: input.companyId },
    include: { items: true, finishedItem: true },
  });

  if (!bom) {
    throw new Error(`Bill of Materials with id '${input.bomId}' not found.`);
  }

  if (input.plannedQty <= 0) {
    throw new Error("Planned quantity must be greater than zero.");
  }

  // Generate order number if not specified
  const orderNo =
    input.orderNo?.trim() || `PRD-${Date.now().toString().slice(-6)}`;

  // Default warehouse resolution
  let warehouseId = input.warehouseId;
  if (!warehouseId) {
    const defWh = await prisma.warehouse.findFirst({
      where: { companyId: input.companyId, isDefault: true },
    });
    warehouseId = defWh ? defWh.id : undefined;
  }

  return prisma.productionOrder.create({
    data: {
      companyId: input.companyId,
      orderNo,
      bomId: bom.id,
      finishedItemId: bom.finishedItemId,
      warehouseId,
      rawWarehouseId: input.rawWarehouseId || warehouseId,
      plannedQty: input.plannedQty,
      status: "DRAFT",
      notes: input.notes,
      createdBy: input.createdBy,
    },
    include: {
      bom: {
        include: {
          items: {
            include: {
              item: { select: { id: true, name: true, sku: true, unit: true, stock: true } },
            },
          },
        },
      },
      finishedItem: { select: { id: true, name: true, sku: true, unit: true } },
    },
  });
}

/**
 * Executes a production run atomically with complete transaction integrity:
 * 1. Checks inventory availability
 * 2. Consumes raw materials (reduces raw stock, records StockMovement PRODUCTION_OUT)
 * 3. Records scrap/wastage (StockMovement WASTAGE)
 * 4. Capitalizes finished product (increases finished stock, records StockMovement PRODUCTION_IN)
 * 5. Generates double-entry Journal Voucher (Debit 1200 Finished Stock, Credit 1200 Raw Materials, Credit Absorption)
 * 6. Marks Production Order as COMPLETED.
 */
export async function executeProductionOrder(input: ExecuteProductionInput) {
  await checkCompanyStatus(input.companyId);

  const { companyId, productionOrderId, producedQty } = input;

  if (producedQty <= 0) {
    throw new Error("Produced quantity must be greater than zero.");
  }

  const order = await prisma.productionOrder.findFirst({
    where: { id: productionOrderId, companyId },
    include: {
      bom: {
        include: {
          items: {
            include: { item: true },
          },
        },
      },
      finishedItem: true,
    },
  });

  if (!order) {
    throw new Error(`Production order '${productionOrderId}' not found.`);
  }

  if (order.status === "COMPLETED") {
    throw new Error("This production order has already been executed and completed.");
  }

  if (!order.bom) {
    throw new Error("Cannot execute production order without a linked Bill of Materials.");
  }

  const outputFactor = producedQty / (order.bom.outputQty || 1);
  const warehouseId = order.warehouseId;
  const rawWarehouseId = order.rawWarehouseId || warehouseId;

  // Execute in isolated database transaction
  return prisma.$transaction(async (tx) => {
    let totalRawCost = 0;
    const consumptionsData: Array<{
      itemId: string;
      qtyRequired: number;
      unitCost: number;
      totalCost: number;
    }> = [];

    // Step 1: Validate stock & calculate consumption for each raw material
    for (const bomItem of order.bom!.items) {
      const requiredQty = bomItem.quantity * outputFactor;
      const rawItem = await tx.item.findUnique({ where: { id: bomItem.itemId } });

      if (!rawItem) {
        throw new Error(`Raw material item '${bomItem.itemId}' not found.`);
      }

      // Check stock availability
      if (rawItem.stock.toNumber() < requiredQty) {
        throw new Error(
          `Insufficient stock for raw material '${rawItem.name}'. Available: ${rawItem.stock}, Required: ${requiredQty}.`
        );
      }

      const unitCost = Number(Number(rawItem.purchasePrice) > 0 ? rawItem.purchasePrice : bomItem.unitCostEstimate);
      const lineCost = Math.round(requiredQty * unitCost * 100) / 100;
      totalRawCost += lineCost;

      consumptionsData.push({
        itemId: rawItem.id,
        qtyRequired: requiredQty,
        unitCost,
        totalCost: lineCost,
      });

      // Deduct raw material from Item stock
      await tx.item.update({
        where: { id: rawItem.id },
        data: { stock: { decrement: requiredQty } },
      });

      // Deduct from WarehouseStock if warehouse is assigned
      if (rawWarehouseId) {
        const existingStock = await tx.warehouseStock.findFirst({
          where: {
            warehouseId: rawWarehouseId,
            itemId: rawItem.id,
            variantId: null,
          },
        });

        if (existingStock) {
          await tx.warehouseStock.update({
            where: { id: existingStock.id },
            data: { quantity: { decrement: requiredQty } },
          });
        } else {
          await tx.warehouseStock.create({
            data: {
              companyId,
              warehouseId: rawWarehouseId,
              itemId: rawItem.id,
              quantity: -requiredQty,
            },
          });
        }
      }

      // Record StockMovement: PRODUCTION_OUT
      await tx.stockMovement.create({
        data: {
          companyId,
          itemId: rawItem.id,
          warehouseId: rawWarehouseId,
          movementType: "PRODUCTION_OUT",
          referenceType: "PRODUCTION_ORDER",
          referenceId: order.id,
          qtyIn: 0,
          qtyOut: requiredQty,
          unitCost,
          totalCost: lineCost,
          notes: `Consumed for Production Order ${order.orderNo} (${order.finishedItem.name})`,
        },
      });

      // Record ProductionConsumption row
      await tx.productionConsumption.create({
        data: {
          productionOrderId: order.id,
          itemId: rawItem.id,
          quantity: requiredQty,
          unitCost,
          totalCost: lineCost,
          warehouseId: rawWarehouseId,
        },
      });
    }

    // Step 2: Handle Wastage if reported
    const wastageQty = input.wastageQty || 0;
    if (wastageQty > 0) {
      await tx.productionWastage.create({
        data: {
          productionOrderId: order.id,
          itemId: order.finishedItemId,
          quantity: wastageQty,
          unitCost: totalRawCost / (producedQty + wastageQty),
          totalCost: 0, // already absorbed into finished goods cost
          reason: input.wastageReason || "Production scrap and testing trim",
        },
      });

      await tx.stockMovement.create({
        data: {
          companyId,
          itemId: order.finishedItemId,
          warehouseId,
          movementType: "WASTAGE",
          referenceType: "PRODUCTION_ORDER",
          referenceId: order.id,
          qtyIn: 0,
          qtyOut: wastageQty,
          unitCost: 0,
          totalCost: 0,
          notes: `Wastage scrap on Production Order ${order.orderNo}: ${input.wastageReason || "Scrap"}`,
        },
      });
    }

    // Step 3: Capitalize Finished Good
    const laborCost = input.laborCostOverride !== undefined ? input.laborCostOverride : (order.bom!.laborCost * outputFactor);
    const overheadCost = input.overheadCostOverride !== undefined ? input.overheadCostOverride : (order.bom!.overheadCost * outputFactor);
    const totalFinishedCost = Math.round((totalRawCost + laborCost + overheadCost) * 100) / 100;
    const finishedUnitCost = Math.round((totalFinishedCost / producedQty) * 100) / 100;

    // Increase Finished Product stock
    await tx.item.update({
      where: { id: order.finishedItemId },
      data: {
        stock: { increment: producedQty },
        purchasePrice: finishedUnitCost, // updates cost price of manufactured item
      },
    });

    if (warehouseId) {
      const existingStock = await tx.warehouseStock.findFirst({
        where: {
          warehouseId,
          itemId: order.finishedItemId,
          variantId: null,
        },
      });

      if (existingStock) {
        await tx.warehouseStock.update({
          where: { id: existingStock.id },
          data: { quantity: { increment: producedQty } },
        });
      } else {
        await tx.warehouseStock.create({
          data: {
            companyId,
            warehouseId,
            itemId: order.finishedItemId,
            quantity: producedQty,
          },
        });
      }
    }

    // Record StockMovement: PRODUCTION_IN
    await tx.stockMovement.create({
      data: {
        companyId,
        itemId: order.finishedItemId,
        warehouseId,
        movementType: "PRODUCTION_IN",
        referenceType: "PRODUCTION_ORDER",
        referenceId: order.id,
        qtyIn: producedQty,
        qtyOut: 0,
        unitCost: finishedUnitCost,
        totalCost: totalFinishedCost,
        notes: `Produced on Order ${order.orderNo}`,
      },
    });

    // Step 4: Create Double-Entry Journal Voucher (Balanced)
    // Debit Finished Goods Inventory (1200 Stock in Hand)
    // Credit Raw Materials Inventory (1200 Stock in Hand)
    // Credit Labor/Overheads Absorption (5101 / 4100)
    let stockAccount = await tx.account.findFirst({
      where: { companyId, code: "1200" },
    });
    if (!stockAccount) {
      stockAccount = await tx.account.create({
        data: {
          companyId,
          code: "1200",
          name: "Stock in Hand",
          type: "ASSET",
          groupId: "Stock-in-Hand",
        },
      });
    }

    let laborAccount = await tx.account.findFirst({
      where: { companyId, code: "5101" },
    });
    if (!laborAccount && laborCost > 0) {
      laborAccount = await tx.account.create({
        data: {
          companyId,
          code: "5101",
          name: "Salaries & Wages",
          type: "EXPENSE",
          groupId: "Direct-Expense",
        },
      });
    }

    const voucherNo = `PRD-JV-${Date.now().toString().slice(-6)}`;
    const voucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNo,
        type: "JOURNAL",
        date: new Date(),
        narration: `Production Run for ${order.orderNo}: ${producedQty} x ${order.finishedItem.name} @ ₹${finishedUnitCost}`,
      },
    });

    const entries = [
      // Debit: Finished Inventory capitalized
      {
        voucherId: voucher.id,
        accountId: stockAccount.id,
        debit: totalFinishedCost,
        credit: 0,
      },
      // Credit: Raw Materials consumed
      {
        voucherId: voucher.id,
        accountId: stockAccount.id,
        debit: 0,
        credit: totalRawCost,
      },
    ];

    // Credit Labor absorption if applicable
    if (laborCost > 0 && laborAccount) {
      entries.push({
        voucherId: voucher.id,
        accountId: laborAccount.id,
        debit: 0,
        credit: laborCost,
      });
    }

    // Credit Overhead absorption if applicable
    if (overheadCost > 0) {
      entries.push({
        voucherId: voucher.id,
        accountId: stockAccount.id, // absorption
        debit: 0,
        credit: overheadCost,
      });
    }

    await tx.voucherEntry.createMany({ data: entries });

    // Step 5: Mark Production Order as COMPLETED
    const completedOrder = await tx.productionOrder.update({
      where: { id: order.id },
      data: {
        status: "COMPLETED",
        producedQty,
        wastageQty,
        totalCost: totalFinishedCost,
        completedDate: new Date(),
        voucherId: voucher.id,
      },
      include: {
        consumptions: { include: { item: true } },
        wastages: true,
        voucher: { include: { entries: true } },
        finishedItem: true,
      },
    });

    return {
      success: true,
      productionOrderId: completedOrder.id,
      orderNo: completedOrder.orderNo,
      finishedItemName: order.finishedItem.name,
      producedQty,
      wastageQty,
      unitCost: finishedUnitCost,
      totalCost: totalFinishedCost,
      voucherNo: voucher.voucherNo,
      completedOrder,
    };
  });
}
