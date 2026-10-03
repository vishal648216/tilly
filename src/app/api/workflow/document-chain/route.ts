import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getDocumentChain } from "@/lib/workflow";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_VIEW, req);
    const { searchParams } = new URL(req.url);
    const docType = searchParams.get("docType") as any;
    const docId = searchParams.get("docId");

    if (!docType || !docId) {
      return NextResponse.json(
        { ok: false, error: "Missing docType or docId parameter." },
        { status: 400 }
      );
    }

    const chain = await getDocumentChain(docType, docId, context.company.id);

    return NextResponse.json({ ok: true, chain });
  } catch (error) {
    return handleAuthError(error);
  }
}
