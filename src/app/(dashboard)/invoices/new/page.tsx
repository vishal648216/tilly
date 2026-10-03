import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewInvoiceForm from "./NewInvoiceForm";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const invoiceType = searchParams.type === "PURCHASE" ? "PURCHASE" : "SALES";

  const [parties, items, warehouses] = await Promise.all([
    prisma.party.findMany({
      where: {
        companyId: company.id,
        ...(invoiceType === "SALES"
          ? { type: { in: ["CUSTOMER", "BOTH"] } }
          : { type: { in: ["VENDOR", "BOTH"] } }),
      },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({
      where: { companyId: company.id, active: true },
      orderBy: { isDefault: "desc" },
    }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">
        {invoiceType === "PURCHASE" ? "New Purchase Bill (Vendor Bill)" : "New Sales Invoice (Customer Bill)"}
      </h1>
      <NewInvoiceForm
        parties={parties}
        items={items}
        warehouses={warehouses}
        companyState={company.state}
        invoiceType={invoiceType}
      />
    </div>
  );
}
