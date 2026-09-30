"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Account } from "@prisma/client";
import { CheckCircle2, AlertTriangle, Plus, Trash2 } from "lucide-react";

type Entry = { accountId: string; debit: string; credit: string };

export default function JournalEntryForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState("");
  const [entries, setEntries] = useState<Entry[]>([
    { accountId: "", debit: "", credit: "" },
    { accountId: "", debit: "", credit: "" },
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateEntry(index: number, field: keyof Entry, value: string) {
    setEntries((es) =>
      es.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  }
  function addEntry() {
    setEntries((es) => [...es, { accountId: "", debit: "", credit: "" }]);
  }
  function removeEntry(index: number) {
    if (entries.length > 2) setEntries((es) => es.filter((_, i) => i !== index));
  }

  const totalDr = entries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
  const totalCr = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
  const diff = Math.abs(totalDr - totalCr);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (entries.some((e) => !e.accountId)) {
      setError("Please select an account for each line entry.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "JOURNAL",
          date,
          narration,
          entries: entries.map((e) => ({
            accountId: e.accountId,
            debit: parseFloat(e.debit) || 0,
            credit: parseFloat(e.credit) || 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push("/vouchers");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">Journal Entry</h1>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label">Narration</label>
          <input className="input" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Being..." />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 text-right font-medium">Debit (₹)</th>
              <th className="px-3 py-2 text-right font-medium">Credit (₹)</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-2">
                  <select
                    className="input"
                    value={entry.accountId}
                    onChange={(e) => updateEntry(i, "accountId", e.target.value)}
                  >
                    <option value="">— Select Account —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.code}] {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input w-32 text-right"
                    value={entry.debit}
                    onChange={(e) => updateEntry(i, "debit", e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input w-32 text-right"
                    value={entry.credit}
                    onChange={(e) => updateEntry(i, "credit", e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                </td>
                <td className="px-3 py-2">
                  {entries.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeEntry(i)}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addEntry} className="m-3 btn-secondary text-sm inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Add Row
        </button>
      </div>

      {/* Balance indicator */}
      <div className={`rounded-lg p-3 text-sm font-medium flex items-center justify-between ${
        diff < 0.01 ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
      }`}>
        <span>Total Debit: ₹{totalDr.toFixed(2)} | Total Credit: ₹{totalCr.toFixed(2)}</span>
        <span className="flex items-center gap-1.5 font-bold">
          {diff < 0.01 ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Balanced
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-red-600" /> Difference: ₹{diff.toFixed(2)}
            </>
          )}
        </span>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={loading || diff >= 0.01} className="btn-primary">
          {loading ? "Saving..." : "Save Voucher"}
        </button>
        <button type="button" onClick={() => router.push("/vouchers")} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
