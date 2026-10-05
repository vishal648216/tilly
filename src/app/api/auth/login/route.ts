import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";
import { checkRateLimit, recordRateLimitFailure, resetRateLimit } from "@/lib/rateLimit";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const meta = getClientMetadata(req);

    // Check rate limit by Email and by IP
    const emailKey = `login:email:${cleanEmail}`;
    const ipKey = `login:ip:${meta.ipAddress || "unknown"}`;

    const [emailLimit, ipLimit] = await Promise.all([
      checkRateLimit(emailKey, MAX_ATTEMPTS, LOCKOUT_MS),
      checkRateLimit(ipKey, 20, LOCKOUT_MS), // 20 attempts max per IP
    ]);

    if (!emailLimit.allowed || !ipLimit.allowed) {
      const waitSeconds = Math.max(emailLimit.retryAfterSeconds, ipLimit.retryAfterSeconds);
      const remainingMin = Math.ceil(waitSeconds / 60);
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Please try again in ${remainingMin} minute(s).`,
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }

    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    
    // Strict Dev-Only Auto-Seed Condition with Fresh Production Database Bootstrap
    const isDevEnvironment = process.env.NODE_ENV !== "production";
    const userCount = await prisma.user.count();
    const isDatabaseEmpty = userCount === 0;
    const isAutoSeedEnabled = (isDevEnvironment && process.env.ALLOW_DEV_AUTO_SEED !== "false") || isDatabaseEmpty;

    if (isAutoSeedEnabled) {
      // Development shortcut: Auto-seed Super Admin if logging in on a fresh database
      if (!user && cleanEmail === "admin@admin.com" && password === "admin@1234") {
        const passwordHash = await bcrypt.hash("admin@1234", 10);
        user = await prisma.user.create({
          data: {
            email: "admin@admin.com",
            name: "Super Administrator",
            passwordHash,
            phone: "9876543210",
            role: "SUPER_ADMIN",
            status: "APPROVED",
          },
        });
      }

      // Development shortcut: Auto-seed demo store if logging in with demo credentials on a fresh database
      if (!user && cleanEmail === "demo@taily.in" && password === "demo1234") {
        const passwordHash = await bcrypt.hash("demo1234", 10);
        user = await prisma.user.create({
          data: {
            email: "demo@taily.in",
            name: "Demo User",
            passwordHash,
            phone: "9999999999",
            role: "USER",
            status: "APPROVED",
          },
        });

        const company = await prisma.company.upsert({
          where: { id: "demo-company-1" },
          update: {},
          create: {
            id: "demo-company-1",
            name: "Taily Demo Store",
            legalName: "Taily Demo Store Pvt Ltd",
            email: "store@taily.in",
            phone: "9876543210",
            address: "123 Market Road",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
            gstin: "27ABCDE1234F1Z5",
            pan: "ABCDE1234F",
            currency: "INR",
            financialYear: "2026-27",
          },
        });

        await prisma.companyMember.upsert({
          where: { userId_companyId: { userId: user.id, companyId: company.id } },
          update: {},
          create: { userId: user.id, companyId: company.id, role: "COMPANY_ADMIN", isActive: true },
        });

        const { DEFAULT_CHART_OF_ACCOUNTS } = await import("@/lib/accounts");
        for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
          await prisma.account.upsert({
            where: { companyId_code: { companyId: company.id, code: acc.code } },
            update: {},
            create: {
              companyId: company.id,
              code: acc.code,
              name: acc.name,
              type: acc.type,
              groupId: acc.groupId,
            },
          });
        }

        await prisma.party.createMany({
          data: [
            { companyId: company.id, name: "Ramesh Traders", type: "CUSTOMER", phone: "9123456789", city: "Pune", state: "Maharashtra", gstin: "27AAACR1234L1Z2" },
            { companyId: company.id, name: "Wholesale Mart", type: "CUSTOMER", phone: "9876501234", city: "Mumbai", state: "Maharashtra" },
            { companyId: company.id, name: "Sharma Suppliers", type: "VENDOR", phone: "9000011222", city: "Nashik", state: "Maharashtra", gstin: "27AAACS5678P1Z3" },
          ],
        });

        await prisma.item.createMany({
          data: [
            { companyId: company.id, name: "Notebook (200 pg)", sku: "NB200", hsn: "4820", unit: "PCS", salePrice: 80, purchasePrice: 55, gstRate: 12, stock: 500, minStock: 50 },
            { companyId: company.id, name: "Ball Pen (Blue)", sku: "BP-BLUE", hsn: "9608", unit: "PCS", salePrice: 10, purchasePrice: 6, gstRate: 18, stock: 1000, minStock: 100 },
            { companyId: company.id, name: "A4 Paper Ream", sku: "A4-500", hsn: "4802", unit: "PCS", salePrice: 250, purchasePrice: 200, gstRate: 18, stock: 100, minStock: 20 },
          ],
        });
      }
    }

    if (!user) {
      await Promise.all([
        recordRateLimitFailure(emailKey, { ipAddress: meta.ipAddress, userEmail: cleanEmail, details: "User not found" }, LOCKOUT_MS),
        recordRateLimitFailure(ipKey, { ipAddress: meta.ipAddress, userEmail: cleanEmail, details: "User not found" }, LOCKOUT_MS),
      ]);
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await Promise.all([
        recordRateLimitFailure(emailKey, { ipAddress: meta.ipAddress, userEmail: cleanEmail, details: "Invalid password" }, LOCKOUT_MS),
        recordRateLimitFailure(ipKey, { ipAddress: meta.ipAddress, userEmail: cleanEmail, details: "Invalid password" }, LOCKOUT_MS),
      ]);
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Reset rate limiter on successful login
    resetRateLimit(emailKey);
    resetRateLimit(ipKey);

    const isSuperAdmin = user.role === "SUPER_ADMIN" || cleanEmail === "admin@admin.com";

    // Regular users: Enforce status check
    if (!isSuperAdmin) {
      if (user.status === "PENDING") {
        return NextResponse.json(
          {
            error:
              "Your account is pending approval by the Super Admin. You will be able to log in once approved.",
          },
          { status: 403 }
        );
      }
      if (user.status === "REJECTED") {
        return NextResponse.json(
          {
            error:
              "Your account registration was rejected by the Super Admin. Please contact the administrator for assistance.",
          },
          { status: 403 }
        );
      }
      if (user.status === "SUSPENDED") {
        return NextResponse.json(
          {
            error:
              "Your account has been suspended. Please contact the Super Admin for assistance.",
          },
          { status: 403 }
        );
      }
    }

    // Ensure role is updated if superadmin
    if (isSuperAdmin && user.role !== "SUPER_ADMIN") {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "SUPER_ADMIN", status: "APPROVED" },
      });
    }

    // Resolve initial company for session
    const firstMembership = await prisma.companyMember.findFirst({
      where: { userId: user.id, isActive: true },
    });

    await createSession(user.id, firstMembership?.companyId);

    await recordAuditLog({
      companyId: firstMembership?.companyId || null,
      userId: user.id,
      userEmail: user.email,
      action: "USER_LOGIN",
      details: isSuperAdmin ? "Super Admin logged in" : `User logged in (${user.name})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      ok: true,
      isSuperAdmin,
      redirectTo: isSuperAdmin ? "/superadmin" : "/",
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ error: err.message || "Login failed" }, { status: 500 });
  }
}
