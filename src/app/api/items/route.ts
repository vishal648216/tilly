import { NextResponse } from "next/server";
import { requirePermission, validateEntityBelongsToCompany, handleAuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";
import { getCompanySettings } from "@/lib/featureFlags";
import { checkCompanyStatus, canCreateProduct, recordUsage } from "@/lib/subscriptionEnforcement";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PRODUCT_VIEW, req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const active = searchParams.get("active");

    const where: any = { companyId: context.company.id };
    if (type) {
      where.type = type.toUpperCase();
    }
    if (active === "true") {
      where.active = true;
    }

    const items = await prisma.item.findMany({
      where,
      include: {
        variants: {
          where: { active: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = items.map((it) => {
      let custom: any = {};
      try {
        if (it.customFields) custom = JSON.parse(it.customFields);
      } catch {}
      return {
        ...it,
        supplierId: custom.supplierId || null,
        supplierName: custom.supplierName || custom.purchasedFrom || null,
        purchasedFrom: custom.purchasedFrom || custom.supplierName || null,
      };
    });

    return NextResponse.json({ ok: true, items: formatted });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PRODUCT_CREATE, req);
    const companyId = context.company.id;

    // Phase 8: Server-side status & plan limit enforcement
    await checkCompanyStatus(companyId);
    const productPerm = await canCreateProduct(companyId);
    if (!productPerm.allowed) {
      return NextResponse.json(
        { error: productPerm.reason || "Maximum products limit reached for your plan.", code: "PLAN_LIMIT_EXCEEDED" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      sku,
      barcode,
      category,
      brand,
      type,
      hsn,
      unit,
      description,
      mrp,
      salePrice,
      purchasePrice,
      wholesalePrice,
      dealerPrice,
      distributorPrice,
      gstRate,
      taxMode,
      stock,
      minStock,
      openingStock,
      openingStockCost,
      reorderLevel,
      active,
      batchNo,
      expiryDate,
      warrantyMonths,
      model,
      imei,
      customFields,
      variants, // optional array
    } = body;

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Item name must be at least 2 characters long." }, { status: 400 });
    }

    if (hsn) {
      const cleanHsn = hsn.replace(/[^0-9]/g, "");
      if (cleanHsn.length < 2 || cleanHsn.length > 8) {
        return NextResponse.json({ error: "HSN/SAC code must be between 2 and 8 digits." }, { status: 400 });
      }
    }

    const settings = await getCompanySettings(companyId);
    let resolvedType = type || "PRODUCT";
    if (!settings.inventoryEnabled) {
      resolvedType = "SERVICE";
    }

    const saleP = parseFloat(salePrice) || 0;
    const purP = parseFloat(purchasePrice) || 0;
    const mrpP = parseFloat(mrp) || 0;
    const wholeP = parseFloat(wholesalePrice) || 0;
    const dealP = parseFloat(dealerPrice) || 0;
    const distP = parseFloat(distributorPrice) || 0;

    // Retail Business strict validations for physical products
    if (resolvedType === "PRODUCT") {
      if (saleP <= 0) {
        return NextResponse.json(
          { error: "Retail Selling Price (Sale Price) is required and must be greater than 0." },
          { status: 400 }
        );
      }
      if (purP <= 0) {
        return NextResponse.json(
          { error: "Purchase / Cost Price is required and must be greater than 0." },
          { status: 400 }
        );
      }
      if (mrpP > 0 && saleP > mrpP) {
        return NextResponse.json(
          { error: `Retail Sale Price (₹${saleP}) cannot exceed MRP (₹${mrpP}).` },
          { status: 400 }
        );
      }
      if (mrpP > 0 && purP > mrpP) {
        return NextResponse.json(
          { error: `Purchase Price (₹${purP}) cannot exceed MRP (₹${mrpP}).` },
          { status: 400 }
        );
      }
    }

    const openStock = resolvedType === "SERVICE" ? 0 : Math.max(0, parseFloat(openingStock) || 0);
    const currentStock = resolvedType === "SERVICE" ? 0 : Math.max(0, parseFloat(stock) || openStock);
    const minS = resolvedType === "SERVICE" ? 0 : Math.max(0, parseFloat(minStock) || 0);

    // Merge supplier info and custom fields
    let parsedCustom: Record<string, any> = {};
    if (customFields) {
      parsedCustom = typeof customFields === "string" ? JSON.parse(customFields || "{}") : { ...customFields };
    }
    if (body.supplierId) parsedCustom.supplierId = body.supplierId;
    if (body.supplierName || body.purchasedFrom) {
      parsedCustom.supplierName = body.supplierName || body.purchasedFrom;
      parsedCustom.purchasedFrom = body.supplierName || body.purchasedFrom;
    }

    const item = await prisma.$transaction(async (tx) => {
      const createdItem = await tx.item.create({
        data: {
          companyId,
          name: cleanName,
          sku: sku ? sku.trim() : null,
          barcode: barcode ? barcode.trim() : null,
          category: category ? category.trim() : null,
          brand: brand ? brand.trim() : null,
          type: resolvedType,
          hsn: hsn ? hsn.trim() : null,
          unit: unit || "PCS",
          description: description ? description.trim() : null,
          mrp: mrpP,
          salePrice: saleP,
          purchasePrice: purP,
          wholesalePrice: wholeP,
          dealerPrice: dealP,
          distributorPrice: distP,
          gstRate: parseFloat(gstRate) || 0,
          taxMode: taxMode === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE",
          stock: openStock > 0 ? 0 : currentStock,
          minStock: minS,
          openingStock: openStock,
          openingStockCost: parseFloat(openingStockCost) || purP,
          reorderLevel: parseFloat(reorderLevel) || 0,
          active: active === false ? false : true,
          batchNo: batchNo ? batchNo.trim() : null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          warrantyMonths: warrantyMonths ? parseInt(warrantyMonths) : null,
          model: model ? model.trim() : null,
          imei: imei ? imei.trim() : null,
          customFields: Object.keys(parsedCustom).length > 0 ? JSON.stringify(parsedCustom) : null,
        },
      });

      // If opening stock > 0, record initial stock movement atomically
      if (openStock > 0 && resolvedType !== "SERVICE") {
        const { recordStockMovement } = await import("@/lib/inventory");
        await recordStockMovement(
          {
            companyId,
            itemId: createdItem.id,
            movementType: "OPENING",
            referenceType: "MANUAL",
            referenceId: "OPENING",
            qtyIn: openStock,
            qtyOut: 0,
            unitCost: parseFloat(openingStockCost) || purP,
            totalCost: openStock * (parseFloat(openingStockCost) || purP),
            notes: "Opening Stock initialization",
            createdBy: context.user.id,
            allowNegative: true,
          },
          tx
        );
      }

      // If variants provided
      if (Array.isArray(variants) && variants.length > 0) {
        for (const v of variants) {
          if (v.options && typeof v.options === "object") {
            const attrDisplay =
              v.attributes ||
              Object.entries(v.options)
                .map(([k, val]) => `${k}: ${val}`)
                .join(" / ");

            await tx.productVariant.create({
              data: {
                companyId,
                itemId: createdItem.id,
                sku: v.sku ? v.sku.trim() : null,
                barcode: v.barcode ? v.barcode.trim() : null,
                price: parseFloat(v.price) || saleP,
                wholesalePrice: parseFloat(v.wholesalePrice) || wholeP,
                stock: parseFloat(v.stock) || 0,
                options: JSON.stringify(v.options),
                attributes: attrDisplay,
              },
            });
          }
        }
      }

      return createdItem;
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "CREATE_ITEM",
      entity: "Item",
      entityId: item.id,
      afterValue: { name: item.name, sku: item.sku, stock: item.stock, mrp: item.mrp },
      details: `Created item '${item.name}' (${item.type})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, item });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PRODUCT_EDIT, req);
    const companyId = context.company.id;

    const body = await req.json();
    const {
      id,
      name,
      sku,
      barcode,
      category,
      brand,
      type,
      hsn,
      unit,
      description,
      mrp,
      salePrice,
      purchasePrice,
      wholesalePrice,
      dealerPrice,
      distributorPrice,
      gstRate,
      taxMode,
      stock,
      minStock,
      openingStock,
      openingStockCost,
      reorderLevel,
      active,
      batchNo,
      expiryDate,
      warrantyMonths,
      model,
      imei,
      customFields,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Item id is required for update." }, { status: 400 });
    }

    // IDOR Check
    await validateEntityBelongsToCompany("item", id, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "Item name must be at least 2 characters long." }, { status: 400 });
    }

    if (hsn) {
      const cleanHsn = hsn.replace(/[^0-9]/g, "");
      if (cleanHsn.length < 2 || cleanHsn.length > 8) {
        return NextResponse.json({ error: "HSN/SAC code must be between 2 and 8 digits." }, { status: 400 });
      }
    }

    const existing = await prisma.item.findUnique({ where: { id } });

    const updated = await prisma.item.update({
      where: { id },
      data: {
        name: cleanName,
        sku: sku !== undefined ? (sku ? sku.trim() : null) : undefined,
        barcode: barcode !== undefined ? (barcode ? barcode.trim() : null) : undefined,
        category: category !== undefined ? (category ? category.trim() : null) : undefined,
        brand: brand !== undefined ? (brand ? brand.trim() : null) : undefined,
        type: type || undefined,
        hsn: hsn !== undefined ? (hsn ? hsn.trim() : null) : undefined,
        unit: unit || undefined,
        description: description !== undefined ? (description ? description.trim() : null) : undefined,
        mrp: mrp !== undefined ? parseFloat(mrp) || 0 : undefined,
        salePrice: salePrice !== undefined ? parseFloat(salePrice) || 0 : undefined,
        purchasePrice: purchasePrice !== undefined ? parseFloat(purchasePrice) || 0 : undefined,
        wholesalePrice: wholesalePrice !== undefined ? parseFloat(wholesalePrice) || 0 : undefined,
        dealerPrice: dealerPrice !== undefined ? parseFloat(dealerPrice) || 0 : undefined,
        distributorPrice: distributorPrice !== undefined ? parseFloat(distributorPrice) || 0 : undefined,
        gstRate: gstRate !== undefined ? parseFloat(gstRate) || 0 : undefined,
        taxMode: taxMode ? (taxMode === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE") : undefined,
        stock: stock !== undefined ? parseFloat(stock) || 0 : undefined,
        minStock: minStock !== undefined ? parseFloat(minStock) || 0 : undefined,
        openingStock: openingStock !== undefined ? parseFloat(openingStock) || 0 : undefined,
        openingStockCost: openingStockCost !== undefined ? parseFloat(openingStockCost) || 0 : undefined,
        reorderLevel: reorderLevel !== undefined ? parseFloat(reorderLevel) || 0 : undefined,
        active: active !== undefined ? Boolean(active) : undefined,
        batchNo: batchNo !== undefined ? (batchNo ? batchNo.trim() : null) : undefined,
        expiryDate: expiryDate !== undefined ? (expiryDate ? new Date(expiryDate) : null) : undefined,
        warrantyMonths: warrantyMonths !== undefined ? (warrantyMonths ? parseInt(warrantyMonths) : null) : undefined,
        model: model !== undefined ? (model ? model.trim() : null) : undefined,
        imei: imei !== undefined ? (imei ? imei.trim() : null) : undefined,
        customFields: customFields !== undefined ? (typeof customFields === "string" ? customFields : JSON.stringify(customFields)) : undefined,
      },
    });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "UPDATE_ITEM",
      entity: "Item",
      entityId: id,
      beforeValue: existing ? { name: existing.name, salePrice: existing.salePrice, stock: existing.stock } : null,
      afterValue: { name: updated.name, salePrice: updated.salePrice, stock: updated.stock },
      details: `Updated item '${updated.name}'`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.PRODUCT_EDIT, req);
    const companyId = context.company.id;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Item id is required for deletion." }, { status: 400 });
    }

    await validateEntityBelongsToCompany("item", id, companyId, req, {
      userId: context.user.id,
      userEmail: context.user.email,
    });

    // Check if item has invoices or stock movements
    const usage = await prisma.invoiceLine.count({ where: { itemId: id } });
    if (usage > 0) {
      return NextResponse.json(
        { error: `Cannot delete item because it is referenced in ${usage} invoice lines. Consider marking it inactive instead.` },
        { status: 400 }
      );
    }

    const item = await prisma.item.findUnique({ where: { id } });
    await prisma.item.delete({ where: { id } });

    const meta = getClientMetadata(req);
    await recordAuditLog({
      companyId,
      userId: context.user.id,
      userEmail: context.user.email,
      action: "DELETE_ITEM",
      entity: "Item",
      entityId: id,
      beforeValue: item ? { name: item.name, sku: item.sku } : null,
      details: `Deleted item '${item?.name}'`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, message: "Item deleted successfully." });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
