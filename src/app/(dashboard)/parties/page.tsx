import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PartiesClient from "./PartiesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PartiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const parties = await prisma.party.findMany({
    where: { companyId: company.id },
    include: {
      invoices: {
        where: {
          status: { notIn: ["CANCELLED", "REVERSED", "DRAFT"] },
        },
        select: {
          id: true,
          invoiceNo: true,
          type: true,
          date: true,
          grandTotal: true,
          paidAmount: true,
          status: true,
        },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formatted = parties.map((p) => {
    let salesTotal = 0;
    let salesPaid = 0;
    let purchaseTotal = 0;
    let purchasePaid = 0;

    const unpaidInvoices: Array<{
      id: string;
      invoiceNo: string;
      type: string;
      date: string;
      grandTotal: number;
      paidAmount: number;
      status: string;
    }> = [];

    p.invoices.forEach((inv) => {
      const g = Number(inv.grandTotal);
      const paid = Number(inv.paidAmount);
      if (inv.type === "SALES") {
        salesTotal += g;
        salesPaid += paid;
      } else if (inv.type === "PURCHASE") {
        purchaseTotal += g;
        purchasePaid += paid;
      }

      if (paid < g) {
        unpaidInvoices.push({
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          type: inv.type,
          date: inv.date.toISOString(),
          grandTotal: g,
          paidAmount: paid,
          status: inv.status,
        });
      }
    });

    const receivable = Math.max(0, salesTotal - salesPaid);
    const payable = Math.max(0, purchaseTotal - purchasePaid);
    const netBalance = receivable - payable;

    return {
      id: p.id,
      name: p.name,
      type: p.type,
      phone: p.phone,
      email: p.email,
      gstin: p.gstin,
      city: p.city,
      state: p.state,
      openingBalance: Number(p.openingBalance || 0),
      creditLimit: p.creditLimit ? Number(p.creditLimit) : null,
      creditDays: p.creditDays,
      receivable,
      payable,
      netBalance,
      unpaidInvoices,
    };
  });

  return <PartiesClient parties={formatted} companyName={company.name} />;
}
