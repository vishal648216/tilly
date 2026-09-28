import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

    const body = await req.json();
    const { name, sku, barcode, category, type, hsn, unit, salePrice, purchasePrice, gstRate, stock, minStock } = body;

    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const item = await prisma.item.create({
      data: {
        companyId: company.id,
        name,
        sku: sku || null,
        barcode: barcode || null,
        category: category || null,
        type: type || "PRODUCT",
        hsn: hsn || null,
        unit: unit || "PCS",
        salePrice: salePrice || 0,
        purchasePrice: purchasePrice || 0,
        gstRate: gstRate || 0,
        stock: type === "SERVICE" ? 0 : stock || 0,
        minStock: type === "SERVICE" ? 0 : minStock || 0,
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
