import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateOcrReview, confirmAndCreatePurchaseFromOcr } from "@/lib/ocrBill";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const scan = await prisma.ocrScanRecord.findFirst({
      where: { id: params.id, companyId },
    });

    if (!scan) {
      return NextResponse.json({ error: "OCR scan record not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      scan: {
        ...scan,
        extractedData: JSON.parse(scan.extractedData),
      },
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;
    const body = await req.json();

    const updated = await updateOcrReview(companyId, params.id, body.reviewedData);

    return NextResponse.json({
      ok: true,
      updated,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

/**
 * POST /api/ocr/review/[id]
 * Confirms user reviewed bill data and commits it to a formal Purchase Invoice.
 * Never directly posts unverified OCR results.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;
    const body = await req.json();

    const result = await confirmAndCreatePurchaseFromOcr(
      companyId,
      params.id,
      body.finalData,
      context.user.id
    );

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
