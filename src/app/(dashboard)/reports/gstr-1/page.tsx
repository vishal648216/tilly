import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatNumber } from "@/lib/currency";
import GstrReport from "./GstrReport";

export default async function Gstr1Page({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  // Default to current month
  const now = new Date();
  const from = searchParams.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = searchParams.to || now.toISOString().slice(0, 10);

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setDate(toDate.getDate() + 1);

  // Get all SALES invoices in date range
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: company.id,
      type: "SALES",
      date: { gte: fromDate, lt: toDate },
    },
    include: { party: true, lines: true },
    orderBy: { date: "asc" },
  });

  // Group by GST rate (B2B + B2C combined by rate)
  const rateGroups: Record<number, { count: number; taxableValue: number; cgst: number; sgst: number; igst: number; total: number }> = {};
  let totalTaxable = 0,
    totalCgst = 0,
    totalSgst = 0,
    totalIgst = 0,
    totalInvoice = 0;

  for (const inv of invoices) {
    const subTotal = parseFloat(inv.subTotal.toString());
    const cgst = parseFloat(inv.cgstTotal.toString());
    const sgst = parseFloat(inv.sgstTotal.toString());
    const igst = parseFloat(inv.igstTotal.toString());
    const grand = parseFloat(inv.grandTotal.toString());

    // Group invoice lines by GST rate
    const lineRateGroups: Record<number, { taxable: number; cgst: number; sgst: number; igst: number }> = {};
    for (const line of inv.lines) {
      const rate = parseFloat(line.gstRate.toString());
      if (!lineRateGroups[rate]) lineRateGroups[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      lineRateGroups[rate].taxable += parseFloat(line.amount.toString());
      lineRateGroups[rate].cgst += parseFloat(line.cgst.toString());
      lineRateGroups[rate].sgst += parseFloat(line.sgst.toString());
      lineRateGroups[rate].igst += parseFloat(line.igst.toString());
    }

    for (const [rateStr, vals] of Object.entries(lineRateGroups)) {
      const rate = parseFloat(rateStr);
      if (!rateGroups[rate]) rateGroups[rate] = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      rateGroups[rate].count++;
      rateGroups[rate].taxableValue += vals.taxable;
      rateGroups[rate].cgst += vals.cgst;
      rateGroups[rate].sgst += vals.sgst;
      rateGroups[rate].igst += vals.igst;
      rateGroups[rate].total += vals.taxable + vals.cgst + vals.sgst + vals.igst;
    }

    totalTaxable += subTotal;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    totalInvoice += grand;
  }

  const sortedRates = Object.entries(rateGroups)
    .map(([rate, data]) => ({ rate: parseFloat(rate), ...data }))
    .sort((a, b) => a.rate - b.rate);

  const reportData = {
    type: "GSTR-1" as const,
    title: "GSTR-1 — Outward Supplies (Sales)",
    subtitle: "Details of outward supplies of goods/services",
    from,
    to,
    invoices,
    sortedRates,
    totals: { totalTaxable, totalCgst, totalSgst, totalIgst, totalInvoice, count: invoices.length },
  };

  return <GstrReport data={reportData} company={company} />;
}
