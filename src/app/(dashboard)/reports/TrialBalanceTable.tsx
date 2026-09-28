import { formatCurrency } from "@/lib/currency";
import { CheckCircle2, AlertTriangle } from "lucide-react";

type AccountWithBalance = {
  id: string;
  code: string;
  name: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

export default function TrialBalanceTable({
  accounts,
}: {
  accounts: AccountWithBalance[];
}) {
  // Calculate debit & credit columns for trial balance
  let totalDr = 0;
  let totalCr = 0;
  const rows = accounts
    .filter((a) => a.balance !== 0)
    .map((a) => {
      const isDebitNature = ["ASSET", "EXPENSE"].includes(a.type);
      if (isDebitNature) {
        totalDr += a.balance;
        return { ...a, dr: a.balance, cr: 0 };
      } else {
        totalCr += a.balance;
        return { ...a, dr: 0, cr: a.balance };
      }
    });

  return (
    <div className="card overflow-hidden">
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">
          No voucher entries yet. Trial balance will show here.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Debit (₹)</th>
              <th className="px-4 py-3 text-right font-medium">Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <span className="font-mono text-xs text-slate-400">{r.code}</span>{" "}
                  <span className="font-medium">{r.name}</span>
                </td>
                <td className="px-4 py-2 text-slate-500">{r.type}</td>
                <td className="px-4 py-2 text-right">{r.dr > 0 ? formatCurrency(r.dr) : "—"}</td>
                <td className="px-4 py-2 text-right">{r.cr > 0 ? formatCurrency(r.cr) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
            <tr>
              <td className="px-4 py-3" colSpan={2}>
                Total
              </td>
              <td className="px-4 py-3 text-right">{formatCurrency(totalDr)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(totalCr)}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-sm" colSpan={2}>
                Difference:{" "}
                <span className={`inline-flex items-center gap-1 font-bold ${Math.abs(totalDr - totalCr) < 0.01 ? "text-emerald-600" : "text-red-600"}`}>
                  {Math.abs(totalDr - totalCr) < 0.01 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Balanced
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4" /> Not Balanced!
                    </>
                  )}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-sm" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
