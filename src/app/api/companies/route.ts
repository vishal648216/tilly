import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { handleAuthError } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeCompany = await getCurrentCompany(req);
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    let companiesWithRoles: Array<{
      id: string;
      name: string;
      legalName: string | null;
      gstin: string | null;
      role: string;
      isActive: boolean;
    }> = [];

    if (isSuperAdmin) {
      const allCompanies = await prisma.company.findMany({
        orderBy: { name: "asc" },
      });
      companiesWithRoles = allCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        legalName: c.legalName,
        gstin: c.gstin,
        role: "SUPER_ADMIN",
        isActive: activeCompany?.id === c.id,
      }));
    } else {
      const memberships = await prisma.companyMember.findMany({
        where: { userId: user.id, isActive: true },
        include: { company: true },
        orderBy: { company: { name: "asc" } },
      });

      companiesWithRoles = memberships.map((m) => ({
        id: m.company.id,
        name: m.company.name,
        legalName: m.company.legalName,
        gstin: m.company.gstin,
        role: m.role,
        isActive: activeCompany?.id === m.company.id,
      }));
    }

    return NextResponse.json({
      companies: companiesWithRoles,
      activeCompanyId: activeCompany?.id || null,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
