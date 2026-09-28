import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { createInvoice } from "@/lib/invoice";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

    const body = await req.json();
    const { type, partyId, date, dueDate, lines, notes, isInterState } = body;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "At least one line item required" }, { status: 400 });
    }

    const invoice = await createInvoice({
      companyId: company.id,
      type: type || "SALES",
      partyId: partyId || undefined,
      date: new Date(date),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      lines,
      notes,
      isInterState: !!isInterState,
    });

    return NextResponse.json({ ok: true, invoice });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
