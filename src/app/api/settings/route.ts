import { NextResponse } from "next/server";
import { requireCompanyAccess, requirePermission, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  isValidEmail,
  isValidPhone,
  isValidGstin,
  isValidPan,
  isValidIfsc,
  isValidUpi,
} from "@/lib/validators";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";
import { getCompanySettings, FeatureFlagKey } from "@/lib/featureFlags";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const [company, settings, customFields] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
      }),
      getCompanySettings(companyId),
      prisma.customFieldDefinition.findMany({
        where: { companyId, isActive: true },
        orderBy: [{ entityType: "asc" }, { displayOrder: "asc" }],
      }),
    ]);

    return NextResponse.json({
      ok: true,
      company,
      settings,
      customFields,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.SETTINGS_MANAGE, req);
    const company = context.company;
    const body = await req.json();

    const {
      name,
      legalName,
      businessType,
      industry,
      logo,
      website,
      email,
      phone,
      address,
      city,
      state,
      country,
      pincode,
      gstin,
      pan,
      currency,
      financialYear,
      timezone,
      upiId,
      bankName,
      accountNo,
      ifscCode,
      branchName,
      terms,
      settings, // Feature flags object
    } = body;

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Company name must be at least 2 characters long." }, { status: 400 });
    }

    if (phone && !isValidPhone(phone)) {
      return NextResponse.json({ error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (gstin && !isValidGstin(gstin)) {
      return NextResponse.json({ error: "Invalid GSTIN format (must be 15 alphanumeric characters, e.g. 24ABCDE1234F1Z5)." }, { status: 400 });
    }

    if (pan && !isValidPan(pan)) {
      return NextResponse.json({ error: "Invalid PAN format (must be 10 characters: ABCDE1234F)." }, { status: 400 });
    }

    if (ifscCode && !isValidIfsc(ifscCode)) {
      return NextResponse.json({ error: "Invalid Bank IFSC code (11 characters: e.g. SBIN0001234)." }, { status: 400 });
    }

    if (upiId && !isValidUpi(upiId)) {
      return NextResponse.json({ error: "Please enter a valid UPI ID (e.g. 9876543210@paytm or name@okhdfcbank)." }, { status: 400 });
    }

    // Update Company Profile
    const updatedCompany = await prisma.company.update({
      where: { id: company.id },
      data: {
        name: cleanName,
        legalName: legalName ? legalName.trim() : null,
        businessType: businessType || "Retail",
        industry: industry ? industry.trim() : null,
        logo: logo || null,
        website: website ? website.trim() : null,
        email: email ? email.trim().toLowerCase() : null,
        phone: phone ? phone.trim() : null,
        address: address ? address.trim() : null,
        city: city ? city.trim() : null,
        state: state ? state.trim() : null,
        country: country ? country.trim() : "India",
        pincode: pincode ? pincode.trim() : null,
        gstin: gstin ? gstin.trim().toUpperCase() : null,
        pan: pan ? pan.trim().toUpperCase() : null,
        currency: currency ? currency.trim().toUpperCase() : "INR",
        financialYear: financialYear ? financialYear.trim() : null,
        timezone: timezone ? timezone.trim() : "Asia/Kolkata",
        upiId: upiId ? upiId.trim() : null,
        bankName: bankName ? bankName.trim() : null,
        accountNo: accountNo ? accountNo.trim() : null,
        ifscCode: ifscCode ? ifscCode.trim().toUpperCase() : null,
        branchName: branchName ? branchName.trim() : null,
        terms: terms || null,
      },
    });

    // Update CompanySettings (Feature Flags) if provided
    let updatedSettings = null;
    if (settings && typeof settings === "object") {
      const allowedFlags: FeatureFlagKey[] = [
        "inventoryEnabled",
        "gstEnabled",
        "warehouseEnabled",
        "multiWarehouseEnabled",
        "barcodeEnabled",
        "batchEnabled",
        "expiryEnabled",
        "serialEnabled",
        "manufacturingEnabled",
        "quotationEnabled",
        "salesOrderEnabled",
        "purchaseOrderEnabled",
        "deliveryChallanEnabled",
        "goodsReceiptEnabled",
        "salespersonEnabled",
        "priceListsEnabled",
        "negativeStockAllowed",
        "taxInclusivePricing",
        "roundOffEnabled",
      ];

      const settingsData: Record<string, boolean> = {};
      for (const flag of allowedFlags) {
        if (typeof settings[flag] === "boolean") {
          settingsData[flag] = settings[flag];
        }
      }

      updatedSettings = await prisma.companySettings.upsert({
        where: { companyId: company.id },
        create: {
          companyId: company.id,
          ...settingsData,
        },
        update: {
          ...settingsData,
        },
      });
    }

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId: company.id,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "UPDATE_SETTINGS",
      entity: "Company",
      entityId: company.id,
      details: `Updated company profile & feature settings for ${updatedCompany.name}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      company: updatedCompany,
      settings: updatedSettings,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
