import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getOutstandingReport } from "@/lib/outstanding";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.REPORT_VIEW, req);
    const companyId = context.company.id;

    const report = await getOutstandingReport(companyId);

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return handleAuthError(error);
  }
}
