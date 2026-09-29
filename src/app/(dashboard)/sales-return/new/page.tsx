import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewSalesReturnForm from "./NewSalesReturnForm";

export const dynamic = "force-dynamic";

export default async function NewSalesReturnPage({
  searchParams,
}: {
  searchParams?: { invoiceId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const [parties, items, pastInvoices] = await Promise.all([
    prisma.party.findMany({
      where: { companyId: company.id, type: { in: ["CUSTOMER", "BOTH"] } },
      select: { id: true, name: true, state: true, gstin: true },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({
      where: { companyId: company.id },
      select: {
        id: true,
        name: true,
        sku: true,
        hsn: true,
        salePrice: true,
        gstRate: true,
        stock: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.invoice.findMany({
      where: { companyId: company.id, type: "SALES" },
      select: {
        id: true,
        invoiceNo: true,
        partyId: true,
        date: true,
        grandTotal: true,
        lines: {
          select: {
            id: true,
            itemId: true,
            name: true,
            hsn: true,
            qty: true,
            rate: true,
            gstRate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <NewSalesReturnForm
      parties={parties}
      items={items.map((it) => ({
        ...it,
        salePrice: it.salePrice.toString(),
        gstRate: it.gstRate.toString(),
        stock: it.stock.toString(),
      }))}
      pastInvoices={pastInvoices.map((inv) => ({
        ...inv,
        date: inv.date.toISOString(),
        grandTotal: inv.grandTotal.toString(),
        lines: inv.lines.map((l) => ({
          ...l,
          qty: l.qty.toString(),
          rate: l.rate.toString(),
          gstRate: l.gstRate.toString(),
        })),
      }))}
      companyState={company.state || null}
      prefilledInvoiceId={searchParams?.invoiceId}
    />
  );
}
