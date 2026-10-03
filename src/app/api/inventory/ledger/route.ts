import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getStockLedger } from "@/lib/inventory";

export const dynamic = "force-dynamic";

/**
 * GET /api/inventory/ledger
 * Query the stock ledger with running balance calculations.
 */
export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.STOCK_VIEW, req);
    const companyId = context.company.id;

    const url = new URL(req.url);
    const itemId = url.searchParams.get("itemId") || undefined;
    const warehouseId = url.searchParams.get("warehouseId") || undefined;
    const movementType = url.searchParams.get("movementType") || undefined;
    const referenceId = url.searchParams.get("referenceId") || undefined;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const ledger = await getStockLedger(companyId, {
      itemId,
      warehouseId,
      movementType,
      referenceId,
      startDate: from ? new Date(from) : undefined,
      endDate: to ? new Date(to + "T23:59:59.999Z") : undefined,
    });

    return NextResponse.json({ ok: true, ledger });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
