import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import CompaniesClient from "./CompaniesClient";

export const dynamic = "force-dynamic";

export default async function SuperAdminCompaniesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") redirect("/login");

  const companies = await prisma.company.findMany({
    include: {
      subscription: {
        include: { plan: true },
      },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, status: true, role: true } },
        },
      },
      invoices: {
        select: { id: true, grandTotal: true, status: true, type: true },
      },
      parties: { select: { id: true } },
      items: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const availablePlans = await prisma.plan.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, price: true },
    orderBy: { price: "asc" },
  });

  const enriched = companies.map((c) => {
    const salesInvoices = c.invoices.filter((i) => i.type === "SALES");
    const totalTurnover = salesInvoices.reduce(
      (sum, i) => sum + parseFloat(i.grandTotal.toString() || "0"),
      0
    );
    return {
      id: c.id,
      name: c.name,
      legalName: c.legalName,
      status: c.status || "ACTIVE",
      suspendedReason: c.suspendedReason,
      planName: c.subscription?.plan?.name || "Trial",
      planCode: c.subscription?.plan?.code || "TRIAL",
      subscriptionStatus: c.subscription?.status || "TRIAL",
      email: c.email,
      phone: c.phone,
      city: c.city,
      state: c.state,
      address: c.address,
      gstin: c.gstin,
      pan: c.pan,
      createdAt: c.createdAt.toISOString(),
      membersCount: c.members.length,
      members: c.members.map((m) => ({
        role: m.role,
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          phone: m.user.phone,
          status: m.user.status,
        },
      })),
      totalInvoices: c.invoices.length,
      totalTurnover,
      partiesCount: c.parties.length,
      itemsCount: c.items.length,
    };
  });

  return <CompaniesClient initialCompanies={enriched} availablePlans={availablePlans} />;
}
