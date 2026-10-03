import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { executeGlobalSearch } from "@/lib/search";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    const searchResponse = await executeGlobalSearch({
      companyId: context.company.id,
      query: q,
      limitPerCategory: 5,
    });

    return NextResponse.json({ ok: true, ...searchResponse });
  } catch (error) {
    return handleAuthError(error);
  }
}
