import { prisma } from "../src/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

async function backfillPurchases() {
  const purchaseInvoices = await prisma.invoice.findMany({
    where: { type: "PURCHASE" },
    include: { lines: true },
  });

  console.log("Found purchase invoices:", purchaseInvoices.length);

  for (const inv of purchaseInvoices) {
    for (const line of inv.lines) {
      if (!line.itemId && line.name) {
        const cleanName = line.name.trim();
        const existing = await prisma.item.findFirst({
          where: {
            companyId: inv.companyId,
            name: { equals: cleanName },
          },
        });

        if (existing) {
          console.log(`Linking existing item: "${existing.name}" to line: ${line.id}`);
          await prisma.invoiceLine.update({
            where: { id: line.id },
            data: { itemId: existing.id },
          });
          await prisma.item.update({
            where: { id: existing.id },
            data: { stock: { increment: Number(line.qty) } },
          });
        } else {
          console.log(`Creating new item from past purchase: "${cleanName}"`);
          const newItem = await prisma.item.create({
            data: {
              companyId: inv.companyId,
              name: cleanName,
              hsn: line.hsn || null,
              gstRate: line.gstRate,
              purchasePrice: line.rate,
              salePrice: new Decimal(Number(line.rate) * 1.2),
              stock: line.qty,
              unit: "PCS",
              type: "PRODUCT",
            },
          });
          await prisma.invoiceLine.update({
            where: { id: line.id },
            data: { itemId: newItem.id },
          });
        }
      }
    }
  }
  console.log("Backfill complete!");
  process.exit(0);
}

backfillPurchases().catch((err) => {
  console.error("Backfill error:", err);
  process.exit(1);
});
