import { prisma } from "@/lib/prisma";
import SuperInvoicesClient from "./SuperInvoicesClient";

export const dynamic = "force-dynamic";

export default async function SuperAdminInvoicesPage() {
  const [invoices, companies] = await Promise.all([
    prisma.invoice.findMany({
      include: {
        company: { select: { id: true, name: true } },
        party: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const formattedInvoices = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNo,
    type: inv.type,
    invoiceDate: inv.date.toISOString(),
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    total: Number(inv.grandTotal),
    balance: Number(inv.grandTotal) - Number(inv.paidAmount),
    status: inv.status,
    company: inv.company,
    party: inv.party || { id: "", name: "Cash / Walk-in Customer", phone: null },
  }));

  return (
    <SuperInvoicesClient
      initialInvoices={formattedInvoices}
      companies={companies}
    />
  );
}
