import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatNumber, numberToWords } from "@/lib/currency";
import UpiQrCode from "@/components/UpiQrCode";
import PublicInvoiceActions from "./PublicInvoiceActions";
import { checkRateLimit, recordRateLimitFailure } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tax Invoice | Taily",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const reqHeaders = headers();
  const forwarded = reqHeaders.get("x-forwarded-for");
  const ipAddress = forwarded ? forwarded.split(",")[0].trim() : reqHeaders.get("x-real-ip") || "unknown";

  // Rate limit public invoice views to 30/minute per IP
  const rateLimit = await checkRateLimit(`public_inv:${ipAddress}`, 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="card p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Rate Limit Exceeded</h2>
          <p className="text-sm text-slate-600">Too many requests. Please wait a minute before accessing invoices again.</p>
        </div>
      </div>
    );
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      company: true,
      party: true,
      lines: true,
    },
  });

  // Privacy protection: Only customer-facing SALES and SALES_RETURN invoices can be viewed publicly
  // Internal vendor purchase bills and debit notes are strictly blocked
  if (!invoice || (invoice.type !== "SALES" && invoice.type !== "SALES_RETURN")) {
    await recordRateLimitFailure(`public_inv:${ipAddress}`, {
      ipAddress,
      action: "SUSPICIOUS_ACCESS",
      details: `Attempted public access to non-existent or vendor invoice ID: ${params.id}`,
    }, 60 * 1000);
    notFound();
  }

  const company = invoice.company;
  const isInterState = parseFloat(invoice.igstTotal.toString()) > 0;
  const grand = parseFloat(invoice.grandTotal.toString());
  const subTotal = parseFloat(invoice.subTotal.toString());
  const roundOff = parseFloat(invoice.roundOff.toString());
  const effectiveUpiId = company.upiId || "taily@upi";

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:p-0">
      {/* Top action bar */}
      <div className="no-print mx-auto max-w-[800px] mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
            T
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Taily Invoice Viewer</p>
            <p className="text-sm font-bold text-slate-800">
              {invoice.type === "SALES" ? "Tax Invoice" : "Purchase Bill"} #{invoice.invoiceNo}
            </p>
          </div>
        </div>

        <PublicInvoiceActions invoiceNo={invoice.invoiceNo} />
      </div>

      {/* ===== Printable Invoice Paper ===== */}
      <div
        id="invoice-paper"
        className="mx-auto max-w-[800px] bg-white p-8 shadow-lg rounded-xl print:max-w-none print:shadow-none print:p-0 print:rounded-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-brand-600 pb-4">
          <div>
            {invoice.type === "SALES" ? (
              <>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Billed By (Seller)
                </p>
                <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
                {company.legalName && company.legalName !== company.name && (
                  <p className="text-sm text-slate-600">{company.legalName}</p>
                )}
                {company.address && <p className="mt-1 text-sm text-slate-600">{company.address}</p>}
                <p className="text-sm text-slate-600">
                  {[company.city, company.state, company.pincode].filter(Boolean).join(", ")}
                </p>
                {company.gstin && (
                  <p className="text-sm font-medium text-slate-700">GSTIN: {company.gstin}</p>
                )}
                {company.phone && <p className="text-sm text-slate-600">Phone: {company.phone}</p>}
              </>
            ) : (
              <>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Supplier / Vendor (Billed By)
                </p>
                <h1 className="text-2xl font-bold text-slate-900">
                  {invoice.party ? invoice.party.name : "Vendor / Supplier"}
                </h1>
                {invoice.party?.address && (
                  <p className="mt-1 text-sm text-slate-600">{invoice.party.address}</p>
                )}
                <p className="text-sm text-slate-600">
                  {[invoice.party?.city, invoice.party?.state, invoice.party?.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {invoice.party?.gstin && (
                  <p className="text-sm font-medium text-slate-700">GSTIN: {invoice.party.gstin}</p>
                )}
                {invoice.party?.phone && (
                  <p className="text-sm text-slate-600">Phone: {invoice.party.phone}</p>
                )}
              </>
            )}
          </div>
          <div className="text-right">
            <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
              T
            </div>
            <h2 className="text-xl font-bold uppercase text-brand-700">
              {invoice.type === "SALES" ? "Tax Invoice (Sales)" : "Purchase Bill (Inward)"}
            </h2>
            <p className="text-sm text-slate-500">Generated by Taily</p>
          </div>
        </div>

        {/* Invoice meta + Bill to */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-400">
              {invoice.type === "SALES"
                ? "Billed To (Customer / Buyer)"
                : "Billed To (Buyer / Consignee)"}
            </p>
            {invoice.type === "SALES" ? (
              invoice.party ? (
                <>
                  <p className="mt-1 font-bold text-slate-900">{invoice.party.name}</p>
                  {invoice.party.address && (
                    <p className="text-sm text-slate-600">{invoice.party.address}</p>
                  )}
                  <p className="text-sm text-slate-600">
                    {[invoice.party.city, invoice.party.state, invoice.party.pincode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {invoice.party.gstin && (
                    <p className="text-sm font-medium text-slate-700">GSTIN: {invoice.party.gstin}</p>
                  )}
                  {invoice.party.phone && (
                    <p className="text-sm text-slate-600">Phone: {invoice.party.phone}</p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-400">Cash / Walk-in Customer</p>
              )
            ) : (
              <>
                <p className="mt-1 font-bold text-slate-900">{company.name}</p>
                {company.address && <p className="text-sm text-slate-600">{company.address}</p>}
                <p className="text-sm text-slate-600">
                  {[company.city, company.state, company.pincode].filter(Boolean).join(", ")}
                </p>
                {company.gstin && (
                  <p className="text-sm font-medium text-slate-700">GSTIN: {company.gstin}</p>
                )}
                {company.phone && <p className="text-sm text-slate-600">Phone: {company.phone}</p>}
              </>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            <div className="flex justify-between border-b border-slate-200 py-1">
              <span className="text-slate-500">Invoice No.</span>
              <span className="font-bold text-slate-900">{invoice.invoiceNo}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 py-1">
              <span className="text-slate-500">Date</span>
              <span className="font-medium">{new Date(invoice.date).toLocaleDateString("en-IN")}</span>
            </div>
            {invoice.dueDate && (
              <div className="flex justify-between border-b border-slate-200 py-1">
                <span className="text-slate-500">Due Date</span>
                <span className="font-medium">
                  {new Date(invoice.dueDate).toLocaleDateString("en-IN")}
                </span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Status</span>
              <span
                className={`badge ${
                  invoice.status === "PAID"
                    ? "bg-green-100 text-green-700"
                    : invoice.status === "PARTIAL"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {invoice.status}
              </span>
            </div>
          </div>
        </div>

        {/* Line items table */}
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 pr-2">HSN</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Rate</th>
              <th className="py-2 pr-2 text-right">GST%</th>
              {isInterState ? (
                <th className="py-2 pr-2 text-right">IGST</th>
              ) : (
                <>
                  <th className="py-2 pr-2 text-right">CGST</th>
                  <th className="py-2 pr-2 text-right">SGST</th>
                </>
              )}
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, idx) => {
              const cgst = parseFloat(line.cgst.toString());
              const sgst = parseFloat(line.sgst.toString());
              const igst = parseFloat(line.igst.toString());
              return (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-slate-400">{idx + 1}</td>
                  <td className="py-2 pr-2 font-medium">{line.name}</td>
                  <td className="py-2 pr-2 text-slate-500">{line.hsn ?? "—"}</td>
                  <td className="py-2 pr-2 text-right">{formatNumber(line.qty)}</td>
                  <td className="py-2 pr-2 text-right">{formatNumber(line.rate)}</td>
                  <td className="py-2 pr-2 text-right">{line.gstRate.toString()}%</td>
                  {isInterState ? (
                    <td className="py-2 pr-2 text-right">{formatNumber(igst)}</td>
                  ) : (
                    <>
                      <td className="py-2 pr-2 text-right">{formatNumber(cgst)}</td>
                      <td className="py-2 pr-2 text-right">{formatNumber(sgst)}</td>
                    </>
                  )}
                  <td className="py-2 text-right font-medium">{formatNumber(line.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs text-sm">
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(subTotal)}</span>
            </div>
            {isInterState ? (
              <div className="flex justify-between border-b border-slate-100 py-1.5">
                <span className="text-slate-500">IGST</span>
                <span className="font-medium">{formatCurrency(invoice.igstTotal)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between border-b border-slate-100 py-1.5">
                  <span className="text-slate-500">CGST</span>
                  <span className="font-medium">{formatCurrency(invoice.cgstTotal)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1.5">
                  <span className="text-slate-500">SGST</span>
                  <span className="font-medium">{formatCurrency(invoice.sgstTotal)}</span>
                </div>
              </>
            )}
            {Math.abs(roundOff) > 0.001 && (
              <div className="flex justify-between border-b border-slate-100 py-1.5">
                <span className="text-slate-500">Round Off</span>
                <span className="font-medium">{formatCurrency(roundOff)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between rounded-lg bg-brand-50 px-3 py-2 text-base font-bold text-brand-800">
              <span>Grand Total</span>
              <span>{formatCurrency(invoice.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="font-semibold text-slate-600">Amount in Words: </span>
          <span className="italic text-slate-700">{numberToWords(grand)}</span>
        </div>

        {/* Payment & Bank Details + Dynamic UPI QR Code */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs">
          {/* Bank details */}
          <div className="sm:col-span-2 space-y-1.5">
            <p className="font-bold uppercase tracking-wider text-slate-700 text-[11px] border-b border-slate-200 pb-1">
              Bank & Payment Details
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600 pt-1">
              <div>
                <span className="text-slate-400">Bank Name: </span>
                <span className="font-semibold text-slate-800">
                  {company.bankName || "State Bank of India"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Account No: </span>
                <span className="font-semibold font-mono text-slate-800">
                  {company.accountNo || "123456789012"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">IFSC Code: </span>
                <span className="font-semibold font-mono text-slate-800">
                  {company.ifscCode || "SBIN0001234"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Branch: </span>
                <span className="font-medium text-slate-800">
                  {company.branchName || "Main Branch"}
                </span>
              </div>
            </div>

            {company.terms && (
              <div className="pt-2 border-t border-slate-200 mt-2">
                <p className="font-bold text-slate-600 text-[10px] uppercase">Terms & Conditions:</p>
                <p className="text-[10px] text-slate-500 whitespace-pre-line leading-relaxed mt-0.5">
                  {company.terms}
                </p>
              </div>
            )}
          </div>

          {/* Dynamic UPI QR Code */}
          <div className="flex justify-center sm:justify-end items-center">
            <UpiQrCode
              upiId={effectiveUpiId}
              payeeName={company.name}
              amount={grand}
              invoiceNo={invoice.invoiceNo}
            />
          </div>
        </div>

        {/* Notes + signature */}
        <div className="mt-6 flex items-end justify-between">
          <div className="max-w-xs text-sm">
            {invoice.notes && (
              <p className="mb-2">
                <span className="font-semibold text-slate-600">Notes: </span>
                <span className="text-slate-600">{invoice.notes}</span>
              </p>
            )}
            <p className="text-xs text-slate-400">
              This is a computer-generated invoice and does not require a physical signature.
            </p>
          </div>
          <div className="text-center">
            <div className="mb-1 h-12 w-40 border-b border-slate-300" />
            <p className="text-sm font-medium text-slate-600">Authorised Signatory</p>
            <p className="text-[11px] text-slate-400">{company.name}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
