// Taily - Centralized GST Tax Engine
// Single source of truth for all tax calculations in the system.
// Used by invoice creation, sales returns, purchase returns, reports, and GST filings.

import { roundTo2 } from "./currency";

// GST standard rates in India
export const GST_RATES = [0, 3, 5, 12, 18, 28] as const;
export type GstRate = (typeof GST_RATES)[number] | number;

// GST treatment for parties
export type GstTreatment =
  | "REGISTERED"      // B2B - Registered business, show GSTIN
  | "UNREGISTERED"    // B2C - Unregistered consumer
  | "COMPOSITION"     // Composition scheme dealer
  | "CONSUMER"        // End consumer
  | "OVERSEAS"        // Export / Import
  | "SEZ"             // Special Economic Zone
  | "EXEMPT";         // GST Exempt supply

export type TaxType = "CGST" | "SGST" | "IGST" | "CESS" | "NONE";

export interface TaxLineInput {
  qty: number;
  rate: number;              // selling/purchase rate per unit
  discount?: number;         // absolute line discount (not %)
  gstRate: number;           // GST rate in % e.g. 18
  taxMode?: "EXCLUSIVE" | "INCLUSIVE"; // whether rate includes GST
}

export interface TaxLineResult {
  qty: number;
  rate: number;
  baseAmount: number;        // qty × rate (before discount)
  lineDiscount: number;      // absolute discount on this line
  taxableAmount: number;     // after discount, after extracting GST if inclusive
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  lineTotal: number;         // taxableAmount + totalTax
}

export interface InvoiceTaxResult {
  lines: TaxLineResult[];
  subTotal: number;          // sum of taxableAmount across lines
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalTax: number;
  discount: number;          // invoice-level discount
  freight: number;
  otherCharges: number;
  beforeRound: number;
  roundOff: number;
  grandTotal: number;
}

/**
 * Calculate GST for a single line item.
 * Supports both Tax Exclusive (default) and Tax Inclusive pricing.
 * For intra-state: CGST + SGST (each half of GST rate).
 * For inter-state: IGST (full GST rate).
 */
export function calculateLineTax(line: TaxLineInput, isInterState: boolean): TaxLineResult {
  const qty = line.qty;
  const gstRate = line.gstRate || 0;
  const lineDiscount = roundTo2(line.discount || 0);
  const taxMode = line.taxMode || "EXCLUSIVE";

  let baseAmount = roundTo2(qty * line.rate);
  let taxableAmount: number;
  let totalTax: number;

  if (taxMode === "INCLUSIVE" && gstRate > 0) {
    // Extract GST from the inclusive price
    // Inclusive rate: price = taxable × (1 + gstRate/100)
    // taxable = price / (1 + gstRate/100)
    const inclusiveBase = roundTo2(baseAmount - lineDiscount);
    taxableAmount = roundTo2(inclusiveBase / (1 + gstRate / 100));
    totalTax = roundTo2(inclusiveBase - taxableAmount);
  } else {
    // Tax Exclusive — default
    taxableAmount = roundTo2(Math.max(0, baseAmount - lineDiscount));
    totalTax = roundTo2((taxableAmount * gstRate) / 100);
  }

  let cgst = 0, sgst = 0, igst = 0;

  if (gstRate > 0) {
    if (isInterState) {
      igst = totalTax;
    } else {
      cgst = roundTo2(totalTax / 2);
      sgst = roundTo2(totalTax / 2);
      // Fix rounding: ensure cgst + sgst = totalTax
      if (roundTo2(cgst + sgst) !== totalTax) {
        sgst = roundTo2(totalTax - cgst);
      }
    }
  }

  return {
    qty,
    rate: line.rate,
    baseAmount,
    lineDiscount,
    taxableAmount,
    cgst,
    sgst,
    igst,
    totalTax: roundTo2(cgst + sgst + igst),
    lineTotal: roundTo2(taxableAmount + cgst + sgst + igst),
  };
}

