import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AdjustmentsClient from "./AdjustmentsClient";

export const dynamic = "force-dynamic";

export default async function AdjustmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const [warehouses, items, recentAdjustments] = await Promise.all([
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
      where: {
        companyId: company.id,
        movementType: { in: ["STOCK_ADJUSTMENT", "DAMAGE", "WASTAGE", "OPENING"] },
        referenceType: "ADJUSTMENT",
      },
      include: {
        item: { select: { id: true, name: true, sku: true, unit: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const formattedAdjustments = recentAdjustments.map((a) => ({
    id: a.id,
    referenceId: a.referenceId,
    date: a.date.toISOString(),
    createdAt: a.createdAt.toISOString(),
    item: a.item.name,
    itemId: a.itemId,
    sku: a.item.sku,
    unit: a.item.unit,
    warehouse: a.warehouse ? a.warehouse.name : "Default Godown",
    warehouseCode: a.warehouse?.code || "",
    qtyIn: a.qtyIn,
    qtyOut: a.qtyOut,
    quantity: a.qtyIn > 0 ? a.qtyIn : a.qtyOut,
    direction: (a.qtyIn > 0 ? "INCREASE" : "DECREASE") as "INCREASE" | "DECREASE",
    movementType: a.movementType,
    notes: a.notes,
    createdBy: a.createdBy,
  }));

  return (
    <AdjustmentsClient
      warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code, isDefault: w.isDefault }))}
      items={items.map((i) => ({
        id: i.id,
        name: i.name,
        sku: i.sku,
        barcode: i.barcode,
        unit: i.unit,
        stock: Number(i.stock),
      }))}
      initialAdjustments={formattedAdjustments}
    />
  );
}
