import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

    const body = await req.json();
    const { type, date, narration, entries } = body;

    if (!entries || !Array.isArray(entries) || entries.length < 2) {
      return NextResponse.json({ error: "At least 2 entries required" }, { status: 400 });
    }

    // Validate balance
    let totalDr = 0, totalCr = 0;
    for (const e of entries) {
      totalDr += e.debit || 0;
      totalCr += e.credit || 0;
    }
    if (Math.abs(totalDr - totalCr) > 0.01) {
      return NextResponse.json(
        { error: `Voucher not balanced! Dr=${totalDr} Cr=${totalCr}` },
        { status: 400 }
      );
    }

    // Validate account IDs
    const accountIds = entries.map((e: any) => e.accountId);
    const existing = await prisma.account.findMany({
      where: { id: { in: accountIds }, companyId: company.id },
    });
    if (existing.length !== new Set(accountIds).size) {
      return NextResponse.json({ error: "Invalid account ID(s)" }, { status: 400 });
    }

    // Generate voucher number
    const last = await prisma.voucher.findFirst({
      where: { companyId: company.id },
      orderBy: { voucherNo: "desc" },
    });
    const seq = last ? parseInt(last.voucherNo.replace(/\D/g, "")) + 1 : 1;
    const voucherNo = `V-${String(seq).padStart(6, "0")}`;

    const voucher = await prisma.voucher.create({
      data: {
        companyId: company.id,
        voucherNo,
        type: type || "JOURNAL",
        date: new Date(date),
        narration,
        entries: {
          create: entries.map((e: any) => ({
            accountId: e.accountId,
            debit: new Decimal(e.debit || 0),
            credit: new Decimal(e.credit || 0),
          })),
        },
      },
      include: { entries: { include: { account: true } } },
    });

    return NextResponse.json({ ok: true, voucher });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
