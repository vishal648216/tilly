import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import SearchBar from "@/components/SearchBar";
import InvoicesExportButton from "./InvoicesExportButton";
import InvoicesClient from "./InvoicesClient";
import { Plus, Receipt, ShoppingCart, ArrowRight, UserPlus } from "lucide-react";

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
          <Link
            href="/parties/new?type=CUSTOMER&redirect=/invoices/new"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-emerald-700 transition-colors"
          >
            <UserPlus className="h-4 w-4 text-emerald-600" />
            <span>+ Add Customer</span>
          </Link>
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

      <InvoicesClient
        initialInvoices={invoices.map((i) => ({
          id: i.id,
          invoiceNo: i.invoiceNo,
          type: i.type,
          partyName: i.party?.name || "Cash / Direct",
          date: i.date.toISOString(),
          grandTotal: i.grandTotal.toString(),
          paidAmount: i.paidAmount.toString(),
          status: i.status,
        }))}
        query={query}
      />
    </div>
  );
}
