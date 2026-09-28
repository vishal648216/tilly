import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

    const body = await req.json();
    const { name, type, phone, email, gstin, address, city, state, pincode, openingBalance } = body;

    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const party = await prisma.party.create({
      data: {
        companyId: company.id,
        name,
        type: type || "CUSTOMER",
        phone: phone || null,
        email: email || null,
        gstin: gstin || null,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        openingBalance: openingBalance || 0,
      },
    });

    return NextResponse.json({ ok: true, party });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
