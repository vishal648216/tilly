import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import SalesReturnClient from "./SalesReturnClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SalesReturnPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const returns = await prisma.invoice.findMany({
    where: { companyId: company.id, type: "SALES_RETURN" },
    include: {
      party: { select: { id: true, name: true, phone: true } },
      lines: { select: { id: true, name: true, qty: true, rate: true, amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <SalesReturnClient
      returns={returns.map((r) => ({
        ...r,
        date: r.date.toISOString(),
        grandTotal: r.grandTotal.toString(),
        subTotal: r.subTotal.toString(),
        lines: r.lines.map((l) => ({
          ...l,
          qty: l.qty.toString(),
          rate: l.rate.toString(),
          amount: l.amount.toString(),
        })),
      }))}
    />
  );
}
