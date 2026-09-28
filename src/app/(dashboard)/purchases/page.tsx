import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PurchasesClient from "./PurchasesClient";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const purchases = await prisma.invoice.findMany({
    where: { companyId: company.id, type: "PURCHASE" },
    include: { party: { select: { id: true, name: true, phone: true } } },
    orderBy: { date: "desc" },
  });

  return (
    <PurchasesClient
      purchases={purchases.map((p) => ({
        ...p,
        date: p.date.toISOString(),
        grandTotal: p.grandTotal.toString(),
        paidAmount: p.paidAmount.toString(),
      }))}
    />
  );
}
