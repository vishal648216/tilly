// Taily - Phase 6: Optional Business Workflows Engine
// Quotation -> Sales Order -> Delivery Challan -> Invoice -> Payment
// Purchase Order -> Goods Receipt (GRN) -> Purchase Invoice
// Strict duplicate protection, partial quantities, stock integrity, and document linking.

import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { roundTo2 } from "./currency";
import { getCompanySettings } from "./featureFlags";
import { recordStockMovement, getDefaultWarehouse } from "./inventory";
import { createInvoice } from "./invoice";

// ============================================================================
// TYPES & INPUT INTERFACES
// ============================================================================

export type WorkflowLineInput = {
  itemId?: string;
  name: string;
  sku?: string;
  unit?: string;
  hsn?: string;
  qty: number;
  rate: number;
  discount?: number;
  gstRate: number;
};

export type CreateQuotationInput = {
  companyId: string;
  partyId?: string;
  date: Date;
  validUntil?: Date;
  quotationNo?: string;
  items: WorkflowLineInput[];
  notes?: string;
  terms?: string;
  status?: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  createdBy?: string;
  isInterState?: boolean;
};

export type CreateSalesOrderInput = {
  companyId: string;
  partyId?: string;
  date: Date;
  expectedDelivery?: Date;
  orderNo?: string;
  warehouseId?: string;
  quotationId?: string;
  items: WorkflowLineInput[];
  notes?: string;
  terms?: string;
  status?: "DRAFT" | "CONFIRMED";
  createdBy?: string;
  isInterState?: boolean;
};

export type DeliveryChallanLineInput = {
  salesOrderLineId?: string;
  itemId?: string;
  name: string;
  sku?: string;
  unit?: string;
  orderedQty: number;
  deliveredQty: number; // Qty delivered in THIS delivery challan
  rate?: number;
};

export type CreateDeliveryChallanInput = {
  companyId: string;
  salesOrderId?: string;
  partyId?: string;
  warehouseId?: string;
  date: Date;
  dcNo?: string;
  lines: DeliveryChallanLineInput[];
  notes?: string;
  createdBy?: string;
  dispatchNow?: boolean; // if true, stock is moved immediately
};

export type CreatePurchaseOrderInput = {
  companyId: string;
  partyId?: string; // Supplier
  date: Date;
  expectedDate?: Date;
  poNo?: string;
  warehouseId?: string;
  items: WorkflowLineInput[];
  notes?: string;
  terms?: string;
  status?: "DRAFT" | "SENT" | "CONFIRMED";
  createdBy?: string;
  isInterState?: boolean;
};

export type GoodsReceiptLineInput = {
  purchaseOrderLineId?: string;
  itemId?: string;
  name: string;
  sku?: string;
  unit?: string;
  orderedQty: number;
  receivedQty: number; // Qty received in THIS GRN
  rate?: number;
};

export type CreateGoodsReceiptInput = {
  companyId: string;
  purchaseOrderId?: string;
  partyId?: string; // Supplier
  warehouseId?: string;
  date: Date;
  grnNo?: string;
  lines: GoodsReceiptLineInput[];
  notes?: string;
  createdBy?: string;
  receiveNow?: boolean; // if true, stock is moved into warehouse
};

// ============================================================================
// HELPER: TAX & TOTAL COMPUTATION
// ============================================================================

function calculateWorkflowLineTax(line: WorkflowLineInput, isInterState: boolean) {
  const qty = Number(line.qty) || 0;
  const rate = Number(line.rate) || 0;
  const discount = Number(line.discount) || 0;
  const gross = qty * rate;
  const taxableAmount = Math.max(0, roundTo2(gross - discount));
  const gstRate = Number(line.gstRate) || 0;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (gstRate > 0) {
    if (isInterState) {
      igst = roundTo2((taxableAmount * gstRate) / 100);
    } else {
      const halfRate = gstRate / 2;
      cgst = roundTo2((taxableAmount * halfRate) / 100);
      sgst = roundTo2((taxableAmount * halfRate) / 100);
    }
  }

  const taxAmount = igst > 0 ? igst : cgst + sgst;
  const amount = roundTo2(taxableAmount + taxAmount);

  return {
    taxableAmount,
    cgst,
    sgst,
    igst,
    taxAmount,
    amount,
  };
}

// ============================================================================
// 1. QUOTATION MODULE
// ============================================================================

export async function createQuotation(input: CreateQuotationInput) {
  const {
    companyId,
    partyId,
    date,
    validUntil,
    items,
    notes,
    terms,
    status = "DRAFT",
    createdBy,
    isInterState = false,
  } = input;

  if (!items || items.length === 0) {
    throw new Error("Quotation must contain at least one item.");
  }

  // Validate party
  if (partyId) {
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.companyId !== companyId) {
      throw new Error("Party does not belong to active company.");
    }
  }

  // Generate sequence if not provided
  let quotationNo = input.quotationNo;
  if (!quotationNo) {
    const count = await prisma.quotation.count({ where: { companyId } });
    const last = await prisma.quotation.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
    let seq = count + 1;
    if (last) {
      const parsed = parseInt(last.quotationNo.replace(/\D/g, ""));
      if (!isNaN(parsed) && parsed >= seq) seq = parsed + 1;
    }
    quotationNo = `QUO-${String(seq).padStart(6, "0")}`;
  }

  let subTotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;

  const linesData = items.map((item) => {
    const calc = calculateWorkflowLineTax(item, isInterState);
    subTotal += calc.taxableAmount;
    discountTotal += Number(item.discount || 0);
    taxTotal += calc.taxAmount;
    grandTotal += calc.amount;

    return {
      itemId: item.itemId || null,
      name: item.name.trim(),
      sku: item.sku || null,
      unit: item.unit || "PCS",
      hsn: item.hsn || null,
      qty: new Decimal(item.qty),
      rate: new Decimal(item.rate),
      discount: new Decimal(item.discount || 0),
      taxableAmount: new Decimal(calc.taxableAmount),
      gstRate: new Decimal(item.gstRate || 0),
      cgst: new Decimal(calc.cgst),
      sgst: new Decimal(calc.sgst),
      igst: new Decimal(calc.igst),
      amount: new Decimal(calc.amount),
    };
  });

  return await prisma.quotation.create({
    data: {
      companyId,
      quotationNo,
      date,
      validUntil: validUntil || null,
      partyId: partyId || null,
      status,
      notes: notes || null,
      terms: terms || null,
      subTotal: new Decimal(roundTo2(subTotal)),
      discount: new Decimal(roundTo2(discountTotal)),
      taxTotal: new Decimal(roundTo2(taxTotal)),
      grandTotal: new Decimal(roundTo2(grandTotal)),
      createdBy: createdBy || null,
      lines: { create: linesData },
    },
    include: { lines: true, party: true },
  });
}

export async function updateQuotationStatus(
  id: string,
  companyId: string,
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CONVERTED"
) {
  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation || quotation.companyId !== companyId) {
    throw new Error("Quotation not found or tenant mismatch.");
  }
  return await prisma.quotation.update({
    where: { id },
    data: { status },
  });
}

