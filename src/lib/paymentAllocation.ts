import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { roundTo2 } from "@/lib/currency";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/accounts";
import { recordAuditLog } from "@/lib/audit";

export interface InvoiceAllocationInput {
  invoiceId: string;
  amount: number;
}

export interface RecordPaymentInput {
  companyId: string;
  partyId?: string;
  type: "RECEIPT" | "PAYMENT" | "ADVANCE" | "REFUND";
  amount: number;
  date: Date;
  mode: "CASH" | "BANK" | "UPI" | "CARD" | "CHEQUE" | "OTHER";
  accountId?: string;
  reference?: string;
  chequeNo?: string;
  chequeDate?: Date;
  notes?: string;
  allocations?: InvoiceAllocationInput[];
  userId?: string;
  userEmail?: string;
}

async function ensureAccount(companyId: string, preferredCodes: string[]): Promise<string> {
  const existing = await prisma.account.findFirst({
    where: { companyId, code: { in: preferredCodes } },
  });
  if (existing) return existing.id;

  const targetCode = preferredCodes[0];
  const def = DEFAULT_CHART_OF_ACCOUNTS.find((d) => d.code === targetCode);
  const created = await prisma.account.create({
    data: {
      companyId,
      code: def?.code || targetCode,
      name: def?.name || "Account",
      type: def?.type || "ASSET",
      groupId: def?.groupId || "General",
    },
  });
  return created.id;
}

/**
 * Production-grade Payment & Allocation Engine
 * Supports multi-invoice split payments, advance balances, and strict double-entry balancing.
 */
