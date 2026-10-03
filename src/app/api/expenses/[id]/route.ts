import { NextResponse } from "next/server";
import { requirePermission, validateEntityBelongsToCompany, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.EXPENSE_CREATE, req);
    const companyId = context.company.id;
    const id = params.id;

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
