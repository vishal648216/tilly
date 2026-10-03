import { NextResponse } from "next/server";
import { getCurrentUser, setActiveCompany } from "@/lib/session";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";
import { handleAuthError } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { companyId } = body;

    if (!companyId || typeof companyId !== "string") {
      return NextResponse.json(
        { error: "companyId string is required." },
        { status: 400 }
      );
    }

    await setActiveCompany(companyId, req);

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: user.id,
      userEmail: user.email,
      action: "SWITCH_COMPANY",
      details: `Switched active company context to ${companyId}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      ok: true,
      activeCompanyId: companyId,
      message: "Active company context switched successfully.",
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
