import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewPurchaseOrderForm from "./NewPurchaseOrderForm";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const [parties, items, warehouses] = await Promise.all([
    prisma.party.findMany({
      where: {
        companyId: company.id,
        type: { in: ["VENDOR", "BOTH", "SUPPLIER"] },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        gstin: true,
        state: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({
      where: { companyId: company.id, active: true },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        hsn: true,
        purchasePrice: true,
        gstRate: true,
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

  return (
    <NewPurchaseOrderForm
      parties={parties}
      items={items.map((i) => ({
        ...i,
        purchasePrice: Number(i.purchasePrice || 0),
        gstRate: Number(i.gstRate || 0),
      }))}
      warehouses={warehouses}
      companyState={company.state || undefined}
    />
  );
}
