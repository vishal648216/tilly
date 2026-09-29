import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/accounts";
import ExpenseClient from "./ExpenseClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  // Ensure default chart of accounts exists if empty
  const accountCount = await prisma.account.count({ where: { companyId: company.id } });
  if (accountCount === 0) {
    await prisma.account.createMany({
      data: DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({
        companyId: company.id,
        code: a.code,
        name: a.name,
        type: a.type,
        groupId: a.groupId,
      })),
    });
  }

  // Fetch all expenses with related account and voucher
  const expenses = await prisma.expense.findMany({
    where: { companyId: company.id },
    include: {
      account: { select: { id: true, name: true, code: true, type: true } },
      voucher: { select: { id: true, voucherNo: true } },
    },
    orderBy: { expenseDate: "desc" },
  });

  // Fetch expense accounts (type: EXPENSE)
  let expenseAccounts = await prisma.account.findMany({
    where: { companyId: company.id, type: "EXPENSE" },
    select: { id: true, name: true, code: true, type: true },
    orderBy: { code: "asc" },
  });

  if (expenseAccounts.length === 0) {
    const defaultExp = await prisma.account.create({
      data: {
        companyId: company.id,
        code: "5900",
        name: "General Expenses",
        type: "EXPENSE",
        groupId: "INDIRECT_EXPENSE",
      },
    });
    expenseAccounts = [defaultExp];
  }

  // Fetch asset/cash/bank accounts (type: ASSET)
  let paymentAccounts = await prisma.account.findMany({
    where: {
      companyId: company.id,
      type: "ASSET",
      code: { in: ["1001", "1002", "1003"] },
    },
    select: { id: true, name: true, code: true, type: true },
    orderBy: { code: "asc" },
  });

  if (paymentAccounts.length === 0) {
    paymentAccounts = await prisma.account.findMany({
      where: { companyId: company.id, type: "ASSET" },
      select: { id: true, name: true, code: true, type: true },
    });
  }

  if (paymentAccounts.length === 0) {
    const defaultCash = await prisma.account.create({
      data: {
        companyId: company.id,
        code: "1001",
        name: "Cash in Hand",
        type: "ASSET",
        groupId: "CURRENT_ASSET",
      },
    });
    paymentAccounts = [defaultCash];
  }

  return (
    <ExpenseClient
      expenses={expenses.map((e) => ({
        ...e,
        expenseDate: e.expenseDate.toISOString(),
        amount: e.amount.toString(),
      }))}
      expenseAccounts={expenseAccounts}
      paymentAccounts={paymentAccounts}
    />
  );
}
