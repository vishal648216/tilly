import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createDeliveryChallan } from "@/lib/workflow";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requirePermission(PERMISSIONS.SALES_CREATE, req);
    const body = await req.json();

    const deliveryChallan = await createDeliveryChallan({
      companyId: context.company.id,
      salesOrderId: params.id,
      partyId: body.partyId,
      warehouseId: body.warehouseId,
      date: body.date ? new Date(body.date) : new Date(),
      dcNo: body.dcNo,
      lines: body.lines || [],
      notes: body.notes,
      createdBy: context.user.email || context.user.id,
      dispatchNow: body.dispatchNow !== false,
    });

    return NextResponse.json({ ok: true, deliveryChallan });
  } catch (error) {
    return handleAuthError(error);
  }
}