export async function recordPayment(input: RecordPaymentInput) {
  const {
    companyId,
    partyId,
    type,
    amount,
    date,
    mode,
    accountId,
    reference,
    chequeNo,
    chequeDate,
    notes,
    allocations = [],
    userId,
    userEmail,
  } = input;

  if (amount <= 0) {
    throw new Error("Payment amount must be greater than 0");
  }

  // 1. Validate party if provided
  let party = null;
  if (partyId) {
    party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.companyId !== companyId) {
      throw new Error("Party not found or does not belong to the active company.");
    }
  }

  // 2. Validate allocations against invoices
  let totalAllocated = 0;
  const verifiedAllocations: Array<{ invoice: any; allocAmount: number }> = [];

  if (allocations.length > 0) {
    const invoiceIds = allocations.map((a) => a.invoiceId);
    const invoices = await prisma.invoice.findMany({
      where: { companyId, id: { in: invoiceIds } },
    });
    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

    for (const alloc of allocations) {
      const inv = invoiceMap.get(alloc.invoiceId);
      if (!inv) {
        throw new Error(`Invoice ${alloc.invoiceId} not found or does not belong to active company.`);
      }
      if (inv.status === "CANCELLED" || inv.status === "REVERSED") {
        throw new Error(`Cannot allocate payment to ${inv.status.toLowerCase()} invoice ${inv.invoiceNo}.`);
      }
      if (partyId && inv.partyId && inv.partyId !== partyId) {
        throw new Error(`Invoice ${inv.invoiceNo} belongs to a different party.`);
      }

      const grand = Number(inv.grandTotal);
      const paid = Number(inv.paidAmount);
      const remainingDue = Math.max(0, roundTo2(grand - paid));
      const allocAmt = roundTo2(alloc.amount);

      if (allocAmt <= 0) continue;

      if (allocAmt > remainingDue + 0.01) {
        throw new Error(
          `Allocation of ₹${allocAmt} exceeds pending balance of ₹${remainingDue} on invoice ${inv.invoiceNo}`
        );
      }

      totalAllocated = roundTo2(totalAllocated + allocAmt);
      verifiedAllocations.push({ invoice: inv, allocAmount: allocAmt });
    }
  }

  if (totalAllocated > amount + 0.01) {
    throw new Error(`Total allocated amount (₹${totalAllocated}) exceeds payment amount (₹${amount})`);
  }

  const unallocatedAmount = Math.max(0, roundTo2(amount - totalAllocated));

  // 3. Generate sequential payment number: PAY-YYYY-0001 or REC-YYYY-0001
  const year = date.getFullYear();
  const isReceipt = type === "RECEIPT" || (type as string) === "CUSTOMER_PAYMENT";
  const pPrefix = isReceipt ? "REC" : "PAY";
  const pCount = await prisma.payment.count({ where: { companyId, type } });
  const paymentNo = `${pPrefix}-${year}-${String(pCount + 1).padStart(5, "0")}`;

  // 4. Resolve Accounts
  // Cash / Bank account
  let cashOrBankId = accountId;
  if (!cashOrBankId) {
    cashOrBankId =
      mode === "CASH"
        ? await ensureAccount(companyId, ["1001"])
        : await ensureAccount(companyId, ["1002", "1003"]);
  }

  // Counterparty account (Sundry Debtors 1100 for Customer Receipts, Sundry Creditors 2001 for Vendor Payments)
  const counterpartyAccountId = isReceipt
    ? await ensureAccount(companyId, ["1100"])
    : await ensureAccount(companyId, ["2001"]);

  // Advance account if unallocated funds exist
  const advanceAccountId = isReceipt
    ? await ensureAccount(companyId, ["2201", "2200", "1100"]) // Customer Advance (Liability)
    : await ensureAccount(companyId, ["1400", "2001"]); // Supplier Advance (Asset)

  // 5. Generate Voucher Number
  const vCount = await prisma.voucher.count({ where: { companyId } });
  const datePrefix = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const voucherNo = `V-${pPrefix}-${datePrefix}-${String(vCount + 1).padStart(4, "0")}-${randomSuffix}`;

  // 6. Execute atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    // A. Create Voucher
    // For Receipt: Dr Cash/Bank [full amount], Cr Sundry Debtors [allocated], Cr Customer Advance [unallocated]
    // For Payment: Dr Sundry Creditors [allocated], Dr Supplier Advance [unallocated], Cr Cash/Bank [full amount]
    const voucherEntries: Array<{ accountId: string; debit: Decimal; credit: Decimal }> = [];

    if (isReceipt) {
      // Dr Cash/Bank
      voucherEntries.push({
        accountId: cashOrBankId!,
        debit: new Decimal(amount),
        credit: new Decimal(0),
      });

      // Cr Debtors for allocated part
      if (totalAllocated > 0) {
        voucherEntries.push({
          accountId: counterpartyAccountId,
          debit: new Decimal(0),
          credit: new Decimal(totalAllocated),
        });
      }

      // Cr Advance for unallocated part
      if (unallocatedAmount > 0) {
        voucherEntries.push({
          accountId: advanceAccountId,
          debit: new Decimal(0),
          credit: new Decimal(unallocatedAmount),
        });
      }
    } else {
      // Dr Creditors for allocated part
      if (totalAllocated > 0) {
        voucherEntries.push({
          accountId: counterpartyAccountId,
          debit: new Decimal(totalAllocated),
          credit: new Decimal(0),
        });
      }

      // Dr Supplier Advance for unallocated part
      if (unallocatedAmount > 0) {
        voucherEntries.push({
          accountId: advanceAccountId,
          debit: new Decimal(unallocatedAmount),
          credit: new Decimal(0),
        });
      }

      // Cr Cash/Bank
      voucherEntries.push({
        accountId: cashOrBankId!,
        debit: new Decimal(0),
        credit: new Decimal(amount),
      });
    }

    const narration =
      notes ||
      `${isReceipt ? "Receipt" : "Payment"} ${paymentNo} of ₹${amount} via ${mode}${
        reference ? ` (Ref: ${reference})` : ""
      }${party ? ` from/to ${party.name}` : ""}`;

    const voucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNo,
        type: isReceipt ? "RECEIPT" : "PAYMENT",
        date,
        partyId: partyId || null,
        narration,
        entries: {
          create: voucherEntries,
        },
      },
    });

    // B. Create Payment
    const payment = await tx.payment.create({
      data: {
        companyId,
        paymentNo,
        type,
        partyId: partyId || null,
        date,
        amount: new Decimal(amount),
        unallocatedAmount: new Decimal(unallocatedAmount),
        mode,
        accountId: cashOrBankId,
        reference: reference || null,
        chequeNo: chequeNo || null,
        chequeDate: chequeDate || null,
        notes: notes || null,
        voucherId: voucher.id,
        status: "COMPLETED",
      },
    });

    // C. Create Allocations & Update Invoices
    const createdAllocations = [];
    const updatedInvoices = [];

    for (const item of verifiedAllocations) {
      const { invoice: inv, allocAmount } = item;

      const allocation = await tx.paymentAllocation.create({
        data: {
          companyId,
          paymentId: payment.id,
          invoiceId: inv.id,
          amount: new Decimal(allocAmount),
          notes: `Allocated from payment ${paymentNo}`,
        },
      });
      createdAllocations.push(allocation);

      const oldPaid = Number(inv.paidAmount);
      const newPaid = roundTo2(oldPaid + allocAmount);
      const grandTotal = Number(inv.grandTotal);
      const newStatus = newPaid >= grandTotal - 0.01 ? "PAID" : "PARTIALLY_PAID";

      const updated = await tx.invoice.update({
        where: { id: inv.id },
        data: {
          paidAmount: new Decimal(newPaid),
          status: newStatus,
        },
      });
      updatedInvoices.push(updated);
    }

    return { payment, voucher, allocations: createdAllocations, invoices: updatedInvoices };
  });

  if (userId) {
    await recordAuditLog({
      companyId,
      userId,
      userEmail,
      action: "CREATE_PAYMENT",
      entity: "Payment",
      entityId: result.payment.id,
      afterValue: {
        paymentNo: result.payment.paymentNo,
        amount,
        type,
        unallocatedAmount,
        allocationsCount: verifiedAllocations.length,
      },
      details: `Created payment ${result.payment.paymentNo} of ₹${amount} with ${verifiedAllocations.length} invoice allocations`,
    });
  }

  return result;
}

