import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PurchaseOrdersClient from "./PurchaseOrdersClient";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { companyId: company.id },
    include: {
      party: { select: { id: true, name: true, phone: true } },
      warehouse: { select: { id: true, name: true } },
      lines: {
        select: {
          id: true,
          orderedQty: true,
          receivedQty: true,
          billedQty: true,
        },
      },
      invoices: { select: { id: true, invoiceNo: true } },
      grns: { select: { id: true, grnNo: true } },
    },
    orderBy: { date: "desc" },
  });

  const formatted = purchaseOrders.map((po) => {
    const orderedQty = po.lines.reduce((s, l) => s + Number(l.orderedQty || 0), 0);
    const receivedQty = po.lines.reduce((s, l) => s + Number(l.receivedQty || 0), 0);
    const billedQty = po.lines.reduce((s, l) => s + Number(l.billedQty || 0), 0);

    return {
      id: po.id,
      poNo: po.poNo,
      date: po.date.toISOString(),
      expectedDate: po.expectedDate ? po.expectedDate.toISOString() : null,
      status: po.status,
      party: po.party,
      warehouse: po.warehouse,
      grandTotal: Number(po.grandTotal || 0),
      orderedQty,
      receivedQty,
      billedQty,
      linesCount: po.lines.length,
      invoices: po.invoices || [],
      grns: po.grns || [],
    };
  });

  return <PurchaseOrdersClient purchaseOrders={formatted} />;
}
