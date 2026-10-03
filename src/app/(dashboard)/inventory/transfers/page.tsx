import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import TransfersClient from "./TransfersClient";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const [warehouses, items, transfersOut] = await Promise.all([
    prisma.warehouse.findMany({
      where: { companyId: company.id, active: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.item.findMany({
      where: { companyId: company.id, type: "PRODUCT", active: true },
      select: { id: true, name: true, sku: true, barcode: true, unit: true, stock: true },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: { companyId: company.id, movementType: "TRANSFER_OUT" },
      include: {
        item: { select: { id: true, name: true, sku: true, unit: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const refIds = transfersOut.map((t) => t.referenceId).filter(Boolean) as string[];
  const transfersIn = await prisma.stockMovement.findMany({
    where: { companyId: company.id, movementType: "TRANSFER_IN", referenceId: { in: refIds } },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
    },
  });

  const inMap = new Map(transfersIn.map((t) => [t.referenceId, t]));

  const formattedTransfers = transfersOut.map((out) => {
    const matchingIn = inMap.get(out.referenceId);
    return {
      id: out.id,
      transferRef: out.referenceId || "—",
      date: out.date.toISOString(),
      createdAt: out.createdAt.toISOString(),
      itemId: out.itemId,
      item: out.item.name,
      sku: out.item.sku,
      unit: out.item.unit,
      quantity: out.qtyOut,
      fromWarehouse: out.warehouse ? out.warehouse.name : "Source Godown",
      fromWarehouseCode: out.warehouse?.code || "",
      toWarehouse: matchingIn?.warehouse ? matchingIn.warehouse.name : "Destination Godown",
      toWarehouseCode: matchingIn?.warehouse?.code || "",
      notes: out.notes,
      createdBy: out.createdBy,
    };
  });

  return (
    <TransfersClient
      warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code, isDefault: w.isDefault }))}
      items={items.map((i) => ({
        id: i.id,
        name: i.name,
        sku: i.sku,
        barcode: i.barcode,
        unit: i.unit,
        stock: Number(i.stock),
      }))}
      initialTransfers={formattedTransfers}
    />
  );
}
