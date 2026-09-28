import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { makePayment, receivePayment } from "@/lib/payment";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

    const body = await req.json();
    const { invoiceId, amount, date, mode, reference, narration, direction } = body;

    if (!invoiceId || !amount || !date || !mode) {
      return NextResponse.json(
        { error: "invoiceId, amount, date, and mode are required" },
        { status: 400 }
      );
    }

    const result =
      direction === "MADE"
        ? await makePayment({
            invoiceId,
            amount: parseFloat(amount),
            date: new Date(date),
            mode,
            reference,
            narration,
          })
        : await receivePayment({
            invoiceId,
            amount: parseFloat(amount),
            date: new Date(date),
            mode,
            reference,
            narration,
          });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
