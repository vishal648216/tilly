import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { checkCompanyStatus } from "@/lib/subscriptionEnforcement";
import { executeImport, ImportEntityType } from "@/lib/importer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;
    await checkCompanyStatus(companyId);

    const body = await req.json();
    const {
      entityType = "PRODUCTS",
      rows = [],
      mapping = {},
      requireAllValid = true,
      fileName = "import_data.csv",
    } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No rows provided for import." },
        { status: 400 }
      );
    }

    const result = await executeImport(
      companyId,
      entityType as ImportEntityType,
      rows,
      mapping,
      requireAllValid
    );

    // Save ImportJob record
    await prisma.importJob.create({
      data: {
        companyId,
        entityType,
        fileName,
        totalRows: result.totalRows,
        validRows: result.importedCount,
        invalidRows: result.failedCount,
        status: result.success ? "IMPORTED" : "FAILED",
        errorsJson: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
        createdBy: context.user.id,
      },
    });

    return NextResponse.json({
      ok: result.success,
      result,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
