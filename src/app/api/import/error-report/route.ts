import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { generateErrorReportCsv, ImportErrorDetail } from "@/lib/importer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requireCompanyAccess(req);
    const body = await req.json();
    const { rows = [], errors = [] }: { rows: any[]; errors: ImportErrorDetail[] } = body;

    const csvContent = generateErrorReportCsv(rows, errors);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="import_errors_${Date.now()}.csv"`,
      },
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
