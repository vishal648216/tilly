import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { executeProductionOrder } from "@/lib/manufacturing";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const body = await req.json();
    const result = await executeProductionOrder({
      companyId,
      productionOrderId: params.id,
      producedQty: Number(body.producedQty) || 1,
      wastageQty: Number(body.wastageQty) || 0,
      wastageReason: body.wastageReason,
      laborCostOverride: body.laborCostOverride !== undefined ? Number(body.laborCostOverride) : undefined,
      overheadCostOverride: body.overheadCostOverride !== undefined ? Number(body.overheadCostOverride) : undefined,
      userId: context.user.id,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
