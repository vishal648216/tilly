import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getInvoiceCustomization,
  saveInvoiceCustomization,
  getTemplateDescriptors,
} from "@/lib/invoiceTemplate";
import { checkCompanyStatus, canUseCustomBranding } from "@/lib/subscriptionEnforcement";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/branding
 * Retrieve invoice customization and available template descriptors.
 */
export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SETTINGS_MANAGE, req);
    const companyId = context.company.id;

    const customization = await getInvoiceCustomization(companyId);
    const templates = getTemplateDescriptors();
    const brandingPerm = await canUseCustomBranding(companyId);

    return NextResponse.json({
      ok: true,
      customization,
      templates,
      customBrandingPermitted: brandingPerm.allowed,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

/**
 * POST /api/settings/branding
 * Update invoice customization, theme colors, template layout, and bank/UPI details.
 */
export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SETTINGS_MANAGE, req);
    const companyId = context.company.id;

    await checkCompanyStatus(companyId);

    const body = await req.json();

    const updated = await saveInvoiceCustomization(companyId, body);

    return NextResponse.json({
      ok: true,
      customization: updated,
      message: "Invoice branding settings saved successfully.",
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
