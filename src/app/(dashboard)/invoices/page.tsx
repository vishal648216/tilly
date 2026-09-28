import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import SearchBar from "@/components/SearchBar";
import InvoicesExportButton from "./InvoicesExportButton";
import { Plus, Receipt, ShoppingCart, ArrowRight } from "lucide-react";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { type?: string; q?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const filterType = searchParams.type;
  const query = searchParams.q?.trim() || "";

  // Build where clause with type + search filter
  const where: any = { companyId: company.id };
  if (filterType) where.type = filterType;
  if (query) {
    where.OR = [
      { invoiceNo: { contains: query } },
      { party: { name: { contains: query } } },
      { notes: { contains: query } },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { party: true },
    orderBy: { date: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices & Billing</h1>
          <p className="text-sm text-slate-500">All GST sales invoices & purchase bills</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchBar placeholder="Search invoice no, customer..." defaultValue={query} />
          {invoices.length > 0 && (
            <InvoicesExportButton
              invoices={invoices.map((i) => ({
                invoiceNo: i.invoiceNo,
                type: i.type,
                date: i.date.toISOString(),
                partyName: i.party?.name || "Cash / Direct",
                grandTotal: i.grandTotal.toString(),
                paidAmount: i.paidAmount.toString(),
                status: i.status,
              }))}
            />
          )}
          <Link href="/invoices/new" className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm">
            <Plus className="h-4 w-4" /> Sales Invoice
          </Link>
          <Link href="/invoices/new?type=PURCHASE" className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm">
            <Plus className="h-4 w-4" /> Purchase Bill
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <Link
          href="/invoices"
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            !filterType
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          All Invoices ({invoices.length})
        </Link>
        <Link
          href="/invoices?type=SALES"
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            filterType === "SALES"
              ? "bg-emerald-600 text-white shadow-xs shadow-emerald-600/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Sales Invoices
        </Link>
        <Link
          href="/invoices?type=PURCHASE"
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            filterType === "PURCHASE"
              ? "bg-purple-600 text-white shadow-xs shadow-purple-600/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Purchase Bills
        </Link>
      </div>

      <div className="card overflow-hidden">
        {invoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Receipt className="h-6 w-6" />
            </div>
            <p className="text-slate-700 font-semibold text-base">
              {query ? `"${query}" ke liye koi result nahi mila.` : "Koi invoice nahi hai abhi."}
            </p>
            {query ? (
              <Link href="/invoices" className="btn-secondary mt-4 inline-flex">
                Clear search
              </Link>
            ) : (
              <Link href="/invoices/new" className="btn-primary mt-4 inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Pehla invoice banao
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Invoice #</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Party / Customer</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Grand Total</th>
                  <th className="px-5 py-3.5 text-right">Paid Amount</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-bold font-mono text-emerald-700">
                      <Link href={`/invoices/${inv.id}`}>{inv.invoiceNo}</Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`badge ${inv.type === "SALES" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {inv.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{inv.party?.name ?? "Cash / Direct"}</td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(inv.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-900">
                      {formatCurrency(inv.grandTotal)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-600">
                      {formatCurrency(inv.paidAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`badge ${
                        inv.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : inv.status === "PARTIAL"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
