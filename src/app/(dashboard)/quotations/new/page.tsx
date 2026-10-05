import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewQuotationForm from "./NewQuotationForm";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const [parties, items] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-emerald-600" />
          Create Customer Quotation
        </h1>
        <p className="text-sm text-slate-500">
          Draft a professional pre-sales price estimate. Inventory and ledger accounts will remain unchanged until converted.
        </p>
      </div>

      <NewQuotationForm
        parties={parties}
        items={items}
        companyState={company.state}
      />
    </div>
  );
}
