import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company selected" }, { status: 400 });

    const id = params.id;
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
