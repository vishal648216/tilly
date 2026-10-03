import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/accounts";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { companyName, city, state, gstin, businessType } = body;

    if (!companyName) return NextResponse.json({ error: "Company name required" }, { status: 400 });

    // Check if user already has a company
    const existing = await prisma.companyMember.findFirst({ where: { userId: user.id } });
    if (existing) {
      return NextResponse.json({ error: "Company already exists" }, { status: 400 });
    }

    const { applyBusinessTemplate } = await import("@/lib/featureFlags");
    const bType = businessType || "Retail";

    const company = await prisma.$transaction(async (tx) => {
      const comp = await tx.company.create({
        data: {
          name: companyName,
          legalName: companyName,
          businessType: bType,
          city: city || null,
          state: state || null,
          gstin: gstin || null,
          currency: "INR",
          financialYear: `${new Date().getFullYear()}-${String((new Date().getFullYear() + 1) % 100).padStart(2, "0")}`,
        },
      });

      await tx.companyMember.create({
        data: { userId: user.id, companyId: comp.id, role: "COMPANY_ADMIN" },
      });

      await tx.account.createMany({
        data: DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({
          companyId: comp.id,
          code: a.code,
          name: a.name,
          type: a.type,
          groupId: a.groupId,
        })),
      });

      await applyBusinessTemplate(comp.id, bType, tx);

      return comp;
    });

    return NextResponse.json({ ok: true, company });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
