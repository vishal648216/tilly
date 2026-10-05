import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewGoodsReceiptForm from "./NewGoodsReceiptForm";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewGoodsReceiptPage({
  searchParams,
}: {
  searchParams: { purchaseOrderId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const [parties, warehouses, items] = await Promise.all([
    prisma.party.findMany({
      where: {
        companyId: company.id,
        type: { in: ["VENDOR", "BOTH"] },
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

  if (searchParams.purchaseOrderId) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: searchParams.purchaseOrderId, companyId: company.id },
      include: { lines: true, party: true, warehouse: true },
    });

    if (po) {
      const lines = po.lines
        .map((l, idx) => {
          const ordered = Number(l.orderedQty);
          const received = Number(l.receivedQty);
          const pending = Math.max(0, ordered - received);

          return {
            key: Date.now() + idx,
            purchaseOrderLineId: l.id,
            itemId: l.itemId || undefined,
            name: l.name,
            sku: l.sku || undefined,
            unit: l.unit || "PCS",
            orderedQty: ordered,
            receivedQty: pending, // Default to receiving remaining pending qty
            pendingQty: pending,
            rate: Number(l.rate || 0),
          };
        })
        .filter((l) => l.pendingQty > 0);

      initialData = {
        purchaseOrderId: po.id,
        purchaseOrderNo: po.poNo,
        partyId: po.partyId || "",
        warehouseId: po.warehouseId || undefined,
        notes: `Inward against Purchase Order ${po.poNo}`,
        lines,
      };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Package className="h-6 w-6 text-indigo-600" />
          Create Goods Receipt Note (GRN)
        </h1>
        <p className="text-sm text-slate-500">
          Verify physical delivery from supplier into warehouse stock. When converted to a purchase bill later, inventory will not be added twice.
        </p>
      </div>

      <NewGoodsReceiptForm
        parties={parties}
        warehouses={warehouses}
        items={items}
        initialData={initialData}
      />
    </div>
  );
}