/**
 * Converts a Quotation into a Sales Order.
 * Prevents duplicate conversions and maintains source references.
 */
export async function convertQuotationToSalesOrder(
  quotationId: string,
  companyId: string,
  options?: {
    expectedDelivery?: Date;
    warehouseId?: string;
    createdBy?: string;
  }
) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { lines: true, party: true },
  });

  if (!quotation || quotation.companyId !== companyId) {
    throw new Error("Quotation not found or does not belong to active company.");
  }

  if (quotation.status === "CONVERTED" || quotation.convertedToOrderId) {
    throw new Error(
      `Quotation ${quotation.quotationNo} has already been converted to Sales Order.`
    );
  }

  if (quotation.status === "REJECTED" || quotation.status === "EXPIRED") {
    throw new Error(`Cannot convert quotation with status ${quotation.status}.`);
  }

  // Default warehouse if not provided
  let warehouseId = options?.warehouseId;
  if (!warehouseId) {
    const wh = await getDefaultWarehouse(companyId);
    warehouseId = wh.id;
  }

  // Create Sales Order inside transaction
  const result = await prisma.$transaction(async (tx) => {
    // Generate SO number
    const soCount = await tx.salesOrder.count({ where: { companyId } });
    const lastSO = await tx.salesOrder.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
    let seq = soCount + 1;
    if (lastSO) {
      const parsed = parseInt(lastSO.orderNo.replace(/\D/g, ""));
      if (!isNaN(parsed) && parsed >= seq) seq = parsed + 1;
    }
    const orderNo = `SO-${String(seq).padStart(6, "0")}`;

    const salesOrder = await tx.salesOrder.create({
      data: {
        companyId,
        orderNo,
        date: new Date(),
        expectedDelivery: options?.expectedDelivery || null,
        partyId: quotation.partyId,
        warehouseId,
        quotationId: quotation.id,
        status: "CONFIRMED",
        notes: quotation.notes,
        terms: quotation.terms,
        subTotal: quotation.subTotal,
        discount: quotation.discount,
        taxTotal: quotation.taxTotal,
        grandTotal: quotation.grandTotal,
        createdBy: options?.createdBy || quotation.createdBy,
        lines: {
          create: quotation.lines.map((line) => ({
            itemId: line.itemId,
            name: line.name,
            sku: line.sku,
            unit: line.unit,
            hsn: line.hsn,
            orderedQty: line.qty,
            deliveredQty: new Decimal(0),
            invoicedQty: new Decimal(0),
            rate: line.rate,
            discount: line.discount,
            taxableAmount: line.taxableAmount,
            gstRate: line.gstRate,
            cgst: line.cgst,
            sgst: line.sgst,
            igst: line.igst,
            amount: line.amount,
          })),
        },
      },
      include: { lines: true },
    });

    // Mark quotation as CONVERTED
    await tx.quotation.update({
      where: { id: quotation.id },
      data: {
        status: "CONVERTED",
        convertedToOrderId: salesOrder.id,
      },
    });

    return salesOrder;
  });

  return result;
}

// ============================================================================
// 2. SALES ORDER MODULE
// ============================================================================

export async function createSalesOrder(input: CreateSalesOrderInput) {
  const {
    companyId,
    partyId,
    date,
    expectedDelivery,
    warehouseId: inputWhId,
    quotationId,
    items,
    notes,
    terms,
    status = "CONFIRMED",
    createdBy,
    isInterState = false,
  } = input;

  if (!items || items.length === 0) {
    throw new Error("Sales order must contain at least one item.");
  }

  if (partyId) {
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.companyId !== companyId) {
      throw new Error("Party does not belong to active company.");
    }
  }

  let warehouseId = inputWhId;
  if (!warehouseId) {
    const wh = await getDefaultWarehouse(companyId);
    warehouseId = wh.id;
  }

  let orderNo = input.orderNo;
  if (!orderNo) {
    const count = await prisma.salesOrder.count({ where: { companyId } });
    const last = await prisma.salesOrder.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
    let seq = count + 1;
    if (last) {
      const parsed = parseInt(last.orderNo.replace(/\D/g, ""));
      if (!isNaN(parsed) && parsed >= seq) seq = parsed + 1;
    }
    orderNo = `SO-${String(seq).padStart(6, "0")}`;
  }

  let subTotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;

  const linesData = items.map((item) => {
    const calc = calculateWorkflowLineTax(item, isInterState);
    subTotal += calc.taxableAmount;
    discountTotal += Number(item.discount || 0);
    taxTotal += calc.taxAmount;
    grandTotal += calc.amount;

    return {
      itemId: item.itemId || null,
      name: item.name.trim(),
      sku: item.sku || null,
      unit: item.unit || "PCS",
      hsn: item.hsn || null,
      orderedQty: new Decimal(item.qty),
      deliveredQty: new Decimal(0),
      invoicedQty: new Decimal(0),
      rate: new Decimal(item.rate),
      discount: new Decimal(item.discount || 0),
      taxableAmount: new Decimal(calc.taxableAmount),
      gstRate: new Decimal(item.gstRate || 0),
      cgst: new Decimal(calc.cgst),
      sgst: new Decimal(calc.sgst),
      igst: new Decimal(calc.igst),
      amount: new Decimal(calc.amount),
    };
  });

  return await prisma.salesOrder.create({
    data: {
      companyId,
      orderNo,
      date,
      expectedDelivery: expectedDelivery || null,
      partyId: partyId || null,
      warehouseId,
      quotationId: quotationId || null,
      status,
      notes: notes || null,
      terms: terms || null,
      subTotal: new Decimal(roundTo2(subTotal)),
      discount: new Decimal(roundTo2(discountTotal)),
      taxTotal: new Decimal(roundTo2(taxTotal)),
      grandTotal: new Decimal(roundTo2(grandTotal)),
      createdBy: createdBy || null,
      lines: { create: linesData },
    },
    include: { lines: true, party: true, warehouse: true },
  });
}

export async function updateSalesOrderStatus(
  id: string,
  companyId: string,
  status: "DRAFT" | "CONFIRMED" | "PARTIALLY_DELIVERED" | "DELIVERED" | "CANCELLED"
) {
  const so = await prisma.salesOrder.findUnique({ where: { id } });
  if (!so || so.companyId !== companyId) {
    throw new Error("Sales Order not found or tenant mismatch.");
  }
  return await prisma.salesOrder.update({
    where: { id },
    data: { status },
  });
}

// ============================================================================
// 3. DELIVERY CHALLAN MODULE (Stock deduction, partial shipments)
// ============================================================================

/**
 * Creates a Delivery Challan against a Sales Order (or standalone).
 * Accurately tracks Ordered vs Delivered vs Pending quantity.
 * Moves stock out ONLY ONCE (via DC dispatch).
 */
