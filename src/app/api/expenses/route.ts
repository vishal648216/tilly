import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company selected" }, { status: 400 });

    const expenses = await prisma.expense.findMany({
      where: { companyId: company.id },
      include: {
        account: true,
        voucher: {
          include: {
            entries: {
              include: { account: true },
            },
          },
        },
      },
      orderBy: { expenseDate: "desc" },
    });

    return NextResponse.json({ expenses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company selected" }, { status: 400 });

    const body = await req.json();
    const { category, amount, paymentMode, accountId, paidFromId, expenseDate, notes } = body;

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      return NextResponse.json({ error: "Please enter a valid amount" }, { status: 400 });
    }
    if (!accountId) {
      return NextResponse.json({ error: "Expense category/account is required" }, { status: 400 });
    }
    if (!paidFromId) {
      return NextResponse.json({ error: "Paid from (Cash/Bank) account is required" }, { status: 400 });
    }

    const date = expenseDate ? new Date(expenseDate) : new Date();

    // Verify accounts belong to company
    const [expenseAcc, paymentAcc] = await Promise.all([
      prisma.account.findFirst({ where: { id: accountId, companyId: company.id } }),
      prisma.account.findFirst({ where: { id: paidFromId, companyId: company.id } }),
    ]);

    if (!expenseAcc || !paymentAcc) {
      return NextResponse.json({ error: "Invalid account selected" }, { status: 400 });
    }

    // Generate voucher number
    const lastVoucher = await prisma.voucher.findFirst({
      where: { companyId: company.id },
      orderBy: { voucherNo: "desc" },
    });
    const seq = lastVoucher ? parseInt(lastVoucher.voucherNo.replace(/\D/g, "")) + 1 : 1;
    const voucherNo = `EXP-${String(seq).padStart(6, "0")}`;

    const expenseRecord = await prisma.$transaction(async (tx) => {
      // Create double entry payment voucher:
      // Dr. Expense Account
      // Cr. Payment Source (Cash / Bank)
      const voucher = await tx.voucher.create({
        data: {
          companyId: company.id,
          voucherNo,
          type: "PAYMENT",
          date,
          narration: `Expense: ${category} - ${notes || expenseAcc.name} (Paid via ${paymentMode || "Cash"})`,
          entries: {
            create: [
              {
                accountId: expenseAcc.id,
                debit: new Decimal(numAmount),
                credit: new Decimal(0),
              },
              {
                accountId: paymentAcc.id,
                debit: new Decimal(0),
                credit: new Decimal(numAmount),
              },
            ],
          },
        },
      });

      const expense = await tx.expense.create({
        data: {
          companyId: company.id,
          expenseDate: date,
          category: category || expenseAcc.name,
          amount: new Decimal(numAmount),
          paymentMode: paymentMode || "Cash",
          accountId: expenseAcc.id,
          paidFromId: paymentAcc.id,
          voucherId: voucher.id,
          notes: notes || null,
        },
        include: {
          account: true,
          voucher: true,
        },
      });

      return expense;
    });

    return NextResponse.json({ success: true, expense: expenseRecord });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
