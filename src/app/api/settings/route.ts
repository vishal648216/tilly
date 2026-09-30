import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  isValidEmail,
  isValidPhone,
  isValidGstin,
  isValidPan,
  isValidIfsc,
  isValidUpi,
} from "@/lib/validators";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 400 });

    return NextResponse.json({ company });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 400 });

    const body = await req.json();
    const {
      name,
      legalName,
      email,
      phone,
      address,
      city,
      state,
      pincode,
      gstin,
      pan,
      upiId,
      bankName,
      accountNo,
      ifscCode,
      branchName,
      terms,
    } = body;

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Company name must be at least 2 characters long." }, { status: 400 });
    }

    if (phone && !isValidPhone(phone)) {
      return NextResponse.json({ error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (gstin && !isValidGstin(gstin)) {
      return NextResponse.json({ error: "Invalid GSTIN format (must be 15 alphanumeric characters, e.g. 24ABCDE1234F1Z5)." }, { status: 400 });
    }

    if (pan && !isValidPan(pan)) {
      return NextResponse.json({ error: "Invalid PAN format (must be 10 characters: ABCDE1234F)." }, { status: 400 });
    }

    if (ifscCode && !isValidIfsc(ifscCode)) {
      return NextResponse.json({ error: "Invalid Bank IFSC code (11 characters: e.g. SBIN0001234)." }, { status: 400 });
    }

    if (upiId && !isValidUpi(upiId)) {
      return NextResponse.json({ error: "Please enter a valid UPI ID (e.g. 9876543210@paytm or name@okhdfcbank)." }, { status: 400 });
    }

    const updated = await prisma.company.update({
      where: { id: company.id },
      data: {
        name: cleanName,
        legalName: legalName ? legalName.trim() : null,
        email: email ? email.trim().toLowerCase() : null,
        phone: phone ? phone.trim() : null,
        address: address ? address.trim() : null,
        city: city ? city.trim() : null,
        state: state ? state.trim() : null,
        pincode: pincode ? pincode.trim() : null,
        gstin: gstin ? gstin.trim().toUpperCase() : null,
        pan: pan ? pan.trim().toUpperCase() : null,
        upiId: upiId ? upiId.trim() : null,
        bankName: bankName ? bankName.trim() : null,
        accountNo: accountNo ? accountNo.trim() : null,
        ifscCode: ifscCode ? ifscCode.trim().toUpperCase() : null,
        branchName: branchName ? branchName.trim() : null,
        terms: terms || null,
      },
    });

    return NextResponse.json({ success: true, company: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update settings" }, { status: 500 });
  }
}
