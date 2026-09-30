import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PurchaseReturnClient from "./PurchaseReturnClient";

export const dynamic = "force-dynamic";

export default async function PurchaseReturnPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const returns = await prisma.invoice.findMany({
    where: { companyId: company.id, type: "PURCHASE_RETURN" },
    include: {
      party: true,
      lines: true,
    },
    orderBy: { date: "desc" },
  });

  const formattedReturns = returns.map((r) => ({
    id: r.id,
    invoiceNo: r.invoiceNo,
    date: r.date.toISOString(),
    grandTotal: r.grandTotal.toString(),
    subTotal: r.subTotal.toString(),
    status: r.status,
    notes: r.notes,
    party: r.party
      ? {
          id: r.party.id,
          name: r.party.name,
          phone: r.party.phone,
          gstin: r.party.gstin,
        }
      : null,
    lines: r.lines.map((l) => ({
      id: l.id,
      name: l.name,
      qty: l.qty.toString(),
      rate: l.rate.toString(),
      amount: l.amount.toString(),
    })),
  }));

  return <PurchaseReturnClient initialReturns={formattedReturns} />;
}
