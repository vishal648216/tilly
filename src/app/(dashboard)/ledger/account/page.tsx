import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import AccountSelector from "./AccountSelector";
import { Layers, BookOpen } from "lucide-react";

export default async function AccountLedgerPage({
  searchParams,
}: {
  searchParams: { accountId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const accounts = await prisma.account.findMany({
    where: { companyId: company.id },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  const selectedAccountId = searchParams.accountId;
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Get all entries for this account
  let transactions: any[] = [];
  let openingBalance = 0;
  let runningBalance = 0;

  if (selectedAccountId && selectedAccount) {
    openingBalance = parseFloat(selectedAccount.openingBalance.toString());
    runningBalance = openingBalance;

    const entries = await prisma.voucherEntry.findMany({
      where: {
        accountId: selectedAccountId,
        voucher: { companyId: company.id, isReversed: false },
      },
      include: { voucher: { include: { entries: { include: { account: true } } } } },
      orderBy: { voucher: { date: "asc" } },
    });

    const isDebitNature = ["ASSET", "EXPENSE"].includes(selectedAccount.type);

    transactions = entries.map((e) => {
      const debit = parseFloat(e.debit.toString());
      const credit = parseFloat(e.credit.toString());

      if (isDebitNature) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }

      // Find opposite entry (the other account in the voucher)
      const opposite = e.voucher.entries.find((oe) => oe.id !== e.id);
      const oppositeName = opposite?.account.name || "—";

      return {
        id: e.id,
        voucherNo: e.voucher.voucherNo,
        type: e.voucher.type,
        date: e.voucher.date,
        narration: e.voucher.narration,
        opposite: oppositeName,
        debit,
        credit,
        balance: isDebitNature ? runningBalance : runningBalance,
      };
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Account Ledger</h1>
        <p className="text-sm text-slate-500">Ledger-wise transaction history (Tally-style)</p>
      </div>

      {/* Account selector */}
      <div className="card mb-4 p-4">
        <label className="label">Select Account (Chart of Accounts)</label>
        <AccountSelector accounts={accounts} selectedAccountId={selectedAccountId} />
      </div>

      {!selectedAccountId ? (
        <div className="card p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Layers className="h-6 w-6" />
          </div>
          <p className="text-slate-600 font-medium">Upar se account select karein.</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <BookOpen className="h-6 w-6" />
          </div>
          <p className="text-slate-600 font-medium">
            "{selectedAccount?.name}" me koi transaction nahi hai.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Account header */}
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">{selectedAccount?.name}</h2>
                <p className="text-xs text-slate-500">
                  Code: {selectedAccount?.code} | Type: {selectedAccount?.type}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="text-slate-500">Opening Balance</p>
                <p className="font-bold">{formatCurrency(openingBalance)}</p>
              </div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Voucher</th>
                <th className="px-4 py-3 font-medium">Particulars</th>
                <th className="px-4 py-3 text-right font-medium">Debit (₹)</th>
                <th className="px-4 py-3 text-right font-medium">Credit (₹)</th>
                <th className="px-4 py-3 text-right font-medium">Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening row */}
              <tr className="border-b border-slate-200 bg-slate-50/50 font-medium italic text-slate-500">
                <td className="px-4 py-2" colSpan={5}>
                  Opening Balance (To {selectedAccount?.type === "ASSET" || selectedAccount?.type === "EXPENSE" ? "Dr" : "Cr"})
                </td>
                <td className="px-4 py-2 text-right">{formatCurrency(openingBalance)}</td>
              </tr>

              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(t.date).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs font-medium text-brand-600">
                    {t.voucherNo}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {t.type === "SALES" && "To "}
                    {t.type === "PURCHASE" && "By "}
                    {t.type === "RECEIPT" && "By "}
                    {t.type === "PAYMENT" && "To "}
                    {t.type === "JOURNAL" && "— "}
                    {t.opposite}
                    {t.narration && (
                      <span className="block text-xs italic text-slate-400">{t.narration}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {t.debit > 0 ? formatCurrency(t.debit) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {t.credit > 0 ? formatCurrency(t.credit) : "—"}
                  </td>
                  <td className={`px-4 py-2 text-right font-medium ${t.balance >= 0 ? "text-slate-700" : "text-red-600"}`}>
                    {formatCurrency(t.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
              <tr>
                <td className="px-4 py-3" colSpan={3}>
                  Closing Balance ({selectedAccount?.type === "ASSET" || selectedAccount?.type === "EXPENSE" ? "Dr" : "Cr"})
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(transactions.reduce((s, t) => s + t.debit, 0))}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(transactions.reduce((s, t) => s + t.credit, 0))}
                </td>
                <td className="px-4 py-3 text-right text-brand-700">
                  {formatCurrency(runningBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
