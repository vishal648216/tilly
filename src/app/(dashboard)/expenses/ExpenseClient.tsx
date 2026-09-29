"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/currency";
import { exportToCSV } from "@/lib/exportCsv";
import {
  Wallet,
  Download,
  Plus,
  Search,
  X,
  Banknote,
  CreditCard,
  Calendar,
  FileText,
  Tag,
  Receipt,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface Account {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface Expense {
  id: string;
  expenseDate: string;
  category: string;
  amount: string | number;
  paymentMode: string;
  notes: string | null;
  accountId: string;
  paidFromId: string;
  account?: { name: string; code: string };
  voucher?: { voucherNo: string } | null;
}

export default function ExpenseClient({
  expenses: initialExpenses,
  expenseAccounts,
  paymentAccounts,
}: {
  expenses: Expense[];
  expenseAccounts: Account[];
  paymentAccounts: Account[];
}) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General Expenses");
  const [accountId, setAccountId] = useState(expenseAccounts[0]?.id || "");
  const [paidFromId, setPaidFromId] = useState(paymentAccounts[0]?.id || "");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const categories = Array.from(new Set(expenses.map((e) => e.category)));

  // Filtered expenses
  const filtered = expenses.filter((e) => {
    const matchCategory = selectedCategory === "ALL" || e.category === selectedCategory;
    const matchSearch =
      e.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.notes && e.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.account && e.account.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchCategory && matchSearch;
  });

  // Analytics
  const totalAllTime = expenses.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.expenseDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const totalThisMonth = thisMonthExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount.toString()),
    0
  );

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMsg("Please enter a valid expense amount");
      return;
    }
    if (!accountId || !paidFromId) {
      setErrorMsg("Please select both Expense account and Paid From account");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          amount: parseFloat(amount),
          paymentMode,
          accountId,
          paidFromId,
          expenseDate,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add expense");

      setExpenses([data.expense, ...expenses]);
      setShowModal(false);
      // Reset form
      setAmount("");
      setNotes("");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteExpense() {
    if (!expenseToDelete) return;
    setDeletingId(expenseToDelete.id);
    try {
      const res = await fetch(`/api/expenses/${expenseToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete expense");

      setExpenses((prev) => prev.filter((e) => e.id !== expenseToDelete.id));
      setExpenseToDelete(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete expense");
    } finally {
      setDeletingId(null);
    }
  }

  function handleExport() {
    const headers = [
      "Date",
      "Voucher No",
      "Category",
      "Expense Account",
      "Amount",
      "Payment Mode",
      "Notes",
    ];
    const rows = filtered.map((e) => [
      new Date(e.expenseDate).toLocaleDateString("en-IN"),
      e.voucher?.voucherNo || "-",
      e.category,
      e.account?.name || "-",
      parseFloat(e.amount.toString()),
      e.paymentMode,
      e.notes || "-",
    ]);
    exportToCSV("taily_expenses", headers, rows);
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-brand-600" /> Expense Tracker
          </h1>
          <p className="text-sm text-slate-500">
            Log daily business expenses with automatic double-entry ledger posting
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" /> Export CSV
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            This Month's Expenses
          </p>
          <p className="mt-2 text-2xl font-bold text-red-600">
            {formatCurrency(totalThisMonth)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{thisMonthExpenses.length} entries recorded</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total All-Time Expenses
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(totalAllTime)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{expenses.length} total entries</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Categories
          </p>
          <p className="mt-2 text-2xl font-bold text-brand-600">
            {categories.length || 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Categorized expense heads</p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by category, account, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Voucher #</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Expense Head</th>
                <th className="px-6 py-3">Payment Mode</th>
                <th className="px-6 py-3">Notes</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-center w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <Wallet className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-base font-medium text-slate-600">No expenses found</p>
                    <p className="text-xs">Click "Add Expense" to log your first business expense.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                      {new Date(exp.expenseDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {exp.voucher?.voucherNo || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                        <Tag className="h-3 w-3" />
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {exp.account ? `${exp.account.name} (${exp.account.code})` : "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        {exp.paymentMode === "Cash" ? (
                          <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                        )}
                        {exp.paymentMode}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate">
                      {exp.notes || "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-red-600 whitespace-nowrap">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setExpenseToDelete(exp)}
                        title="Delete / Remove Expense"
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-brand-600" /> Add New Expense
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Category / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Office Rent, Electricity Bill, Tea & Snacks, Maintenance"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Expense Account (Ledger) *
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => {
                      setAccountId(e.target.value);
                      const acc = expenseAccounts.find((a) => a.id === e.target.value);
                      if (acc && !category) setCategory(acc.name);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  >
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Paid From (Account) *
                  </label>
                  <select
                    value={paidFromId}
                    onChange={(e) => setPaidFromId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  >
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Payment Mode
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {["Cash", "UPI", "Bank Transfer", "Cheque"].map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => setPaymentMode(mode)}
                      className={`rounded-lg py-1.5 text-xs font-medium border transition-colors ${
                        paymentMode === mode
                          ? "bg-brand-50 border-brand-500 text-brand-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Narration / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional description, bill/receipt reference..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2.5 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Delete Expense Entry?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Are you sure you want to delete this expense? This will also remove the corresponding payment voucher from your ledger.
                </p>

                <div className="mt-4 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Category:</span>
                    <span className="font-semibold text-slate-800">{expenseToDelete.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount:</span>
                    <span className="font-bold text-red-600">{formatCurrency(expenseToDelete.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date:</span>
                    <span className="text-slate-700">
                      {new Date(expenseToDelete.expenseDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {expenseToDelete.voucher?.voucherNo && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Voucher:</span>
                      <span className="font-mono text-slate-700">{expenseToDelete.voucher.voucherNo}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={deletingId !== null}
                    onClick={() => setExpenseToDelete(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deletingId !== null}
                    onClick={handleDeleteExpense}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deletingId ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" /> Delete Expense
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
