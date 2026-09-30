import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

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
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Please enter a valid expense amount greater than 0." }, { status: 400 });
    }

    const date = expenseDate ? new Date(expenseDate) : new Date();

    // 1. Resolve Expense Account
    let expenseAcc = null;
    if (accountId) {
      expenseAcc = await prisma.account.findFirst({
        where: { id: accountId, companyId: company.id },
      });
    }
    if (!expenseAcc) {
      expenseAcc = await prisma.account.findFirst({
        where: { companyId: company.id, type: "EXPENSE" },
      });
    }
    if (!expenseAcc) {
      expenseAcc = await prisma.account.create({
        data: {
          companyId: company.id,
          code: "5999",
          name: category?.trim() || "General Expenses",
          type: "EXPENSE",
          groupId: "INDIRECT_EXPENSE",
        },
      });
    }

    // 2. Resolve Payment Account (Cash / Bank)
    let paymentAcc = null;
    if (paidFromId) {
      paymentAcc = await prisma.account.findFirst({
        where: { id: paidFromId, companyId: company.id },
      });
    }
    if (!paymentAcc) {
      paymentAcc = await prisma.account.findFirst({
        where: {
          companyId: company.id,
          type: "ASSET",
          code: { in: ["1001", "1002", "1003"] },
        },
      });
    }
    if (!paymentAcc) {
      paymentAcc = await prisma.account.findFirst({
        where: { companyId: company.id, type: "ASSET" },
      });
    }
    if (!paymentAcc) {
      paymentAcc = await prisma.account.create({
        data: {
          companyId: company.id,
          code: "1001",
          name: "Cash in Hand",
          type: "ASSET",
          groupId: "CURRENT_ASSET",
        },
      });
    }

    // 3. Generate guaranteed unique Voucher Number
    const count = await prisma.voucher.count({ where: { companyId: company.id } });
    const datePrefix = date.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const voucherNo = `EXP-${datePrefix}-${String(count + 1).padStart(4, "0")}-${randomSuffix}`;

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
          narration: `Expense: ${category || expenseAcc.name} - ${notes || ""} (Paid via ${paymentMode || "Cash"})`,
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
          category: category?.trim() || expenseAcc.name,
          amount: new Decimal(numAmount),
          paymentMode: paymentMode || "Cash",
          accountId: expenseAcc.id,
          paidFromId: paymentAcc.id,
          voucherId: voucher.id,
          notes: notes?.trim() || null,
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
    console.error("Expense creation error:", err);
    return NextResponse.json({ error: err.message || "Failed to record expense" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company selected" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {
        // body may be empty
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Expense ID is required" }, { status: 400 });
    }

    const expense = await prisma.expense.findFirst({
      where: { id, companyId: company.id },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.expense.delete({
        where: { id: expense.id },
      });

      if (expense.voucherId) {
        await tx.voucher.delete({
          where: { id: expense.voucherId },
        });
      }
    });

    return NextResponse.json({ success: true, message: "Expense deleted successfully" });
  } catch (err: any) {
    console.error("Expense deletion error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete expense" }, { status: 500 });
  }
}

