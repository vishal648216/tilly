// Taily - Production-Grade Invoice & Purchase Engine
// Strict atomic posting, duplicate invoice control, credit limits, stock movements, and double-entry ledger.

import { prisma } from "./prisma";
import { roundTo2 } from "./currency";
import { Decimal } from "@prisma/client/runtime/library";
import { DEFAULT_CHART_OF_ACCOUNTS } from "./accounts";
import { getCompanySettings } from "./featureFlags";
import { recordStockMovement, getDefaultWarehouse, getAvailableStock } from "./inventory";
import { recordAuditLog } from "./audit";
import {
  checkCompanyStatus,
  canCreateInvoice,
  recordUsage,
  SubscriptionError,
} from "./subscriptionEnforcement";

export type InvoiceLineInput = {
  itemId?: string;
  name: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  hsn?: string;
  qty: number;
  rate: number;
  purchasePrice?: number;
  salePrice?: number;
  discount?: number; // line discount
  gstRate: number;
};

export type CreateInvoiceInput = {
  companyId: string;
  type: "SALES" | "PURCHASE";
  partyId?: string;
  warehouseId?: string;
  createdBy?: string;
  userEmail?: string;
  date: Date;
  dueDate?: Date;
  supplierInvoiceNo?: string;
  supplierInvoiceDate?: Date;
  billingAddress?: string;
  shippingAddress?: string;
  placeOfSupply?: string;
  salesperson?: string;
  orderNo?: string;
  paymentTerms?: string;
  discount?: number; // overall invoice discount
  freight?: number;  // freight / shipping charges
  otherCharges?: number; // packaging / other charges
  paidAmount?: number; // upfront payment at invoice creation
  paymentMode?: "CASH" | "BANK" | "UPI" | "CARD" | "CHEQUE" | "OTHER";
  paymentReference?: string;
  lines: InvoiceLineInput[];
  notes?: string;
  customFields?: string;
  // For inter-state: IGST applies. For intra-state: CGST+SGST split.
  isInterState: boolean;
  status?: "DRAFT" | "POSTED";
  quickAction?: "SAVE_DRAFT" | "SAVE_POST" | "SAVE_PRINT" | "SAVE_NEW";
  skipStockMovement?: boolean; // When true, stock movement is handled by DC/GRN
  sourceDocType?: string;      // QUOTATION, SALES_ORDER, DELIVERY_CHALLAN, PURCHASE_ORDER, GOODS_RECEIPT
  sourceDocId?: string;
  salesOrderId?: string;
  deliveryChallanId?: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
};