export async function createDeliveryChallan(input: CreateDeliveryChallanInput) {
  const {
    companyId,
    salesOrderId,
    partyId: explicitPartyId,
    warehouseId: explicitWhId,
    date,
    notes,
    createdBy,
    dispatchNow = true,
  } = input;

  let so = null;
  if (salesOrderId) {
    so = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { lines: true, party: true },
    });
    if (!so || so.companyId !== companyId) {
      throw new Error("Sales order not found or does not belong to active company.");
    }
    if (so.status === "CANCELLED") {
      throw new Error("Cannot create delivery challan against a cancelled sales order.");
    }
    if (so.status === "DELIVERED") {
      throw new Error("Sales order is already fully delivered.");
    }
  }

  const partyId = explicitPartyId || so?.partyId || null;
  let warehouseId = explicitWhId || so?.warehouseId || null;
  if (!warehouseId) {
    const wh = await getDefaultWarehouse(companyId);
    warehouseId = wh.id;
  }

  // Generate DC Number
  let dcNo = input.dcNo;
  if (!dcNo) {
    const count = await prisma.deliveryChallan.count({ where: { companyId } });
    const last = await prisma.deliveryChallan.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
    let seq = count + 1;
    if (last) {
      const parsed = parseInt(last.dcNo.replace(/\D/g, ""));
      if (!isNaN(parsed) && parsed >= seq) seq = parsed + 1;
    }
    dcNo = `DC-${String(seq).padStart(6, "0")}`;
  }

  const settings = await getCompanySettings(companyId);

  return await prisma.$transaction(async (tx) => {
    const dcLinesToCreate: {
      salesOrderLineId: string | null;
      itemId: string | null;
      name: string;
      sku: string | null;
      unit: string;
      orderedQty: Decimal;
      deliveredQty: Decimal;
      pendingQty: Decimal;
      rate: Decimal;
    }[] = [];

    // Process each input line
    for (const line of input.lines) {
      let soLine = null;
      if (line.salesOrderLineId && so) {
        soLine = so.lines.find((l) => l.id === line.salesOrderLineId);
      }

      const orderedQty = soLine ? Number(soLine.orderedQty) : Number(line.orderedQty || line.deliveredQty);
      const alreadyDelivered = soLine ? Number(soLine.deliveredQty) : 0;
      const currentDelivering = Number(line.deliveredQty);

      if (currentDelivering <= 0) {
        continue; // Skip zero deliveries
      }

      const pendingAfter = Math.max(0, orderedQty - (alreadyDelivered + currentDelivering));

      if (soLine && currentDelivering > (orderedQty - alreadyDelivered)) {
        throw new Error(
          `Delivered quantity (${currentDelivering}) exceeds remaining pending quantity (${
            orderedQty - alreadyDelivered
          }) for item "${line.name}".`
        );
      }

      dcLinesToCreate.push({
        salesOrderLineId: soLine ? soLine.id : null,
        itemId: line.itemId || soLine?.itemId || null,
        name: line.name || soLine?.name || "Item",
        sku: line.sku || soLine?.sku || null,
        unit: line.unit || soLine?.unit || "PCS",
        orderedQty: new Decimal(orderedQty),
        deliveredQty: new Decimal(currentDelivering),
        pendingQty: new Decimal(pendingAfter),
        rate: new Decimal(Number(line.rate || soLine?.rate || 0)),
      });

      // Update SalesOrderLine deliveredQty
      if (soLine) {
        await tx.salesOrderLine.update({
          where: { id: soLine.id },
          data: {
            deliveredQty: { increment: currentDelivering },
          },
        });
      }

      // Record stock movement if dispatchNow is true and inventory is enabled
      const finalItemId = line.itemId || soLine?.itemId || null;
      if (dispatchNow && settings.inventoryEnabled && finalItemId) {
        await recordStockMovement(
          {
            companyId,
            itemId: finalItemId,
            warehouseId,
            movementType: "SALE",
            referenceType: "DELIVERY_CHALLAN",
            referenceId: dcNo,
            qtyIn: 0,
            qtyOut: currentDelivering,
            unitCost: Number(line.rate || soLine?.rate || 0),
            totalCost: currentDelivering * Number(line.rate || soLine?.rate || 0),
            date,
            notes: `Dispatched via Delivery Challan ${dcNo}${
              so ? ` (SO: ${so.orderNo})` : ""
            }`,
            createdBy,
            allowNegative: settings.negativeStockAllowed,
          },
          tx
        );
      }
    }

    if (dcLinesToCreate.length === 0) {
      throw new Error("Delivery Challan must have at least one line with delivered quantity > 0.");
    }

    // Create the Delivery Challan record
    const deliveryChallan = await tx.deliveryChallan.create({
      data: {
        companyId,
        dcNo,
        date,
        salesOrderId: salesOrderId || null,
        partyId,
        warehouseId,
        status: dispatchNow ? "DISPATCHED" : "DRAFT",
        stockMoved: dispatchNow,
        notes: notes || null,
        createdBy: createdBy || null,
        lines: { create: dcLinesToCreate },
      },
      include: { lines: true, salesOrder: true, party: true, warehouse: true },
    });

    // Update SalesOrder overall status based on all lines
    if (so) {
      const refreshedLines = await tx.salesOrderLine.findMany({
        where: { salesOrderId: so.id },
      });
      const allFullyDelivered = refreshedLines.every(
        (l) => Number(l.deliveredQty) >= Number(l.orderedQty)
      );
      const someDelivered = refreshedLines.some((l) => Number(l.deliveredQty) > 0);

      const newStatus = allFullyDelivered
        ? "DELIVERED"
        : someDelivered
        ? "PARTIALLY_DELIVERED"
        : "CONFIRMED";

      await tx.salesOrder.update({
        where: { id: so.id },
        data: { status: newStatus },
      });
    }

    return deliveryChallan;
  });
}

/**
 * Converts a Delivery Challan into a Sales Invoice.
 * CRITICAL: Sets skipStockMovement = true because stock was ALREADY moved when DC was dispatched!
 */
