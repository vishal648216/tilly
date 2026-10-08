import { NextResponse } from "next/server";
import { requirePermission, validateEntityBelongsToCompany, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isValidEmail, isValidPhone, isValidGstin, isValidPincode, isValidPan } from "@/lib/validators";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PARTY_VIEW, req);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // CUSTOMER or VENDOR/SUPPLIER

    const where: any = { companyId: context.company.id };
    if (type) {
      if (type === "CUSTOMER") {
        where.type = { in: ["CUSTOMER", "BOTH"] };
      } else if (type === "VENDOR" || type === "SUPPLIER") {
        where.type = { in: ["VENDOR", "BOTH"] };
      } else {
        where.type = type;
      }
    }

    const parties = await prisma.party.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, parties });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PARTY_CREATE, req);
    const companyId = context.company.id;

    const body = await req.json();
    const {
      name,
      type,
      phone,
      email,
      gstin,
      pan,
      address,
      city,
      state,
      pincode,
      openingBalance,
      contactPerson,
      code,
      billingAddress,
      shippingAddress,
      gstTreatment,
      creditLimit,
      creditDays,
      paymentTerms,
      priceList,
      bankDetails,
      salesperson,
      notes,
      tags,
      customFields,
    } = body;

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Party name must be at least 2 characters long." }, { status: 400 });
    }

    const cleanPhone = phone?.trim();
    if (!cleanPhone && (type === "VENDOR" || type === "SUPPLIER")) {
      return NextResponse.json({ error: "Mobile number is required for vendor registration." }, { status: 400 });
    }
    if (cleanPhone && !isValidPhone(cleanPhone)) {
      return NextResponse.json({ error: "Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9." }, { status: 400 });
    }

    const cleanState = state?.trim();
    if (!cleanState && (type === "VENDOR" || type === "SUPPLIER")) {
      return NextResponse.json({ error: "State is required for vendor registration." }, { status: 400 });
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (gstin && !isValidGstin(gstin)) {
      return NextResponse.json({ error: "Invalid GSTIN format (must be 15 alphanumeric characters, e.g. 27ABCDE1234F1Z5)." }, { status: 400 });
    }

    if (pan && !isValidPan(pan)) {
      return NextResponse.json({ error: "Invalid PAN format (must be 10 characters, e.g. ABCDE1234F)." }, { status: 400 });
    }

    if (pincode && !isValidPincode(pincode)) {
      return NextResponse.json({ error: "PIN code must be exactly 6 digits." }, { status: 400 });
    }

    const party = await prisma.party.create({
      data: {
        companyId,
        name: cleanName,
        type: type || "CUSTOMER",
        phone: phone ? phone.trim() : null,
        email: email ? email.trim().toLowerCase() : null,
        gstin: gstin ? gstin.trim().toUpperCase() : null,
        pan: pan ? pan.trim().toUpperCase() : null,
        address: address ? address.trim() : null,
        city: city ? city.trim() : null,
        state: state ? state.trim() : null,
        pincode: pincode ? pincode.trim() : null,
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
        contactPerson: contactPerson ? contactPerson.trim() : null,
        code: code ? code.trim() : null,
        billingAddress: billingAddress ? billingAddress.trim() : address ? address.trim() : null,
        shippingAddress: shippingAddress ? shippingAddress.trim() : null,
        gstTreatment: gstTreatment || "REGISTERED",
        creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
        creditDays: creditDays ? parseInt(creditDays) : 0,
        paymentTerms: paymentTerms ? paymentTerms.trim() : null,
        priceList: priceList || "RETAIL",
        bankDetails: bankDetails ? (typeof bankDetails === "string" ? bankDetails : JSON.stringify(bankDetails)) : null,
        salesperson: salesperson ? salesperson.trim() : null,
        notes: notes ? notes.trim() : null,
        tags: tags ? (typeof tags === "string" ? tags : JSON.stringify(tags)) : null,
        customFields: customFields ? (typeof customFields === "string" ? customFields : JSON.stringify(customFields)) : null,
      },
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "CREATE_PARTY",
      entity: "Party",
      entityId: party.id,
      afterValue: { name: party.name, type: party.type, gstin: party.gstin, code: party.code },
      details: `Created ${party.type} '${party.name}'`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, party });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PARTY_EDIT, req);
    const companyId = context.company.id;

    const body = await req.json();
    const {
      id,
      name,
      type,
      phone,
      email,
      gstin,
      pan,
      address,
      city,
      state,
      pincode,
      openingBalance,
      contactPerson,
      code,
      billingAddress,
      shippingAddress,
      gstTreatment,
      creditLimit,
      creditDays,
      paymentTerms,
      priceList,
      bankDetails,
      salesperson,
      notes,
      tags,
      customFields,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Party id is required for update." }, { status: 400 });
    }

    // IDOR Check
    await validateEntityBelongsToCompany("party", id, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Party name must be at least 2 characters long." }, { status: 400 });
    }

    if (phone && !isValidPhone(phone)) {
      return NextResponse.json({ error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (gstin && !isValidGstin(gstin)) {
      return NextResponse.json({ error: "Invalid GSTIN format (must be 15 alphanumeric characters, e.g. 27ABCDE1234F1Z5)." }, { status: 400 });
    }

    if (pan && !isValidPan(pan)) {
      return NextResponse.json({ error: "Invalid PAN format (must be 10 characters, e.g. ABCDE1234F)." }, { status: 400 });
    }

    if (pincode && !isValidPincode(pincode)) {
      return NextResponse.json({ error: "PIN code must be exactly 6 digits." }, { status: 400 });
    }

    const existing = await prisma.party.findUnique({ where: { id } });

    const updated = await prisma.party.update({
      where: { id },
      data: {
        name: cleanName,
        type: type || undefined,
        phone: phone !== undefined ? (phone ? phone.trim() : null) : undefined,
        email: email !== undefined ? (email ? email.trim().toLowerCase() : null) : undefined,
        gstin: gstin !== undefined ? (gstin ? gstin.trim().toUpperCase() : null) : undefined,
        pan: pan !== undefined ? (pan ? pan.trim().toUpperCase() : null) : undefined,
        address: address !== undefined ? (address ? address.trim() : null) : undefined,
        city: city !== undefined ? (city ? city.trim() : null) : undefined,
        state: state !== undefined ? (state ? state.trim() : null) : undefined,
        pincode: pincode !== undefined ? (pincode ? pincode.trim() : null) : undefined,
        openingBalance: openingBalance !== undefined ? parseFloat(openingBalance) || 0 : undefined,
        contactPerson: contactPerson !== undefined ? (contactPerson ? contactPerson.trim() : null) : undefined,
        code: code !== undefined ? (code ? code.trim() : null) : undefined,
        billingAddress: billingAddress !== undefined ? (billingAddress ? billingAddress.trim() : null) : undefined,
        shippingAddress: shippingAddress !== undefined ? (shippingAddress ? shippingAddress.trim() : null) : undefined,
        gstTreatment: gstTreatment || undefined,
        creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) || 0 : undefined,
        creditDays: creditDays !== undefined ? parseInt(creditDays) || 0 : undefined,
        paymentTerms: paymentTerms !== undefined ? (paymentTerms ? paymentTerms.trim() : null) : undefined,
        priceList: priceList || undefined,
        bankDetails: bankDetails !== undefined ? (typeof bankDetails === "string" ? bankDetails : JSON.stringify(bankDetails)) : undefined,
        salesperson: salesperson !== undefined ? (salesperson ? salesperson.trim() : null) : undefined,
        notes: notes !== undefined ? (notes ? notes.trim() : null) : undefined,
        tags: tags !== undefined ? (typeof tags === "string" ? tags : JSON.stringify(tags)) : undefined,
        customFields: customFields !== undefined ? (typeof customFields === "string" ? customFields : JSON.stringify(customFields)) : undefined,
      },
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "UPDATE_PARTY",
      entity: "Party",
      entityId: id,
      beforeValue: existing ? { name: existing.name, phone: existing.phone, gstin: existing.gstin } : null,
      afterValue: { name: updated.name, phone: updated.phone, gstin: updated.gstin },
      details: `Updated ${updated.type} '${updated.name}'`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, party: updated });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PARTY_EDIT, req);
    const companyId = context.company.id;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Party id is required for deletion." }, { status: 400 });
    }

    await validateEntityBelongsToCompany("party", id, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    // Check if party has invoices
    const invoiceCount = await prisma.invoice.count({ where: { partyId: id } });
    if (invoiceCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete party because it is referenced in ${invoiceCount} invoices/bills.` },
        { status: 400 }
      );
    }

    const party = await prisma.party.findUnique({ where: { id } });
    await prisma.party.delete({ where: { id } });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "DELETE_PARTY",
      entity: "Party",
      entityId: id,
      beforeValue: party ? { name: party.name, type: party.type } : null,
      details: `Deleted ${party?.type} '${party?.name}'`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, message: "Party deleted successfully." });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
