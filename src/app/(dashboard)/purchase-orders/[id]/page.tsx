import { redirect, notFound } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PurchaseOrderDetailClient from "./PurchaseOrderDetailClient";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, companyId: company.id },
    include: {
      party: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          gstin: true,
          address: true,
          city: true,
          state: true,
        },
      },
      warehouse: {
        select: {
          id: true,
          name: true,
        },
      },
      lines: {
        orderBy: { id: "asc" },
      },
      grns: {
        select: {
          id: true,
          grnNo: true,
          date: true,
          status: true,
        },
        orderBy: { date: "desc" },
      },
      invoices: {
        select: {
          id: true,
          invoiceNo: true,
          date: true,
          status: true,
          grandTotal: true,
          paidAmount: true,
        },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!po) {
    notFound();
  }

  const formatted = {
    id: po.id,
    poNo: po.poNo,
    date: po.date.toISOString(),
    expectedDate: po.expectedDate ? po.expectedDate.toISOString() : null,
    status: po.status,
    notes: po.notes,
    terms: po.terms,
    subTotal: Number(po.subTotal || 0),
    discount: Number(po.discount || 0),
    taxTotal: Number(po.taxTotal || 0),
    grandTotal: Number(po.grandTotal || 0),
    party: po.party,
    warehouse: po.warehouse,
    lines: po.lines.map((l) => ({
      id: l.id,
      name: l.name,
      sku: l.sku,
      unit: l.unit,
      hsn: l.hsn,
      orderedQty: Number(l.orderedQty || 0),
      receivedQty: Number(l.receivedQty || 0),
      billedQty: Number(l.billedQty || 0),
      rate: Number(l.rate || 0),
      discount: Number(l.discount || 0),
      gstRate: Number(l.gstRate || 0),
      taxableAmount: Number(l.taxableAmount || 0),
      amount: Number(l.amount || 0),
    })),
    grns: po.grns.map((g) => ({
      id: g.id,
      grnNo: g.grnNo,
      date: g.date.toISOString(),
      status: g.status,
    })),
    invoices: po.invoices.map((inv) => ({
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      date: inv.date.toISOString(),
      status: inv.status,
      grandTotal: Number(inv.grandTotal || 0),
      paidAmount: Number(inv.paidAmount || 0),
    })),
  };

  return <PurchaseOrderDetailClient po={formatted} />;
}
