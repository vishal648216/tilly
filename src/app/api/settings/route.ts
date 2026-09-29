import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

    return NextResponse.json({ company });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

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
      return NextResponse.json({ error: "Company name kam se kam 2 characters ka hona chahiye." }, { status: 400 });
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
        return NextResponse.json({ error: "GSTIN format galat hai (15 characters: 24ABCDE1234F1Z5)." }, { status: 400 });
      }
    }

    if (pan) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(pan.trim().toUpperCase())) {
        return NextResponse.json({ error: "PAN format galat hai (10 characters: ABCDE1234F)." }, { status: 400 });
      }
    }

    if (ifscCode) {
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(ifscCode.trim().toUpperCase())) {
        return NextResponse.json({ error: "Bank IFSC code galat hai (11 characters: SBIN0001234)." }, { status: 400 });
      }
    }

    if (upiId) {
      const upiRegex = /^[\w.-]+@[\w.-]+$/;
      if (!upiRegex.test(upiId.trim())) {
        return NextResponse.json({ error: "Valid UPI VPA format daalein (jaise: 9876543210@paytm ya name@okhdfcbank)." }, { status: 400 });
      }
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
