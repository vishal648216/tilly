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

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Item name kam se kam 2 characters ka hona chahiye." }, { status: 400 });
    }

    if (hsn) {
      const cleanHsn = hsn.replace(/[^0-9]/g, "");
      if (cleanHsn.length < 2 || cleanHsn.length > 8) {
        return NextResponse.json({ error: "HSN/SAC code 2 se 8 digits ka hona chahiye." }, { status: 400 });
      }
    }

    const saleP = parseFloat(salePrice) || 0;
    const purP = parseFloat(purchasePrice) || 0;
    if (saleP < 0 || purP < 0) {
      return NextResponse.json({ error: "Price negative nahi ho sakti." }, { status: 400 });
    }

    const item = await prisma.item.create({
      data: {
        companyId: company.id,
        name: cleanName,
        sku: sku ? sku.trim() : null,
        barcode: barcode ? barcode.trim() : null,
        category: category ? category.trim() : null,
        type: type || "PRODUCT",
        hsn: hsn ? hsn.trim() : null,
        unit: unit || "PCS",
        salePrice: saleP,
        purchasePrice: purP,
        gstRate: parseFloat(gstRate) || 0,
        stock: type === "SERVICE" ? 0 : Math.max(0, parseFloat(stock) || 0),
        minStock: type === "SERVICE" ? 0 : Math.max(0, parseFloat(minStock) || 0),
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create item" }, { status: 500 });
  }
}
