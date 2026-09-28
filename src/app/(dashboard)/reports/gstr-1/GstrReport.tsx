import Link from "next/link";
import { formatCurrency, formatNumber } from "@/lib/currency";
import DateRangePicker from "../DateRangePicker";
import ReportActions from "../ReportActions";

type ReportData = {
  type: "GSTR-1" | "GSTR-3B";
  title: string;
  subtitle: string;
  from: string;
  to: string;
  invoices: any[];
  sortedRates: { rate: number; count: number; taxableValue: number; cgst: number; sgst: number; igst: number; total: number }[];
  totals: { totalTaxable: number; totalCgst: number; totalSgst: number; totalIgst: number; totalInvoice: number; count: number };
};

type Company = { name: string; gstin: string | null; state: string | null };

export default function GstrReport({
  data,
  company,
}: {
  data: ReportData;
  company: Company;
}) {
  const { type, title, subtitle, from, to, invoices, sortedRates, totals } = data;
  const isGstr3B = type === "GSTR-3B";

  // For GSTR-3B we also need purchase (input tax)
  return (
    <div>
      <ReportActions />

      <div className="no-print mb-4">
        <DateRangePicker from={from} to={to} />
      </div>

      {/* Printable area */}
      <div id="report-paper" className="mx-auto max-w-[800px] bg-white p-8 shadow-lg print:max-w-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="border-b-2 border-brand-600 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
              {company.gstin && <p className="text-sm font-medium text-slate-700">GSTIN: {company.gstin}</p>}
              {company.state && <p className="text-sm text-slate-500">State: {company.state}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold uppercase text-brand-700">{title}</h2>
              <p className="text-sm text-slate-500">{subtitle}</p>
              <p className="text-sm font-medium text-slate-600">
                Period: {new Date(from).toLocaleDateString("en-IN")} — {new Date(to).toLocaleDateString("en-IN")}
              </p>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-500">Total Invoices</p>
            <p className="text-lg font-bold text-slate-700">{totals.count}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-500">Taxable Value</p>
            <p className="text-lg font-bold text-slate-700">{formatCurrency(totals.totalTaxable)}</p>
          </div>
          <div className="rounded-lg bg-orange-50 p-3 text-center">
            <p className="text-xs text-slate-500">Total GST</p>
            <p className="text-lg font-bold text-orange-700">
              {formatCurrency(totals.totalCgst + totals.totalSgst + totals.totalIgst)}
            </p>
          </div>
          <div className="rounded-lg bg-brand-50 p-3 text-center">
            <p className="text-xs text-slate-500">Invoice Total</p>
            <p className="text-lg font-bold text-brand-700">{formatCurrency(totals.totalInvoice)}</p>
          </div>
        </div>

        {/* Rate-wise breakup table */}
        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase text-slate-500">
          {isGstr3B ? "3.1 Outward Supplies (Rate-wise)" : "B2B + B2C Supplies (Rate-wise breakup)"}
        </h3>
        <table className="w-full text-sm">
          <thead className="border-b-2 border-slate-300 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-2">GST Rate</th>
              <th className="py-2 pr-2 text-right">Invoices</th>
              <th className="py-2 pr-2 text-right">Taxable Value</th>
              <th className="py-2 pr-2 text-right">CGST</th>
              <th className="py-2 pr-2 text-right">SGST</th>
              <th className="py-2 pr-2 text-right">IGST</th>
              <th className="py-2 text-right">Total (incl GST)</th>
            </tr>
          </thead>
          <tbody>
            {sortedRates.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  Is period me koi sales nahi thi.
                </td>
              </tr>
            ) : (
              sortedRates.map((r) => (
                <tr key={r.rate} className="border-b border-slate-100">
                  <td className="py-2 pr-2 font-medium">{r.rate}%</td>
                  <td className="py-2 pr-2 text-right">{r.count}</td>
                  <td className="py-2 pr-2 text-right">{formatNumber(r.taxableValue)}</td>
                  <td className="py-2 pr-2 text-right">{r.cgst > 0 ? formatNumber(r.cgst) : "—"}</td>
                  <td className="py-2 pr-2 text-right">{r.sgst > 0 ? formatNumber(r.sgst) : "—"}</td>
                  <td className="py-2 pr-2 text-right">{r.igst > 0 ? formatNumber(r.igst) : "—"}</td>
                  <td className="py-2 text-right font-medium">{formatNumber(r.total)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
            <tr>
              <td className="py-2 pr-2">Total</td>
              <td className="py-2 pr-2 text-right">{totals.count}</td>
              <td className="py-2 pr-2 text-right">{formatNumber(totals.totalTaxable)}</td>
              <td className="py-2 pr-2 text-right">{formatNumber(totals.totalCgst)}</td>
              <td className="py-2 pr-2 text-right">{formatNumber(totals.totalSgst)}</td>
              <td className="py-2 pr-2 text-right">{formatNumber(totals.totalIgst)}</td>
              <td className="py-2 text-right">{formatNumber(totals.totalInvoice)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Invoice detail table */}
        {!isGstr3B && (
          <>
            <h3 className="mt-6 mb-2 text-sm font-semibold uppercase text-slate-500">
              Invoice-wise Details
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b-2 border-slate-300 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-2">Invoice #</th>
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Party</th>
                    <th className="py-2 pr-2">GSTIN</th>
                    <th className="py-2 pr-2 text-right">Taxable</th>
                    <th className="py-2 pr-2 text-right">CGST</th>
                    <th className="py-2 pr-2 text-right">SGST</th>
                    <th className="py-2 pr-2 text-right">IGST</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 font-medium text-brand-600">{inv.invoiceNo}</td>
                      <td className="py-1.5 pr-2 text-slate-500">{new Date(inv.date).toLocaleDateString("en-IN")}</td>
                      <td className="py-1.5 pr-2">{inv.party?.name || "Cash"}</td>
                      <td className="py-1.5 pr-2 text-slate-500">{inv.party?.gstin || "—"}</td>
                      <td className="py-1.5 pr-2 text-right">{formatNumber(inv.subTotal)}</td>
                      <td className="py-1.5 pr-2 text-right">{parseFloat(inv.cgstTotal) > 0 ? formatNumber(inv.cgstTotal) : "—"}</td>
                      <td className="py-1.5 pr-2 text-right">{parseFloat(inv.sgstTotal) > 0 ? formatNumber(inv.sgstTotal) : "—"}</td>
                      <td className="py-1.5 pr-2 text-right">{parseFloat(inv.igstTotal) > 0 ? formatNumber(inv.igstTotal) : "—"}</td>
                      <td className="py-1.5 text-right font-medium">{formatNumber(inv.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-end justify-between text-xs text-slate-400">
          <p>Generated by Taily on {new Date().toLocaleDateString("en-IN")} at {new Date().toLocaleTimeString("en-IN")}</p>
          <div className="text-center">
            <div className="mb-1 h-12 w-40 border-b border-slate-300" />
            <p>Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
