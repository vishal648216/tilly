/**
 * Taily Phase 6: Optional Business Workflows Test Suite
 * Tests: Quotation -> Sales Order -> Delivery Challan -> Invoice
 *        PO -> GRN -> Purchase Invoice
 *        Partial Delivery, Partial Receipt, Cancellation, Duplicate Prevention
 *        Anti-Duplication of Stock, Revenue, Payables, Receivables, Tax
 * Run: npx tsx scripts/test-phase6.ts
 */

import { prisma } from "../src/lib/prisma";
import {
  createQuotation,
  updateQuotationStatus,
  convertQuotationToSalesOrder,
  createSalesOrder,
  createDeliveryChallan,
  convertDeliveryChallanToInvoice,
  cancelDeliveryChallan,
  convertSalesOrderToDirectInvoice,
  createPurchaseOrder,
  createGoodsReceipt,
  convertGoodsReceiptToPurchaseInvoice,
  cancelGoodsReceipt,
  getDocumentChain,
} from "../src/lib/workflow";
import { createInvoice } from "../src/lib/invoice";
import { getAvailableStock } from "../src/lib/inventory";
import { getCompanySettings, updateCompanySettings } from "../src/lib/featureFlags";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
    failures.push(name);
  }
}

function group(name: string) {
  console.log(`\n--- ${name} ---`);
}

async function cleanup(companyId: string) {
  await prisma.paymentAllocation.deleteMany({ where: { companyId } });
  await prisma.payment.deleteMany({ where: { companyId } });
  await prisma.stockMovement.deleteMany({ where: { companyId } });
  await prisma.warehouseStock.deleteMany({ where: { companyId } });
  await prisma.voucherEntry.deleteMany({ where: { voucher: { companyId } } });
  await prisma.voucher.deleteMany({ where: { companyId } });
  await prisma.invoiceLine.deleteMany({ where: { invoice: { companyId } } });
  await prisma.invoice.deleteMany({ where: { companyId } });
  await prisma.deliveryChallanLine.deleteMany({ where: { deliveryChallan: { companyId } } });
  await prisma.deliveryChallan.deleteMany({ where: { companyId } });
  await prisma.salesOrderLine.deleteMany({ where: { salesOrder: { companyId } } });
  await prisma.salesOrder.deleteMany({ where: { companyId } });
  await prisma.quotationLine.deleteMany({ where: { quotation: { companyId } } });
  await prisma.quotation.deleteMany({ where: { companyId } });
  await prisma.goodsReceiptLine.deleteMany({ where: { goodsReceipt: { companyId } } });
  await prisma.goodsReceipt.deleteMany({ where: { companyId } });
  await prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrder: { companyId } } });
  await prisma.purchaseOrder.deleteMany({ where: { companyId } });
  await prisma.item.deleteMany({ where: { companyId } });
  await prisma.warehouse.deleteMany({ where: { companyId } });
  await prisma.party.deleteMany({ where: { companyId } });
}

