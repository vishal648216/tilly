import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import WarehouseClient from "./WarehouseClient";

export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const warehouses = await prisma.warehouse.findMany({
    where: { companyId: company.id },
    include: {
      _count: { select: { warehouseStocks: true, stockMovements: true } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const stockAggregates = await prisma.warehouseStock.groupBy({
    by: ["warehouseId"],
    where: { companyId: company.id },
    _sum: { quantity: true },
  });

  const stockMap = new Map(stockAggregates.map((s) => [s.warehouseId, s._sum.quantity || 0]));

  const formatted = warehouses.map((wh) => ({
    id: wh.id,
    name: wh.name,
    code: wh.code,
    address: wh.address,
    isDefault: wh.isDefault,
    active: wh.active,
    itemCount: wh._count.warehouseStocks,
    movementCount: wh._count.stockMovements,
    totalQuantity: stockMap.get(wh.id) || 0,
    createdAt: wh.createdAt.toISOString(),
  }));

  return <WarehouseClient initialWarehouses={formatted} />;
}
