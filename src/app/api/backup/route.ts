import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import {
  createDatabaseBackup,
  getBackupLogs,
  getAutoBackupConfig,
  saveAutoBackupConfig,
} from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const [logs, autoConfig] = await Promise.all([
      getBackupLogs(companyId, 30),
      getAutoBackupConfig(),
    ]);

    return NextResponse.json({
      ok: true,
      logs,
      autoConfig,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const body = await req.json().catch(() => ({}));
    const { action = "BACKUP_DB", notes, autoConfig } = body;

    if (action === "UPDATE_AUTO_CONFIG") {
      const updated = await saveAutoBackupConfig(autoConfig || {}, context.user.id);
      return NextResponse.json({ ok: true, autoConfig: updated });
    }

    // Default: Manual Database Backup
    const result = await createDatabaseBackup({
      initiatedBy: context.user.id,
      isAuto: false,
      notes,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
