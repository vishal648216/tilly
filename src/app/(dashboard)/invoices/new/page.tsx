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

  const [parties, items] = await Promise.all([
    prisma.party.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" } }),
    prisma.item.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">
        {invoiceType === "PURCHASE" ? "New Purchase Bill" : "New Sales Invoice"}
      </h1>
      <NewInvoiceForm
        parties={parties}
        items={items}
        companyState={company.state}
        invoiceType={invoiceType}
      />
    </div>
  );
}