export async function createInvoice(input: CreateInvoiceInput) {
  const {
    companyId,
    type,
    partyId,
    date,
    dueDate,
    lines,
    notes,
    customFields,
    isInterState,
    supplierInvoiceNo,
    supplierInvoiceDate,
    billingAddress,
    shippingAddress,
    placeOfSupply,
    salesperson,
    orderNo,
    paymentTerms,
    discount = 0,
    freight = 0,
    otherCharges = 0,
    paidAmount = 0,
    paymentMode = "CASH",
    paymentReference,
    status: explicitStatus,
    quickAction,
    createdBy,
    userEmail,
    skipStockMovement = false,
    sourceDocType,
    sourceDocId,
    salesOrderId,
    deliveryChallanId,
    purchaseOrderId,
    goodsReceiptId,
  } = input;

  const isSales = type === "SALES";
  const isDraft = explicitStatus === "DRAFT" || quickAction === "SAVE_DRAFT";

  // 0. PHASE 8: Check company status and monthly invoice limit
  await checkCompanyStatus(companyId);
  const invoicePerm = await canCreateInvoice(companyId);
  if (!invoicePerm.allowed) {
    throw new SubscriptionError(
      invoicePerm.reason || "Monthly invoice limit exceeded for your active subscription plan.",
      403,
      "PLAN_LIMIT_EXCEEDED"
    );
  }

  // 1. VALIDATE PARTY & ITEM OWNERSHIP (IDOR GUARDS)
  let party = null;
  if (partyId) {
    party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.companyId !== companyId) {
      throw new Error("Cross-tenant access violation: Party not found or does not belong to active company.");
    }
  }

  for (const line of lines) {
    if (line.itemId) {
      const it = await prisma.item.findUnique({ where: { id: line.itemId } });
      if (it && it.companyId !== companyId) {
        throw new Error(`Cross-tenant access violation: Item ${line.itemId} does not belong to active company.`);
      }
    }
  }

  const settings = await getCompanySettings(companyId);

  // 2. SUPPLIER INVOICE DUPLICATE CONTROL (Requirement 3)
  if (!isSales && supplierInvoiceNo && supplierInvoiceNo.trim()) {
    const cleanSupplierInvoiceNo = supplierInvoiceNo.trim();
    const existingDuplicate = await prisma.invoice.findFirst({
      where: {
        companyId,
        partyId: partyId || null,
        type: "PURCHASE",
        supplierInvoiceNo: { equals: cleanSupplierInvoiceNo },
        status: { notIn: ["CANCELLED", "REVERSED"] },
      },
    });

    if (existingDuplicate) {
      if (settings.duplicateSupplierInvoiceBlock !== false) {
        throw new Error(
          `Duplicate supplier invoice: Supplier bill number "${cleanSupplierInvoiceNo}" already recorded on purchase bill ${existingDuplicate.invoiceNo} (Supplier: ${party?.name || "Vendor"}).`
        );
      }
    }
  }

  // 2b. ORDER REFERENCE (PO NUMBER) VALIDATION & DUPLICATE CONTROL
  let finalOrderNo = orderNo ? String(orderNo).trim().toUpperCase() : undefined;
  if (finalOrderNo) {
    const currentYear = new Date().getFullYear();
    const poPattern = /^(?:PO|SO)-(\d{4})-(\d{3,})$/i;
    const match = finalOrderNo.match(poPattern);
    if (!match && !input.sourceDocType) {
      throw new Error(
        `Invalid Order Ref format: "${finalOrderNo}". Format must be PO-YYYY-XXX (e.g. PO-${currentYear}-001). The format cannot be changed.`
      );
    }
    if (match) {
      const poYear = parseInt(match[1], 10);
      if (poYear !== currentYear) {
        throw new Error(
          `Year in PO number must be the current year (${currentYear}). Year ${poYear} is not allowed.`
        );
      }
    }
    const existingDuplicateOrder = await prisma.invoice.findFirst({
      where: {
        companyId,
        type,
        orderNo: { equals: finalOrderNo },
        status: { notIn: ["CANCELLED", "REVERSED"] },
      },
      select: { invoiceNo: true },
    });
    if (existingDuplicateOrder) {
      throw new Error(
        `Order Reference "${finalOrderNo}" already exists in ${type === "PURCHASE" ? "purchase bill" : "sales invoice"} ${existingDuplicateOrder.invoiceNo}! Duplicate references are not allowed.`
      );
    }
  }

  // 3. RESOLVE WAREHOUSE
  let warehouseId = input.warehouseId || null;
  if (warehouseId) {
    const wh = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!wh || wh.companyId !== companyId) {
      throw new Error("Specified warehouse not found or does not belong to active company.");
    }
  } else if (settings.warehouseEnabled || settings.inventoryEnabled) {
    const defaultWh = await getDefaultWarehouse(companyId);
    warehouseId = defaultWh.id;
  }

  // 4. CALCULATE LINE TOTALS & GST BREAKUP
  let linesSubTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  const builtLines = lines.map((line) => {
    const baseAmt = roundTo2(line.qty * line.rate);
    const lineDiscount = roundTo2(line.discount || 0);
    const taxableAmount = Math.max(0, roundTo2(baseAmt - lineDiscount));
    const gstAmt = roundTo2((taxableAmount * line.gstRate) / 100);

    let cgst = 0,
      sgst = 0,
      igst = 0;

    if (isInterState) {
      igst = gstAmt;
      igstTotal += igst;
    } else {
      cgst = roundTo2(gstAmt / 2);
      sgst = roundTo2(gstAmt / 2);
      cgstTotal += cgst;
      sgstTotal += sgst;
    }

    linesSubTotal += taxableAmount;

    return {
      itemId: line.itemId || null,
      name: line.name,
      sku: line.sku || null,
      barcode: line.barcode || null,
      unit: line.unit || "PCS",
      hsn: line.hsn || null,
      qty: new Decimal(line.qty),
      rate: new Decimal(line.rate),
      discount: new Decimal(lineDiscount),
      taxableAmount: new Decimal(taxableAmount),
      amount: new Decimal(taxableAmount + gstAmt),
      gstRate: new Decimal(line.gstRate),
      cgst: new Decimal(cgst),
      sgst: new Decimal(sgst),
      igst: new Decimal(igst),
    };
  });

  const overallDiscount = roundTo2(discount);
  const freightAmt = roundTo2(freight);
  const otherChargesAmt = roundTo2(otherCharges);

  const taxableBeforeGst = roundTo2(linesSubTotal);
  const totalGst = roundTo2(cgstTotal + sgstTotal + igstTotal);
  const beforeRound = roundTo2(taxableBeforeGst - overallDiscount + freightAmt + otherChargesAmt + totalGst);
  const grandTotal = settings.roundOffEnabled ? Math.round(beforeRound) : beforeRound;
  const roundOff = settings.roundOffEnabled ? roundTo2(grandTotal - beforeRound) : 0;

  // Paid & Balance calculations
  const effectivePaid = isDraft ? 0 : roundTo2(Math.min(grandTotal, paidAmount));
  const balance = roundTo2(grandTotal - effectivePaid);

  // Determine final status
  let documentStatus: string;
  if (isDraft) {
    documentStatus = "DRAFT";
  } else if (effectivePaid >= grandTotal - 0.01) {
    documentStatus = "PAID";
  } else if (effectivePaid > 0) {
    documentStatus = "PARTIALLY_PAID";
  } else {
    documentStatus = "POSTED";
  }

  // 5. CREDIT LIMIT ENFORCEMENT FOR SALES (Requirement 12)
  if (isSales && party && !isDraft) {
    const creditLimit = Number(party.creditLimit || 0);
    if (creditLimit > 0) {
      const unpaidNewAmount = Math.max(0, roundTo2(grandTotal - effectivePaid));
      if (unpaidNewAmount > 0) {
        const existingInvoices = await prisma.invoice.findMany({
          where: {
            companyId,
            partyId: party.id,
            type: "SALES",
            status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
          },
          select: { grandTotal: true, paidAmount: true },
        });

        const currentOutstanding = existingInvoices.reduce((sum, inv) => {
          return roundTo2(sum + Math.max(0, Number(inv.grandTotal) - Number(inv.paidAmount)));
        }, 0);

        const projectedOutstanding = roundTo2(currentOutstanding + unpaidNewAmount);
        if (projectedOutstanding > creditLimit) {
          if (settings.creditLimitBlock) {
            throw new Error(
              `Credit limit exceeded! Customer "${party.name}" has a limit of ₹${creditLimit}. Current outstanding is ₹${currentOutstanding} and new credit requested is ₹${unpaidNewAmount}. Total ₹${projectedOutstanding} exceeds credit limit.`
            );
          }
        }
      }
    }
  }

  // 6. VALIDATE AVAILABLE STOCK FOR SALES (Strict inventory protection)
  if (isSales && !isDraft && settings.inventoryEnabled && !settings.negativeStockAllowed) {
    const itemTotalQtyMap = new Map<string, { name: string; totalQty: number }>();
    for (const line of lines) {
      if (line.itemId) {
        const existing = itemTotalQtyMap.get(line.itemId) || { name: line.name, totalQty: 0 };
        existing.totalQty += line.qty;
        itemTotalQtyMap.set(line.itemId, existing);
      }
    }

    for (const [itemId, info] of itemTotalQtyMap.entries()) {
      const available = await getAvailableStock({
        companyId,
        itemId,
        warehouseId,
      });
      if (available < info.totalQty) {
        throw new Error(
          `Insufficient stock for "${info.name}". Available stock: ${available}, Requested: ${info.totalQty}. Cannot create bill with quantity greater than available stock.`
        );
      }
    }
  }

  // 7. BUILD BALANCED DOUBLE-ENTRY ENTRIES (Only if not DRAFT)
  const entries: { accountCode: string; debit: number; credit: number }[] = [];

  // 7a. COGS CALCULATION for Sales
  // Compute cost at Weighted Average Cost (WAC) stored on each item for COGS entry.
  // This is separate from the sales accounting entries.
  let totalCOGS = 0;
  if (isSales && !isDraft && settings.inventoryEnabled) {
    for (const line of lines) {
      if (line.itemId) {
        const itemForCost = await prisma.item.findUnique({
          where: { id: line.itemId },
          select: { purchasePrice: true, type: true },
        });
        if (itemForCost && itemForCost.type !== "SERVICE") {
          // purchasePrice is the Weighted Average Cost (maintained by recordStockMovement)
          const wac = roundTo2(Number(itemForCost.purchasePrice || 0));
          totalCOGS = roundTo2(totalCOGS + line.qty * wac);
        }
      }
    }
  }

  if (!isDraft) {
    const salesCode = isSales ? "4001" : "5001";
    const debtorCode = isSales ? "1100" : "2001";

    if (isSales) {
      // ---- SALES VOUCHER (Revenue Recognition) ----
      // Dr Sundry Debtors (or Cash/Bank if paid at counter)
      entries.push({ accountCode: debtorCode, debit: grandTotal, credit: 0 });
      // Cr Sales (taxable revenue only)
      entries.push({ accountCode: salesCode, debit: 0, credit: taxableBeforeGst });
      if (freightAmt > 0) entries.push({ accountCode: "4101", debit: 0, credit: freightAmt });
      if (otherChargesAmt > 0) entries.push({ accountCode: "4100", debit: 0, credit: otherChargesAmt });
      if (overallDiscount > 0) entries.push({ accountCode: "5300", debit: overallDiscount, credit: 0 });
      if (cgstTotal > 0) entries.push({ accountCode: "2100", debit: 0, credit: cgstTotal });
      if (sgstTotal > 0) entries.push({ accountCode: "2101", debit: 0, credit: sgstTotal });
      if (igstTotal > 0) entries.push({ accountCode: "2102", debit: 0, credit: igstTotal });
      if (roundOff < 0) entries.push({ accountCode: "4900", debit: Math.abs(roundOff), credit: 0 });
      else if (roundOff > 0) entries.push({ accountCode: "4900", debit: 0, credit: roundOff });

      // ---- COGS ENTRY (Inventory Cost Recognition) ----
      // Whenever inventory items are sold, derecognize inventory at WAC.
      // Dr Cost of Goods Sold (5400) — expense recognized when goods leave
      // Cr Stock in Hand (1200)      — asset reduced at WAC
      if (totalCOGS > 0 && settings.inventoryEnabled) {
        entries.push({ accountCode: "5400", debit: totalCOGS, credit: 0 });
        entries.push({ accountCode: "1200", debit: 0, credit: totalCOGS });
      }
    } else {
      // ---- PURCHASE VOUCHER (Inventory Acquisition — Perpetual System) ----
      // Under the Perpetual Inventory + COGS Method:
      //   Dr Stock in Hand (1200) for inventory items — increases BS asset
      //   Dr Input CGST/SGST/IGST  — recoverable tax asset
      //   Cr Sundry Creditors (2001) — liability to supplier
      //
      // Purchase account (5001) is used ONLY for non-inventory purchases
      // or when inventory is disabled. This ensures balance: Dr = Cr always.

      const isPurchaseOfInventory = settings.inventoryEnabled;

      if (isPurchaseOfInventory) {
        // Perpetual Inventory: Dr Stock in Hand instead of Dr Purchase
        entries.push({ accountCode: "1200", debit: taxableBeforeGst, credit: 0 });
      } else {
        // Non-inventory or inventory disabled: Dr Purchase (5001) as P&L expense
        entries.push({ accountCode: "5001", debit: taxableBeforeGst, credit: 0 });
      }

      if (freightAmt > 0) entries.push({ accountCode: "5200", debit: freightAmt, credit: 0 });
      if (otherChargesAmt > 0) entries.push({ accountCode: "5107", debit: otherChargesAmt, credit: 0 });
      if (overallDiscount > 0) entries.push({ accountCode: "4200", debit: 0, credit: overallDiscount });
      if (cgstTotal > 0) entries.push({ accountCode: "1300", debit: cgstTotal, credit: 0 });
      if (sgstTotal > 0) entries.push({ accountCode: "1301", debit: sgstTotal, credit: 0 });
      if (igstTotal > 0) entries.push({ accountCode: "1302", debit: igstTotal, credit: 0 });
      if (roundOff < 0) entries.push({ accountCode: "4900", debit: 0, credit: Math.abs(roundOff) });
      else if (roundOff > 0) entries.push({ accountCode: "4900", debit: roundOff, credit: 0 });
      // Cr Sundry Creditors (full payable amount)
      entries.push({ accountCode: "2001", debit: 0, credit: grandTotal });
    }
  }

  // 8. GENERATE SEQUENTIAL INVOICE & VOUCHER NUMBERS
  const invoicesOfType = await prisma.invoice.findMany({
    where: { companyId, type },
    select: { invoiceNo: true },
  });
  let maxSeq = 0;
  for (const inv of invoicesOfType) {
    const match = inv.invoiceNo.match(/\d+/g);
    if (match) {
      const parsed = parseInt(match[match.length - 1], 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }
  const nextSeq = Math.max(invoicesOfType.length + 1, maxSeq + 1);
  const invoiceNo = `${isSales ? "INV" : "PUR"}-${String(nextSeq).padStart(6, "0")}`;

  const vCount = await prisma.voucher.count({ where: { companyId } });
  const datePrefix = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const voucherNo = `V-${isSales ? "S" : "P"}-${datePrefix}-${String(vCount + 1).padStart(4, "0")}-${randomSuffix}`;

  // 9. VALIDATE & AUTO-SEED ACCOUNT CODES
  let accountMap = new Map<string, string>();
  if (!isDraft) {
    const codes = entries.map((e) => e.accountCode);
    let accounts = await prisma.account.findMany({
      where: { companyId, code: { in: codes } },
    });
    const existingCodes = new Set(accounts.map((a) => a.code));
    const missingCodes = codes.filter((c) => !existingCodes.has(c));

    if (missingCodes.length > 0) {
      for (const missingCode of missingCodes) {
        const def = DEFAULT_CHART_OF_ACCOUNTS.find((d) => d.code === missingCode);
        if (def) {
          const created = await prisma.account.create({
            data: {
              companyId,
              code: def.code,
              name: def.name,
              type: def.type,
              groupId: def.groupId,
            },
          });
          accounts.push(created);
        }
      }
    }
    accountMap = new Map(accounts.map((a) => [a.code, a.id]));
  }

  // 10. EXECUTE ATOMIC TRANSACTION (Prisma.$transaction)
  const result = await prisma.$transaction(async (tx) => {
    let voucherId: string | null = null;

    // A. Create Voucher (if not draft)
    if (!isDraft) {
      const voucher = await tx.voucher.create({
        data: {
          companyId,
          voucherNo,
          type: isSales ? "SALES" : "PURCHASE",
          date,
          partyId: partyId || null,
          narration: `${isSales ? "Sales invoice" : "Purchase bill"} ${invoiceNo}${
            supplierInvoiceNo ? ` (Supplier Inv: ${supplierInvoiceNo})` : ""
          }`,
          entries: {
            create: entries.map((e) => ({
              accountId: accountMap.get(e.accountCode)!,
              debit: new Decimal(e.debit),
              credit: new Decimal(e.credit),
            })),
          },
        },
      });
      voucherId = voucher.id;
    }

    // B. Resolve / Auto-create Items & Record Stock Movements
    for (let i = 0; i < builtLines.length; i++) {
      const line = builtLines[i];
      const rawLine = lines[i];
      const cleanName = line.name.trim();
      let matchedItem = null;

      if (line.itemId) {
        matchedItem = await tx.item.findUnique({ where: { id: line.itemId } });
        if (matchedItem && matchedItem.companyId !== companyId) {
          throw new Error(`Cross-tenant access violation: Item ${line.itemId} does not belong to active company.`);
        }
      }

      if (!matchedItem && cleanName) {
        const companyItems = await tx.item.findMany({ where: { companyId } });
        matchedItem =
          companyItems.find((i) => i.name.trim().toLowerCase() === cleanName.toLowerCase()) || null;
      }

      if (!isSales) {
        // Purchase Bill
        if (settings.inventoryEnabled) {
          if (matchedItem && matchedItem.type !== "SERVICE") {
            line.itemId = matchedItem.id;
            // Update purchase price, sale price, and gst rate on the item master
            await tx.item.update({
              where: { id: matchedItem.id },
              data: {
                purchasePrice: line.rate,
                ...(rawLine?.salePrice && Number(rawLine.salePrice) > 0 ? { salePrice: new Decimal(rawLine.salePrice) } : {}),
                ...(rawLine?.gstRate !== undefined ? { gstRate: new Decimal(rawLine.gstRate) } : {}),
              },
            }).catch(() => {});
          } else if (cleanName && (!matchedItem || matchedItem.type !== "SERVICE")) {
            // Auto-create newly purchased product
            const newItem = await tx.item.create({
              data: {
                companyId,
                name: cleanName,
                sku: line.sku || null,
                unit: line.unit || "PCS",
                hsn: line.hsn ? line.hsn.trim() : null,
                gstRate: line.gstRate,
                purchasePrice: line.rate,
                salePrice: new Decimal(
                  rawLine?.salePrice && Number(rawLine.salePrice) > 0
                    ? Number(rawLine.salePrice)
                    : roundTo2(line.rate.toNumber() > 0 ? line.rate.toNumber() * 1.2 : 0)
                ),
                stock: 0,
                type: "PRODUCT",
              },
            });
            line.itemId = newItem.id;
          }

          if (line.itemId && !isDraft && !skipStockMovement) {
            await recordStockMovement(
              {
                companyId,
                itemId: line.itemId,
                warehouseId,
                movementType: "PURCHASE",
                referenceType: "PURCHASE",
                referenceId: invoiceNo,
                qtyIn: line.qty.toNumber(),
                qtyOut: 0,
                unitCost: line.rate.toNumber(),
                totalCost: line.taxableAmount.toNumber(),
                date,
                notes: `Stock in via purchase bill ${invoiceNo}${
                  supplierInvoiceNo ? ` (Supplier Inv: ${supplierInvoiceNo})` : ""
                }`,
                createdBy,
                allowNegative: true,
              },
              tx
            );
          }
        }
      } else {
        // Sales Invoice
        if (settings.inventoryEnabled && matchedItem && matchedItem.type !== "SERVICE") {
          line.itemId = matchedItem.id;

          if (!isDraft && !skipStockMovement) {
            await recordStockMovement(
              {
                companyId,
                itemId: matchedItem.id,
                warehouseId,
                movementType: "SALE",
                referenceType: "INVOICE",
                referenceId: invoiceNo,
                qtyIn: 0,
                qtyOut: line.qty.toNumber(),
                unitCost: Number(matchedItem.purchasePrice || 0),
                totalCost: line.qty.toNumber() * Number(matchedItem.purchasePrice || 0),
                date,
                notes: `Stock out via sales invoice ${invoiceNo}`,
                createdBy,
                allowNegative: settings.negativeStockAllowed,
              },
              tx
            );
          }
        }
      }
    }

    // C. Create Invoice Record with Lines
    const invoice = await tx.invoice.create({
      data: {
        companyId,
        invoiceNo,
        type,
        partyId: partyId || null,
        date,
        dueDate,
        supplierInvoiceNo: supplierInvoiceNo ? supplierInvoiceNo.trim() : null,
        supplierInvoiceDate: supplierInvoiceDate || null,
        billingAddress: billingAddress || null,
        shippingAddress: shippingAddress || null,
        placeOfSupply: placeOfSupply || null,
        salesperson: salesperson || null,
        warehouseId,
        orderNo: finalOrderNo || null,
        paymentTerms: paymentTerms || null,
        subTotal: new Decimal(taxableBeforeGst),
        discount: new Decimal(overallDiscount),
        freight: new Decimal(freightAmt),
        otherCharges: new Decimal(otherChargesAmt),
        cgstTotal: new Decimal(cgstTotal),
        sgstTotal: new Decimal(sgstTotal),
        igstTotal: new Decimal(igstTotal),
        roundOff: new Decimal(roundOff),
        grandTotal: new Decimal(grandTotal),
        paidAmount: new Decimal(effectivePaid),
        status: documentStatus,
        notes: notes || null,
        customFields: customFields || null,
        voucherId,
        sourceDocType: sourceDocType || null,
        sourceDocId: sourceDocId || null,
        skipStockMovement,
        salesOrderId: salesOrderId || null,
        deliveryChallanId: deliveryChallanId || null,
        purchaseOrderId: purchaseOrderId || null,
        goodsReceiptId: goodsReceiptId || null,
        lines: { create: builtLines },
      },
      include: { lines: true, party: true, warehouse: true },
    });

    // D. If Upfront Payment Provided, Create Payment & PaymentAllocation
    if (!isDraft && effectivePaid > 0) {
      // Find or seed cash/bank account
      const cashOrBankHead =
        paymentMode === "CASH"
          ? await prisma.account.findFirst({ where: { companyId, code: "1001" } })
          : await prisma.account.findFirst({ where: { companyId, code: { in: ["1002", "1003"] } } });

      const counterHead = isSales
        ? await prisma.account.findFirst({ where: { companyId, code: "1100" } })
        : await prisma.account.findFirst({ where: { companyId, code: "2001" } });

      const pYear = date.getFullYear();
      const pCount = await tx.payment.count({ where: { companyId } });
      const payNo = `${isSales ? "REC" : "PAY"}-${pYear}-${String(pCount + 1).padStart(5, "0")}`;

      // Payment Voucher
      const payVoucherNo = `V-${isSales ? "REC" : "PAY"}-${datePrefix}-${String(vCount + 2).padStart(4, "0")}-${randomSuffix}`;
      const payVoucher = await tx.voucher.create({
        data: {
          companyId,
          voucherNo: payVoucherNo,
          type: isSales ? "RECEIPT" : "PAYMENT",
          date,
          partyId: partyId || null,
          invoiceId: invoice.id,
          narration: `Payment for ${isSales ? "sales invoice" : "purchase bill"} ${invoiceNo} via ${paymentMode}`,
          entries: {
            create: isSales
              ? [
                  { accountId: cashOrBankHead!.id, debit: new Decimal(effectivePaid), credit: new Decimal(0) },
                  { accountId: counterHead!.id, debit: new Decimal(0), credit: new Decimal(effectivePaid) },
                ]
              : [
                  { accountId: counterHead!.id, debit: new Decimal(effectivePaid), credit: new Decimal(0) },
                  { accountId: cashOrBankHead!.id, debit: new Decimal(0), credit: new Decimal(effectivePaid) },
                ],
          },
        },
      });

      // Payment entity
      const payment = await tx.payment.create({
        data: {
          companyId,
          paymentNo: payNo,
          type: isSales ? "RECEIPT" : "PAYMENT",
          partyId: partyId || null,
          date,
          amount: new Decimal(effectivePaid),
          unallocatedAmount: new Decimal(0),
          mode: paymentMode,
          accountId: cashOrBankHead?.id,
          reference: paymentReference || null,
          notes: `Upfront payment on bill ${invoiceNo}`,
          voucherId: payVoucher.id,
          status: "COMPLETED",
        },
      });

      // PaymentAllocation entity
      await tx.paymentAllocation.create({
        data: {
          companyId,
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount: new Decimal(effectivePaid),
          notes: `Full/partial allocation to ${invoiceNo}`,
        },
      });
    }

    return invoice;
  });

  // Record subscription usage for invoice count
  await recordUsage(companyId, "MONTHLY_INVOICES", 1);

  if (createdBy) {
    await recordAuditLog({
      companyId,
      userId: createdBy,
      userEmail,
      action: isDraft ? "SAVE_DRAFT_INVOICE" : "CREATE_INVOICE",
      entity: "Invoice",
      entityId: result.id,
      afterValue: {
        invoiceNo: result.invoiceNo,
        type: result.type,
        grandTotal,
        status: result.status,
      },
      details: `${isDraft ? "Saved draft" : "Posted"} ${type} invoice ${result.invoiceNo} (Total: ₹${grandTotal}, Status: ${result.status})`,
    });
  }

  return result;
}

/**
 * Safely cancels a posted financial transaction.
 * Posted transactions cannot be deleted. Instead, they are reversed with full auditability.
 */
export async function cancelInvoice(params: {
  invoiceId: string;
  companyId: string;
  reason: string;
  userId?: string;
  userEmail?: string;
}) {
  const { invoiceId, companyId, reason, userId, userEmail } = params;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: {
      lines: true,
      voucher: { include: { entries: true } },
      paymentAllocations: true,
    },
  });

  if (!invoice) {
    throw new Error("Invoice not found or does not belong to active company.");
  }

  if (invoice.status === "CANCELLED" || invoice.status === "REVERSED") {
    throw new Error(`Invoice ${invoice.invoiceNo} is already ${invoice.status.toLowerCase()}.`);
  }

  // If Draft: can delete directly or mark cancelled
  if (invoice.status === "DRAFT") {
    return await prisma.invoice.delete({ where: { id: invoice.id } });
  }

  // If Posted / Paid: execute atomic reversal
  const result = await prisma.$transaction(async (tx) => {
    const isSales = invoice.type === "SALES";

    // 1. Reverse Stock Movements
    for (const line of invoice.lines) {
      if (line.itemId) {
        await recordStockMovement(
          {
            companyId,
            itemId: line.itemId,
            warehouseId: invoice.warehouseId,
            movementType: isSales ? "SALE_RETURN" : "PURCHASE_RETURN",
            referenceType: "INVOICE",
            referenceId: invoice.invoiceNo,
            qtyIn: isSales ? Number(line.qty) : 0,
            qtyOut: isSales ? 0 : Number(line.qty),
            unitCost: Number(line.rate),
            totalCost: Number(line.amount),
            date: new Date(),
            notes: `Stock reversal for cancelled invoice ${invoice.invoiceNo} (${reason})`,
            createdBy: userId,
            allowNegative: true,
          },
          tx
        );
      }
    }

    // 2. Reverse Voucher
    if (invoice.voucher) {
      await tx.voucher.update({
        where: { id: invoice.voucher.id },
        data: { isReversed: true },
      });

      const currentYear = new Date().getFullYear();
      const count = await tx.voucher.count({ where: { companyId } });
      const revVoucherNo = `V-REV-${currentYear}-${String(count + 1).padStart(4, "0")}`;

      await tx.voucher.create({
        data: {
          companyId,
          voucherNo: revVoucherNo,
          type: "JOURNAL",
          date: new Date(),
          partyId: invoice.partyId,
          narration: `Reversal of ${invoice.type.toLowerCase()} invoice ${invoice.invoiceNo} (${reason})`,
          entries: {
            create: invoice.voucher.entries.map((e) => ({
              accountId: e.accountId,
              debit: e.credit, // swap debit and credit
              credit: e.debit,
            })),
          },
        },
      });
    }

    // 3. Mark invoice CANCELLED
    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledReason: reason,
      },
    });

    return updated;
  });

  if (userId) {
    await recordAuditLog({
      companyId,
      userId,
      userEmail,
      action: "CANCEL_INVOICE",
      entity: "Invoice",
      entityId: invoice.id,
      beforeValue: { invoiceNo: invoice.invoiceNo, grandTotal: invoice.grandTotal, status: invoice.status },
      afterValue: { status: "CANCELLED", cancelledReason: reason },
      details: `Cancelled invoice ${invoice.invoiceNo} (${reason})`,
    });
  }

  return result;
}
