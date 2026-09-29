import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/accounts";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, companyName, city, state, gstin, phone } = body;

    const trimmedName = name?.trim();
    const cleanEmail = email?.trim().toLowerCase();
    const trimmedCompany = companyName?.trim();
    const cleanGstin = gstin?.trim().toUpperCase();
    const cleanPhone = phone?.trim();

    // 1. Required fields check
    if (!trimmedName || !cleanEmail || !password || !trimmedCompany) {
      return NextResponse.json(
        { error: "Kripya sabhi zaroori fields (Name, Email, Password, Company Name) bharein." },
        { status: 400 }
      );
    }

    // 2. Name validation
    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: "Naam kam se kam 2 characters ka hona chahiye." },
        { status: 400 }
      );
    }

    // 3. Email format regex check
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { error: "Kripya sahi email address enter karein (jaise: yourname@example.com)." },
        { status: 400 }
      );
    }

    // 4. Password complexity check (min 8 chars, at least 1 number & 1 letter)
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password kam se kam 8 characters ka hona chahiye." },
        { status: 400 }
      );
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return NextResponse.json(
        { error: "Password me kam se kam ek letter (A-Z ya a-z) aur ek number (0-9) hona zaroori hai." },
        { status: 400 }
      );
    }

    // 5. Company Name check
    if (trimmedCompany.length < 2) {
      return NextResponse.json(
        { error: "Company / Dukan ka naam kam se kam 2 characters ka hona chahiye." },
        { status: 400 }
      );
    }

    // 6. GSTIN format check (if provided)
    if (cleanGstin) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(cleanGstin)) {
        return NextResponse.json(
          { error: "GSTIN ka format galat hai. Udaharan: 27ABCDE1234F1Z5 (15 characters)." },
          { status: 400 }
        );
      }
    }

    // 7. Phone check (if provided)
    if (cleanPhone) {
      const phoneDigits = cleanPhone.replace(/[^0-9]/g, "");
      if (phoneDigits.length < 10) {
        return NextResponse.json(
          { error: "Phone number kam se kam 10 digits ka hona chahiye." },
          { status: 400 }
        );
      }
    }

    // 8. Check existing user
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json(
        { error: "Yeh email pehle se registered hai. Kripya Login karein ya dusra email use karein." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user + company + membership + chart of accounts atomically
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: cleanEmail,
          name: trimmedName,
          passwordHash,
          phone: cleanPhone || null,
        },
      });

      const company = await tx.company.create({
        data: {
          name: trimmedCompany,
          legalName: trimmedCompany,
          email: cleanEmail,
          phone: cleanPhone || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          gstin: cleanGstin || null,
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
    console.error("Signup error:", err);
    return NextResponse.json({ error: err.message || "Signup failed. Kripya dobara try karein." }, { status: 500 });
  }
}
