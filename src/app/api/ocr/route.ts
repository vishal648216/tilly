import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { checkCompanyStatus, canUseOCR, recordUsage } from "@/lib/subscriptionEnforcement";

export const dynamic = "force-dynamic";

/**
 * POST /api/ocr
 * Bill & Receipt OCR Scanning API.
 * Dual-gated: Plan must permit OCR AND Company setting must have OCR enabled.
 * Also enforces monthly OCR scan limits.
 */
export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    // Check company status & dual-gated OCR entitlement
    await checkCompanyStatus(companyId);
    const ocrPerm = await canUseOCR(companyId);
    if (!ocrPerm.allowed) {
      return NextResponse.json(
        { error: ocrPerm.reason || "OCR is not enabled or quota exceeded for your plan.", code: "OCR_RESTRICTED" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { rawText, fileType } = body;

    // Increment OCR scan usage count
    await recordUsage(companyId, "OCR_SCANS", 1);

    // Mock/Simulated OCR extraction response
    return NextResponse.json({
      ok: true,
      extracted: {
        vendorName: "Acme Supplies Ltd",
        invoiceNo: `OCR-${Date.now().toString().slice(-6)}`,
        invoiceDate: new Date().toISOString().slice(0, 10),
        taxableAmount: 12500,
        taxAmount: 2250,
        grandTotal: 14750,
        items: [
          { name: "Item A - Bulk Packaging", qty: 50, rate: 150, gstRate: 18 },
          { name: "Item B - Logistics Seal", qty: 100, rate: 50, gstRate: 18 },
        ],
      },
      usage: {
        current: (ocrPerm.current || 0) + 1,
        max: ocrPerm.max,
      },
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
