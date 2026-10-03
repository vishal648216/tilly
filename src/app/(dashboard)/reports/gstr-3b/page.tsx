import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatNumber } from "@/lib/currency";
import GstrReport from "../gstr-1/GstrReport";

export default async function Gstr3bPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const now = new Date();
  const from = searchParams.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = searchParams.to || now.toISOString().slice(0, 10);

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setDate(toDate.getDate() + 1);

  // === SALES (output tax) ===
  // GSTR-3B: Only include POSTED/PAID invoices. Exclude DRAFT, CANCELLED, REVERSED.
  const salesInvoices = await prisma.invoice.findMany({
    where: {
      companyId: company.id,
      type: "SALES",
      date: { gte: fromDate, lt: toDate },
      status: { notIn: ["DRAFT", "CANCELLED", "REVERSED"] },
    },
    include: { party: true, lines: true },
    orderBy: { date: "asc" },
  });

  const salesRateGroups: Record<number, { count: number; taxableValue: number; cgst: number; sgst: number; igst: number; total: number }> = {};
  let salesTaxable = 0, salesCgst = 0, salesSgst = 0, salesIgst = 0, salesTotal = 0;

  for (const inv of salesInvoices) {
    salesTaxable += parseFloat(inv.subTotal.toString());
    salesCgst += parseFloat(inv.cgstTotal.toString());
    salesSgst += parseFloat(inv.sgstTotal.toString());
    salesIgst += parseFloat(inv.igstTotal.toString());
    salesTotal += parseFloat(inv.grandTotal.toString());

    const lineGroups: Record<number, { taxable: number; cgst: number; sgst: number; igst: number }> = {};
    for (const line of inv.lines) {
      const rate = parseFloat(line.gstRate.toString());
      if (!lineGroups[rate]) lineGroups[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      lineGroups[rate].taxable += parseFloat(line.amount.toString());
      lineGroups[rate].cgst += parseFloat(line.cgst.toString());
      lineGroups[rate].sgst += parseFloat(line.sgst.toString());
      lineGroups[rate].igst += parseFloat(line.igst.toString());
    }
    for (const [rateStr, vals] of Object.entries(lineGroups)) {
      const rate = parseFloat(rateStr);
      if (!salesRateGroups[rate]) salesRateGroups[rate] = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      salesRateGroups[rate].count++;
      salesRateGroups[rate].taxableValue += vals.taxable;
      salesRateGroups[rate].cgst += vals.cgst;
      salesRateGroups[rate].sgst += vals.sgst;
      salesRateGroups[rate].igst += vals.igst;
      salesRateGroups[rate].total += vals.taxable + vals.cgst + vals.sgst + vals.igst;
    }
  }

  const sortedRates = Object.entries(salesRateGroups)
    .map(([rate, data]) => ({ rate: parseFloat(rate), ...data }))
    .sort((a, b) => a.rate - b.rate);

  // === PURCHASE (input tax credit) ===
  // Only include POSTED/PAID purchases. CANCELLED purchases don't generate ITC.
  const purchaseInvoices = await prisma.invoice.findMany({
    where: {
      companyId: company.id,
      type: "PURCHASE",
      date: { gte: fromDate, lt: toDate },
      status: { notIn: ["DRAFT", "CANCELLED", "REVERSED"] },
    },
    select: { subTotal: true, cgstTotal: true, sgstTotal: true, igstTotal: true, grandTotal: true },
  });

  let purchaseTaxable = 0, purchaseCgst = 0, purchaseSgst = 0, purchaseIgst = 0;
  for (const inv of purchaseInvoices) {
    purchaseTaxable += parseFloat(inv.subTotal.toString());
    purchaseCgst += parseFloat(inv.cgstTotal.toString());
    purchaseSgst += parseFloat(inv.sgstTotal.toString());
    purchaseIgst += parseFloat(inv.igstTotal.toString());
  }

  // Net tax payable
  const netCgst = Math.max(0, salesCgst - purchaseCgst);
  const netSgst = Math.max(0, salesSgst - purchaseSgst);
  const netIgst = Math.max(0, salesIgst - purchaseIgst);
  const totalTaxPayable = netCgst + netSgst + netIgst;

  const reportData = {
    type: "GSTR-3B" as const,
    title: "GSTR-3B — Tax Liability Summary",
    subtitle: "Summary of outward + inward supplies and net tax payable",
    from,
    to,
    invoices: salesInvoices,
    sortedRates,
    totals: {
      totalTaxable: salesTaxable,
      totalCgst: salesCgst,
      totalSgst: salesSgst,
      totalIgst: salesIgst,
      totalInvoice: salesTotal,
      count: salesInvoices.length,
    },
  };

  return (
    <>
      <GstrReport data={reportData} company={company} />

      {/* Input tax + net liability section (GSTR-3B specific) */}
      <div id="3b-extra" className="mx-auto mt-6 max-w-[800px] bg-white p-8 shadow-lg print:max-w-none print:shadow-none">
        <h3 className="mb-3 text-sm font-semibold uppercase text-slate-500">4. Input Tax Credit (Purchases)</h3>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-2">Total Purchase Taxable Value</td>
              <td className="py-2 text-right font-medium">{formatCurrency(purchaseTaxable)}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2">Input CGST</td>
              <td className="py-2 text-right text-green-700">{formatCurrency(purchaseCgst)}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2">Input SGST</td>
              <td className="py-2 text-right text-green-700">{formatCurrency(purchaseSgst)}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2">Input IGST</td>
              <td className="py-2 text-right text-green-700">{formatCurrency(purchaseIgst)}</td>
            </tr>
          </tbody>
        </table>

        {/* Net tax payable */}
        <h3 className="mt-6 mb-3 text-sm font-semibold uppercase text-red-500">5. Net Tax Payable</h3>
        <div className="overflow-hidden rounded-lg border border-red-200">
          <table className="w-full text-sm">
            <thead className="bg-red-50 text-left text-xs uppercase text-red-500">
              <tr>
                <th className="px-4 py-2 font-medium">Tax Type</th>
                <th className="px-4 py-2 text-right font-medium">Output (Sales)</th>
                <th className="px-4 py-2 text-right font-medium">Input (Purchase)</th>
                <th className="px-4 py-2 text-right font-medium">Net Payable</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium">CGST</td>
                <td className="px-4 py-2 text-right">{formatCurrency(salesCgst)}</td>
                <td className="px-4 py-2 text-right text-green-700">−{formatCurrency(purchaseCgst)}</td>
                <td className="px-4 py-2 text-right font-bold text-red-600">{formatCurrency(netCgst)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium">SGST</td>
                <td className="px-4 py-2 text-right">{formatCurrency(salesSgst)}</td>
                <td className="px-4 py-2 text-right text-green-700">−{formatCurrency(purchaseSgst)}</td>
                <td className="px-4 py-2 text-right font-bold text-red-600">{formatCurrency(netSgst)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium">IGST</td>
                <td className="px-4 py-2 text-right">{formatCurrency(salesIgst)}</td>
                <td className="px-4 py-2 text-right text-green-700">−{formatCurrency(purchaseIgst)}</td>
                <td className="px-4 py-2 text-right font-bold text-red-600">{formatCurrency(netIgst)}</td>
              </tr>
              <tr className="bg-red-50 font-bold">
                <td className="px-4 py-3">Total Tax Payable</td>
                <td className="px-4 py-3 text-right" colSpan={2}></td>
                <td className="px-4 py-3 text-right text-red-700 text-base">{formatCurrency(totalTaxPayable)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