/**
 * Calculate full invoice GST breakdown.
 * Applies line-level GST, then header charges (freight, other charges),
 * header discount, and optional round-off.
 */
export function calculateInvoiceTax(
  lines: TaxLineInput[],
  options: {
    isInterState: boolean;
    discount?: number;        // header-level invoice discount
    freight?: number;         // freight/shipping charges (not taxed separately)
    otherCharges?: number;    // other charges (not taxed separately)
    roundOffEnabled?: boolean;
  }
): InvoiceTaxResult {
  const {
    isInterState,
    discount = 0,
    freight = 0,
    otherCharges = 0,
    roundOffEnabled = true,
  } = options;

  const calculatedLines = lines.map((line) => calculateLineTax(line, isInterState));

  const subTotal = roundTo2(calculatedLines.reduce((s, l) => s + l.taxableAmount, 0));
  const cgstTotal = roundTo2(calculatedLines.reduce((s, l) => s + l.cgst, 0));
  const sgstTotal = roundTo2(calculatedLines.reduce((s, l) => s + l.sgst, 0));
  const igstTotal = roundTo2(calculatedLines.reduce((s, l) => s + l.igst, 0));
  const totalTax = roundTo2(cgstTotal + sgstTotal + igstTotal);

  const invoiceDiscount = roundTo2(discount);
  const freightAmt = roundTo2(freight);
  const otherChargesAmt = roundTo2(otherCharges);

  const beforeRound = roundTo2(
    subTotal - invoiceDiscount + freightAmt + otherChargesAmt + totalTax
  );

  const grandTotal = roundOffEnabled ? Math.round(beforeRound) : beforeRound;
  const roundOff = roundOffEnabled ? roundTo2(grandTotal - beforeRound) : 0;

  return {
    lines: calculatedLines,
    subTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    totalTax,
    discount: invoiceDiscount,
    freight: freightAmt,
    otherCharges: otherChargesAmt,
    beforeRound,
    roundOff,
    grandTotal,
  };
}

/**
 * Categorize invoices for GST report (B2B vs B2C).
 * B2B: party has GSTIN (registered).
 * B2C: party is unregistered or consumer.
 */
export function categorizeGstInvoice(party: {
  gstin?: string | null;
  gstTreatment?: string | null;
}): "B2B" | "B2C" | "EXPORT" {
  const treatment = party?.gstTreatment || "UNREGISTERED";
  if (treatment === "OVERSEAS" || treatment === "SEZ") return "EXPORT";
  if (party?.gstin && party.gstin.trim().length > 0) return "B2B";
  return "B2C";
}

/**
 * Validate GSTIN format (India).
 * Pattern: 2 digit state code + 10 char PAN + 1 entity number + Z + 1 check digit
 */
export function validateGstin(gstin: string): boolean {
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return pattern.test(gstin.trim().toUpperCase());
}

/**
 * Determine if a transaction is inter-state based on GSTIN / state codes.
 * Compares first 2 digits of seller GSTIN vs buyer GSTIN or state.
 */
export function isInterStateTransaction(
  sellerGstin?: string | null,
  buyerGstin?: string | null,
  buyerState?: string | null
): boolean {
  if (sellerGstin && buyerGstin && sellerGstin.length >= 2 && buyerGstin.length >= 2) {
    return sellerGstin.substring(0, 2) !== buyerGstin.substring(0, 2);
  }
  // Default to intra-state (CGST + SGST) if cannot determine
  return false;
}

/**
 * Get GST account codes for a transaction.
 * Returns the correct CGST/SGST or IGST account codes.
 */
export function getGstAccountCodes(isInterState: boolean, isInput: boolean): {
  cgstCode?: string;
  sgstCode?: string;
  igstCode?: string;
} {
  if (isInterState) {
    return { igstCode: isInput ? "1302" : "2102" };
  }
  return {
    cgstCode: isInput ? "1300" : "2100",
    sgstCode: isInput ? "1301" : "2101",
  };
}