async function runPhase6Tests() {
  console.log("=======================================================");
  console.log("💼  TAILY PHASE 6: BUSINESS WORKFLOWS TEST SUITE");
  console.log("=======================================================\n");

  const randSuffix = Math.floor(10000 + Math.random() * 90000);
  const companyName = `Phase6 Workflow Test ${randSuffix}`;

  console.log("[1] Setting up test environment...");
  const company = await prisma.company.create({
    data: {
      name: companyName,
      state: "Maharashtra",
      country: "India",
      currency: "INR",
    },
  });
  const companyId = company.id;

  // Enable all workflow feature flags for this test company
  await updateCompanySettings(companyId, {
    inventoryEnabled: true,
    gstEnabled: true,
    warehouseEnabled: true,
    quotationEnabled: true,
    salesOrderEnabled: true,
    deliveryChallanEnabled: true,
    purchaseOrderEnabled: true,
    goodsReceiptEnabled: true,
    negativeStockAllowed: true,
  });

  const warehouse = await prisma.warehouse.create({
    data: {
      companyId,
      name: "Main Test Godown",
      code: "WH-T1",
      isDefault: true,
      active: true,
    },
  });

  const customer = await prisma.party.create({
    data: {
      companyId,
      name: "Apex Retailers Ltd",
      type: "CUSTOMER",
      state: "Maharashtra",
      gstin: "27AABCA1234F1Z1",
    },
  });

  const supplier = await prisma.party.create({
    data: {
      companyId,
      name: "Zenith Suppliers Hub",
      type: "VENDOR",
      state: "Maharashtra",
      gstin: "27AABBZ5678K1Z5",
    },
  });

  const testProduct = await prisma.item.create({
    data: {
      companyId,
      name: "Industrial Valve X100",
      sku: "VALVE-X100",
      unit: "PCS",
      hsn: "8481",
      purchasePrice: 400,
      salePrice: 600,
      gstRate: 18,
      stock: 500, // Pre-seeded initial stock
      type: "PRODUCT",
    },
  });

  console.log(`[1] Setup complete: Company "${companyName}", Item "${testProduct.name}" (Stock: 500)\n`);

  try {
    // =========================================================================
    // GROUP 1: QUOTATION LIFECYCLE & CONVERSION
    // =========================================================================
    group("Group 1: Quotation Lifecycle & Conversion");

    const quotation = await createQuotation({
      companyId,
      partyId: customer.id,
      date: new Date(),
      validUntil: new Date(Date.now() + 15 * 86400000),
      items: [
        {
          itemId: testProduct.id,
          name: testProduct.name,
          qty: 50,
          rate: 600,
          discount: 1000,
          gstRate: 18,
        },
      ],
      notes: "Quote valid for 15 days",
      terms: "100% advance or 15 days credit",
      status: "DRAFT",
    });

    test("Quotation: Created with DRAFT status", quotation.status === "DRAFT");
    test("Quotation: Quotation number starts with QUO-", quotation.quotationNo.startsWith("QUO-"));
    test("Quotation: SubTotal correct (50 × 600 - 1000 = 29000)", Number(quotation.subTotal) === 29000);
    test("Quotation: 18% GST on 29000 = 5220", Number(quotation.taxTotal) === 5220);
    test("Quotation: Grand total = 34220", Number(quotation.grandTotal) === 34220);

    // Update status to ACCEPTED
    const acceptedQuote = await updateQuotationStatus(quotation.id, companyId, "ACCEPTED");
    test("Quotation: Status updated to ACCEPTED", acceptedQuote.status === "ACCEPTED");

    // Convert Quotation -> Sales Order
    const convertedSO = await convertQuotationToSalesOrder(quotation.id, companyId, {
      warehouseId: warehouse.id,
    });

    test("Quotation -> Order: Sales Order created successfully", Boolean(convertedSO.id));
    test("Quotation -> Order: Order number starts with SO-", convertedSO.orderNo.startsWith("SO-"));
    test("Quotation -> Order: Sales Order status is CONFIRMED", convertedSO.status === "CONFIRMED");
    test("Quotation -> Order: Source quotation linked (quotationId)", convertedSO.quotationId === quotation.id);
    test("Quotation -> Order: Line orderedQty = 50", Number(convertedSO.lines[0].orderedQty) === 50);

    // Verify quotation is marked CONVERTED
    const refQuote = await prisma.quotation.findUnique({ where: { id: quotation.id } });
    test("Quotation: Status changed to CONVERTED", refQuote?.status === "CONVERTED");
    test("Quotation: convertedToOrderId matches SO ID", refQuote?.convertedToOrderId === convertedSO.id);

    // Duplicate conversion guard
    let duplicateErrorThrown = false;
    try {
      await convertQuotationToSalesOrder(quotation.id, companyId);
    } catch (e: any) {
      duplicateErrorThrown = true;
    }
    test("Quotation: Duplicate conversion blocked", duplicateErrorThrown);

    // =========================================================================
    // GROUP 2: DIRECT SALES ORDER -> INVOICE (No Delivery Challan)
    // =========================================================================
    group("Group 2: Direct Sales Order -> Invoice (No Delivery Challan)");

    const directSO = await createSalesOrder({
      companyId,
      partyId: customer.id,
      date: new Date(),
      warehouseId: warehouse.id,
      items: [
        {
          itemId: testProduct.id,
          name: testProduct.name,
          qty: 20,
          rate: 600,
          gstRate: 18,
        },
      ],
      status: "CONFIRMED",
    });

    const stockBeforeDirect = await getAvailableStock({ companyId, itemId: testProduct.id });

    // Retail / direct flow skips DC and converts SO directly to Invoice
    const directInvoice = await convertSalesOrderToDirectInvoice(directSO.id, companyId);

    const stockAfterDirect = await getAvailableStock({ companyId, itemId: testProduct.id });

    test("Direct SO -> Inv: Invoice created with POSTED status", directInvoice.status === "POSTED");
    test("Direct SO -> Inv: Document link preserved (salesOrderId)", directInvoice.salesOrderId === directSO.id);
    test("Direct SO -> Inv: Source doc type = SALES_ORDER", directInvoice.sourceDocType === "SALES_ORDER");
    test("Direct SO -> Inv: Stock deducted ONCE (decreased by 20)", stockBeforeDirect - stockAfterDirect === 20);

    const refreshedDirectSO = await prisma.salesOrder.findUnique({ where: { id: directSO.id } });
    test("Direct SO -> Inv: Sales Order status updated to DELIVERED", refreshedDirectSO?.status === "DELIVERED");

    // =========================================================================
    // GROUP 3: SALES ORDER -> DELIVERY CHALLAN (Partial & Full Delivery)
    // =========================================================================
    group("Group 3: Delivery Challan — Partial & Full Deliveries");

    const workflowSO = await createSalesOrder({
      companyId,
      partyId: customer.id,
      date: new Date(),
      warehouseId: warehouse.id,
      items: [
        {
          itemId: testProduct.id,
          name: testProduct.name,
          qty: 100, // 100 units ordered
          rate: 600,
          gstRate: 18,
        },
      ],
      status: "CONFIRMED",
    });

    const stockBeforeDC = await getAvailableStock({ companyId, itemId: testProduct.id });

    // Partial Delivery 1: Deliver 60 units (out of 100)
    const dc1 = await createDeliveryChallan({
      companyId,
      salesOrderId: workflowSO.id,
      date: new Date(),
      lines: [
        {
          salesOrderLineId: workflowSO.lines[0].id,
          name: testProduct.name,
          orderedQty: 100,
          deliveredQty: 60,
          rate: 600,
        },
      ],
      dispatchNow: true,
    });

    const stockAfterDC1 = await getAvailableStock({ companyId, itemId: testProduct.id });

    test("Partial Delivery: DC 1 created with DISPATCHED status", dc1.status === "DISPATCHED");
    test("Partial Delivery: DC 1 stockMoved = true", dc1.stockMoved === true);
    test("Partial Delivery: Stock decreased by delivered qty (60 units)", stockBeforeDC - stockAfterDC1 === 60);

    const dc1Line = dc1.lines[0];
    test("Partial Delivery: DC 1 line orderedQty = 100", Number(dc1Line.orderedQty) === 100);
    test("Partial Delivery: DC 1 line deliveredQty = 60", Number(dc1Line.deliveredQty) === 60);
    test("Partial Delivery: DC 1 line pendingQty = 40", Number(dc1Line.pendingQty) === 40);

    const soAfterDC1 = await prisma.salesOrder.findUnique({
      where: { id: workflowSO.id },
      include: { lines: true },
    });
    test("Partial Delivery: SO status changed to PARTIALLY_DELIVERED", soAfterDC1?.status === "PARTIALLY_DELIVERED");
    test("Partial Delivery: SO line deliveredQty incremented to 60", Number(soAfterDC1?.lines[0].deliveredQty) === 60);

    // Over-delivery guard: trying to deliver 50 more when only 40 pending
    let overDeliveryBlocked = false;
    try {
      await createDeliveryChallan({
        companyId,
        salesOrderId: workflowSO.id,
        date: new Date(),
        lines: [
          {
            salesOrderLineId: workflowSO.lines[0].id,
            name: testProduct.name,
            orderedQty: 100,
            deliveredQty: 50, // exceeds 40 pending!
            rate: 600,
          },
        ],
      });
    } catch (e) {
      overDeliveryBlocked = true;
    }
    test("Partial Delivery: Over-delivery (> pending qty) blocked", overDeliveryBlocked);

    // Partial Delivery 2: Deliver remaining 40 units
    const dc2 = await createDeliveryChallan({
      companyId,
      salesOrderId: workflowSO.id,
      date: new Date(),
      lines: [
        {
          salesOrderLineId: workflowSO.lines[0].id,
          name: testProduct.name,
          orderedQty: 100,
          deliveredQty: 40,
          rate: 600,
        },
      ],
      dispatchNow: true,
    });

    const stockAfterDC2 = await getAvailableStock({ companyId, itemId: testProduct.id });
    test("Full Delivery: DC 2 created for remaining 40 units", dc2.lines[0].deliveredQty.toNumber() === 40);
    test("Full Delivery: Stock decreased by additional 40 units", stockAfterDC1 - stockAfterDC2 === 40);

    const soAfterDC2 = await prisma.salesOrder.findUnique({
      where: { id: workflowSO.id },
      include: { lines: true },
    });
    test("Full Delivery: SO status updated to DELIVERED", soAfterDC2?.status === "DELIVERED");
    test("Full Delivery: SO line deliveredQty equals orderedQty (100)", Number(soAfterDC2?.lines[0].deliveredQty) === 100);

    // =========================================================================
    // GROUP 4: DELIVERY CHALLAN -> INVOICE (NO DOUBLE STOCK DEDUCTION)
    // =========================================================================
    group("Group 4: Delivery Challan -> Invoice (No Double Stock Deduction)");

    const stockBeforeDC1Invoice = await getAvailableStock({ companyId, itemId: testProduct.id });

    // Convert DC 1 (60 units) to Invoice
    const invoiceForDC1 = await convertDeliveryChallanToInvoice(dc1.id, companyId, {
      notes: "Invoice for DC-1 (60 units)",
    });

    const stockAfterDC1Invoice = await getAvailableStock({ companyId, itemId: testProduct.id });

    test("DC -> Invoice: Invoice created successfully", Boolean(invoiceForDC1.id));
    test("DC -> Invoice: skipStockMovement is true on Invoice", invoiceForDC1.skipStockMovement === true);
    test("CRITICAL: Stock NOT deducted again when invoice is generated", stockBeforeDC1Invoice === stockAfterDC1Invoice);
    test("DC -> Invoice: Invoice linked to deliveryChallanId", invoiceForDC1.deliveryChallanId === dc1.id);
    test("DC -> Invoice: Invoice linked to salesOrderId", invoiceForDC1.salesOrderId === workflowSO.id);

    const refDC1 = await prisma.deliveryChallan.findUnique({ where: { id: dc1.id } });
    test("DC -> Invoice: Delivery Challan status updated to DELIVERED", refDC1?.status === "DELIVERED");
    test("DC -> Invoice: Delivery Challan invoiceId linked to Invoice", refDC1?.invoiceId === invoiceForDC1.id);

    // Duplicate invoicing guard
    let duplicateInvoiceBlocked = false;
    try {
      await convertDeliveryChallanToInvoice(dc1.id, companyId);
    } catch (e) {
      duplicateInvoiceBlocked = true;
    }
    test("DC -> Invoice: Duplicate invoice creation blocked", duplicateInvoiceBlocked);

    // =========================================================================
    // GROUP 5: DELIVERY CHALLAN CANCELLATION & STOCK REVERSAL
    // =========================================================================
    group("Group 5: Delivery Challan Cancellation & Stock Reversal");

    const cancelTestSO = await createSalesOrder({
      companyId,
      partyId: customer.id,
      date: new Date(),
      warehouseId: warehouse.id,
      items: [{ itemId: testProduct.id, name: testProduct.name, qty: 30, rate: 600, gstRate: 18 }],
    });

    const stockBeforeCancelTest = await getAvailableStock({ companyId, itemId: testProduct.id });

    const cancelTestDC = await createDeliveryChallan({
      companyId,
      salesOrderId: cancelTestSO.id,
      date: new Date(),
      lines: [{ salesOrderLineId: cancelTestSO.lines[0].id, name: testProduct.name, orderedQty: 30, deliveredQty: 30, rate: 600 }],
      dispatchNow: true,
    });

    const stockAfterDispatch = await getAvailableStock({ companyId, itemId: testProduct.id });
    test("DC Cancel: Stock deducted upon dispatch (-30)", stockBeforeCancelTest - stockAfterDispatch === 30);

    // Cancel DC
    await cancelDeliveryChallan(cancelTestDC.id, companyId, "Customer cancelled order at gate");

    const stockAfterCancel = await getAvailableStock({ companyId, itemId: testProduct.id });
    test("DC Cancel: Stock restored on cancellation (+30)", stockAfterCancel === stockBeforeCancelTest);

    const cancelledDC = await prisma.deliveryChallan.findUnique({ where: { id: cancelTestDC.id } });
    test("DC Cancel: DC status changed to CANCELLED", cancelledDC?.status === "CANCELLED");
    test("DC Cancel: stockMoved set to false", cancelledDC?.stockMoved === false);

    const revertedSO = await prisma.salesOrder.findUnique({
      where: { id: cancelTestSO.id },
      include: { lines: true },
    });
    test("DC Cancel: SO deliveredQty reverted to 0", Number(revertedSO?.lines[0].deliveredQty) === 0);
    test("DC Cancel: SO status reverted to CONFIRMED", revertedSO?.status === "CONFIRMED");

    // Guard: Cannot cancel DC if already invoiced
    let invoicedDCCancelBlocked = false;
    try {
      await cancelDeliveryChallan(dc1.id, companyId);
    } catch (e) {
      invoicedDCCancelBlocked = true;
    }
    test("DC Cancel: Cannot cancel Delivery Challan after invoice is created", invoicedDCCancelBlocked);

    // =========================================================================
    // GROUP 6: PURCHASE ORDER -> GOODS RECEIPT (GRN) (Partial & Full Receipt)
    // =========================================================================
    group("Group 6: Purchase Order -> Goods Receipt (GRN)");

    const po = await createPurchaseOrder({
      companyId,
      partyId: supplier.id,
      date: new Date(),
      warehouseId: warehouse.id,
      items: [
        {
          itemId: testProduct.id,
          name: testProduct.name,
          qty: 100, // PO for 100 units
          rate: 400,
          gstRate: 18,
        },
      ],
      status: "CONFIRMED",
    });

    test("PO: Created with status CONFIRMED", po.status === "CONFIRMED");
    test("PO: PO number starts with PO-", po.poNo.startsWith("PO-"));
    test("PO: Grand total = 47200 (100 × 400 + 18% GST)", Number(po.grandTotal) === 47200);

    const stockBeforeGRN = await getAvailableStock({ companyId, itemId: testProduct.id });

    // Partial Receipt 1: Receive 70 units (Pending = 30)
    const grn1 = await createGoodsReceipt({
      companyId,
      purchaseOrderId: po.id,
      date: new Date(),
      lines: [
        {
          purchaseOrderLineId: po.lines[0].id,
          name: testProduct.name,
          orderedQty: 100,
          receivedQty: 70, // Example: PO = 100, Received = 70, Pending = 30
          rate: 400,
        },
      ],
      receiveNow: true,
    });

    const stockAfterGRN1 = await getAvailableStock({ companyId, itemId: testProduct.id });

    test("GRN 1: Created with status RECEIVED", grn1.status === "RECEIVED");
    test("GRN 1: GRN number starts with GRN-", grn1.grnNo.startsWith("GRN-"));
    test("GRN 1: Stock increased by exactly received quantity (+70)", stockAfterGRN1 - stockBeforeGRN === 70);

    const grn1Line = grn1.lines[0];
    test("GRN 1: Line orderedQty = 100", Number(grn1Line.orderedQty) === 100);
    test("GRN 1: Line receivedQty = 70", Number(grn1Line.receivedQty) === 70);
    test("GRN 1: Line pendingQty = 30", Number(grn1Line.pendingQty) === 30);

    const poAfterGRN1 = await prisma.purchaseOrder.findUnique({
      where: { id: po.id },
      include: { lines: true },
    });
    test("PO: Status changed to PARTIALLY_RECEIVED", poAfterGRN1?.status === "PARTIALLY_RECEIVED");
    test("PO: Line receivedQty incremented to 70", Number(poAfterGRN1?.lines[0].receivedQty) === 70);

    // Over-receipt guard: trying to receive 40 when only 30 pending
    let overReceiptBlocked = false;
    try {
      await createGoodsReceipt({
        companyId,
        purchaseOrderId: po.id,
        date: new Date(),
        lines: [
          {
            purchaseOrderLineId: po.lines[0].id,
            name: testProduct.name,
            orderedQty: 100,
            receivedQty: 40, // exceeds 30 pending!
            rate: 400,
          },
        ],
      });
    } catch (e) {
      overReceiptBlocked = true;
    }
    test("PO -> GRN: Over-receipt (> pending qty) blocked", overReceiptBlocked);

    // Partial Receipt 2: Receive remaining 30 units
    const grn2 = await createGoodsReceipt({
      companyId,
      purchaseOrderId: po.id,
      date: new Date(),
      lines: [
        {
          purchaseOrderLineId: po.lines[0].id,
          name: testProduct.name,
          orderedQty: 100,
          receivedQty: 30,
          rate: 400,
        },
      ],
      receiveNow: true,
    });

    const stockAfterGRN2 = await getAvailableStock({ companyId, itemId: testProduct.id });
    test("GRN 2: Remaining 30 units received into stock", stockAfterGRN2 - stockAfterGRN1 === 30);

    const poAfterGRN2 = await prisma.purchaseOrder.findUnique({
      where: { id: po.id },
      include: { lines: true },
    });
    test("PO: Status changed to RECEIVED", poAfterGRN2?.status === "RECEIVED");
    test("PO: Line receivedQty equals orderedQty (100)", Number(poAfterGRN2?.lines[0].receivedQty) === 100);

    // =========================================================================
    // GROUP 7: GOODS RECEIPT -> PURCHASE INVOICE (NO DOUBLE STOCK ENTRY)
    // =========================================================================
    group("Group 7: Goods Receipt -> Purchase Invoice (No Double Stock Entry)");

    const stockBeforeGRN1Bill = await getAvailableStock({ companyId, itemId: testProduct.id });

    // Convert GRN 1 (70 units) to Purchase Invoice
    const purchaseBillGRN1 = await convertGoodsReceiptToPurchaseInvoice(grn1.id, companyId, {
      supplierInvoiceNo: `SUP-INV-${randSuffix}-01`,
      supplierInvoiceDate: new Date(),
    });

    const stockAfterGRN1Bill = await getAvailableStock({ companyId, itemId: testProduct.id });

    test("GRN -> Purchase: Purchase Bill created successfully", Boolean(purchaseBillGRN1.id));
    test("GRN -> Purchase: skipStockMovement is true on Purchase Bill", purchaseBillGRN1.skipStockMovement === true);
    test("CRITICAL: Stock NOT added again when purchase bill is generated", stockBeforeGRN1Bill === stockAfterGRN1Bill);
    test("GRN -> Purchase: Purchase Bill linked to goodsReceiptId", purchaseBillGRN1.goodsReceiptId === grn1.id);
    test("GRN -> Purchase: Purchase Bill linked to purchaseOrderId", purchaseBillGRN1.purchaseOrderId === po.id);

    const refGRN1 = await prisma.goodsReceipt.findUnique({ where: { id: grn1.id } });
    test("GRN -> Purchase: GRN invoiceId linked to Purchase Bill", refGRN1?.invoiceId === purchaseBillGRN1.id);

    // Duplicate bill guard
    let duplicateBillBlocked = false;
    try {
      await convertGoodsReceiptToPurchaseInvoice(grn1.id, companyId);
    } catch (e) {
      duplicateBillBlocked = true;
    }
    test("GRN -> Purchase: Duplicate bill creation blocked", duplicateBillBlocked);

    // =========================================================================
    // GROUP 8: GOODS RECEIPT CANCELLATION & STOCK REVERSAL
    // =========================================================================
    group("Group 8: Goods Receipt Cancellation & Stock Reversal");

    const cancelTestPO = await createPurchaseOrder({
      companyId,
      partyId: supplier.id,
      date: new Date(),
      warehouseId: warehouse.id,
      items: [{ itemId: testProduct.id, name: testProduct.name, qty: 25, rate: 400, gstRate: 18 }],
    });

    const stockBeforeCancelGRN = await getAvailableStock({ companyId, itemId: testProduct.id });

    const cancelTestGRN = await createGoodsReceipt({
      companyId,
      purchaseOrderId: cancelTestPO.id,
      date: new Date(),
      lines: [{ purchaseOrderLineId: cancelTestPO.lines[0].id, name: testProduct.name, orderedQty: 25, receivedQty: 25, rate: 400 }],
      receiveNow: true,
    });

    const stockAfterReceive = await getAvailableStock({ companyId, itemId: testProduct.id });
    test("GRN Cancel: Stock added on receipt (+25)", stockAfterReceive - stockBeforeCancelGRN === 25);

    // Cancel GRN
    await cancelGoodsReceipt(cancelTestGRN.id, companyId, "Damaged in transit / Rejected at unloading");

    const stockAfterGRNCancel = await getAvailableStock({ companyId, itemId: testProduct.id });
    test("GRN Cancel: Stock reversed on cancellation (-25)", stockAfterGRNCancel === stockBeforeCancelGRN);

    const cancelledGRN = await prisma.goodsReceipt.findUnique({ where: { id: cancelTestGRN.id } });
    test("GRN Cancel: GRN status changed to CANCELLED", cancelledGRN?.status === "CANCELLED");
    test("GRN Cancel: stockMoved set to false", cancelledGRN?.stockMoved === false);

    const revertedPO = await prisma.purchaseOrder.findUnique({
      where: { id: cancelTestPO.id },
      include: { lines: true },
    });
    test("GRN Cancel: PO receivedQty reverted to 0", Number(revertedPO?.lines[0].receivedQty) === 0);
    test("GRN Cancel: PO status reverted to CONFIRMED", revertedPO?.status === "CONFIRMED");

    // Guard: Cannot cancel GRN if already billed
    let billedGRNCancelBlocked = false;
    try {
      await cancelGoodsReceipt(grn1.id, companyId);
    } catch (e) {
      billedGRNCancelBlocked = true;
    }
    test("GRN Cancel: Cannot cancel Goods Receipt after purchase bill is created", billedGRNCancelBlocked);

    // =========================================================================
    // GROUP 9: DOCUMENT CHAIN & FULL TRACEABILITY
    // =========================================================================
    group("Group 9: Document Chain & Full Traceability");

    const salesChainFromQuote = await getDocumentChain("QUOTATION", quotation.id, companyId);
    test("Doc Chain: Quote chain contains QUOTATION", salesChainFromQuote.some((d) => d.type === "QUOTATION"));
    test("Doc Chain: Quote chain contains converted SALES_ORDER", salesChainFromQuote.some((d) => d.type === "SALES_ORDER"));

    const salesChainFromDC = await getDocumentChain("DELIVERY_CHALLAN", dc1.id, companyId);
    test("Doc Chain: DC chain contains SALES_ORDER", salesChainFromDC.some((d) => d.type === "SALES_ORDER"));
    test("Doc Chain: DC chain contains DELIVERY_CHALLAN", salesChainFromDC.some((d) => d.type === "DELIVERY_CHALLAN"));
    test("Doc Chain: DC chain contains linked INVOICE", salesChainFromDC.some((d) => d.type === "INVOICE"));

    const purchaseChainFromGRN = await getDocumentChain("GOODS_RECEIPT", grn1.id, companyId);
    test("Doc Chain: GRN chain contains PURCHASE_ORDER", purchaseChainFromGRN.some((d) => d.type === "PURCHASE_ORDER"));
    test("Doc Chain: GRN chain contains GOODS_RECEIPT", purchaseChainFromGRN.some((d) => d.type === "GOODS_RECEIPT"));
    test("Doc Chain: GRN chain contains linked INVOICE (Purchase Bill)", purchaseChainFromGRN.some((d) => d.type === "INVOICE"));

    // =========================================================================
    // GROUP 10: ANTI-DUPLICATION INTEGRITY AUDIT
    // =========================================================================
    group("Group 10: Anti-Duplication Integrity Audit");

    // Check all accounting vouchers generated for this company
    const vouchers = await prisma.voucher.findMany({
      where: { companyId },
      include: { entries: true },
    });

    let allBalanced = true;
    for (const v of vouchers) {
      const dr = v.entries.reduce((a, e) => a + Number(e.debit), 0);
      const cr = v.entries.reduce((a, e) => a + Number(e.credit), 0);
      if (Math.abs(dr - cr) > 0.05) allBalanced = false;
    }
    test("Integrity: All posted accounting vouchers are strictly balanced (Dr = Cr)", allBalanced);

    // Verify revenue was recognized ONLY on posted invoices (not on quotations or SO or DC)
    const revenueEntries = await prisma.voucherEntry.findMany({
      where: {
        voucher: { companyId },
        account: { code: "4001" }, // Sales Account
      },
    });
    // In our test we created: 1 direct invoice (20 units @ 600 = 12000) + 1 DC1 invoice (60 units @ 600 = 36000)
    const totalSalesRev = revenueEntries.reduce((a, e) => a + Number(e.credit), 0);
    test("Integrity: Sales revenue recognized exactly matches invoiced amount (₹48,000)", totalSalesRev === 48000);

    // Verify Sundry Creditors (2001) recognized ONLY on purchase bill
    const creditorEntries = await prisma.voucherEntry.findMany({
      where: {
        voucher: { companyId },
        account: { code: "2001" },
      },
    });
    // Purchase bill for GRN1: 70 units @ 400 + 18% = 28000 + 5040 = 33040
    const totalPayable = creditorEntries.reduce((a, e) => a + Number(e.credit), 0);
    test("Integrity: Sundry Creditors payable recognized exactly matches purchase bill (₹33,040)", totalPayable === 33040);

    // =========================================================================
    // GROUP 11: BUSINESS CONFIGURATION & DIRECT FLOW PRESERVATION
    // =========================================================================
    group("Group 11: Business Configuration & Direct Flow Preservation");

    const directCompany = await prisma.company.create({
      data: {
        name: `Direct Retailer ${randSuffix}`,
        currency: "INR",
      },
    });

    // Workflow features turned OFF (pure direct retail store)
    await updateCompanySettings(directCompany.id, {
      inventoryEnabled: true,
      gstEnabled: true,
      quotationEnabled: false,
      salesOrderEnabled: false,
      deliveryChallanEnabled: false,
      purchaseOrderEnabled: false,
      goodsReceiptEnabled: false,
    });

    const settings = await getCompanySettings(directCompany.id);
    test("Config: quotationEnabled is false", settings.quotationEnabled === false);
    test("Config: deliveryChallanEnabled is false", settings.deliveryChallanEnabled === false);
    test("Config: goodsReceiptEnabled is false", settings.goodsReceiptEnabled === false);

    // Direct invoice works seamlessly without workflow constraints
    const directRetailInvoice = await createInvoice({
      companyId: directCompany.id,
      type: "SALES",
      date: new Date(),
      lines: [
        {
          name: "Direct Retail Item",
          qty: 5,
          rate: 100,
          gstRate: 18,
        },
      ],
      isInterState: false,
      status: "POSTED",
    });

    test("Config: Direct invoice works seamlessly when workflows are OFF", Boolean(directRetailInvoice.id));
    test("Config: Direct invoice has valid invoice number", directRetailInvoice.invoiceNo.startsWith("INV-"));

    await cleanup(directCompany.id);
    await prisma.company.delete({ where: { id: directCompany.id } });
  } finally {
    console.log("\n[Cleanup] Cleaning up test data...");
    await cleanup(companyId);
    await prisma.company.delete({ where: { id: companyId } });
    console.log("[Cleanup] Complete.");
  }

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    console.error("Failures:", failures);
    process.exit(1);
  }
}

runPhase6Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
