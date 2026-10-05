import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import QuotationActions from "./QuotationActions";
import { ArrowLeft, FileText, Calendar, Building2, User } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function QuotationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const quotation = await prisma.quotation.findFirst({
    where: { id: params.id, companyId: company.id },
    include: {
      party: true,
      lines: { include: { item: true } },
      salesOrders: true,
    },
  });

  if (!quotation) notFound();

  const statusColors: Record<string, string> = {
    DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
    SENT: "bg-blue-50 text-blue-700 border-blue-200",
    ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    EXPIRED: "bg-slate-50 text-slate-600 border-slate-200",
    CONVERTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Bar (Hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <Link
          href="/quotations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Quotations</span>
        </Link>

        <QuotationActions
          quotationId={quotation.id}
          quotationNo={quotation.quotationNo}
          status={quotation.status}
          hasLinkedOrder={quotation.salesOrders.length > 0}
        />
      </div>

      {/* Main Quotation Sheet (Printable Document) */}
      <div className="card p-8 sm:p-12 shadow-sm bg-white border border-slate-200 print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-8">
          <div>
            <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold text-xs tracking-wider uppercase mb-2">
              ESTIMATE / QUOTATION
            </span>
            <h1 className="text-2xl font-black text-slate-900">{company.name}</h1>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {company.address} {company.city} {company.state} {company.pincode}
            </p>
            {company.gstin && (
              <p className="text-xs font-semibold text-slate-700 mt-1">
                GSTIN: <span className="font-mono">{company.gstin}</span>
              </p>
            )}
            {company.phone && <p className="text-xs text-slate-500">Phone: {company.phone}</p>}
          </div>

          <div className="text-left sm:text-right space-y-1">
            <h2 className="text-xl font-mono font-bold text-slate-900">{quotation.quotationNo}</h2>
            <div className="text-xs text-slate-500">
              <span>Date: </span>
              <span className="font-semibold text-slate-800">
                {new Date(quotation.date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            {quotation.validUntil && (
              <div className="text-xs text-slate-500">
                <span>Valid Until: </span>
                <span className="font-semibold text-amber-700">
                  {new Date(quotation.validUntil).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            <div className="pt-2">
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${
                  statusColors[quotation.status] || "bg-slate-100 text-slate-700"
                }`}
              >
                STATUS: {quotation.status}
              </span>
            </div>
          </div>
        </div>

        {/* Client & Billing Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Quotation For (Client)
            </span>
            <p className="text-base font-bold text-slate-900">{quotation.party?.name || "Direct Customer"}</p>
            {quotation.party?.billingAddress && (
              <p className="text-xs text-slate-600 mt-0.5">{quotation.party.billingAddress}</p>
            )}
            {quotation.party?.city && (
              <p className="text-xs text-slate-600">
                {quotation.party.city}, {quotation.party.state}
              </p>
            )}
            {quotation.party?.gstin && (
              <p className="text-xs font-medium text-slate-700 mt-1">
                GSTIN: <span className="font-mono">{quotation.party.gstin}</span>
              </p>
            )}
            {quotation.party?.phone && (
              <p className="text-xs text-slate-600">Phone: {quotation.party.phone}</p>
            )}
          </div>

          <div className="sm:text-right text-xs text-slate-500 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Commercial Proposal Summary
            </span>
            <p>
              Taxation Mode: <span className="font-semibold text-slate-800">GST Compliant</span>
            </p>
            <p>
              Supply Place: <span className="font-semibold text-slate-800">{quotation.party?.state || company.state || "Maharashtra"}</span>
            </p>
            {quotation.salesOrders.length > 0 && (
              <p className="text-blue-700 font-bold mt-2">
                Linked Order: #{quotation.salesOrders[0].orderNo}
              </p>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="py-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 text-slate-800 font-bold">
                <th className="py-2.5 px-2">#</th>
                <th className="py-2.5 px-3">Item Description</th>
                <th className="py-2.5 px-2">HSN</th>
                <th className="py-2.5 px-2 text-right">Qty</th>
                <th className="py-2.5 px-2 text-right">Rate</th>
                <th className="py-2.5 px-2 text-right">Disc</th>
                <th className="py-2.5 px-2 text-right">GST %</th>
                <th className="py-2.5 px-3 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotation.lines.map((line, idx) => (
                <tr key={line.id}>
                  <td className="py-3 px-2 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-900">{line.name}</p>
                    {line.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {line.sku}</p>}
                  </td>
                  <td className="py-3 px-2 text-slate-500 font-mono">{line.hsn || "—"}</td>
                  <td className="py-3 px-2 text-right font-medium text-slate-800">
                    {Number(line.qty)} {line.unit}
                  </td>
                  <td className="py-3 px-2 text-right text-slate-700">{formatCurrency(Number(line.rate))}</td>
                  <td className="py-3 px-2 text-right text-slate-500">
                    {Number(line.discount) > 0 ? `${Number(line.discount)}%` : "—"}
                  </td>
                  <td className="py-3 px-2 text-right text-slate-500">{Number(line.gstRate)}%</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatCurrency(Number(line.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="flex flex-col sm:flex-row justify-between gap-8 pt-4 border-t border-slate-200">
          <div className="w-full sm:w-1/2 space-y-4">
            {quotation.terms && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Terms & Conditions
                </h4>
                <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                  {quotation.terms}
                </p>
              </div>
            )}
            {quotation.notes && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Remarks / Notes
                </h4>
                <p className="text-xs text-slate-600 italic">{quotation.notes}</p>
              </div>
            )}
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Sub Total:</span>
              <span className="font-medium text-slate-900">
                {formatCurrency(Number(quotation.subTotal))}
              </span>
            </div>
            {Number(quotation.discount) > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span>-{formatCurrency(Number(quotation.discount))}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Total Tax (GST):</span>
              <span className="font-medium text-slate-900">
                {formatCurrency(Number(quotation.taxTotal))}
              </span>
            </div>
            <div className="border-t-2 border-slate-900 pt-2 flex justify-between text-base font-black text-slate-900">
              <span>Quoted Amount:</span>
              <span className="text-emerald-700">{formatCurrency(Number(quotation.grandTotal))}</span>
            </div>
          </div>
        </div>

        {/* Footer Signature */}
        <div className="pt-16 mt-8 border-t border-slate-100 flex justify-between items-end text-xs text-slate-500">
          <div>
            <p>This is a computer-generated quotation estimate.</p>
            <p>Ready for conversion into a Confirmed Sales Order or GST Tax Invoice.</p>
          </div>
          <div className="text-right">
            <div className="w-44 border-b border-slate-300 pb-1 mb-1"></div>
            <p className="font-bold text-slate-800">Authorized Signatory</p>
            <p>{company.name}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
