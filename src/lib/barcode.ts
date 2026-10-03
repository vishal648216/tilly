import { prisma } from "./prisma";

export interface BarcodeLookupResult {
  found: boolean;
  item?: any;
  variant?: any;
  matchType?: "BARCODE_ITEM" | "BARCODE_VARIANT" | "SKU_ITEM" | "SKU_VARIANT";
}

/**
 * Searches for a product across Items and ProductVariants by scanned barcode or SKU.
 * Highly optimized for fast POS and keyboard-style barcode scanners.
 */
export async function lookupProductByBarcode(
  companyId: string,
  rawCode: string
): Promise<BarcodeLookupResult> {
  const code = rawCode.trim();
  if (!code) return { found: false };

  // 1. Exact Item Barcode match
  const itemByBarcode = await prisma.item.findFirst({
    where: {
      companyId,
      barcode: code,
      active: true,
    },
    include: {
      batches: {
        where: { quantity: { gt: 0 } },
        orderBy: { expiryDate: "asc" },
      },
    },
  });

  if (itemByBarcode) {
    return {
      found: true,
      item: itemByBarcode,
      matchType: "BARCODE_ITEM",
    };
  }

  // 2. Product Variant Barcode match
  const variantByBarcode = await prisma.productVariant.findFirst({
    where: {
      companyId,
      barcode: code,
      active: true,
    },
    include: {
      item: true,
    },
  });

  if (variantByBarcode) {
    return {
      found: true,
      item: variantByBarcode.item,
      variant: variantByBarcode,
      matchType: "BARCODE_VARIANT",
    };
  }

  // 3. Fallback: SKU match on Item
  const itemBySku = await prisma.item.findFirst({
    where: {
      companyId,
      sku: { equals: code },
      active: true,
    },
    include: {
      batches: {
        where: { quantity: { gt: 0 } },
        orderBy: { expiryDate: "asc" },
      },
    },
  });

  if (itemBySku) {
    return {
      found: true,
      item: itemBySku,
      matchType: "SKU_ITEM",
    };
  }

  // 4. Fallback: SKU match on Variant
  const variantBySku = await prisma.productVariant.findFirst({
    where: {
      companyId,
      sku: { equals: code },
      active: true,
    },
    include: {
      item: true,
    },
  });

  if (variantBySku) {
    return {
      found: true,
      item: variantBySku.item,
      variant: variantBySku,
      matchType: "SKU_VARIANT",
    };
  }

  return { found: false };
}

/**
 * Automatically integrates scanned product into invoice lines.
 * If product already in line items, increments quantity by 1.
 * Otherwise, appends new line item with default rate, GST, and quantity = 1.
 */
export function handleBarcodeInvoiceSelection(
  currentLines: any[],
  product: any,
  variant?: any,
  options?: { isInterstate?: boolean; defaultWarehouseId?: string }
): {
  lines: any[];
  action: "INCREMENTED" | "ADDED";
  lineIndex: number;
} {
  const itemId = product.id;
  const lines = [...currentLines];

  const existingIndex = lines.findIndex((l) => l.itemId === itemId);

  if (existingIndex >= 0) {
    const existing = lines[existingIndex];
    const newQty = Number(existing.qty || 1) + 1;
    const rate = Number(existing.rate || product.salePrice || 0);
    const discount = Number(existing.discount || 0);
    const taxableAmount = Math.max(0, newQty * rate - discount);
    const gstRate = Number(existing.gstRate ?? product.gstRate ?? 0);
    const gstAmount = Math.round(((taxableAmount * gstRate) / 100) * 100) / 100;
    const amount = Math.round((taxableAmount + gstAmount) * 100) / 100;

    lines[existingIndex] = {
      ...existing,
      qty: newQty,
      taxableAmount,
      amount,
      cgst: options?.isInterstate ? 0 : gstAmount / 2,
      sgst: options?.isInterstate ? 0 : gstAmount / 2,
      igst: options?.isInterstate ? gstAmount : 0,
    };

    return {
      lines,
      action: "INCREMENTED",
      lineIndex: existingIndex,
    };
  } else {
    const qty = 1;
    const rate = Number(variant ? variant.price : product.salePrice || 0);
    const taxableAmount = qty * rate;
    const gstRate = Number(product.gstRate || 0);
    const gstAmount = Math.round(((taxableAmount * gstRate) / 100) * 100) / 100;
    const amount = Math.round((taxableAmount + gstAmount) * 100) / 100;

    const newLine = {
      itemId: product.id,
      name: variant ? `${product.name} (${variant.attributes || "Variant"})` : product.name,
      sku: variant?.sku || product.sku || undefined,
      barcode: variant?.barcode || product.barcode || undefined,
      unit: product.unit || "PCS",
      hsn: product.hsn || undefined,
      qty,
      rate,
      discount: 0,
      taxableAmount,
      gstRate,
      cgst: options?.isInterstate ? 0 : gstAmount / 2,
      sgst: options?.isInterstate ? 0 : gstAmount / 2,
      igst: options?.isInterstate ? gstAmount : 0,
      amount,
    };

    lines.push(newLine);

    return {
      lines,
      action: "ADDED",
      lineIndex: lines.length - 1,
    };
  }
}
