import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { convertQuotationToSalesOrder } from "@/lib/workflow";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_CREATE, req);
    const body = await req.json().catch(() => ({}));

    const salesOrder = await convertQuotationToSalesOrder(
      params.id,
      context.company.id,
      {
        expectedDelivery: body.expectedDelivery ? new Date(body.expectedDelivery) : undefined,
        warehouseId: body.warehouseId,
        createdBy: context.user.email || context.user.id,
      }
    );

    return NextResponse.json({ ok: true, salesOrder });
  } catch (error) {
    return handleAuthError(error);
  }
}
