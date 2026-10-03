import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { restoreDatabaseBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);

    // Only company admins or super admins can restore database
    if (context.role !== "COMPANY_ADMIN" && context.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can perform database restore.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { backupFilePath } = body;

    if (!backupFilePath) {
      return NextResponse.json(
        { error: "backupFilePath is required for database restore." },
        { status: 400 }
      );
    }

    const result = await restoreDatabaseBackup(backupFilePath, context.user.id);

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
