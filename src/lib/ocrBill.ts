import { prisma } from "./prisma";
import { checkCompanyStatus, canUseOCR, recordUsage } from "./subscriptionEnforcement";
import { createInvoice } from "./invoice";

export interface ExtractedBillItem {
  name: string;
  sku?: string;
  qty: number;
  rate: number;
  discount?: number;
  gstRate: number;
  amount: number;
}

export interface ExtractedBillData {
  supplierName: string;
  supplierGstin?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate?: string;
  subTotal: number;
  discountTotal?: number;
  taxTotal: number;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  grandTotal: number;
  items: ExtractedBillItem[];
  confidence: number;
}

/**
 * Intelligent pattern-based OCR extractor for Indian B2B & Retail Supplier Invoices.
 */
export function parseRawBillText(rawText: string): ExtractedBillData {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let supplierName = "Supplier Vendor";
  let supplierGstin: string | undefined = undefined;
  let supplierPhone: string | undefined = undefined;
  let supplierAddress: string | undefined = undefined;
  let invoiceNo = `BILL-${Date.now().toString().slice(-6)}`;
  let invoiceDate = new Date().toISOString().slice(0, 10);
  let grandTotal = 0;
  let subTotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  const items: ExtractedBillItem[] = [];

  const gstRegex = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i;
  const phoneRegex = /\b([6-9]\d{9})\b/;
  const invRegex = /(?:invoice\s*#|invoice\s*no\.?|inv\s*#|inv\s*no\.?|bill\s*no\.?|bill\s*#)[:.\s-]*([A-Za-z0-9\/-]+)/i;
  const dateRegex = /(?:invoice\s+date|bill\s+date|date|dated|dt)[:.\s-]*([A-Za-z0-9,\s\/-]+)/i;

  let inBilledBy = false;
  let inBilledTo = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section headers (Billed By = Vendor, Billed To = Customer)
    if (/^billed\s+by|^seller|^supplier|^from|^vendor/i.test(line)) {
      inBilledBy = true;
      inBilledTo = false;
      const inlineName = line.replace(/^(?:billed\s+by|seller|supplier|from|vendor)[:\s-]*/i, "").trim();
      if (inlineName.length >= 2 && !inlineName.toLowerCase().includes("gstin")) {
        supplierName = inlineName;
      }
      continue;
    }

    if (/^billed\s+to|^buyer|^customer|^to\s*:|^ship\s+to/i.test(line)) {
      inBilledTo = true;
      inBilledBy = false;
      continue;
    }

    // Capture supplier name
    if (inBilledBy && !inBilledTo) {
      if (
        (supplierName === "Supplier Vendor" || !supplierName) &&
        !line.match(gstRegex) &&
        !line.match(/^pan/i) &&
        !line.toLowerCase().includes("invoice") &&
        line.length >= 2
      ) {
        supplierName = line;
      }
      if (!supplierGstin) {
        const gm = line.match(gstRegex);
        if (gm) supplierGstin = gm[1].toUpperCase();
      }
    }

    // Fallback supplier name
    if (supplierName === "Supplier Vendor" && !inBilledTo) {
      const supMatch = line.match(/(?:supplier|vendor|from|m\/s)[:.\s-]+([A-Za-z0-9\s&.,'-]+)/i);
      if (supMatch && supMatch[1].trim().length >= 3 && !supMatch[1].toLowerCase().includes("gstin")) {
        supplierName = supMatch[1].trim();
      }
    }

    // Capture GSTIN
    if (!supplierGstin && !inBilledTo) {
      const gMatch = line.match(gstRegex);
      if (gMatch) supplierGstin = gMatch[1].toUpperCase();
    }

    // Capture Phone
    if (!supplierPhone && !inBilledTo) {
      const pMatch = line.match(phoneRegex);
      if (pMatch) supplierPhone = pMatch[1];
    }

    // Invoice No
    const im = line.match(invRegex);
    if (im && im[1] && im[1].trim().length >= 1) {
      invoiceNo = im[1].trim();
    } else if (invoiceNo.startsWith("BILL-")) {
      const fallbackInv = line.match(/^(?:invoice|bill|inv)\s*[:#\s-]+\s*([A-Za-z0-9\/-]+)$/i);
      if (fallbackInv && fallbackInv[1]) {
        invoiceNo = fallbackInv[1].trim();
      }
    }

    // Invoice Date
    if (/invoice\s*date|bill\s*date/i.test(line) || (!invoiceDate && /date/i.test(line))) {
      const dm = line.match(dateRegex);
      if (dm && dm[1]) {
        const cleanDateStr = dm[1].trim().replace(/^[:\s-]+/, "");
        const parsed = Date.parse(cleanDateStr);
        if (!isNaN(parsed)) {
          invoiceDate = new Date(parsed).toISOString().slice(0, 10);
        } else {
          invoiceDate = parseFlexibleDate(cleanDateStr);
        }
      }
    }

    // Parse Totals
    const totalMatch = line.match(/^(?:grand\s+total|total\s+amount|net\s+amount|invoice\s+total|total)\s*[:\s-]*₹?\s*([\d,]+(?:\.\d{1,2})?)$/i);
    if (totalMatch && totalMatch[1] && !line.toLowerCase().includes("sub") && !line.toLowerCase().includes("taxable")) {
      grandTotal = parseFloat(totalMatch[1].replace(/,/g, ""));
    }

    if (/sub\s*total[:\s-]*₹?\s*([\d,]+(?:\.\d{1,2})?)/i.test(line)) {
      const sm = line.match(/sub\s*total[:\s-]*₹?\s*([\d,]+(?:\.\d{1,2})?)/i);
      if (sm) subTotal = parseFloat(sm[1].replace(/,/g, ""));
    }

    if (/cgst[:\s-]*₹?\s*([\d,]+(?:\.\d{1,2})?)/i.test(line)) {
      const cm = line.match(/cgst[:\s-]*₹?\s*([\d,]+(?:\.\d{1,2})?)/i);
      if (cm) cgstTotal = parseFloat(cm[1].replace(/,/g, ""));
    }

    if (/sgst[:\s-]*₹?\s*([\d,]+(?:\.\d{1,2})?)/i.test(line)) {
      const sm = line.match(/sgst[:\s-]*₹?\s*([\d,]+(?:\.\d{1,2})?)/i);
      if (sm) sgstTotal = parseFloat(sm[1].replace(/,/g, ""));
    }

    // Parse Line Items:
    // Format 1: "1. Basic Web Development 02 10 9% 10,000.00 900 900 11,800.00"
    const itemMatch = line.match(
      /^(?:(\d+)[\.\s]+)?([A-Za-z0-9\s\-_+()\/]{3,}?)\s+(?:\d+\s+)?(\d+(?:\.\d+)?)\s+(?:\d+%\s+)?₹?\s*([\d,]+(?:\.\d{1,2})?)(?:\s+₹?[\d,]+(?:\.\d{1,2})?)*\s+₹?\s*([\d,]+(?:\.\d{1,2})?)$/
    );
    if (
      itemMatch &&
      !line.toLowerCase().includes("sub total") &&
      !line.toLowerCase().includes("taxable amount") &&
      !line.toLowerCase().includes("total")
    ) {
      const name = itemMatch[2].trim();
      const qty = parseFloat(itemMatch[3]) || 1;
      const rate = parseFloat(itemMatch[4].replace(/,/g, "")) || 0;
      const amount = parseFloat(itemMatch[5].replace(/,/g, "")) || qty * rate;
      items.push({ name, qty, rate, gstRate: 18, amount });
    } else {
      // Format 2: Tab-delimited or double-spaced items
      const tokens = line.split(/\s{2,}|\t/);
      if (tokens.length >= 3 && !line.toLowerCase().includes("total") && !line.toLowerCase().includes("gstin")) {
        const lastToken = tokens[tokens.length - 1].replace(/[₹,]/g, "");
        const secondLast = tokens[tokens.length - 2].replace(/[₹,]/g, "");
        const thirdLast = tokens[tokens.length - 3].replace(/[₹,]/g, "");

        const num1 = parseFloat(lastToken);
        const num2 = parseFloat(secondLast);
        const num3 = parseFloat(thirdLast);

        if (!isNaN(num1) && !isNaN(num2) && !isNaN(num3)) {
          items.push({
            name: tokens[0].trim(),
            qty: num3,
            rate: num2,
            gstRate: 18,
            amount: num1,
          });
        }
      }
    }
  }

  // Recalculate totals if not explicitly parsed from OCR
  if (items.length > 0) {
    if (!subTotal || subTotal === 0) {
      subTotal = items.reduce((acc, it) => acc + (it.qty * it.rate - (it.discount || 0)), 0);
    }
    taxTotal = (cgstTotal + sgstTotal) > 0 ? (cgstTotal + sgstTotal) : items.reduce((acc, it) => acc + (it.qty * it.rate * it.gstRate) / 100, 0);
    if (!grandTotal || grandTotal === 0) {
      grandTotal = Math.round((subTotal + taxTotal) * 100) / 100;
    }
  }

  return {
    supplierName,
    supplierGstin,
    supplierPhone,
    invoiceNo,
    invoiceDate,
    subTotal,
    taxTotal,
    cgstTotal: cgstTotal || taxTotal / 2,
    sgstTotal: sgstTotal || taxTotal / 2,
    grandTotal,
    items,
    confidence: items.length > 0 ? 0.95 : 0.8,
  };
}

function parseFlexibleDate(str: string): string {
  try {
    const parts = str.split(/[-\/.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
      } else {
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Stage an OCR scan for review.
 * NEVER posts directly to invoices.
 */
export async function stageOcrBillScan(
  companyId: string,
  fileName: string,
  rawText: string,
  createdBy?: string
) {
  await checkCompanyStatus(companyId);
  const ocrPerm = await canUseOCR(companyId);
  if (!ocrPerm.allowed) {
    throw new Error(ocrPerm.reason || "OCR is not allowed on your subscription tier.");
  }

  // Increment usage count
  await recordUsage(companyId, "OCR_SCANS", 1);

  const extracted = parseRawBillText(rawText);

  const scanRecord = await prisma.ocrScanRecord.create({
    data: {
      companyId,
      fileName,
      status: "EXTRACTED",
      rawText,
      extractedData: JSON.stringify(extracted),
      createdBy,
    },
  });

  return {
    scanId: scanRecord.id,
    fileName,
    status: scanRecord.status,
    extracted,
  };
}

/**
 * Update OCR staging during user review screen.
 */
export async function updateOcrReview(
  companyId: string,
  scanId: string,
  reviewedData: ExtractedBillData
) {
  const scan = await prisma.ocrScanRecord.findFirst({
    where: { id: scanId, companyId },
  });

  if (!scan) throw new Error("OCR scan record not found.");

  const updated = await prisma.ocrScanRecord.update({
    where: { id: scanId },
    data: {
      status: "REVIEWED",
      extractedData: JSON.stringify(reviewedData),
    },
  });

  return {
    scanId: updated.id,
    status: updated.status,
    reviewedData,
  };
}

/**
 * Confirm and convert reviewed OCR scan into verified Purchase Invoice.
 * Strict: Never posts unverified OCR results.
 */
export async function confirmAndCreatePurchaseFromOcr(
  companyId: string,
  scanId: string,
  finalData: ExtractedBillData,
  userId?: string
) {
  await checkCompanyStatus(companyId);

  const scan = await prisma.ocrScanRecord.findFirst({
    where: { id: scanId, companyId },
  });

  if (!scan) throw new Error("OCR scan record not found.");
  if (scan.status === "POSTED") {
    throw new Error("This OCR bill has already been posted as a Purchase Invoice.");
  }

  // 1. Resolve or create Supplier Party
  let supplier = await prisma.party.findFirst({
    where: {
      companyId,
      type: { in: ["VENDOR", "BOTH"] },
      OR: [
        { name: { equals: finalData.supplierName } },
        ...(finalData.supplierGstin ? [{ gstin: finalData.supplierGstin }] : []),
      ],
    },
  });

  if (!supplier) {
    supplier = await prisma.party.create({
      data: {
        companyId,
        name: finalData.supplierName,
        type: "VENDOR",
        gstin: finalData.supplierGstin,
        phone: finalData.supplierPhone,
        address: finalData.supplierAddress,
      },
    });
  }

  // 2. Resolve items
  const lines = [];
  for (const itemData of finalData.items) {
    let item = await prisma.item.findFirst({
      where: {
        companyId,
        OR: [
          { name: { equals: itemData.name } },
          ...(itemData.sku ? [{ sku: itemData.sku }] : []),
        ],
      },
    });

    if (!item) {
      item = await prisma.item.create({
        data: {
          companyId,
          name: itemData.name,
          sku: itemData.sku,
          purchasePrice: itemData.rate,
          salePrice: Math.round(itemData.rate * 1.3),
          gstRate: itemData.gstRate || 18,
          unit: "PCS",
        },
      });
    }

    lines.push({
      itemId: item.id,
      name: item.name,
      qty: itemData.qty,
      rate: itemData.rate,
      discount: itemData.discount || 0,
      gstRate: itemData.gstRate || 18,
    });
  }

  // 3. Post verified Purchase Invoice
  const invoice = await createInvoice({
    companyId,
    type: "PURCHASE",
    partyId: supplier.id,
    supplierInvoiceNo: finalData.invoiceNo,
    date: new Date(finalData.invoiceDate),
    isInterState: Boolean(finalData.igstTotal && finalData.igstTotal > 0),
    notes: `Created from verified OCR bill scan (${scan.fileName})`,
    lines,
  });

  // 4. Update scan record to POSTED
  await prisma.ocrScanRecord.update({
    where: { id: scanId },
    data: {
      status: "POSTED",
      invoiceId: invoice.id,
    },
  });

  return {
    success: true,
    invoiceId: invoice.id,
    invoiceNo: invoice.invoiceNo,
    supplierName: supplier.name,
    grandTotal: invoice.grandTotal,
    scanRecordId: scanId,
  };
}
