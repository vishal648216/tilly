import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ItemsClient from "./ItemsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ItemsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const items = await prisma.item.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
  });

  const isInventoryEnabled = company.settings?.inventoryEnabled ?? true;

  const formattedItems = items.map((i) => {
    let supplierName: string | null = null;
    try {
      if (i.customFields) {
        const parsed = JSON.parse(i.customFields);
        supplierName = parsed.supplierName || parsed.purchasedFrom || null;
      }
    } catch {}

    return {
      id: i.id,
      name: i.name,
      sku: i.sku,
      barcode: i.barcode,
      category: i.category,
      brand: i.brand,
      type: i.type,
      hsn: i.hsn,
      unit: i.unit || "PCS",
      mrp: Number(i.mrp || 0),
      salePrice: Number(i.salePrice || 0),
      purchasePrice: Number(i.purchasePrice || 0),
      gstRate: Number(i.gstRate || 0),
      taxMode: i.taxMode || "EXCLUSIVE",
      stock: Number(i.stock || 0),
      minStock: Number(i.minStock || 0),
      supplierName,
    };
  });

  return (
    <ItemsClient
      items={formattedItems}
      companyName={company.name}
      isInventoryEnabled={isInventoryEnabled}
    />
  );
}
