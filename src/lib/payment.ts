// Taily - Payment Receive logic
// When customer pays against an invoice, this:
// 1. Creates a RECEIPT voucher (Dr Cash/Bank, Cr Sundry Debtors)
// 2. Updates invoice paidAmount + status (UNPAID → PARTIAL → PAID)

import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { roundTo2 } from "./currency";

export type ReceivePaymentInput = {
  invoiceId: string;
  amount: number;
  date: Date;
  mode: "CASH" | "BANK" | "UPI" | "CHEQUE";
  reference?: string; // UPI ref, cheque no, etc.
  narration?: string;
};

export async function receivePayment(input: ReceivePaymentInput) {
  const { invoiceId, amount, date, mode, reference, narration } = input;

  if (amount <= 0) throw new Error("Amount must be greater than 0");

  // 1. Fetch invoice with company
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { company: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  const companyId = invoice.companyId;

  // 2. Validate amount doesn't exceed invoice total
  const grandTotal = parseFloat(invoice.grandTotal.toString());
  const alreadyPaid = parseFloat(invoice.paidAmount.toString());
  const newPaidAmount = roundTo2(alreadyPaid + amount);
  const balanceAfter = roundTo2(grandTotal - newPaidAmount);

  if (newPaidAmount > grandTotal + 0.01) {
    throw new Error(
      `Payment (₹${newPaidAmount}) exceeds invoice total (₹${grandTotal})`
    );
  }

  // 3. Determine Cash vs Bank account
  // CASH → 1001 (Cash in Hand), BANK/UPI/CHEQUE → 1003 (Bank of Baroda)
  const cashOrBankCode = mode === "CASH" ? "1001" : "1003";
  const debtorCode = "1100"; // Sundry Debtors

  const accounts = await prisma.account.findMany({
    where: { companyId, code: { in: [cashOrBankCode, debtorCode] } },
  });
  const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

  if (!accountMap.has(cashOrBankCode) || !accountMap.has(debtorCode)) {
    throw new Error("Required accounts not found. Check chart of accounts.");
  }

  // 4. Generate voucher number
  const lastVoucher = await prisma.voucher.findFirst({
    where: { companyId },
    orderBy: { voucherNo: "desc" },
  });
  const vSeq = lastVoucher ? parseInt(lastVoucher.voucherNo.replace(/\D/g, "")) + 1 : 1;
  const voucherNo = `V-${String(vSeq).padStart(6, "0")}`;

  // 5. Determine new status
  let newStatus: string;
  if (balanceAfter <= 0.01) newStatus = "PAID";
  else if (newPaidAmount > 0) newStatus = "PARTIAL";
  else newStatus = "UNPAID";

  const modeLabel = { CASH: "Cash", BANK: "Bank", UPI: "UPI", CHEQUE: "Cheque" }[mode];
  const fullNarration =
    narration ||
    `Payment received via ${modeLabel} against ${invoice.invoiceNo}${reference ? ` (Ref: ${reference})` : ""}`;

  // 6. Create voucher + update invoice atomically
  const result = await prisma.$transaction(async (tx) => {
    // Create RECEIPT voucher: Dr Cash/Bank, Cr Sundry Debtors
    const voucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNo,
        type: "RECEIPT",
        date,
        partyId: invoice.partyId,
        invoiceId: invoice.id,
        narration: fullNarration,
        entries: {
          create: [
            {
              accountId: accountMap.get(cashOrBankCode)!,
              debit: new Decimal(amount),
              credit: new Decimal(0),
            },
            {
              accountId: accountMap.get(debtorCode)!,
              debit: new Decimal(0),
              credit: new Decimal(amount),
            },
          ],
        },
      },
    });

    // Update invoice paid amount + status
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: new Decimal(newPaidAmount),
        status: newStatus,
      },
    });

    return { voucher, invoice: updated };
  });

  return result;
}

// ============================================================
// PAYMENT MADE — Pay a vendor/supplier against a Purchase Bill
// Creates a PAYMENT voucher: Dr Sundry Creditors, Cr Cash/Bank
// Updates purchase invoice paidAmount + status (UNPAID → PARTIAL → PAID)
// ============================================================

export type MakePaymentInput = {
  invoiceId: string;
  amount: number;
  date: Date;
  mode: "CASH" | "BANK" | "UPI" | "CHEQUE";
  reference?: string;
  narration?: string;
};

export async function makePayment(input: MakePaymentInput) {
  const { invoiceId, amount, date, mode, reference, narration } = input;

  if (amount <= 0) throw new Error("Amount must be greater than 0");

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { company: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  const companyId = invoice.companyId;

  const grandTotal = parseFloat(invoice.grandTotal.toString());
  const alreadyPaid = parseFloat(invoice.paidAmount.toString());
  const newPaidAmount = roundTo2(alreadyPaid + amount);
  const balanceAfter = roundTo2(grandTotal - newPaidAmount);

  if (newPaidAmount > grandTotal + 0.01) {
    throw new Error(
      `Payment (Rs.${newPaidAmount}) exceeds invoice total (Rs.${grandTotal})`
    );
  }

  // Payment Made: Dr Sundry Creditors (2001), Cr Cash (1001) or Bank (1003)
  const cashOrBankCode = mode === "CASH" ? "1001" : "1003";
  const creditorCode = "2001"; // Sundry Creditors

  const accounts = await prisma.account.findMany({
    where: { companyId, code: { in: [cashOrBankCode, creditorCode] } },
  });
  const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

  if (!accountMap.has(cashOrBankCode) || !accountMap.has(creditorCode)) {
    throw new Error("Required accounts not found. Check chart of accounts.");
  }

  // Generate voucher number
  const lastVoucher = await prisma.voucher.findFirst({
    where: { companyId },
    orderBy: { voucherNo: "desc" },
  });
  const vSeq = lastVoucher ? parseInt(lastVoucher.voucherNo.replace(/\D/g, "")) + 1 : 1;
  const voucherNo = `V-${String(vSeq).padStart(6, "0")}`;

  // Determine new status
  let newStatus: string;
  if (balanceAfter <= 0.01) newStatus = "PAID";
  else if (newPaidAmount > 0) newStatus = "PARTIAL";
  else newStatus = "UNPAID";

  const modeLabel = { CASH: "Cash", BANK: "Bank", UPI: "UPI", CHEQUE: "Cheque" }[mode];
  const fullNarration =
    narration ||
    `Payment made via ${modeLabel} against ${invoice.invoiceNo}${reference ? ` (Ref: ${reference})` : ""}`;

  const result = await prisma.$transaction(async (tx) => {
    // Create PAYMENT voucher: Dr Sundry Creditors, Cr Cash/Bank
    const voucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNo,
        type: "PAYMENT",
        date,
        partyId: invoice.partyId,
        invoiceId: invoice.id,
        narration: fullNarration,
        entries: {
          create: [
            {
              accountId: accountMap.get(creditorCode)!,
              debit: new Decimal(amount),
              credit: new Decimal(0),
            },
            {
              accountId: accountMap.get(cashOrBankCode)!,
              debit: new Decimal(0),
              credit: new Decimal(amount),
            },
          ],
        },
      },
    });

    // Update invoice paid amount + status
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: new Decimal(newPaidAmount),
        status: newStatus,
      },
    });

    return { voucher, invoice: updated };
  });

  return result;
}
