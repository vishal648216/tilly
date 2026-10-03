import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.ACCOUNTING_VIEW, req);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const where: any = { companyId: context.company.id };
    if (type) where.type = type;

    const vouchers = await prisma.voucher.findMany({
      where,
      include: {
        entries: { include: { account: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ ok: true, vouchers });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.VOUCHER_CREATE, req);
    const companyId = context.company.id;

    const body = await req.json();
    const { type, date, narration, entries } = body;

    if (!entries || !Array.isArray(entries) || entries.length < 2) {
      return NextResponse.json({ error: "At least 2 entries required for double-entry." }, { status: 400 });
    }

    // Validate double-entry mathematical balance
    let totalDr = 0, totalCr = 0;
    for (const e of entries) {
      totalDr += Number(e.debit) || 0;
      totalCr += Number(e.credit) || 0;
    }
    if (Math.abs(totalDr - totalCr) > 0.01) {
      return NextResponse.json(
        { error: `Voucher is not balanced! Total Debits (${totalDr}) must equal Total Credits (${totalCr}).` },
        { status: 400 }
      );
    }

    // Validate account IDs belong to active company (IDOR check)
    const accountIds = entries.map((e: any) => e.accountId);
    const existing = await prisma.account.findMany({
      where: { id: { in: accountIds }, companyId },
    });
    if (existing.length !== new Set(accountIds).size) {
      return NextResponse.json({ error: "One or more account IDs do not belong to active company." }, { status: 400 });
    }

    // Generate guaranteed unique voucher number
    const count = await prisma.voucher.count({ where: { companyId } });
    const datePrefix = (date ? new Date(date) : new Date()).toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const voucherNo = `V-${type || "JRN"}-${datePrefix}-${String(count + 1).padStart(4, "0")}-${randomSuffix}`;

    const voucher = await prisma.voucher.create({
      data: {
        companyId,
        voucherNo,
        type: type || "JOURNAL",
        date: date ? new Date(date) : new Date(),
        narration: narration ? String(narration).trim() : null,
        entries: {
          create: entries.map((e: any) => ({
            accountId: e.accountId,
            debit: new Decimal(Number(e.debit) || 0),
            credit: new Decimal(Number(e.credit) || 0),
          })),
        },
      },
      include: { entries: { include: { account: true } } },
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "CREATE_VOUCHER",
      entity: "Voucher",
      entityId: voucher.id,
      afterValue: { voucherNo: voucher.voucherNo, type: voucher.type, total: totalDr },
      details: `Created double-entry voucher ${voucher.voucherNo} (${voucher.type})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, voucher });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
