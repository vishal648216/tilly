import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/accounts";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, companyName, city, state, gstin } = body;

    if (!name || !email || !password || !companyName) {
      return NextResponse.json({ error: "Name, email, password, and company name are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Check existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered. Please login." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user + company + membership + chart of accounts atomically
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name, passwordHash },
      });

      const company = await tx.company.create({
        data: {
          name: companyName,
          legalName: companyName,
          city: city || null,
          state: state || null,
          gstin: gstin || null,
          currency: "INR",
          financialYear: `${new Date().getFullYear()}-${String((new Date().getFullYear() + 1) % 100).padStart(2, "0")}`,
        },
      });

      await tx.companyMember.create({
        data: { userId: user.id, companyId: company.id, role: "ADMIN" },
      });

      // Seed default chart of accounts
      await tx.account.createMany({
        data: DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({
          companyId: company.id,
          code: a.code,
          name: a.name,
          type: a.type,
          groupId: a.groupId,
        })),
      });

      return { user, company };
    });

    await createSession(result.user.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Signup failed" }, { status: 500 });
  }
}
