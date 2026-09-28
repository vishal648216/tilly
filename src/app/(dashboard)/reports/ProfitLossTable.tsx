import { formatCurrency } from "@/lib/currency";

type AccountWithBalance = {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number;
};

export default function ProfitLossTable({
  accounts,
}: {
  accounts: AccountWithBalance[];
}) {
  const incomeAccounts = accounts.filter(
    (a) => a.type === "INCOME" && a.balance !== 0
  );
  const expenseAccounts = accounts.filter(
    (a) => a.type === "EXPENSE" && a.balance !== 0
  );

  const totalIncome = incomeAccounts.reduce((s, a) => s + a.balance, 0);
  const totalExpense = expenseAccounts.reduce((s, a) => s + a.balance, 0);
  const netProfit = totalIncome - totalExpense;

  return (
    <div className="card overflow-hidden">
      {incomeAccounts.length === 0 && expenseAccounts.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">
          No income/expense entries yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Particulars</th>
              <th className="px-4 py-3 text-right font-medium">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {/* Income */}
            <tr className="bg-green-50/50">
              <td className="px-4 py-2 font-semibold text-green-700">Income</td>
              <td className="px-4 py-2"></td>
            </tr>
            {incomeAccounts.map((a) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="px-4 py-2 pl-8">
                  {a.name}{" "}
                  <span className="font-mono text-xs text-slate-400">({a.code})</span>
                </td>
                <td className="px-4 py-2 text-right text-green-700">
                  {formatCurrency(a.balance)}
                </td>
              </tr>
            ))}
            <tr className="border-b border-slate-200 font-semibold">
              <td className="px-4 py-2 pl-8">Total Income</td>
              <td className="px-4 py-2 text-right text-green-700">
                {formatCurrency(totalIncome)}
              </td>
            </tr>

            {/* Expenses */}
            <tr className="bg-red-50/50">
              <td className="px-4 py-2 font-semibold text-red-700">Expenses</td>
              <td className="px-4 py-2"></td>
            </tr>
            {expenseAccounts.map((a) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="px-4 py-2 pl-8">
                  {a.name}{" "}
                  <span className="font-mono text-xs text-slate-400">({a.code})</span>
                </td>
                <td className="px-4 py-2 text-right text-red-700">
                  {formatCurrency(a.balance)}
                </td>
              </tr>
            ))}
            <tr className="border-b border-slate-200 font-semibold">
              <td className="px-4 py-2 pl-8">Total Expenses</td>
              <td className="px-4 py-2 text-right text-red-700">
                {formatCurrency(totalExpense)}
              </td>
            </tr>
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 text-base font-bold">
            <tr>
              <td className="px-4 py-3">
                {netProfit >= 0 ? "Net Profit" : "Net Loss"}
              </td>
              <td
                className={`px-4 py-3 text-right ${
                  netProfit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(Math.abs(netProfit))}
                {netProfit < 0 && " (Loss)"}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
