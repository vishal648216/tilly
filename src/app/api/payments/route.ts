import { NextResponse } from "next/server";
import { requirePermission, validateEntityBelongsToCompany, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { recordPayment } from "@/lib/paymentAllocation";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";
import { checkCompanyStatus } from "@/lib/subscriptionEnforcement";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PAYMENT_VIEW, req);
    const companyId = context.company.id;

    // Fetch official Payment entities with allocations & parties
    const payments = await prisma.payment.findMany({
      where: { companyId },
      include: {
        party: true,
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNo: true,
                type: true,
                grandTotal: true,
                paidAmount: true,
                status: true,
              },
            },
          },
        },
        voucher: {
          include: {
            entries: { include: { account: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // Also fetch raw payment vouchers for backwards compatibility
    const paymentVouchers = await prisma.voucher.findMany({
      where: {
        companyId,
        type: { in: ["PAYMENT", "RECEIPT"] },
      },
      include: {
        entries: { include: { account: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ ok: true, payments, vouchers: paymentVouchers });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PAYMENT_CREATE, req);
    const companyId = context.company.id;

    // Phase 8: Block payments if company is SUSPENDED or EXPIRED
    await checkCompanyStatus(companyId);

    const body = await req.json();
    const {
      partyId,
      invoiceId,
      amount,
      date,
      mode,
      reference,
      chequeNo,
      chequeDate,
      notes,
      narration,
      type,
      direction,
      allocations,
      accountId,
    } = body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
    }

    if (!mode) {
      return NextResponse.json({ error: "Payment mode (CASH, BANK, UPI, CHEQUE, etc.) is required." }, { status: 400 });
    }

    const paymentDate = date ? new Date(date) : new Date();

    // 1. Resolve Allocations and Payment Type
    let targetType: "RECEIPT" | "PAYMENT" | "ADVANCE" | "REFUND" = "RECEIPT";
    let targetPartyId = partyId;
    let paymentAllocations: Array<{ invoiceId: string; amount: number }> = [];

    if (allocations && Array.isArray(allocations) && allocations.length > 0) {
      paymentAllocations = allocations.map((a: any) => ({
        invoiceId: a.invoiceId,
        amount: Number(a.amount),
      }));

      if (type) {
        targetType = type;
      } else if (direction === "MADE") {
        targetType = "PAYMENT";
      } else {
        targetType = "RECEIPT";
      }
    } else if (invoiceId) {
      // Legacy single invoice payment
      await validateEntityBelongsToCompany("invoice", invoiceId, companyId, req, {
        userId: context.user.id,
        userEmail: context.user.email,
      });

      const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

      if (!targetPartyId && inv.partyId) targetPartyId = inv.partyId;
      targetType = inv.type === "PURCHASE" || direction === "MADE" ? "PAYMENT" : "RECEIPT";
      paymentAllocations = [{ invoiceId, amount: numAmount }];
    } else {
      // Unallocated Advance Payment / Receipt
      if (!partyId) {
        return NextResponse.json(
          { error: "Either partyId or invoiceId is required for recording a payment." },
          { status: 400 }
        );
      }
      targetType = type || (direction === "MADE" ? "PAYMENT" : "RECEIPT");
    }

    if (targetPartyId) {
      await validateEntityBelongsToCompany("party", targetPartyId, companyId, req, {
        userId: context.user.id,
        userEmail: context.user.email,
      });
    }

    // 2. Call authoritative Payment & Allocation Engine
    const result = await recordPayment({
      companyId,
      partyId: targetPartyId || undefined,
      type: targetType,
      amount: numAmount,
      date: paymentDate,
      mode: (mode.toUpperCase() as any) || "CASH",
      accountId: accountId || undefined,
      reference: reference ? String(reference).trim() : undefined,
      chequeNo: chequeNo ? String(chequeNo).trim() : undefined,
      chequeDate: chequeDate && !isNaN(new Date(chequeDate).getTime()) ? new Date(chequeDate) : undefined,
      notes: notes || narration || undefined,
      allocations: paymentAllocations,
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "CREATE_PAYMENT",
      entity: "Payment",
      entityId: result.payment.id,
      afterValue: {
        paymentNo: result.payment.paymentNo,
        amount: numAmount,
        mode,
        type: targetType,
      },
      details: `Created payment ${result.payment.paymentNo} of ₹${numAmount} (${mode})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
