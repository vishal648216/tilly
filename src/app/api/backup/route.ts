import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "excel";

    // Fetch all business data for this company
    const [parties, items, invoices, expenses, vouchers, accounts] = await Promise.all([
      prisma.party.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" } }),
      prisma.item.findMany({ where: { companyId: company.id }, orderBy: { name: "asc" } }),
      prisma.invoice.findMany({
        where: { companyId: company.id },
        include: { party: true, lines: true },
        orderBy: { date: "desc" },
      }),
      prisma.expense.findMany({
        where: { companyId: company.id },
        include: { account: true },
        orderBy: { expenseDate: "desc" },
      }),
      prisma.voucher.findMany({
        where: { companyId: company.id },
        include: { entries: { include: { account: true } } },
        orderBy: { date: "desc" },
      }),
      prisma.account.findMany({ where: { companyId: company.id }, orderBy: { code: "asc" } }),
    ]);

    const sanitize = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines: string[] = [];

    // Helper to add a section
    const addSection = (title: string, headers: string[], rows: any[][]) => {
      lines.push(`\n=== ${title.toUpperCase()} ===`);
      lines.push(headers.map(sanitize).join(","));
      rows.forEach((r) => lines.push(r.map(sanitize).join(",")));
    };

    // Header info
    lines.push(`TAILY - COMPLETE EXCEL BUSINESS BACKUP`);
    lines.push(`Company Name: ${company.name}`);
    lines.push(`GSTIN: ${company.gstin || "N/A"}`);
    lines.push(`Exported On: ${new Date().toLocaleString("en-IN")}`);
    lines.push(`--------------------------------------------------------------------------------`);

    // 1. Invoices
    addSection(
      "1. Invoices & Bills (Sales & Purchases)",
      ["Invoice #", "Type", "Date", "Party Name", "Subtotal (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Grand Total (₹)", "Paid Amount (₹)", "Pending (₹)", "Status", "Notes"],
      invoices.map((inv) => {
        const grand = parseFloat(inv.grandTotal.toString());
        const paid = parseFloat(inv.paidAmount.toString());
        return [
          inv.invoiceNo,
          inv.type,
          new Date(inv.date).toLocaleDateString("en-IN"),
          inv.party?.name || "Cash Customer / Direct",
          parseFloat(inv.subTotal.toString()),
          parseFloat(inv.cgstTotal.toString()),
          parseFloat(inv.sgstTotal.toString()),
          parseFloat(inv.igstTotal.toString()),
          grand,
          paid,
          grand - paid,
          inv.status,
          inv.notes || "",
        ];
      })
    );

    // 2. Invoice Line Items Breakdown
    addSection(
      "2. Invoice Line Items Breakdown",
      ["Invoice #", "Item Name", "HSN/SAC", "Qty", "Rate (₹)", "Amount (₹)", "GST %", "CGST (₹)", "SGST (₹)", "IGST (₹)"],
      invoices.flatMap((inv) =>
        inv.lines.map((l) => [
          inv.invoiceNo,
          l.name,
          l.hsn || "",
          parseFloat(l.qty.toString()),
          parseFloat(l.rate.toString()),
          parseFloat(l.amount.toString()),
          parseFloat(l.gstRate.toString()),
          parseFloat(l.cgst.toString()),
          parseFloat(l.sgst.toString()),
          parseFloat(l.igst.toString()),
        ])
      )
    );

    // 3. Parties (Customers & Suppliers)
    addSection(
      "3. Parties Directory (Customers & Suppliers)",
      ["Party Name", "Type", "Phone", "Email", "GSTIN", "PAN", "Address", "City", "State", "Opening Balance (₹)"],
      parties.map((p) => [
        p.name,
        p.type,
        p.phone || "",
        p.email || "",
        p.gstin || "",
        p.pan || "",
        p.address || "",
        p.city || "",
        p.state || "",
        parseFloat(p.openingBalance.toString()),
      ])
    );

    // 4. Products & Inventory
    addSection(
      "4. Inventory Items & Services",
      ["Item Name", "Classification", "Category", "Barcode", "SKU", "HSN/SAC", "Unit", "Sale Price (₹)", "Purchase Price (₹)", "GST %", "Current Stock", "Min Stock Alert"],
      items.map((i) => [
        i.name,
        i.type || "PRODUCT",
        i.category || "",
        i.barcode || "",
        i.sku || "",
        i.hsn || "",
        i.unit,
        parseFloat(i.salePrice.toString()),
        parseFloat(i.purchasePrice.toString()),
        parseFloat(i.gstRate.toString()),
        parseFloat(i.stock.toString()),
        parseFloat(i.minStock.toString()),
      ])
    );

    // 5. Expenses
    addSection(
      "5. Business Expenses Log",
      ["Date", "Voucher #", "Category", "Expense Head", "Payment Mode", "Amount (₹)", "Notes"],
      expenses.map((e) => [
        new Date(e.expenseDate).toLocaleDateString("en-IN"),
        e.voucherId || "-",
        e.category,
        e.account?.name || "",
        e.paymentMode,
        parseFloat(e.amount.toString()),
        e.notes || "",
      ])
    );

    // 6. Chart of Accounts
    addSection(
      "6. Chart of Accounts Master",
      ["Account Code", "Account Name", "Type", "Group", "Opening Balance (₹)"],
      accounts.map((a) => [
        a.code,
        a.name,
        a.type,
        a.groupId || "",
        parseFloat(a.openingBalance.toString()),
      ])
    );

    // 7. Day Book / Voucher Entries
    addSection(
      "7. Complete Voucher Journal Entries",
      ["Voucher #", "Type", "Date", "Narration", "Account Name", "Account Code", "Debit (₹)", "Credit (₹)"],
      vouchers.flatMap((v) =>
        v.entries.map((e) => [
          v.voucherNo,
          v.type,
          new Date(v.date).toLocaleDateString("en-IN"),
          v.narration || "",
          e.account.name,
          e.account.code,
          parseFloat(e.debit.toString()),
          parseFloat(e.credit.toString()),
        ])
      )
    );

    // UTF-8 BOM so Excel opens it with perfect unicode & column parsing
    const csvContent = "\uFEFF" + lines.join("\r\n");
    const filename = `Taily_Complete_Backup_${company.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
