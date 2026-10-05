import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewChallanForm from "./NewChallanForm";
import { Truck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewDeliveryChallanPage({
  searchParams,
}: {
  searchParams: { salesOrderId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const [parties, warehouses, items] = await Promise.all([
    prisma.party.findMany({
      where: {
        companyId: company.id,
        type: { in: ["CUSTOMER", "BOTH"] },
      },
      orderBy: { name: "asc" },
    }),
    prisma.warehouse.findMany({
      where: { companyId: company.id, active: true },
      orderBy: { isDefault: "desc" },
    }),
    prisma.item.findMany({
      where: { companyId: company.id },
      orderBy: { name: "asc" },
    }),
  ]);

  let initialData: any = null;

  if (searchParams.salesOrderId) {
    const so = await prisma.salesOrder.findFirst({
      where: { id: searchParams.salesOrderId, companyId: company.id },
      include: { lines: true, party: true, warehouse: true },
    });

    if (so) {
      // Filter lines where pending qty > 0
      const lines = so.lines
        .map((l, idx) => {
          const ordered = Number(l.orderedQty);
          const delivered = Number(l.deliveredQty);
          const pending = Math.max(0, ordered - delivered);

          return {
            key: Date.now() + idx,
            salesOrderLineId: l.id,
            itemId: l.itemId || undefined,
            name: l.name,
            sku: l.sku || undefined,
            unit: l.unit || "PCS",
            orderedQty: ordered,
            deliveredQty: pending, // Default to dispatching all remaining
            pendingQty: pending,
            rate: Number(l.rate || 0),
          };
        })
        .filter((l) => l.pendingQty > 0);

      initialData = {
        salesOrderId: so.id,
        salesOrderNo: so.orderNo,
        partyId: so.partyId || "",
        warehouseId: so.warehouseId || undefined,
        notes: `Dispatch against Sales Order ${so.orderNo}`,
        lines,
      };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Truck className="h-6 w-6 text-emerald-600" />
          Create Delivery Challan (Goods Dispatch)
        </h1>
        <p className="text-sm text-slate-500">
          Record physical dispatch of items from warehouse. When converted to invoice later, inventory will not be deducted twice.
        </p>
      </div>

      <NewChallanForm
        parties={parties}
        warehouses={warehouses}
        items={items}
        initialData={initialData}
      />
    </div>
  );
}
