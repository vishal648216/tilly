import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { checkCompanyStatus } from "@/lib/subscriptionEnforcement";
import {
  parseSpreadsheetBuffer,
  autoMapColumns,
  validateImportRows,
  ImportEntityType,
} from "@/lib/importer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;
    await checkCompanyStatus(companyId);

    const contentType = req.headers.get("content-type") || "";
    let entityType: ImportEntityType = "PRODUCTS";
    let rows: Array<Record<string, any>> = [];
    let customMapping: Record<string, string> | undefined = undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      entityType = ((formData.get("entityType") as string) || "PRODUCTS") as ImportEntityType;
      const mappingJson = formData.get("mapping") as string | null;
      if (mappingJson) {
        try {
          customMapping = JSON.parse(mappingJson);
        } catch {}
      }

      if (!file) {
        return NextResponse.json({ error: "No file provided for import." }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      rows = parseSpreadsheetBuffer(buffer, file.name);
    } else {
      const body = await req.json();
      entityType = (body.entityType || "PRODUCTS") as ImportEntityType;
      rows = body.rows || [];
      customMapping = body.mapping;
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "Spreadsheet contains no data rows to import." },
        { status: 400 }
      );
    }

    const rawHeaders = Object.keys(rows[0] || {});
    const columnMapping = customMapping || autoMapColumns(entityType, rawHeaders);

    const validation = await validateImportRows(companyId, entityType, rows, columnMapping);

    return NextResponse.json({
      ok: true,
      entityType,
      columnMapping,
      validation,
      headers: rawHeaders,
      totalRows: rows.length,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
