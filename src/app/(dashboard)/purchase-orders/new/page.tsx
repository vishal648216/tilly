import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewPurchaseOrderForm from "./NewPurchaseOrderForm";
import { ShoppingCart } from "lucide-react";

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
        type: { in: ["VENDOR", "BOTH"] },
      },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({
      where: { companyId: company.id },
      orderBy: { name: "asc" },
    }),
    prisma.warehouse.findMany({
      where: { companyId: company.id, active: true },
      orderBy: { isDefault: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-indigo-600" />
          Issue Purchase Order (PO)
        </h1>
        <p className="text-sm text-slate-500">
          Place a formal procurement order with your supplier. Physical inventory is recorded when Goods Receipt Note (GRN) is received.
        </p>
      </div>

      <NewPurchaseOrderForm
        parties={parties}
        items={items}
        warehouses={warehouses}
        companyState={company.state}
      />
    </div>
  );
}
