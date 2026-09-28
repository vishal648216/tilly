import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { formatCurrency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import SalesChart from "@/components/SalesChart";
import {
  TrendingUp,
  Clock,
  FileSpreadsheet,
  Users,
  Award,
  Package,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Plus,
  Receipt,
  BarChart3,
  Sparkles,
  Layers,
  IndianRupee,
  ShoppingCart,
  Wallet,
  Building2,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";

export default async function DashboardHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // === 1. Last 6 months sales data (for bar chart) ===
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const salesInvoices = await prisma.invoice.findMany({
    where: {
      companyId: company.id,
      type: "SALES",
      date: { gte: sixMonthsAgo },
    },
    select: { grandTotal: true, date: true },
  });

  // Group by month
  const months: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = d.toLocaleString("en-IN", { month: "short" });
    const total = salesInvoices
      .filter((inv) => {
        const invDate = new Date(inv.date);
        return invDate.getMonth() === d.getMonth() && invDate.getFullYear() === d.getFullYear();
      })
      .reduce((sum, inv) => sum + parseFloat(inv.grandTotal.toString()), 0);
    months.push({ label: monthName, value: total });
  }

  // === 2. This month's sales ===
  const monthSales = months[months.length - 1].value;

  // === 3. Receivables (unpaid invoices) ===
  const unpaidInvoices = await prisma.invoice.findMany({
    where: { companyId: company.id, type: "SALES", status: { not: "PAID" } },
    include: { party: true },
    orderBy: { date: "asc" },
  });
  const receivables = unpaidInvoices.reduce(
    (sum, i) => sum + (parseFloat(i.grandTotal.toString()) - parseFloat(i.paidAmount.toString())),
    0
  );

  // === 4. Total Purchases & Expenses ===
  const purchaseInvoices = await prisma.invoice.findMany({
    where: { companyId: company.id, type: "PURCHASE" },
    select: { grandTotal: true },
  });
  const totalPurchases = purchaseInvoices.reduce(
    (sum, i) => sum + parseFloat(i.grandTotal.toString()),
    0
  );

  const expenses = await prisma.expense.findMany({
    where: { companyId: company.id },
    select: { amount: true },
  });
  const totalExpenses = expenses.reduce(
    (sum, e) => sum + parseFloat(e.amount.toString()),
    0
  );

  // === 5. Counts ===
  const voucherCount = await prisma.voucher.count({
    where: { companyId: company.id },
  });
  const partyCount = await prisma.party.count({
    where: { companyId: company.id },
  });
  const itemCount = await prisma.item.count({
    where: { companyId: company.id },
  });

  // === 6. Top 5 parties by sales amount ===
  const allSalesInv = await prisma.invoice.findMany({
    where: { companyId: company.id, type: "SALES", partyId: { not: null } },
    include: { party: true },
  });
  const partyTotals = new Map<string, { name: string; total: number }>();
  for (const inv of allSalesInv) {
    if (!inv.party) continue;
    const existing = partyTotals.get(inv.party.id);
    const amt = parseFloat(inv.grandTotal.toString());
    if (existing) existing.total += amt;
    else partyTotals.set(inv.party.id, { name: inv.party.name, total: amt });
  }
  const topParties = [...partyTotals.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // === 7. Top 5 items by sales qty ===
  const allInvoiceLines = await prisma.invoiceLine.findMany({
    where: { invoice: { companyId: company.id, type: "SALES" }, itemId: { not: null } },
    include: { item: true },
  });
  const itemQtyMap = new Map<string, { name: string; qty: number }>();
  for (const line of allInvoiceLines) {
    if (!line.item) continue;
    const existing = itemQtyMap.get(line.item.id);
    const qty = parseFloat(line.qty.toString());
    if (existing) existing.qty += qty;
    else itemQtyMap.set(line.item.id, { name: line.item.name, qty });
  }
  const topItems = [...itemQtyMap.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // === 8. Low stock items ===
  const allItems = await prisma.item.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true, stock: true, minStock: true, unit: true, type: true },
  });
  const lowStockItems = allItems.filter((i) => {
    if (i.type === "SERVICE") return false;
    return parseFloat(i.stock.toString()) <= parseFloat(i.minStock.toString());
  });

  // === 9. Recent invoices ===
  const recentInvoices = await prisma.invoice.findMany({
    where: { companyId: company.id },
    include: { party: true },
    orderBy: { date: "desc" },
    take: 6,
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-8 text-white shadow-lg shadow-slate-900/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Smart Accounting & GST Ready</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Namaste, {user.name.split(" ")[0]}!
            </h1>
            <p className="text-sm text-slate-300 max-w-xl font-medium">
              Welcome back to <span className="font-semibold text-white">{company.name}</span>. Here is your live financial performance and transaction summary.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/invoices/new"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Create Invoice</span>
            </Link>
            <Link
              href="/reports"
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-all backdrop-blur-xs border border-white/15"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Excel Export</span>
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Sales Card */}
        <div className="card p-5 bg-gradient-to-br from-white via-white to-emerald-50/40 border-emerald-100/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Month Sales
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-xs">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {formatCurrency(monthSales)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Active Billing Cycle</span>
          </div>
        </div>

        {/* Receivables Card */}
        <div className="card p-5 bg-gradient-to-br from-white via-white to-amber-50/40 border-amber-100/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pending Receivables
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-amber-600 tracking-tight">
            {formatCurrency(receivables)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs font-semibold text-amber-700">
            <span>{unpaidInvoices.length} unpaid invoices</span>
            <Link href="/invoices" className="underline hover:text-amber-800">Collect →</Link>
          </div>
        </div>

        {/* Total Purchases Card */}
        <div className="card p-5 bg-gradient-to-br from-white via-white to-purple-50/40 border-purple-100/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Purchases Recorded
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 shadow-xs">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-purple-700 tracking-tight">
            {formatCurrency(totalPurchases)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-purple-600">
            <span>Supplier bills & stock-in</span>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="card p-5 bg-gradient-to-br from-white via-white to-rose-50/40 border-rose-100/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Logged Expenses
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 shadow-xs">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-rose-600 tracking-tight">
            {formatCurrency(totalExpenses)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs font-semibold text-rose-600">
            <span>Direct & Indirect overheads</span>
            <Link href="/expenses" className="underline hover:text-rose-800">View →</Link>
          </div>
        </div>
      </div>

      {/* Chart & Quick Action Matrix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales Chart */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
                Sales Trend (Last 6 Months)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Month-wise gross turnover</p>
            </div>
            <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Turnover: {formatCurrency(months.reduce((s, m) => s + m.value, 0))}
            </span>
          </div>
          <SalesChart data={months} />
        </div>

        {/* Quick Actions Hub */}
        <div className="card p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">Quick Actions Hub</h2>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <Link
                href="/invoices/new"
                className="group flex items-center justify-between rounded-xl bg-emerald-50/80 p-3 text-xs font-bold text-emerald-900 border border-emerald-200/70 hover:bg-emerald-100/90 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <span>New Sales Invoice (GST)</span>
                </div>
                <ArrowRight className="h-4 w-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/invoices/new?type=PURCHASE"
                className="group flex items-center justify-between rounded-xl bg-purple-50/80 p-3 text-xs font-bold text-purple-900 border border-purple-200/70 hover:bg-purple-100/90 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <span>Record Purchase Bill</span>
                </div>
                <ArrowRight className="h-4 w-4 text-purple-600 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/expenses"
                className="group flex items-center justify-between rounded-xl bg-rose-50/80 p-3 text-xs font-bold text-rose-900 border border-rose-200/70 hover:bg-rose-100/90 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <span>Log Business Expense</span>
                </div>
                <ArrowRight className="h-4 w-4 text-rose-600 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/parties/new"
                className="group flex items-center justify-between rounded-xl bg-blue-50/80 p-3 text-xs font-bold text-blue-900 border border-blue-200/70 hover:bg-blue-100/90 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Users className="h-4 w-4" />
                  </div>
                  <span>Add Customer / Vendor</span>
                </div>
                <ArrowRight className="h-4 w-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/items/new"
                className="group flex items-center justify-between rounded-xl bg-amber-50/80 p-3 text-xs font-bold text-amber-900 border border-amber-200/70 hover:bg-amber-100/90 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white">
                    <Package className="h-4 w-4" />
                  </div>
                  <span>Add Product / Service</span>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-[11px] text-slate-500">
            <span className="font-bold text-slate-700">Auto-Ledger Sync:</span> All transactions automatically post double-entry vouchers to General Ledger.
          </div>
        </div>
      </div>

      {/* Top Parties & Top Items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Parties */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" /> Top Customers
              </h2>
              <p className="text-xs text-slate-400">By total sales volume</p>
            </div>
            <Link
              href="/parties"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              View all ({partyCount}) <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {topParties.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No sales recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {topParties.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3 border border-slate-100 hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                        i === 0
                          ? "bg-amber-100 text-amber-800"
                          : i === 1
                          ? "bg-slate-200 text-slate-700"
                          : i === 2
                          ? "bg-orange-100 text-orange-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="font-semibold text-xs sm:text-sm text-slate-800 truncate max-w-[180px] sm:max-w-[240px]">
                      {p.name}
                    </span>
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-emerald-700">
                    {formatCurrency(p.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Selling Items */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" /> Top Selling Items
              </h2>
              <p className="text-xs text-slate-400">By quantity sold</p>
            </div>
            <Link
              href="/items"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              View all ({itemCount}) <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {topItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No item sales data yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {topItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3 border border-slate-100 hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">
                      {i + 1}
                    </span>
                    <span className="font-semibold text-xs sm:text-sm text-slate-800 truncate max-w-[180px] sm:max-w-[240px]">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    {item.qty} sold
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts & Receivables row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low Stock Alert */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" /> Low Stock Alerts
              </h2>
              <p className="text-xs text-slate-400">Items nearing reorder threshold</p>
            </div>
            <Link href="/items" className="text-xs font-bold text-slate-600 hover:underline">
              Inventory →
            </Link>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-1" />
              <p className="text-sm font-semibold text-slate-700">All inventory items healthy</p>
              <p className="text-xs text-slate-400">No low stock thresholds breached</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-rose-50/60 p-3 border border-rose-100"
                >
                  <span className="font-semibold text-xs sm:text-sm text-slate-800">{item.name}</span>
                  <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg">
                    {item.stock.toString()} {item.unit} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unpaid Receivables */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" /> Pending Client Payments
              </h2>
              <p className="text-xs text-slate-400">Total overdue amount</p>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg">
              {formatCurrency(receivables)}
            </span>
          </div>
          {unpaidInvoices.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-1" />
              <p className="text-sm font-semibold text-slate-700">Zero outstanding dues</p>
              <p className="text-xs text-slate-400">All invoices are completely settled</p>
            </div>
          ) : (
            <div className="space-y-2">
              {unpaidInvoices.slice(0, 4).map((inv) => {
                const balance =
                  parseFloat(inv.grandTotal.toString()) - parseFloat(inv.paidAmount.toString());
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-3 hover:bg-amber-50/60 border border-slate-100 hover:border-amber-200 transition-all"
                  >
                    <div>
                      <p className="font-bold text-xs sm:text-sm text-slate-800">{inv.party?.name || "Direct Customer"}</p>
                      <p className="text-[11px] font-mono text-slate-400">{inv.invoiceNo}</p>
                    </div>
                    <span className="font-bold text-amber-600 text-xs sm:text-sm">{formatCurrency(balance)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" /> Recent Transactions
            </h2>
            <p className="text-xs text-slate-400">Latest sales invoices & purchase bills</p>
          </div>
          <Link
            href="/invoices"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No invoices recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Party Name</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-bold font-mono text-emerald-700">
                      <Link href={`/invoices/${inv.id}`}>{inv.invoiceNo}</Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`badge ${
                          inv.type === "SALES" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {inv.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      {inv.party?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(inv.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-900">
                      {formatCurrency(inv.grandTotal)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`badge ${
                          inv.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : inv.status === "PARTIAL"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
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

