// Taily - Double-entry voucher helper
// Guarantees: every voucher has balanced debits = credits before saving.

import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";

export type EntryInput = {
  accountCode: string; // lookup by code within company
  debit?: number;
  credit?: number;
};

export type CreateVoucherInput = {
  companyId: string;
  type: string; // SALES, PURCHASE, PAYMENT, RECEIPT, JOURNAL, CONTRA
  date: Date;
  narration?: string;
  partyId?: string;
  entries: EntryInput[];
};

// Validates & saves a balanced voucher inside a transaction.
// Throws if entries don't balance or an account code is missing.
export async function createVoucher(input: CreateVoucherInput) {
  const { companyId, type, date, narration, partyId, entries } = input;

  // 1. Look up all accounts by code (single query)
  const codes = entries.map((e) => e.accountCode);
  const accounts = await prisma.account.findMany({
    where: { companyId, code: { in: codes } },
  });
  const accountMap = new Map(accounts.map((a) => [a.code, a]));

  // Validate all codes exist
  for (const code of codes) {
    if (!accountMap.has(code)) {
      throw new Error(`Account code not found: ${code}`);
    }
  }

  // 2. Build entries & check balance
  let totalDebit = 0;
  let totalCredit = 0;
  const builtEntries = entries.map((e) => {
    const debit = e.debit ?? 0;
    const credit = e.credit ?? 0;
    if (debit > 0 && credit > 0) {
      throw new Error(`Account ${e.accountCode}: cannot have both debit and credit`);
    }
    totalDebit += debit;
    totalCredit += credit;
    return {
      accountId: accountMap.get(e.accountCode)!.id,
      debit: new Decimal(debit),
      credit: new Decimal(credit),
    };
  });

  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  if (diff !== 0) {
    throw new Error(
      `Voucher not balanced! Debits (${totalDebit}) ≠ Credits (${totalCredit})`
    );
  }

  // 3. Generate next voucher number: V-000001
  const lastVoucher = await prisma.voucher.findFirst({
    where: { companyId },
    orderBy: { voucherNo: "desc" },
  });
  const nextSeq = lastVoucher ? parseInt(lastVoucher.voucherNo.replace(/\D/g, "")) + 1 : 1;
  const voucherNo = `V-${String(nextSeq).padStart(6, "0")}`;

  // 4. Save in a transaction (atomic - both voucher & entries or nothing)
  return prisma.voucher.create({
    data: {
      companyId,
      voucherNo,
      type,
      date,
      narration,
      partyId,
      entries: { create: builtEntries },
    },
    include: { entries: { include: { account: true } } },
  });
}
