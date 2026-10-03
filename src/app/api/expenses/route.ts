import { NextResponse } from "next/server";
import { requirePermission, validateEntityBelongsToCompany, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";
import { checkCompanyStatus } from "@/lib/subscriptionEnforcement";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.EXPENSE_VIEW, req);

    const expenses = await prisma.expense.findMany({
      where: { companyId: context.company.id },
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

    return NextResponse.json({ ok: true, expenses });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.EXPENSE_CREATE, req);
    const companyId = context.company.id;

    // Phase 8: Block expense creation if company is SUSPENDED or EXPIRED
    await checkCompanyStatus(companyId);

    const body = await req.json();
    const { category, amount, paymentMode, accountId, paidFromId, expenseDate, notes } = body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Please enter a valid expense amount greater than 0." }, { status: 400 });
    }

    const date = expenseDate ? new Date(expenseDate) : new Date();

    // 1. Resolve Expense Account (IDOR verification if provided)
    let expenseAcc = null;
    if (accountId) {
      expenseAcc = await prisma.account.findFirst({
        where: { id: accountId, companyId },
      });
      if (!expenseAcc) {
        return NextResponse.json({ error: "Selected expense account does not belong to active company." }, { status: 400 });
      }
    }
    if (!expenseAcc) {
      expenseAcc = await prisma.account.findFirst({
        where: { companyId, type: "EXPENSE" },
      });
    }
    if (!expenseAcc) {
      expenseAcc = await prisma.account.create({
        data: {
          companyId,
          code: "5999",
          name: category?.trim() || "General Expenses",
          type: "EXPENSE",
          groupId: "INDIRECT_EXPENSE",
        },
      });
    }

    // 2. Resolve Payment Account (Cash / Bank, IDOR verification if provided)
    let paymentAcc = null;
    if (paidFromId) {
      paymentAcc = await prisma.account.findFirst({
        where: { id: paidFromId, companyId },
      });
      if (!paymentAcc) {
        return NextResponse.json({ error: "Selected payment account does not belong to active company." }, { status: 400 });
      }
    }
    if (!paymentAcc) {
      paymentAcc = await prisma.account.findFirst({
        where: {
          companyId,
          type: "ASSET",
          code: { in: ["1001", "1002", "1003"] },
        },
      });
    }
    if (!paymentAcc) {
      paymentAcc = await prisma.account.findFirst({
        where: { companyId, type: "ASSET" },
      });
    }
    if (!paymentAcc) {
      paymentAcc = await prisma.account.create({
        data: {
          companyId,
          code: "1001",
          name: "Cash in Hand",
          type: "ASSET",
          groupId: "CURRENT_ASSET",
        },
      });
    }

    // 3. Generate guaranteed unique Voucher Number
    const count = await prisma.voucher.count({ where: { companyId } });
    const datePrefix = date.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const voucherNo = `EXP-${datePrefix}-${String(count + 1).padStart(4, "0")}-${randomSuffix}`;

    const expenseRecord = await prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          companyId,
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
          companyId,
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

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "CREATE_EXPENSE",
      entity: "Expense",
      entityId: expenseRecord.id,
      afterValue: { amount: numAmount, category: expenseRecord.category },
      details: `Created expense of ₹${numAmount} for ${expenseRecord.category}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, success: true, expense: expenseRecord });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.EXPENSE_CREATE, req);
    const companyId = context.company.id;

    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: "Expense ID is required" }, { status: 400 });
    }

    // IDOR Check
    await validateEntityBelongsToCompany("expense", id, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const expense = await prisma.expense.findFirst({
      where: { id, companyId },
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

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "DELETE_EXPENSE",
      entity: "Expense",
      entityId: expense.id,
      details: `Deleted expense id ${expense.id}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, success: true, message: "Expense deleted successfully" });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
