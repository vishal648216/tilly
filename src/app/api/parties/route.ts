import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isValidEmail, isValidPhone, isValidGstin, isValidPincode } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "Company profile not found" }, { status: 400 });

    const body = await req.json();
    const { name, type, phone, email, gstin, address, city, state, pincode, openingBalance } = body;

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Party name must be at least 2 characters long." }, { status: 400 });
    }

    if (phone && !isValidPhone(phone)) {
      return NextResponse.json({ error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (gstin && !isValidGstin(gstin)) {
      return NextResponse.json({ error: "Invalid GSTIN format (must be 15 alphanumeric characters, e.g. 27ABCDE1234F1Z5)." }, { status: 400 });
    }

    if (pincode && !isValidPincode(pincode)) {
      return NextResponse.json({ error: "PIN code must be exactly 6 digits." }, { status: 400 });
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
