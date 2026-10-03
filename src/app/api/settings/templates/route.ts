import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { BUSINESS_TEMPLATES, BusinessType } from "@/lib/businessTemplates";
import { applyBusinessTemplate } from "@/lib/featureFlags";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    return NextResponse.json({
      ok: true,
      templates: Object.values(BUSINESS_TEMPLATES),
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SETTINGS_MANAGE, req);
    const body = await req.json();
    const { templateType } = body;

    if (!templateType || !BUSINESS_TEMPLATES[templateType as BusinessType]) {
      return NextResponse.json(
        { error: `Invalid template type '${templateType}'. Must be one of: ${Object.keys(BUSINESS_TEMPLATES).join(", ")}` },
        { status: 400 }
      );
    }

    const result = await applyBusinessTemplate(context.company.id, templateType as BusinessType);

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId: context.company.id,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "APPLY_BUSINESS_TEMPLATE",
      entity: "Company",
      entityId: context.company.id,
      details: `Applied business template '${templateType}' to company`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully configured for ${result.template.name}`,
      ...result,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
