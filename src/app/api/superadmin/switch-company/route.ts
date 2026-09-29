import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, logActivity } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { companyId, clear } = body;

    if (clear) {
      cookies().delete("taily_impersonate_company");
      return NextResponse.json({ success: true, message: "Exited impersonation mode" });
    }

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const targetCompany = await prisma.company.findUnique({ where: { id: companyId } });
    if (!targetCompany) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Set impersonation cookie for 24 hours
    cookies().set("taily_impersonate_company", companyId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    await logActivity({
      userId: user.id,
      userEmail: user.email,
      companyId: companyId,
      action: "IMPERSONATE_COMPANY",
      details: `Super Admin switched view to inspect company "${targetCompany.name}"`,
    });

    return NextResponse.json({ success: true, company: targetCompany });
  } catch (err: any) {
    console.error("Switch company error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
