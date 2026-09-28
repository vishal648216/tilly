import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ExpenseClient from "./ExpenseClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

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
  const expenseAccounts = await prisma.account.findMany({
    where: { companyId: company.id, type: "EXPENSE" },
    select: { id: true, name: true, code: true, type: true },
    orderBy: { code: "asc" },
  });

  // Fetch asset/cash/bank accounts (type: ASSET)
  const paymentAccounts = await prisma.account.findMany({
    where: {
      companyId: company.id,
      type: "ASSET",
      code: { in: ["1001", "1002", "1003"] },
    },
    select: { id: true, name: true, code: true, type: true },
    orderBy: { code: "asc" },
  });

  // Fallback if specific accounts aren't found
  const allAssetAccounts =
    paymentAccounts.length > 0
      ? paymentAccounts
      : await prisma.account.findMany({
          where: { companyId: company.id, type: "ASSET" },
          select: { id: true, name: true, code: true, type: true },
          take: 5,
        });

  return (
    <ExpenseClient
      expenses={expenses.map((e) => ({
        ...e,
        expenseDate: e.expenseDate.toISOString(),
        amount: e.amount.toString(),
      }))}
      expenseAccounts={expenseAccounts}
      paymentAccounts={allAssetAccounts}
    />
  );
}
