import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/accounts";
import { isValidEmail, isValidPhone, isValidGstin } from "@/lib/validators";

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
        { error: "Please fill in all required fields (Name, Email, Password, Company Name)." },
        { status: 400 }
      );
    }

    // 2. Name validation
    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: "Full name must be at least 2 characters long." },
        { status: 400 }
      );
    }

    // 3. Email format regex check
    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address (e.g. name@company.com)." },
        { status: 400 }
      );
    }

    // 4. Password complexity check (min 8 chars, at least 1 number & 1 letter)
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return NextResponse.json(
        { error: "Password must contain at least one letter and one number." },
        { status: 400 }
      );
    }

    // 5. Company Name check
    if (trimmedCompany.length < 2) {
      return NextResponse.json(
        { error: "Business / Company name must be at least 2 characters long." },
        { status: 400 }
      );
    }

    // 6. GSTIN format check (if provided)
    if (cleanGstin && !isValidGstin(cleanGstin)) {
      return NextResponse.json(
        { error: "Invalid GSTIN format (must be 15 alphanumeric characters, e.g. 27ABCDE1234F1Z5)." },
        { status: 400 }
      );
    }

    // 7. Phone check (if provided)
    if (cleanPhone && !isValidPhone(cleanPhone)) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit mobile number." },
        { status: 400 }
      );
    }

    // 8. Check existing user
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json(
        { error: "This email address is already registered. Please log in or use a different email." },
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
          role: "USER",
          status: "PENDING",
        },
      });

      const { applyBusinessTemplate } = await import("@/lib/featureFlags");

      const company = await tx.company.create({
        data: {
          name: trimmedCompany,
          legalName: trimmedCompany,
          businessType: "Retail",
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
        data: { userId: user.id, companyId: company.id, role: "COMPANY_ADMIN" },
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

      await applyBusinessTemplate(company.id, "Retail", tx);

      return { user, company };
    });

    // Log Activity for Super Admin
    try {
      await prisma.activityLog.create({
        data: {
          userId: result.user.id,
          userEmail: result.user.email,
          companyId: result.company.id,
          action: "SIGNUP_REQUEST",
          details: `New registration requested by ${trimmedName} for business "${trimmedCompany}" (${cleanPhone || "No phone"})`,
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({
      ok: true,
      pendingApproval: true,
      message:
        "Your registration was successful! You will be able to log in once Super Admin approves your account.",
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: err.message || "Signup failed. Please try again." }, { status: 500 });
  }
}
