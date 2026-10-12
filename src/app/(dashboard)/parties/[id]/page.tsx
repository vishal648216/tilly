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

  // Fetch all invoices for this party (excluding cancelled/reversed)
  const invoices = await prisma.invoice.findMany({
    where: {
      partyId: party.id,
      companyId: company.id,
      status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
    },
    orderBy: { date: "desc" },
  });

  // Fetch payments history for this party
  const payments = await prisma.payment.findMany({
    where: { partyId: party.id, companyId: company.id },
    include: {
      allocations: {
        include: {
          invoice: { select: { invoiceNo: true, type: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  const totalBilled = invoices.reduce((s, i) => s + parseFloat(i.grandTotal.toString()), 0);
  const totalPaid = invoices.reduce((s, i) => s + parseFloat(i.paidAmount.toString()), 0);
  const balance = Math.max(0, totalBilled - totalPaid);

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
      payments={payments.map((p) => ({
        id: p.id,
        paymentNo: p.paymentNo,
        date: p.date.toISOString(),
        type: p.type,
        mode: p.mode,
        amount: Number(p.amount),
        reference: p.reference,
        notes: p.notes,
        allocationsCount: p.allocations.length,
      }))}
      totalBilled={totalBilled}
      totalPaid={totalPaid}
      balance={balance}
      companyName={company.name}
    />
  );
}
