import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PartyProfileClient from "./PartyProfileClient";

export const dynamic = "force-dynamic";

export default async function PartyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const party = await prisma.party.findFirst({
    where: { id: params.id, companyId: company.id },
  });
  if (!party) notFound();

  // Fetch all invoices for this party
  const invoices = await prisma.invoice.findMany({
    where: { partyId: party.id, companyId: company.id },
    orderBy: { date: "desc" },
  });

  const totalBilled = invoices.reduce((s, i) => s + parseFloat(i.grandTotal.toString()), 0);
  const totalPaid = invoices.reduce((s, i) => s + parseFloat(i.paidAmount.toString()), 0);
  const balance = totalBilled - totalPaid;

  return (
    <PartyProfileClient
      party={{
        ...party,
        openingBalance: party.openingBalance.toString(),
        creditLimit: party.creditLimit ? party.creditLimit.toString() : null,
      }}
      invoices={invoices.map((i) => ({
        ...i,
        date: i.date.toISOString(),
        grandTotal: i.grandTotal.toString(),
        paidAmount: i.paidAmount.toString(),
      }))}
      totalBilled={totalBilled}
      totalPaid={totalPaid}
      balance={balance}
      companyName={company.name}
    />
  );
}