export async function convertDeliveryChallanToInvoice(
  dcId: string,
  companyId: string,
  options?: {
    dueDate?: Date;
    isInterState?: boolean;
    paidAmount?: number;
    paymentMode?: "CASH" | "BANK" | "UPI" | "CARD" | "CHEQUE" | "OTHER";
    notes?: string;
    createdBy?: string;
  }
) {
  const dc = await prisma.deliveryChallan.findUnique({
    where: { id: dcId },
    include: {
      lines: { include: { item: true } },
      salesOrder: { include: { lines: true } },
      party: true,
    },
  });

  if (!dc || dc.companyId !== companyId) {
    throw new Error("Delivery Challan not found or does not belong to active company.");
  }

  if (dc.status === "CANCELLED") {
    throw new Error("Cannot create invoice from a cancelled delivery challan.");
  }

  if (dc.invoiceId) {
    throw new Error(`Delivery Challan ${dc.dcNo} has already been invoiced.`);
  }

  const isInterState = options?.isInterState ?? false;

  // Build invoice lines from DC lines
  const invoiceLines: {
    itemId?: string;
    name: string;
    sku?: string;
    unit?: string;
    hsn?: string;
    qty: number;
    rate: number;
    discount?: number;
    gstRate: number;
  }[] = [];

  for (const line of dc.lines) {
    const deliveredQty = Number(line.deliveredQty);
    if (deliveredQty <= 0) continue;

    let gstRate = 0;
    let hsn = "";
    if (line.itemId) {
      const it = await prisma.item.findUnique({ where: { id: line.itemId } });
      if (it) {
        gstRate = Number(it.gstRate || 0);
        hsn = it.hsn || "";
      }
    }

    invoiceLines.push({
      itemId: line.itemId || undefined,
      name: line.name,
      sku: line.sku || undefined,
      unit: line.unit,
      hsn,
      qty: deliveredQty,
      rate: Number(line.rate || 0),
      discount: 0,
      gstRate,
    });
  }

  // Create invoice with skipStockMovement = true!
  const invoice = await createInvoice({
    companyId,
    type: "SALES",
    partyId: dc.partyId || undefined,
    warehouseId: dc.warehouseId || undefined,
    date: new Date(),
    dueDate: options?.dueDate,
    orderNo: dc.salesOrder?.orderNo || dc.dcNo,
    lines: invoiceLines,
    isInterState,
    status: "POSTED",
    skipStockMovement: true, // PREVENT DOUBLE STOCK DEDUCTION
    sourceDocType: "DELIVERY_CHALLAN",
    sourceDocId: dc.id,
    deliveryChallanId: dc.id,
    salesOrderId: dc.salesOrderId || undefined,
    paidAmount: options?.paidAmount || 0,
    paymentMode: options?.paymentMode || "CASH",
    notes: options?.notes || `Invoice generated from Delivery Challan ${dc.dcNo}`,
    createdBy: options?.createdBy || dc.createdBy || undefined,
  });

  // Link invoice back to DeliveryChallan
  await prisma.deliveryChallan.update({
    where: { id: dc.id },
    data: {
      invoiceId: invoice.id,
      status: "DELIVERED",
    },
  });

  // Update invoicedQty on SalesOrder lines if linked
  if (dc.salesOrderId) {
    for (const dcline of dc.lines) {
      if (dcline.salesOrderLineId) {
        await prisma.salesOrderLine.update({
          where: { id: dcline.salesOrderLineId },
          data: {
            invoicedQty: { increment: Number(dcline.deliveredQty) },
          },
        });
      }
    }
  }

  return invoice;
}

/**
 * Cancels a Delivery Challan and reverses inventory deduction if stock was moved.
 */
export async function cancelDeliveryChallan(
  dcId: string,
  companyId: string,
  reason?: string
) {
  const dc = await prisma.deliveryChallan.findUnique({
    where: { id: dcId },
    include: { lines: true, salesOrder: true },
  });

  if (!dc || dc.companyId !== companyId) {
    throw new Error("Delivery Challan not found or tenant mismatch.");
  }

  if (dc.status === "CANCELLED") {
    throw new Error("Delivery Challan is already cancelled.");
  }

  if (dc.invoiceId) {
    throw new Error(
      `Cannot cancel Delivery Challan ${dc.dcNo} because Invoice ${dc.invoiceId} is already created. Cancel the invoice first.`
    );
  }

  const settings = await getCompanySettings(companyId);

  return await prisma.$transaction(async (tx) => {
    // 1. Re-add stock if stock was moved
    if (dc.stockMoved && settings.inventoryEnabled) {
      for (const line of dc.lines) {
        if (line.itemId && Number(line.deliveredQty) > 0) {
          await recordStockMovement(
            {
              companyId,
              itemId: line.itemId,
              warehouseId: dc.warehouseId,
              movementType: "SALE_RETURN",
              referenceType: "DELIVERY_CHALLAN_CANCEL",
              referenceId: dc.dcNo,
              qtyIn: Number(line.deliveredQty),
              qtyOut: 0,
              unitCost: Number(line.rate),
              totalCost: Number(line.deliveredQty) * Number(line.rate),
              date: new Date(),
              notes: `Stock restored from cancelled DC ${dc.dcNo}${
                reason ? `: ${reason}` : ""
              }`,
              allowNegative: true,
            },
            tx
          );
        }
      }
    }

    // 2. Decrement deliveredQty on SalesOrder lines
    if (dc.salesOrderId) {
      for (const line of dc.lines) {
        if (line.salesOrderLineId && Number(line.deliveredQty) > 0) {
          await tx.salesOrderLine.update({
            where: { id: line.salesOrderLineId },
            data: {
              deliveredQty: { decrement: Number(line.deliveredQty) },
            },
          });
        }
      }

      // Recalculate SalesOrder status
      const remainingLines = await tx.salesOrderLine.findMany({
        where: { salesOrderId: dc.salesOrderId },
      });
      const anyDelivered = remainingLines.some((l) => Number(l.deliveredQty) > 0);
      await tx.salesOrder.update({
        where: { id: dc.salesOrderId },
        data: {
          status: anyDelivered ? "PARTIALLY_DELIVERED" : "CONFIRMED",
        },
      });
    }

    // 3. Update DC status
    return await tx.deliveryChallan.update({
      where: { id: dc.id },
      data: {
        status: "CANCELLED",
        stockMoved: false,
        notes: dc.notes ? `${dc.notes} | Cancelled: ${reason || "No reason"}` : `Cancelled: ${reason || "No reason"}`,
      },
    });
  });
}

// ============================================================================
// 4. PURCHASE ORDER MODULE
// ============================================================================

export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  const {
    companyId,
    partyId,
    date,
    expectedDate,
    warehouseId: inputWhId,
    items,
    notes,
    terms,
    status = "CONFIRMED",
    createdBy,
    isInterState = false,
  } = input;

  if (!items || items.length === 0) {
    throw new Error("Purchase order must contain at least one item.");
  }

  if (partyId) {
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.companyId !== companyId) {
      throw new Error("Supplier does not belong to active company.");
    }
  }

  let warehouseId = inputWhId;
  if (!warehouseId) {
    const wh = await getDefaultWarehouse(companyId);
    warehouseId = wh.id;
  }

  let poNo = input.poNo;
  if (!poNo) {
    const count = await prisma.purchaseOrder.count({ where: { companyId } });
    const last = await prisma.purchaseOrder.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
    let seq = count + 1;
    if (last) {
      const parsed = parseInt(last.poNo.replace(/\D/g, ""));
      if (!isNaN(parsed) && parsed >= seq) seq = parsed + 1;
    }
    poNo = `PO-${String(seq).padStart(6, "0")}`;
  }

  let subTotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;

  const linesData = items.map((item) => {
    const calc = calculateWorkflowLineTax(item, isInterState);
    subTotal += calc.taxableAmount;
    discountTotal += Number(item.discount || 0);
    taxTotal += calc.taxAmount;
    grandTotal += calc.amount;

    return {
      itemId: item.itemId || null,
      name: item.name.trim(),
      sku: item.sku || null,
      unit: item.unit || "PCS",
      hsn: item.hsn || null,
      orderedQty: new Decimal(item.qty),
      receivedQty: new Decimal(0),
      billedQty: new Decimal(0),
      rate: new Decimal(item.rate),
      discount: new Decimal(item.discount || 0),
      taxableAmount: new Decimal(calc.taxableAmount),
      gstRate: new Decimal(item.gstRate || 0),
      cgst: new Decimal(calc.cgst),
      sgst: new Decimal(calc.sgst),
      igst: new Decimal(calc.igst),
      amount: new Decimal(calc.amount),
    };
  });

  return await prisma.purchaseOrder.create({
    data: {
      companyId,
      poNo,
      date,
      expectedDate: expectedDate || null,
      partyId: partyId || null,
      warehouseId,
      status,
      notes: notes || null,
      terms: terms || null,
      subTotal: new Decimal(roundTo2(subTotal)),
      discount: new Decimal(roundTo2(discountTotal)),
      taxTotal: new Decimal(roundTo2(taxTotal)),
      grandTotal: new Decimal(roundTo2(grandTotal)),
      createdBy: createdBy || null,
      lines: { create: linesData },
    },
    include: { lines: true, party: true, warehouse: true },
  });
}

