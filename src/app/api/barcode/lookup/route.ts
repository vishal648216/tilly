import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { lookupProductByBarcode } from "@/lib/barcode";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code") || searchParams.get("barcode") || "";

    if (!code) {
      return NextResponse.json({ error: "Barcode query parameter 'code' is required." }, { status: 400 });
    }

    const result = await lookupProductByBarcode(companyId, code);

    return NextResponse.json({
      ok: true,
      ...result,
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
    const code = body.code || body.barcode || "";

    if (!code) {
      return NextResponse.json({ error: "Barcode 'code' is required in request body." }, { status: 400 });
    }

    const result = await lookupProductByBarcode(companyId, code);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
