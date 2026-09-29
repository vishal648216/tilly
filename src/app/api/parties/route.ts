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

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Party name kam se kam 2 characters ka hona chahiye." }, { status: 400 });
    }

    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      if (cleanPhone.length !== 10) {
        return NextResponse.json({ error: "Mobile number 10 digits ka hona chahiye." }, { status: 400 });
      }
    }

    if (email) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email.trim().toLowerCase())) {
        return NextResponse.json({ error: "Valid email address daalein." }, { status: 400 });
      }
    }

    if (gstin) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin.trim().toUpperCase())) {
        return NextResponse.json({ error: "GSTIN format galat hai (15 characters: 27ABCDE1234F1Z5)." }, { status: 400 });
      }
    }

    if (pincode) {
      const cleanPin = pincode.replace(/[^0-9]/g, "");
      if (cleanPin.length !== 6) {
        return NextResponse.json({ error: "Pincode 6 digits ka hona chahiye." }, { status: 400 });
      }
    }

    const party = await prisma.party.create({
      data: {
        companyId: company.id,
        name: cleanName,
        type: type || "CUSTOMER",
        phone: phone ? phone.trim() : null,
        email: email ? email.trim().toLowerCase() : null,
        gstin: gstin ? gstin.trim().toUpperCase() : null,
        address: address ? address.trim() : null,
        city: city ? city.trim() : null,
        state: state ? state.trim() : null,
        pincode: pincode ? pincode.trim() : null,
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
      },
    });

    return NextResponse.json({ ok: true, party });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save party" }, { status: 500 });
  }
}