export async function updatePurchaseOrderStatus(
  id: string,
  companyId: string,
  status: "DRAFT" | "SENT" | "CONFIRMED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED"
) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po || po.companyId !== companyId) {
    throw new Error("Purchase Order not found or tenant mismatch.");
  }
  return await prisma.purchaseOrder.update({
    where: { id },
    data: { status },
  });
}

// ============================================================================
// 5. GOODS RECEIPT NOTE (GRN) MODULE
// ============================================================================

/**
 * Creates a Goods Receipt Note against a Purchase Order.
 * Only received quantity enters stock.
 * Accurately calculates pending quantity.
 */
export async function createGoodsReceipt(input: CreateGoodsReceiptInput) {
  const {
    companyId,
    purchaseOrderId,
    partyId: explicitPartyId,
    warehouseId: explicitWhId,
    date,
    notes,
    createdBy,
    receiveNow = true,
  } = input;

  let po = null;
  if (purchaseOrderId) {
    po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { lines: true, party: true },
    });
    if (!po || po.companyId !== companyId) {
      throw new Error("Purchase Order not found or tenant mismatch.");
    }
    if (po.status === "CANCELLED") {
      throw new Error("Cannot create goods receipt against a cancelled purchase order.");
    }
    if (po.status === "RECEIVED") {
      throw new Error("Purchase Order is already fully received.");
    }
  }

  const partyId = explicitPartyId || po?.partyId || null;
  let warehouseId = explicitWhId || po?.warehouseId || null;
  if (!warehouseId) {
    const wh = await getDefaultWarehouse(companyId);
    warehouseId = wh.id;
  }

  // Generate GRN Number
  let grnNo = input.grnNo;
  if (!grnNo) {
    const count = await prisma.goodsReceipt.count({ where: { companyId } });
    const last = await prisma.goodsReceipt.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
    let seq = count + 1;
    if (last) {
      const parsed = parseInt(last.grnNo.replace(/\D/g, ""));
      if (!isNaN(parsed) && parsed >= seq) seq = parsed + 1;
    }
    grnNo = `GRN-${String(seq).padStart(6, "0")}`;
  }

  const settings = await getCompanySettings(companyId);

  return await prisma.$transaction(async (tx) => {
    const grnLinesToCreate: {
      purchaseOrderLineId: string | null;
      itemId: string | null;
      name: string;
      sku: string | null;
      unit: string;
      orderedQty: Decimal;
      receivedQty: Decimal;
      pendingQty: Decimal;
      rate: Decimal;
    }[] = [];

    for (const line of input.lines) {
      let poLine = null;
      if (line.purchaseOrderLineId && po) {
        poLine = po.lines.find((l) => l.id === line.purchaseOrderLineId);
      }

      const orderedQty = poLine ? Number(poLine.orderedQty) : Number(line.orderedQty || line.receivedQty);
      const alreadyReceived = poLine ? Number(poLine.receivedQty) : 0;
      const currentReceiving = Number(line.receivedQty);

      if (currentReceiving <= 0) continue;

      const pendingAfter = Math.max(0, orderedQty - (alreadyReceived + currentReceiving));

      if (poLine && currentReceiving > (orderedQty - alreadyReceived)) {
        throw new Error(
          `Received quantity (${currentReceiving}) exceeds remaining pending quantity (${
            orderedQty - alreadyReceived
          }) for item "${line.name}".`
        );
      }

      // If item doesn't exist in system yet, resolve or create it
      let finalItemId = line.itemId || poLine?.itemId || null;
      if (!finalItemId && line.name) {
        const existingItem = await tx.item.findFirst({
          where: { companyId, name: line.name.trim() },
        });
        if (existingItem) {
          finalItemId = existingItem.id;
        } else {
          const newItem = await tx.item.create({
            data: {
              companyId,
              name: line.name.trim(),
              sku: line.sku || null,
              unit: line.unit || "PCS",
              purchasePrice: new Decimal(Number(line.rate || 0)),
              stock: 0,
              type: "PRODUCT",
            },
          });
          finalItemId = newItem.id;
        }
      }

      grnLinesToCreate.push({
        purchaseOrderLineId: poLine ? poLine.id : null,
        itemId: finalItemId,
        name: line.name || poLine?.name || "Item",
        sku: line.sku || poLine?.sku || null,
        unit: line.unit || poLine?.unit || "PCS",
        orderedQty: new Decimal(orderedQty),
        receivedQty: new Decimal(currentReceiving),
        pendingQty: new Decimal(pendingAfter),
        rate: new Decimal(Number(line.rate || poLine?.rate || 0)),
      });

      // Update POLine receivedQty
      if (poLine) {
        await tx.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: {
            receivedQty: { increment: currentReceiving },
          },
        });
      }

      // Record stock movement (Goods entering warehouse)
      if (receiveNow && settings.inventoryEnabled && finalItemId) {
        await recordStockMovement(
          {
            companyId,
            itemId: finalItemId,
            warehouseId,
            movementType: "PURCHASE",
            referenceType: "GOODS_RECEIPT",
            referenceId: grnNo,
            qtyIn: currentReceiving,
            qtyOut: 0,
            unitCost: Number(line.rate || poLine?.rate || 0),
            totalCost: currentReceiving * Number(line.rate || poLine?.rate || 0),
            date,
            notes: `Stock received via GRN ${grnNo}${
              po ? ` (PO: ${po.poNo})` : ""
            }`,
            createdBy,
            allowNegative: true,
          },
          tx
        );
      }
    }

    if (grnLinesToCreate.length === 0) {
      throw new Error("Goods Receipt Note must have at least one line with received quantity > 0.");
    }

    // Create GRN record
    const goodsReceipt = await tx.goodsReceipt.create({
      data: {
        companyId,
        grnNo,
        date,
        purchaseOrderId: purchaseOrderId || null,
        partyId,
        warehouseId,
        status: receiveNow ? "RECEIVED" : "DRAFT",
        stockMoved: receiveNow,
        notes: notes || null,
        createdBy: createdBy || null,
        lines: { create: grnLinesToCreate },
      },
      include: { lines: true, purchaseOrder: true, party: true, warehouse: true },
    });

    // Update PO status
    if (po) {
      const refreshedLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: po.id },
      });
      const allFullyReceived = refreshedLines.every(
        (l) => Number(l.receivedQty) >= Number(l.orderedQty)
      );
      const someReceived = refreshedLines.some((l) => Number(l.receivedQty) > 0);

      const newStatus = allFullyReceived
        ? "RECEIVED"
        : someReceived
        ? "PARTIALLY_RECEIVED"
        : "CONFIRMED";

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newStatus },
      });
    }

    return goodsReceipt;
  });
}

