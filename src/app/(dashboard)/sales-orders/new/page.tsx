import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewSalesOrderForm from "./NewSalesOrderForm";
import { ShoppingCart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewSalesOrderPage({
  searchParams,
}: {
  searchParams: { quotationId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const [parties, items, warehouses] = await Promise.all([
    prisma.party.findMany({
      where: {
        companyId: company.id,
        type: { in: ["CUSTOMER", "BOTH"] },
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

  let initialData: any = null;

  if (searchParams.quotationId) {
    const quote = await prisma.quotation.findFirst({
      where: { id: searchParams.quotationId, companyId: company.id },
      include: { lines: true, party: true },
    });
    if (quote) {
      initialData = {
        partyId: quote.partyId || "",
        quotationId: quote.id,
        notes: quote.notes ? `${quote.notes} (From Quote ${quote.quotationNo})` : `Converted from Quotation ${quote.quotationNo}`,
        terms: quote.terms || undefined,
        lines: quote.lines.map((l, idx) => ({
          key: Date.now() + idx,
          itemId: l.itemId || "",
          name: l.name,
          sku: l.sku || "",
          unit: l.unit || "PCS",
          hsn: l.hsn || "",
          qty: Number(l.qty),
          rate: Number(l.rate),
          discount: Number(l.discount || 0),
          gstRate: Number(l.gstRate || 0),
        })),
      };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-blue-600" />
          Create Customer Sales Order
        </h1>
        <p className="text-sm text-slate-500">
          Record confirmed customer orders, track fulfillment progress, and prepare for delivery dispatch.
        </p>
      </div>

      <NewSalesOrderForm
        parties={parties}
        items={items}
        warehouses={warehouses}
        companyState={company.state}
        initialData={initialData}
      />
    </div>
  );
}
