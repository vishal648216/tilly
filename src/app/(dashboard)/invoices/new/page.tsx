import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewInvoiceForm from "./NewInvoiceForm";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: {
    type?: string;
    quotationId?: string;
    salesOrderId?: string;
    challanId?: string;
    purchaseOrderId?: string;
    grnId?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const isPurchaseWorkflow = Boolean(searchParams.purchaseOrderId || searchParams.grnId);
  const invoiceType = (searchParams.type === "PURCHASE" || isPurchaseWorkflow) ? "PURCHASE" : "SALES";

  const [parties, items, warehouses] = await Promise.all([
    prisma.party.findMany({
      where: {
        companyId: company.id,
        ...(invoiceType === "SALES"
          ? { type: { in: ["CUSTOMER", "BOTH"] } }
          : { type: { in: ["VENDOR", "BOTH"] } }),
      },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({
      where: { companyId: company.id, active: true },
      orderBy: { isDefault: "desc" },
    }),
  ]);

  let initialData: any = null;

  // Pre-load from Quotation
  if (searchParams.quotationId) {
    const quote = await prisma.quotation.findFirst({
      where: { id: searchParams.quotationId, companyId: company.id },
      include: { lines: true, party: true },
    });
    if (quote) {
      initialData = {
        partyId: quote.partyId || "",
        notes: quote.notes ? `${quote.notes} (From Quote ${quote.quotationNo})` : `Converted from Quotation ${quote.quotationNo}`,
        quotationId: quote.id,
        sourceDocType: "QUOTATION",
        sourceDocId: quote.id,
        sourceDocLabel: `Quotation #${quote.quotationNo}`,
        lines: quote.lines.map((l, idx) => ({
          key: Date.now() + idx,
          itemId: l.itemId || "",
          name: l.name,
          sku: l.sku || "",
          barcode: "",
          unit: l.unit || "PCS",
          hsn: l.hsn || "",
          qty: Number(l.qty),
          rate: Number(l.rate),
          discount: Number(l.discount || 0),
          gstRate: Number(l.gstRate || 0),
        })),
      };
    }
  }

  // Pre-load from Sales Order
  if (!initialData && searchParams.salesOrderId) {
    const so = await prisma.salesOrder.findFirst({
      where: { id: searchParams.salesOrderId, companyId: company.id },
      include: { lines: true, party: true, warehouse: true },
    });
    if (so) {
      initialData = {
        partyId: so.partyId || "",
        warehouseId: so.warehouseId || undefined,
        orderNo: so.orderNo,
        notes: so.notes ? `${so.notes} (Against SO ${so.orderNo})` : `Created against Sales Order ${so.orderNo}`,
        salesOrderId: so.id,
        sourceDocType: "SALES_ORDER",
        sourceDocId: so.id,
        sourceDocLabel: `Sales Order #${so.orderNo}`,
        lines: so.lines.map((l, idx) => ({
          key: Date.now() + idx,
          itemId: l.itemId || "",
          name: l.name,
          sku: l.sku || "",
          barcode: "",
          unit: l.unit || "PCS",
          hsn: l.hsn || "",
          qty: Number(l.orderedQty),
          rate: Number(l.rate),
          discount: Number(l.discount || 0),
          gstRate: Number(l.gstRate || 0),
        })),
      };
    }
  }

  // Pre-load from Delivery Challan
  if (!initialData && searchParams.challanId) {
    const dc = await prisma.deliveryChallan.findFirst({
      where: { id: searchParams.challanId, companyId: company.id },
      include: { lines: true, party: true, warehouse: true, salesOrder: true },
    });
    if (dc) {
      initialData = {
        partyId: dc.partyId || "",
        warehouseId: dc.warehouseId || undefined,
        orderNo: dc.salesOrder?.orderNo || dc.dcNo,
        notes: `Invoiced from Delivery Challan ${dc.dcNo}`,
        deliveryChallanId: dc.id,
        salesOrderId: dc.salesOrderId || undefined,
        skipStockMovement: true, // Goods already left warehouse with Challan
        sourceDocType: "DELIVERY_CHALLAN",
        sourceDocId: dc.id,
        sourceDocLabel: `Delivery Challan #${dc.dcNo}`,
        lines: dc.lines.map((l, idx) => ({
          key: Date.now() + idx,
          itemId: l.itemId || "",
          name: l.name,
          sku: l.sku || "",
          barcode: "",
          unit: l.unit || "PCS",
          hsn: "",
          qty: Number(l.deliveredQty),
          rate: Number(l.rate || 0),
          discount: 0,
          gstRate: 18,
        })),
      };
    }
  }

  // Pre-load from Purchase Order
  if (!initialData && searchParams.purchaseOrderId) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: searchParams.purchaseOrderId, companyId: company.id },
      include: { lines: true, party: true, warehouse: true },
    });
    if (po) {
      initialData = {
        partyId: po.partyId || "",
        warehouseId: po.warehouseId || undefined,
        orderNo: po.poNo,
        notes: po.notes ? `${po.notes} (Against PO ${po.poNo})` : `Billed against Purchase Order ${po.poNo}`,
        purchaseOrderId: po.id,
        sourceDocType: "PURCHASE_ORDER",
        sourceDocId: po.id,
        sourceDocLabel: `Purchase Order #${po.poNo}`,
        lines: po.lines.map((l, idx) => ({
          key: Date.now() + idx,
          itemId: l.itemId || "",
          name: l.name,
          sku: l.sku || "",
          barcode: "",
          unit: l.unit || "PCS",
          hsn: l.hsn || "",
          qty: Number(l.orderedQty),
          rate: Number(l.rate),
          discount: Number(l.discount || 0),
          gstRate: Number(l.gstRate || 0),
        })),
      };
    }
  }

  // Pre-load from Goods Receipt Note (GRN)
  if (!initialData && searchParams.grnId) {
    const grn = await prisma.goodsReceipt.findFirst({
      where: { id: searchParams.grnId, companyId: company.id },
      include: { lines: true, party: true, warehouse: true, purchaseOrder: true },
    });
    if (grn) {
      initialData = {
        partyId: grn.partyId || "",
        warehouseId: grn.warehouseId || undefined,
        orderNo: grn.purchaseOrder?.poNo || grn.grnNo,
        notes: `Billed from Goods Receipt Note ${grn.grnNo}`,
        goodsReceiptId: grn.id,
        purchaseOrderId: grn.purchaseOrderId || undefined,
        skipStockMovement: true, // Physical inventory already inwarded into warehouse via GRN
        sourceDocType: "GOODS_RECEIPT",
        sourceDocId: grn.id,
        sourceDocLabel: `Goods Receipt #${grn.grnNo}`,
        lines: grn.lines.map((l, idx) => ({
          key: Date.now() + idx,
          itemId: l.itemId || "",
          name: l.name,
          sku: l.sku || "",
          barcode: "",
          unit: l.unit || "PCS",
          hsn: "",
          qty: Number(l.receivedQty),
          rate: Number(l.rate || 0),
          discount: 0,
          gstRate: 18,
        })),
      };
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">
        {invoiceType === "PURCHASE" ? "New Purchase Bill (Vendor Bill)" : "New Sales Invoice (Customer Bill)"}
      </h1>
      <NewInvoiceForm
        parties={parties}
        items={items}
        warehouses={warehouses}
        companyState={company.state}
        invoiceType={invoiceType}
        initialData={initialData}
      />
    </div>
  );
}