/**
 * Converts a Goods Receipt (GRN) into a Purchase Invoice (Bill).
 * CRITICAL: Sets skipStockMovement = true because stock ALREADY entered the warehouse via GRN!
 */
export async function convertGoodsReceiptToPurchaseInvoice(
  grnId: string,
  companyId: string,
  options?: {
    dueDate?: Date;
    supplierInvoiceNo?: string;
    supplierInvoiceDate?: Date;
    isInterState?: boolean;
    paidAmount?: number;
    paymentMode?: "CASH" | "BANK" | "UPI" | "CARD" | "CHEQUE" | "OTHER";
    notes?: string;
    createdBy?: string;
  }
) {
  const grn = await prisma.goodsReceipt.findUnique({
    where: { id: grnId },
    include: {
      lines: { include: { item: true } },
      purchaseOrder: { include: { lines: true } },
      party: true,
    },
  });

  if (!grn || grn.companyId !== companyId) {
    throw new Error("Goods Receipt Note not found or does not belong to active company.");
  }

  if (grn.status === "CANCELLED") {
    throw new Error("Cannot create invoice from a cancelled Goods Receipt Note.");
  }

  if (grn.invoiceId) {
    throw new Error(`Goods Receipt Note ${grn.grnNo} has already been invoiced.`);
  }

  const isInterState = options?.isInterState ?? false;

  const invoiceLines: {
    itemId?: string;
    name: string;
    sku?: string;
    unit?: string;
    hsn?: string;
    qty: number;
    rate: number;
    discount?: number;
    gstRate: number;
  }[] = [];

  for (const line of grn.lines) {
    const receivedQty = Number(line.receivedQty);
    if (receivedQty <= 0) continue;

    let gstRate = 0;
    let hsn = "";
    if (line.itemId) {
      const it = await prisma.item.findUnique({ where: { id: line.itemId } });
      if (it) {
        gstRate = Number(it.gstRate || 0);
        hsn = it.hsn || "";
      }
    }

    invoiceLines.push({
      itemId: line.itemId || undefined,
      name: line.name,
      sku: line.sku || undefined,
      unit: line.unit,
      hsn,
      qty: receivedQty,
      rate: Number(line.rate || 0),
      discount: 0,
      gstRate,
    });
  }

  // Create Purchase Invoice with skipStockMovement = true!
  const invoice = await createInvoice({
    companyId,
    type: "PURCHASE",
    partyId: grn.partyId || undefined,
    warehouseId: grn.warehouseId || undefined,
    date: new Date(),
    dueDate: options?.dueDate,
    supplierInvoiceNo: options?.supplierInvoiceNo,
    supplierInvoiceDate: options?.supplierInvoiceDate,
    orderNo: grn.purchaseOrder?.poNo || grn.grnNo,
    lines: invoiceLines,
    isInterState,
    status: "POSTED",
    skipStockMovement: true, // PREVENT DOUBLE STOCK ENTRY
    sourceDocType: "GOODS_RECEIPT",
    sourceDocId: grn.id,
    goodsReceiptId: grn.id,
    purchaseOrderId: grn.purchaseOrderId || undefined,
    paidAmount: options?.paidAmount || 0,
    paymentMode: options?.paymentMode || "BANK",
    notes: options?.notes || `Purchase bill generated from GRN ${grn.grnNo}`,
    createdBy: options?.createdBy || grn.createdBy || undefined,
  });

  // Link invoice back to GRN
  await prisma.goodsReceipt.update({
    where: { id: grn.id },
    data: {
      invoiceId: invoice.id,
    },
  });

  // Update billedQty on PurchaseOrder lines if linked
  if (grn.purchaseOrderId) {
    for (const grnline of grn.lines) {
      if (grnline.purchaseOrderLineId) {
        await prisma.purchaseOrderLine.update({
          where: { id: grnline.purchaseOrderLineId },
          data: {
            billedQty: { increment: Number(grnline.receivedQty) },
          },
        });
      }
    }
  }

  return invoice;
}

/**
 * Cancels a Goods Receipt Note and reverses stock movement.
 */
export async function cancelGoodsReceipt(
  grnId: string,
  companyId: string,
  reason?: string
) {
  const grn = await prisma.goodsReceipt.findUnique({
    where: { id: grnId },
    include: { lines: true, purchaseOrder: true },
  });

  if (!grn || grn.companyId !== companyId) {
    throw new Error("Goods Receipt Note not found or tenant mismatch.");
  }

  if (grn.status === "CANCELLED") {
    throw new Error("Goods Receipt Note is already cancelled.");
  }

  if (grn.invoiceId) {
    throw new Error(
      `Cannot cancel GRN ${grn.grnNo} because Purchase Invoice ${grn.invoiceId} is already created. Cancel the purchase invoice first.`
    );
  }

  const settings = await getCompanySettings(companyId);

  return await prisma.$transaction(async (tx) => {
    // 1. Remove stock if stock was moved
    if (grn.stockMoved && settings.inventoryEnabled) {
      for (const line of grn.lines) {
        if (line.itemId && Number(line.receivedQty) > 0) {
          await recordStockMovement(
            {
              companyId,
              itemId: line.itemId,
              warehouseId: grn.warehouseId,
              movementType: "PURCHASE_RETURN",
              referenceType: "GOODS_RECEIPT_CANCEL",
              referenceId: grn.grnNo,
              qtyIn: 0,
              qtyOut: Number(line.receivedQty),
              unitCost: Number(line.rate),
              totalCost: Number(line.receivedQty) * Number(line.rate),
              date: new Date(),
              notes: `Stock reversed from cancelled GRN ${grn.grnNo}${
                reason ? `: ${reason}` : ""
              }`,
              allowNegative: true,
            },
            tx
          );
        }
      }
    }

    // 2. Decrement receivedQty on POLines
    if (grn.purchaseOrderId) {
      for (const line of grn.lines) {
        if (line.purchaseOrderLineId && Number(line.receivedQty) > 0) {
          await tx.purchaseOrderLine.update({
            where: { id: line.purchaseOrderLineId },
            data: {
              receivedQty: { decrement: Number(line.receivedQty) },
            },
          });
        }
      }

      // Recalculate PO status
      const remainingLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: grn.purchaseOrderId },
      });
      const anyReceived = remainingLines.some((l) => Number(l.receivedQty) > 0);
      await tx.purchaseOrder.update({
        where: { id: grn.purchaseOrderId },
        data: {
          status: anyReceived ? "PARTIALLY_RECEIVED" : "CONFIRMED",
        },
      });
    }

    // 3. Update GRN status
    return await tx.goodsReceipt.update({
      where: { id: grn.id },
      data: {
        status: "CANCELLED",
        stockMoved: false,
        notes: grn.notes ? `${grn.notes} | Cancelled: ${reason || "No reason"}` : `Cancelled: ${reason || "No reason"}`,
      },
    });
  });
}

