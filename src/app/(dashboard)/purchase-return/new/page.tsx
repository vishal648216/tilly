import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewPurchaseReturnForm from "./NewPurchaseReturnForm";

export const dynamic = "force-dynamic";

export default async function NewPurchaseReturnPage({
  searchParams,
}: {
  searchParams: { billId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  // Fetch Vendors (suppliers)
  const vendors = await prisma.party.findMany({
    where: {
      companyId: company.id,
      type: { in: ["VENDOR", "BOTH"] },
    },
    orderBy: { name: "asc" },
  });

  // Fetch Items for stock lookup
  const items = await prisma.item.findMany({
    where: { companyId: company.id },
    orderBy: { name: "asc" },
  });

  // Fetch past purchase bills
  const pastBills = await prisma.invoice.findMany({
    where: {
      companyId: company.id,
      type: "PURCHASE",
    },
    include: {
      party: true,
      lines: true,
    },
    orderBy: { date: "desc" },
    take: 50,
  });

  let initialBill = null;
  if (searchParams.billId) {
    const found = pastBills.find((b) => b.id === searchParams.billId);
    if (found) {
      initialBill = {
        id: found.id,
        invoiceNo: found.invoiceNo,
        partyId: found.partyId,
        date: found.date.toISOString(),
        grandTotal: found.grandTotal.toString(),
        lines: found.lines.map((l) => ({
          itemId: l.itemId,
          name: l.name,
          hsn: l.hsn,
          qty: l.qty.toString(),
          rate: l.rate.toString(),
          gstRate: l.gstRate.toString(),
        })),
      };
    }
  }

  const formattedPastBills = pastBills.map((b) => ({
    id: b.id,
    invoiceNo: b.invoiceNo,
    partyId: b.partyId,
    date: b.date.toISOString(),
    grandTotal: b.grandTotal.toString(),
    lines: b.lines.map((l) => ({
      itemId: l.itemId,
      name: l.name,
      hsn: l.hsn,
      qty: l.qty.toString(),
      rate: l.rate.toString(),
      gstRate: l.gstRate.toString(),
    })),
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Create Debit Note (Vendor Return)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Issue a formal Debit Note to a supplier for returned, damaged, or defective purchased goods.
        </p>
      </div>

      <NewPurchaseReturnForm
        vendors={vendors}
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          hsn: i.hsn,
          purchasePrice: i.purchasePrice.toString(),
          gstRate: i.gstRate.toString(),
          stock: i.stock.toString(),
        }))}
        pastBills={formattedPastBills}
        companyState={company.state || ""}
        initialBill={initialBill}
      />
    </div>
  );
}
