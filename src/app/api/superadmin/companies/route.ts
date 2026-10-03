import { NextResponse } from "next/server";
import { getCurrentUser, logActivity } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/accounts";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const companies = await prisma.company.findMany({
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, status: true, role: true } },
          },
        },
        invoices: {
          select: { id: true, grandTotal: true, status: true, type: true },
        },
        parties: { select: { id: true } },
        items: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = companies.map((c) => {
      const salesInvoices = c.invoices.filter((i) => i.type === "SALES");
      const totalTurnover = salesInvoices.reduce(
        (sum, i) => sum + parseFloat(i.grandTotal.toString() || "0"),
        0
      );
      return {
        id: c.id,
        name: c.name,
        legalName: c.legalName,
        email: c.email,
        phone: c.phone,
        city: c.city,
        state: c.state,
        address: c.address,
        gstin: c.gstin,
        pan: c.pan,
        createdAt: c.createdAt,
        membersCount: c.members.length,
        members: c.members.map((m) => ({
          role: m.role,
          user: m.user,
        })),
        totalInvoices: c.invoices.length,
        totalTurnover,
        partiesCount: c.parties.length,
        itemsCount: c.items.length,
      };
    });

    return NextResponse.json({ companies: enriched });
  } catch (err: any) {
    console.error("Super Admin companies GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { name, legalName, businessType, email, phone, city, state, gstin, pan, ownerName, ownerEmail, ownerPassword } = body;

    if (!name || !ownerEmail || !ownerPassword) {
      return NextResponse.json({ error: "Company name, Owner email, and Password are required" }, { status: 400 });
    }

    const cleanEmail = ownerEmail.trim().toLowerCase();
    let owner = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!owner) {
      const passwordHash = await bcrypt.hash(ownerPassword, 10);
      owner = await prisma.user.create({
        data: {
          name: ownerName?.trim() || "Business Owner",
          email: cleanEmail,
          passwordHash,
          phone: phone || null,
          role: "USER",
          status: "APPROVED",
        },
      });
    }

    const { applyBusinessTemplate } = await import("@/lib/featureFlags");
    const bType = businessType || "Retail";

    const company = await prisma.$transaction(async (tx) => {
      const comp = await tx.company.create({
        data: {
          name: name.trim(),
          legalName: legalName?.trim() || name.trim(),
          businessType: bType,
          email: email?.trim().toLowerCase() || cleanEmail,
          phone: phone?.trim() || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          gstin: gstin?.trim().toUpperCase() || null,
          pan: pan?.trim().toUpperCase() || null,
          currency: "INR",
          financialYear: `${new Date().getFullYear()}-${String((new Date().getFullYear() + 1) % 100).padStart(2, "0")}`,
        },
      });

      await tx.companyMember.create({
        data: { userId: owner!.id, companyId: comp.id, role: "COMPANY_ADMIN" },
      });

      // Seed chart of accounts
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

    await logActivity({
      userId: user.id,
      userEmail: user.email,
      companyId: company.id,
      action: "CREATE_COMPANY",
      details: `Super Admin created new business "${company.name}" (Owner: ${cleanEmail})`,
    });

    return NextResponse.json({ success: true, company });
  } catch (err: any) {
    console.error("Super Admin company creation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { companyId, name, legalName, email, phone, address, city, state, gstin, pan } = body;

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: name?.trim(),
        legalName: legalName?.trim(),
        email: email?.trim(),
        phone: phone?.trim(),
        address: address?.trim(),
        city: city?.trim(),
        state: state?.trim(),
        gstin: gstin?.trim().toUpperCase(),
        pan: pan?.trim().toUpperCase(),
      },
    });

    await logActivity({
      userId: user.id,
      userEmail: user.email,
      companyId: updated.id,
      action: "UPDATE_COMPANY",
      details: `Super Admin updated details for "${updated.name}"`,
    });

    return NextResponse.json({ success: true, company: updated });
  } catch (err: any) {
    console.error("Super Admin company update error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const targetCompany = await prisma.company.findUnique({ where: { id: companyId } });
    if (!targetCompany) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    await prisma.company.delete({ where: { id: companyId } });

    await logActivity({
      userId: user.id,
      userEmail: user.email,
      action: "DELETE_COMPANY",
      details: `Super Admin deleted company "${targetCompany.name}" and all linked records`,
    });

    return NextResponse.json({ success: true, message: `Company ${targetCompany.name} deleted successfully` });
  } catch (err: any) {
    console.error("Super Admin company deletion error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