// ============================================================================
// 6. DIRECT SALES ORDER -> INVOICE CONVERSION (Without Delivery Challan)
// ============================================================================

/**
 * Direct conversion from Sales Order to Invoice when company does NOT use Delivery Challans.
 * Stock IS deducted on Invoice posting (skipStockMovement = false).
 */
export async function convertSalesOrderToDirectInvoice(
  salesOrderId: string,
  companyId: string,
  options?: {
    dueDate?: Date;
    isInterState?: boolean;
    paidAmount?: number;
    paymentMode?: "CASH" | "BANK" | "UPI" | "CARD" | "CHEQUE" | "OTHER";
    notes?: string;
    createdBy?: string;
  }
) {
  const so = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    include: { lines: true, party: true },
  });

  if (!so || so.companyId !== companyId) {
    throw new Error("Sales Order not found or tenant mismatch.");
  }

  if (so.status === "CANCELLED") {
    throw new Error("Cannot invoice a cancelled Sales Order.");
  }

  const invoiceLines = so.lines.map((l) => ({
    itemId: l.itemId || undefined,
    name: l.name,
    sku: l.sku || undefined,
    unit: l.unit,
    hsn: l.hsn || undefined,
    qty: Number(l.orderedQty),
    rate: Number(l.rate),
    discount: Number(l.discount || 0),
    gstRate: Number(l.gstRate || 0),
  }));

  const invoice = await createInvoice({
    companyId,
    type: "SALES",
    partyId: so.partyId || undefined,
    warehouseId: so.warehouseId || undefined,
    date: new Date(),
    dueDate: options?.dueDate,
    orderNo: so.orderNo,
    lines: invoiceLines,
    isInterState: options?.isInterState ?? false,
    status: "POSTED",
    skipStockMovement: false, // Stock deducted at invoice posting!
    sourceDocType: "SALES_ORDER",
    sourceDocId: so.id,
    salesOrderId: so.id,
    paidAmount: options?.paidAmount || 0,
    paymentMode: options?.paymentMode || "CASH",
    notes: options?.notes || `Invoice for Sales Order ${so.orderNo}`,
    createdBy: options?.createdBy || so.createdBy || undefined,
  });

  // Mark all lines invoiced and SO delivered/completed
  await prisma.$transaction(async (tx) => {
    for (const l of so.lines) {
      await tx.salesOrderLine.update({
        where: { id: l.id },
        data: {
          invoicedQty: l.orderedQty,
          deliveredQty: l.orderedQty,
        },
      });
    }
    await tx.salesOrder.update({
      where: { id: so.id },
      data: { status: "DELIVERED" },
    });
  });

  return invoice;
}

// ============================================================================
// 7. DOCUMENT LINKING & AUDIT TRAIL NAVIGATOR
// ============================================================================

export type DocumentLinkItem = {
  type: "QUOTATION" | "SALES_ORDER" | "DELIVERY_CHALLAN" | "INVOICE" | "PURCHASE_ORDER" | "GOODS_RECEIPT" | "PAYMENT";
  id: string;
  docNo: string;
  date: Date;
  status: string;
  amount?: number;
  url: string;
};

/**
 * Returns the entire lineage of linked documents for any document in the workflow.
 */
