import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { getBatchExpiryReport, triggerExpiryNotifications } from "@/lib/batchSerial";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30", 10);

    const report = await getBatchExpiryReport(companyId, days);

    return NextResponse.json({
      ok: true,
      report,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const body = await req.json().catch(() => ({}));
    const days = parseInt(body.days || "30", 10);

    const report = await triggerExpiryNotifications(companyId, days);

    return NextResponse.json({
      ok: true,
      notified: true,
      report,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
