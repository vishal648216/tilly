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

    const updated = await prisma.company.update({
      where: { id: company.id },
      data: {
        name: name || company.name,
        legalName: legalName || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        gstin: gstin || null,
        pan: pan || null,
        upiId: upiId || null,
        bankName: bankName || null,
        accountNo: accountNo || null,
        ifscCode: ifscCode || null,
        branchName: branchName || null,
        terms: terms || null,
      },
    });

    return NextResponse.json({ success: true, company: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
