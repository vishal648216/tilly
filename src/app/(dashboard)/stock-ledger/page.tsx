import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getStockLedger } from "@/lib/inventory";
import StockLedgerClient from "./StockLedgerClient";

export const dynamic = "force-dynamic";

export default async function StockLedgerPage({
  searchParams,
}: {
  searchParams: {
    itemId?: string;
    warehouseId?: string;
    movementType?: string;
    from?: string;
    to?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const [items, warehouses, ledgerRows] = await Promise.all([
    prisma.item.findMany({
      where: { companyId: company.id, type: "PRODUCT" },
      select: { id: true, name: true, sku: true, unit: true },
      orderBy: { name: "asc" },
    }),
    prisma.warehouse.findMany({
      where: { companyId: company.id },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    getStockLedger(company.id, {
      itemId: searchParams.itemId,
      warehouseId: searchParams.warehouseId,
      movementType: searchParams.movementType,
      startDate: searchParams.from ? new Date(searchParams.from) : undefined,
      endDate: searchParams.to ? new Date(searchParams.to + "T23:59:59.999Z") : undefined,
    }),
  ]);

  const formattedLedger = ledgerRows.map((r) => ({
    ...r,
    date: r.date.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <StockLedgerClient
      items={items}
      warehouses={warehouses}
      initialLedger={formattedLedger}
      filters={{
        itemId: searchParams.itemId || "",
        warehouseId: searchParams.warehouseId || "",
        movementType: searchParams.movementType || "",
        from: searchParams.from || "",
        to: searchParams.to || "",
      }}
    />
  );
}