/**
 * Reverses a payment, un-allocating from invoices and creating a reversal voucher.
 */
export async function reversePayment(params: {
  paymentId: string;
  companyId: string;
  reason?: string;
  userId?: string;
  userEmail?: string;
}) {
  const { paymentId, companyId, reason, userId, userEmail } = params;

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, companyId },
    include: {
      allocations: { include: { invoice: true } },
      voucher: { include: { entries: true } },
    },
  });

  if (!payment) {
    throw new Error("Payment not found or does not belong to active company.");
  }
  if (payment.status === "REVERSED" || payment.status === "CANCELLED") {
    throw new Error(`Payment is already ${payment.status.toLowerCase()}.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Revert invoice paid amounts
    for (const alloc of payment.allocations) {
      const inv = alloc.invoice;
      const currentPaid = Number(inv.paidAmount);
      const allocAmt = Number(alloc.amount);
      const newPaid = Math.max(0, roundTo2(currentPaid - allocAmt));
      const grand = Number(inv.grandTotal);

      let newStatus = "POSTED";
      if (newPaid >= grand - 0.01) newStatus = "PAID";
      else if (newPaid > 0) newStatus = "PARTIALLY_PAID";

      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          paidAmount: new Decimal(newPaid),
          status: newStatus,
        },
      });
    }

    // 2. Mark voucher reversed & post reversing journal voucher
    if (payment.voucher) {
      await tx.voucher.update({
        where: { id: payment.voucher.id },
        data: { isReversed: true },
      });

      const currentYear = new Date().getFullYear();
      const count = await tx.voucher.count({ where: { companyId } });
      const revVoucherNo = `V-REV-${currentYear}-${String(count + 1).padStart(4, "0")}`;

      await tx.voucher.create({
        data: {
          companyId,
          voucherNo: revVoucherNo,
          type: "JOURNAL",
          date: new Date(),
          partyId: payment.partyId,
          narration: `Reversal of payment ${payment.paymentNo} (${reason || "Payment Cancelled"})`,
          entries: {
            create: payment.voucher.entries.map((e) => ({
              accountId: e.accountId,
              debit: e.credit, // swap debit and credit
              credit: e.debit,
            })),
          },
        },
      });
    }

    // 3. Mark payment status as REVERSED
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "REVERSED",
        notes: `${payment.notes ? `${payment.notes} | ` : ""}REVERSED: ${reason || "User requested reversal"}`,
      },
    });

    return updatedPayment;
  });

  if (userId) {
    await recordAuditLog({
      companyId,
      userId,
      userEmail,
      action: "REVERSE_PAYMENT",
      entity: "Payment",
      entityId: payment.id,
      details: `Reversed payment ${payment.paymentNo} (${reason || "No reason given"})`,
    });
  }

  return result;
}
