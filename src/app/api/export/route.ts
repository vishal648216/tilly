import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { exportTenantData } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const data = await exportTenantData(companyId, context.user.id);

    const jsonString = JSON.stringify(data, null, 2);
    const safeName = context.company.name.replace(/[^a-zA-Z0-9]/g, "_");

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}_export_${Date.now()}.json"`,
      },
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const data = await exportTenantData(companyId, context.user.id);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
