import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError, AuthError } from "@/lib/auth";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireCompanyAccess(req);
    const invoiceId = params.id;

    // Strict multi-tenant isolation filter
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: context.company.id,
      },
      include: {
        party: true,
        lines: true,
        voucher: {
          include: { entries: { include: { account: true } } },
        },
      },
    });

    if (!invoice) {
      const meta = getClientMetadata(req);
      await recordAuditLog({
        companyId: context.company.id,
        userId: context.user.id,
        userEmail: context.user.email,
        action: "IDOR_ATTEMPT_BLOCKED",
        entity: "Invoice",
        entityId: invoiceId,
        details: `Unauthorized attempt to access invoice ${invoiceId} not belonging to active company.`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return NextResponse.json(
        { error: "Invoice not found or does not belong to your company.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const requiredPerm =
      invoice.type === "PURCHASE" ? PERMISSIONS.PURCHASE_VIEW : PERMISSIONS.SALES_VIEW;

    if (!hasPermission(context.role, requiredPerm, context.membership.customPermissions)) {
      throw new AuthError(`Missing required permission: ${requiredPerm}`, 403, "FORBIDDEN");
    }

    return NextResponse.json({ ok: true, invoice });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireCompanyAccess(req);
    const invoiceId = params.id;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: context.company.id,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found or does not belong to your company.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const requiredPerm =
      invoice.type === "PURCHASE" ? PERMISSIONS.PURCHASE_CANCEL : PERMISSIONS.SALES_CANCEL;

    if (!hasPermission(context.role, requiredPerm, context.membership.customPermissions)) {
      throw new AuthError(`Missing required permission: ${requiredPerm}`, 403, "FORBIDDEN");
    }

    // Production-Grade Financial Integrity:
    // DRAFT invoices may be deleted. POSTED/PAID invoices MUST NOT be deleted.
    // Instead, they are cancelled with stock reversal and accounting reversal.
    const { searchParams } = new URL(req.url);
    const reason = searchParams.get("reason") || "Cancelled by user";

    if (invoice.status === "DRAFT") {
      await prisma.invoice.delete({
        where: { id: invoice.id },
      });

      const meta = getClientMetadata(req);
      await recordAuditLog({
        companyId: context.company.id,
        userId: context.user.id,
        userEmail: context.user.email,
        action: "DELETE_DRAFT_INVOICE",
        entity: "Invoice",
        entityId: invoice.id,
        beforeValue: { invoiceNo: invoice.invoiceNo, grandTotal: invoice.grandTotal },
        details: `Deleted draft invoice ${invoice.invoiceNo}`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return NextResponse.json({ ok: true, message: `Draft invoice ${invoice.invoiceNo} deleted.` });
    }

    const { cancelInvoice } = await import("@/lib/invoice");
    const cancelled = await cancelInvoice({
      invoiceId: invoice.id,
      companyId: context.company.id,
      reason,
      userId: context.user.id,
      userEmail: context.user.email,
    });

    return NextResponse.json({
      ok: true,
      message: `Invoice ${invoice.invoiceNo} cancelled and reversed successfully.`,
      invoice: cancelled,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
