import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PosClient from "./PosClient";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const [items, parties, warehouses] = await Promise.all([
    prisma.item.findMany({
      where: { companyId: company.id, active: true },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        category: true,
        unit: true,
        salePrice: true,
        mrp: true,
        gstRate: true,
        stock: true,
        taxMode: true,
        type: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.party.findMany({
      where: { companyId: company.id, type: { in: ["CUSTOMER", "BOTH"] } },
      select: {
        id: true,
        name: true,
        phone: true,
        gstin: true,
        state: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.warehouse.findMany({
      where: { companyId: company.id, active: true },
      select: {
        id: true,
        name: true,
        isDefault: true,
      },
      orderBy: { isDefault: "desc" },
    }),
  ]);

  const defaultWarehouseId = warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || "";

  return (
    <PosClient
      items={items.map((i) => ({
        ...i,
        salePrice: Number(i.salePrice || 0),
        mrp: Number(i.mrp || 0),
        gstRate: Number(i.gstRate || 0),
        stock: Number(i.stock || 0),
      }))}
      parties={parties}
      company={{
        id: company.id,
        name: company.name,
        phone: company.phone || null,
        email: company.email || null,
        address: company.address || null,
        city: company.city || null,
        state: company.state || null,
        gstin: company.gstin || null,
      }}
      defaultWarehouseId={defaultWarehouseId}
    />
  );
}