export async function getDocumentChain(
  docType: "QUOTATION" | "SALES_ORDER" | "DELIVERY_CHALLAN" | "INVOICE" | "PURCHASE_ORDER" | "GOODS_RECEIPT",
  docId: string,
  companyId: string
): Promise<DocumentLinkItem[]> {
  const chain: DocumentLinkItem[] = [];

  switch (docType) {
    case "QUOTATION": {
      const q = await prisma.quotation.findUnique({
        where: { id: docId },
        include: { salesOrders: { include: { deliveryChallans: true, invoices: true } } },
      });
      if (!q || q.companyId !== companyId) return [];

      chain.push({
        type: "QUOTATION",
        id: q.id,
        docNo: q.quotationNo,
        date: q.date,
        status: q.status,
        amount: Number(q.grandTotal),
        url: `/quotations/${q.id}`,
      });

      for (const so of q.salesOrders) {
        chain.push({
          type: "SALES_ORDER",
          id: so.id,
          docNo: so.orderNo,
          date: so.date,
          status: so.status,
          amount: Number(so.grandTotal),
          url: `/invoices`,
        });

        for (const dc of so.deliveryChallans) {
          chain.push({
            type: "DELIVERY_CHALLAN",
            id: dc.id,
            docNo: dc.dcNo,
            date: dc.date,
            status: dc.status,
            url: `/delivery-challans/${dc.id}`,
          });
        }

        for (const inv of so.invoices) {
          chain.push({
            type: "INVOICE",
            id: inv.id,
            docNo: inv.invoiceNo,
            date: inv.date,
            status: inv.status,
            amount: Number(inv.grandTotal),
            url: `/invoices/${inv.id}`,
          });
        }
      }
      break;
    }

    case "SALES_ORDER": {
      const so = await prisma.salesOrder.findUnique({
        where: { id: docId },
        include: { quotation: true, deliveryChallans: true, invoices: true },
      });
      if (!so || so.companyId !== companyId) return [];

      if (so.quotation) {
        chain.push({
          type: "QUOTATION",
          id: so.quotation.id,
          docNo: so.quotation.quotationNo,
          date: so.quotation.date,
          status: so.quotation.status,
          amount: Number(so.quotation.grandTotal),
          url: `/quotations/${so.quotation.id}`,
        });
      }

      chain.push({
        type: "SALES_ORDER",
        id: so.id,
        docNo: so.orderNo,
        date: so.date,
        status: so.status,
        amount: Number(so.grandTotal),
        url: `/invoices`,
      });

      for (const dc of so.deliveryChallans) {
        chain.push({
          type: "DELIVERY_CHALLAN",
          id: dc.id,
          docNo: dc.dcNo,
          date: dc.date,
          status: dc.status,
          url: `/delivery-challans/${dc.id}`,
        });
      }

      for (const inv of so.invoices) {
        chain.push({
          type: "INVOICE",
          id: inv.id,
          docNo: inv.invoiceNo,
          date: inv.date,
          status: inv.status,
          amount: Number(inv.grandTotal),
          url: `/invoices/${inv.id}`,
        });
      }
      break;
    }

    case "DELIVERY_CHALLAN": {
      const dc = await prisma.deliveryChallan.findUnique({
        where: { id: docId },
        include: { salesOrder: { include: { quotation: true } }, invoice: true },
      });
      if (!dc || dc.companyId !== companyId) return [];

      if (dc.salesOrder?.quotation) {
        chain.push({
          type: "QUOTATION",
          id: dc.salesOrder.quotation.id,
          docNo: dc.salesOrder.quotation.quotationNo,
          date: dc.salesOrder.quotation.date,
          status: dc.salesOrder.quotation.status,
          amount: Number(dc.salesOrder.quotation.grandTotal),
          url: `/quotations/${dc.salesOrder.quotation.id}`,
        });
      }

      if (dc.salesOrder) {
        chain.push({
          type: "SALES_ORDER",
          id: dc.salesOrder.id,
          docNo: dc.salesOrder.orderNo,
          date: dc.salesOrder.date,
          status: dc.salesOrder.status,
          amount: Number(dc.salesOrder.grandTotal),
          url: `/invoices`,
        });
      }

      chain.push({
        type: "DELIVERY_CHALLAN",
        id: dc.id,
        docNo: dc.dcNo,
        date: dc.date,
        status: dc.status,
        url: `/delivery-challans/${dc.id}`,
      });

      if (dc.invoice) {
        chain.push({
          type: "INVOICE",
          id: dc.invoice.id,
          docNo: dc.invoice.invoiceNo,
          date: dc.invoice.date,
          status: dc.invoice.status,
          amount: Number(dc.invoice.grandTotal),
          url: `/invoices/${dc.invoice.id}`,
        });
      }
      break;
    }

    case "PURCHASE_ORDER": {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: docId },
        include: { grns: true, invoices: true },
      });
      if (!po || po.companyId !== companyId) return [];

      chain.push({
        type: "PURCHASE_ORDER",
        id: po.id,
        docNo: po.poNo,
        date: po.date,
        status: po.status,
        amount: Number(po.grandTotal),
        url: `/purchase-orders/${po.id}`,
      });

      for (const grn of po.grns) {
        chain.push({
          type: "GOODS_RECEIPT",
          id: grn.id,
          docNo: grn.grnNo,
          date: grn.date,
          status: grn.status,
          url: `/goods-receipts/${grn.id}`,
        });
      }

      for (const inv of po.invoices) {
        chain.push({
          type: "INVOICE",
          id: inv.id,
          docNo: inv.invoiceNo,
          date: inv.date,
          status: inv.status,
          amount: Number(inv.grandTotal),
          url: `/invoices/${inv.id}`,
        });
      }
      break;
    }

    case "GOODS_RECEIPT": {
      const grn = await prisma.goodsReceipt.findUnique({
        where: { id: docId },
        include: { purchaseOrder: true, invoice: true },
      });
      if (!grn || grn.companyId !== companyId) return [];

      if (grn.purchaseOrder) {
        chain.push({
          type: "PURCHASE_ORDER",
          id: grn.purchaseOrder.id,
          docNo: grn.purchaseOrder.poNo,
          date: grn.purchaseOrder.date,
          status: grn.purchaseOrder.status,
          amount: Number(grn.purchaseOrder.grandTotal),
          url: `/purchase-orders/${grn.purchaseOrder.id}`,
        });
      }

      chain.push({
        type: "GOODS_RECEIPT",
        id: grn.id,
        docNo: grn.grnNo,
        date: grn.date,
        status: grn.status,
        url: `/goods-receipts/${grn.id}`,
      });

      if (grn.invoice) {
        chain.push({
          type: "INVOICE",
          id: grn.invoice.id,
          docNo: grn.invoice.invoiceNo,
          date: grn.invoice.date,
          status: grn.invoice.status,
          amount: Number(grn.invoice.grandTotal),
          url: `/invoices/${grn.invoice.id}`,
        });
      }
      break;
    }

    case "INVOICE": {
      const inv = await prisma.invoice.findUnique({
        where: { id: docId },
        include: {
          salesOrder: { include: { quotation: true } },
          purchaseOrder: true,
          deliveryChallans: true,
          goodsReceipts: true,
          paymentAllocations: { include: { payment: true } },
        },
      });
      if (!inv || inv.companyId !== companyId) return [];

      if (inv.salesOrder?.quotation) {
        chain.push({
          type: "QUOTATION",
          id: inv.salesOrder.quotation.id,
          docNo: inv.salesOrder.quotation.quotationNo,
          date: inv.salesOrder.quotation.date,
          status: inv.salesOrder.quotation.status,
          amount: Number(inv.salesOrder.quotation.grandTotal),
          url: `/quotations/${inv.salesOrder.quotation.id}`,
        });
      }

      if (inv.salesOrder) {
        chain.push({
          type: "SALES_ORDER",
          id: inv.salesOrder.id,
          docNo: inv.salesOrder.orderNo,
          date: inv.salesOrder.date,
          status: inv.salesOrder.status,
          amount: Number(inv.salesOrder.grandTotal),
          url: `/invoices`,
        });
      }

      if (inv.purchaseOrder) {
        chain.push({
          type: "PURCHASE_ORDER",
          id: inv.purchaseOrder.id,
          docNo: inv.purchaseOrder.poNo,
          date: inv.purchaseOrder.date,
          status: inv.purchaseOrder.status,
          amount: Number(inv.purchaseOrder.grandTotal),
          url: `/purchase-orders/${inv.purchaseOrder.id}`,
        });
      }

      for (const dc of inv.deliveryChallans) {
        chain.push({
          type: "DELIVERY_CHALLAN",
          id: dc.id,
          docNo: dc.dcNo,
          date: dc.date,
          status: dc.status,
          url: `/delivery-challans/${dc.id}`,
        });
      }

      for (const grn of inv.goodsReceipts) {
        chain.push({
          type: "GOODS_RECEIPT",
          id: grn.id,
          docNo: grn.grnNo,
          date: grn.date,
          status: grn.status,
          url: `/goods-receipts/${grn.id}`,
        });
      }

      chain.push({
        type: "INVOICE",
        id: inv.id,
        docNo: inv.invoiceNo,
        date: inv.date,
        status: inv.status,
        amount: Number(inv.grandTotal),
        url: `/invoices/${inv.id}`,
      });

      for (const alloc of inv.paymentAllocations) {
        if (alloc.payment) {
          chain.push({
            type: "PAYMENT",
            id: alloc.payment.id,
            docNo: alloc.payment.paymentNo,
            date: alloc.payment.date,
            status: alloc.payment.status,
            amount: Number(alloc.amount),
            url: `/payments/${alloc.payment.id}`,
          });
        }
      }
      break;
    }
  }

  return chain;
}
