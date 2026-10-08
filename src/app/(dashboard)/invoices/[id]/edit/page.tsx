import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import EditInvoiceForm from "./EditInvoiceForm";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, companyId: company.id },
    include: {
      party: true,
      lines: true,
    },
  });

  if (!invoice) notFound();

  const [parties, items, warehouses] = await Promise.all([
    prisma.party.findMany({
      where: { companyId: company.id },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({
      where: { companyId: company.id },
      orderBy: { name: "asc" },
    }),
    prisma.warehouse.findMany({
      where: { companyId: company.id, active: true },
      orderBy: { isDefault: "desc" },
    }),
  ]);

  return (
    <EditInvoiceForm
      invoice={{
        ...invoice,
        date: invoice.date.toISOString().split("T")[0],
        dueDate: invoice.dueDate ? invoice.dueDate.toISOString().split("T")[0] : "",
        subTotal: invoice.subTotal.toString(),
        discount: invoice.discount.toString(),
        freight: invoice.freight.toString(),
        otherCharges: invoice.otherCharges.toString(),
        grandTotal: invoice.grandTotal.toString(),
        paidAmount: invoice.paidAmount.toString(),
        lines: invoice.lines.map((l) => ({
          ...l,
          qty: Number(l.qty),
          rate: Number(l.rate),
          discount: Number(l.discount),
          gstRate: Number(l.gstRate),
          amount: Number(l.amount),
        })),
      }}
      parties={parties}
      items={items.map((it) => ({
        ...it,
        salePrice: Number(it.salePrice || 0),
        purchasePrice: Number(it.purchasePrice || 0),
        gstRate: Number(it.gstRate || 18),
      }))}
      warehouses={warehouses}
      companyState={company.state}
    />
  );
}
