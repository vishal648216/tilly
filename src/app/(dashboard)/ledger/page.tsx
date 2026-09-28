import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import PartySelector from "./PartySelector";
import { Users, Phone, Receipt, FileSpreadsheet, BookOpen } from "lucide-react";

export default async function PartyLedgerPage({
  searchParams,
}: {
  searchParams: { partyId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const parties = await prisma.party.findMany({
    where: { companyId: company.id },
    orderBy: { name: "asc" },
  });

  const selectedPartyId = searchParams.partyId;
  const selectedParty = parties.find((p) => p.id === selectedPartyId);

  // Get all vouchers for this party
  let transactions: any[] = [];
  let openingBalance = 0;
  let runningBalance = 0;

  if (selectedPartyId) {
    openingBalance = parseFloat(selectedParty?.openingBalance.toString() || "0");
    runningBalance = openingBalance;

    const vouchers = await prisma.voucher.findMany({
      where: {
        companyId: company.id,
        partyId: selectedPartyId,
        isReversed: false,
      },
      include: { entries: { include: { account: true } } },
      orderBy: { date: "asc" },
    });

    transactions = vouchers.map((v) => {
      // For customers (Sundry Debtors): debit increases their balance (they owe us)
      // For vendors (Sundry Creditors): credit increases their balance (we owe them)
      const dr = v.entries.reduce((s, e) => s + parseFloat(e.debit.toString()), 0);
      const cr = v.entries.reduce((s, e) => s + parseFloat(e.credit.toString()), 0);

      // Customer: Dr = sale (they owe more), Cr = payment (they paid)
      // The "debit" side increases receivable, "credit" decreases
      runningBalance += dr - cr;

      return {
        id: v.id,
        voucherNo: v.voucherNo,
        type: v.type,
        date: v.date,
        narration: v.narration,
        debit: dr,
        credit: cr,
        balance: runningBalance,
      };
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Party Ledger</h1>
        <p className="text-sm text-slate-500">Customer/Vendor wise transaction history</p>
      </div>

      {/* Party selector */}
      <div className="card mb-4 p-4">
        <label className="label">Select Party</label>
        <PartySelector parties={parties} selectedPartyId={selectedPartyId} />
        {selectedParty && (
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
            {selectedParty.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-slate-400" /> {selectedParty.phone}
              </span>
            )}
            {selectedParty.gstin && (
              <span className="flex items-center gap-1.5 font-mono">
                <Receipt className="h-4 w-4 text-slate-400" /> GSTIN: {selectedParty.gstin}
              </span>
            )}
          </div>
        )}
      </div>

      {!selectedPartyId ? (
        <div className="card p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Users className="h-6 w-6" />
          </div>
          <p className="text-slate-600 font-medium">Upar se party select karein.</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <BookOpen className="h-6 w-6" />
          </div>
          <p className="text-slate-600 font-medium">
            {selectedParty?.name} ke saath koi transaction nahi hai.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Voucher</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Particulars</th>
                <th className="px-4 py-3 text-right font-medium">Debit (₹)</th>
                <th className="px-4 py-3 text-right font-medium">Credit (₹)</th>
                <th className="px-4 py-3 text-right font-medium">Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening balance row */}
              <tr className="border-b border-slate-200 bg-slate-50/50 font-medium italic text-slate-500">
                <td className="px-4 py-2" colSpan={6}>
                  Opening Balance
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
                  <td className="px-4 py-2">
                    <span className={`badge ${
                      t.type === "SALES" ? "bg-blue-100 text-blue-700" :
                      t.type === "PURCHASE" ? "bg-purple-100 text-purple-700" :
                      t.type === "RECEIPT" ? "bg-green-100 text-green-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600 truncate max-w-[200px]">
                    {t.narration || "—"}
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
                <td className="px-4 py-3" colSpan={4}>Closing Balance</td>
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
