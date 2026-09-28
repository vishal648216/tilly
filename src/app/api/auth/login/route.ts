import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    
    // Auto-seed demo store if logging in with demo credentials on a fresh database
    if (!user && email.toLowerCase() === "demo@taily.in" && password === "demo1234") {
      const passwordHash = await bcrypt.hash("demo1234", 10);
      user = await prisma.user.create({
        data: {
          email: "demo@taily.in",
          name: "Demo User",
          passwordHash,
          phone: "9999999999",
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
        create: { userId: user.id, companyId: company.id, role: "ADMIN" },
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

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ error: err.message || "Login failed" }, { status: 500 });
  }
}
