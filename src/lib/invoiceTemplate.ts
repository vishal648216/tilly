// Taily - Phase 8: Dynamic Invoice Customization & Business Branding Engine
// Unified configuration-driven template architecture supporting 6 distinct layouts.
// Pure company configuration: zero separate frontend codebases per client.

import { prisma } from "./prisma";
import { canUseCustomBranding } from "./subscriptionEnforcement";

export type InvoiceTemplateType =
  | "Classic"
  | "Modern"
  | "GST_Detailed"
  | "Retail"
  | "Wholesale"
  | "Service";

export interface InvoiceCustomizationData {
  id?: string;
  companyId: string;
  template: InvoiceTemplateType;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  showLogo: boolean;
  logoUrl?: string | null;
  logoWidth: number;
  companyDisplayName?: string | null;
  customAddress?: string | null;
  showGstin: boolean;
  showPan: boolean;
  showBankDetails: boolean;
  bankAccountName?: string | null;
  bankName?: string | null;
  accountNo?: string | null;
  ifscCode?: string | null;
  branchName?: string | null;
  showUpiQr: boolean;
  upiId?: string | null;
  showSignature: boolean;
  signatureUrl?: string | null;
  signatureLabel: string;
  termsAndConditions?: string | null;
  footerNotes?: string | null;
  headerText?: string | null;
}

export const DEFAULT_INVOICE_CUSTOMIZATION: Omit<InvoiceCustomizationData, "companyId"> = {
  template: "Modern",
  primaryColor: "#059669", // Emerald 600
  accentColor: "#0f172a",  // Slate 900
  fontFamily: "Inter",
  showLogo: true,
  logoUrl: null,
  logoWidth: 120,
  companyDisplayName: null,
  customAddress: null,
  showGstin: true,
  showPan: true,
  showBankDetails: true,
  bankAccountName: null,
  bankName: null,
  accountNo: null,
  ifscCode: null,
  branchName: null,
  showUpiQr: true,
  upiId: null,
  showSignature: true,
  signatureUrl: null,
  signatureLabel: "Authorized Signatory",
  termsAndConditions: "1. Goods once sold will not be taken back without valid receipt.\n2. Payment is due within agreed credit terms.\n3. Interest @18% p.a. will be levied on overdue invoices.",
  footerNotes: "Thank you for doing business with us!",
  headerText: "TAX INVOICE",
};

/**
 * Retrieves the invoice branding and template configuration for a company.
 * Inherits default values from the company profile if not specifically overridden.
 */
export async function getInvoiceCustomization(companyId: string): Promise<InvoiceCustomizationData> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { invoiceCustomization: true },
  });

  if (!company) {
    throw new Error(`Company ${companyId} not found.`);
  }

  const existing = company.invoiceCustomization;

  return {
    id: existing?.id,
    companyId,
    template: (existing?.template as InvoiceTemplateType) || "Modern",
    primaryColor: existing?.primaryColor || "#059669",
    accentColor: existing?.accentColor || "#0f172a",
    fontFamily: existing?.fontFamily || "Inter",
    showLogo: existing?.showLogo ?? true,
    logoUrl: existing?.logoUrl || company.logo || null,
    logoWidth: existing?.logoWidth || 120,
    companyDisplayName: existing?.companyDisplayName || company.legalName || company.name,
    customAddress: existing?.customAddress || company.address || null,
    showGstin: existing?.showGstin ?? true,
    showPan: existing?.showPan ?? true,
    showBankDetails: existing?.showBankDetails ?? true,
    bankAccountName: existing?.bankAccountName || company.name,
    bankName: existing?.bankName || company.bankName || null,
    accountNo: existing?.accountNo || company.accountNo || null,
    ifscCode: existing?.ifscCode || company.ifscCode || null,
    branchName: existing?.branchName || company.branchName || null,
    showUpiQr: existing?.showUpiQr ?? true,
    upiId: existing?.upiId || company.upiId || null,
    showSignature: existing?.showSignature ?? true,
    signatureUrl: existing?.signatureUrl || null,
    signatureLabel: existing?.signatureLabel || "Authorized Signatory",
    termsAndConditions: existing?.termsAndConditions || company.terms || DEFAULT_INVOICE_CUSTOMIZATION.termsAndConditions,
    footerNotes: existing?.footerNotes || DEFAULT_INVOICE_CUSTOMIZATION.footerNotes,
    headerText: existing?.headerText || DEFAULT_INVOICE_CUSTOMIZATION.headerText,
  };
}

/**
 * Saves custom branding and invoice layout preferences.
 * Verifies plan permits custom branding if user changes colors or non-default template.
 */
export async function saveInvoiceCustomization(
  companyId: string,
  data: Partial<InvoiceCustomizationData>
): Promise<InvoiceCustomizationData> {
  // Check plan entitlement for custom branding if custom styling is applied
  const isCustomizing =
    (data.primaryColor && data.primaryColor !== "#059669") ||
    (data.template && data.template !== "Classic" && data.template !== "Modern") ||
    data.signatureUrl ||
    data.logoUrl;

  if (isCustomizing) {
    const perm = await canUseCustomBranding(companyId);
    if (!perm.allowed) {
      throw new Error(perm.reason || "Custom branding requires a Professional or Enterprise plan.");
    }
  }

  const upserted = await prisma.invoiceCustomization.upsert({
    where: { companyId },
    create: {
      companyId,
      template: data.template || "Modern",
      primaryColor: data.primaryColor || "#059669",
      accentColor: data.accentColor || "#0f172a",
      fontFamily: data.fontFamily || "Inter",
      showLogo: data.showLogo ?? true,
      logoUrl: data.logoUrl || null,
      logoWidth: data.logoWidth || 120,
      companyDisplayName: data.companyDisplayName || null,
      customAddress: data.customAddress || null,
      showGstin: data.showGstin ?? true,
      showPan: data.showPan ?? true,
      showBankDetails: data.showBankDetails ?? true,
      bankAccountName: data.bankAccountName || null,
      bankName: data.bankName || null,
      accountNo: data.accountNo || null,
      ifscCode: data.ifscCode || null,
      branchName: data.branchName || null,
      showUpiQr: data.showUpiQr ?? true,
      upiId: data.upiId || null,
      showSignature: data.showSignature ?? true,
      signatureUrl: data.signatureUrl || null,
      signatureLabel: data.signatureLabel || "Authorized Signatory",
      termsAndConditions: data.termsAndConditions || null,
      footerNotes: data.footerNotes || null,
      headerText: data.headerText || "TAX INVOICE",
    },
    update: {
      ...data,
    },
  });

  return {
    ...upserted,
    template: upserted.template as InvoiceTemplateType,
  };
}

/**
 * Returns descriptive metadata for the 6 available invoice templates.
 */
export function getTemplateDescriptors() {
  return [
    {
      id: "Modern" as InvoiceTemplateType,
      name: "Modern Clean",
      badge: "Most Popular",
      description: "Sleek contemporary look with dynamic accent banners, rounded metadata pills, and clear visual hierarchy.",
      bestFor: "Tech, Retail, Modern Brands, Consulting",
      features: ["Hero Brand Header", "Accent Border Tables", "Prominent Grand Total Box", "Quick UPI Pay Card"],
    },
    {
      id: "Classic" as InvoiceTemplateType,
      name: "Classic Corporate",
      badge: "Standard",
      description: "Formal accounting layout featuring traditional double dividers, serif headings, and structured data boxes.",
      bestFor: "Manufacturing, Trading, Law & Auditing firms",
      features: ["Double Line Borders", "Formal Ledger Grid", "Traditional Authorized Signatory", "Structured Bank Box"],
    },
    {
      id: "GST_Detailed" as InvoiceTemplateType,
      name: "GST Tax Detailed",
      badge: "Auditor Favorite",
      description: "Full Indian GST tax audit layout with explicit CGST, SGST, IGST split per item and HSN summary matrix.",
      bestFor: "GST-registered distributors, B2B Wholesalers, Exporters",
      features: ["HSN / SAC Code Matrix", "State Code & Place of Supply", "CGST / SGST / IGST breakdown", "Reverse Charge Indicator"],
    },
    {
      id: "Retail" as InvoiceTemplateType,
      name: "Retail Express",
      badge: "Compact & Fast",
      description: "Optimized for point-of-sale efficiency, compact thermal-friendly spacing, item savings, and instant QR scan.",
      bestFor: "Supermarkets, Boutiques, Hardware Shops, Pharmacies",
      features: ["Compact Spacing", "Customer Savings Highlight", "Instant UPI QR Code", "Barcode Reference"],
    },
    {
      id: "Wholesale" as InvoiceTemplateType,
      name: "Wholesale & Logistics",
      badge: "B2B Freight Ready",
      description: "Specialized for multi-carton shipments with transporter details, vehicle number, LR date, and packaging units.",
      bestFor: "FMCG Distributors, Industrial Goods, Bulk Traders",
      features: ["Vehicle & E-way Bill Info", "Dispatch Warehouse Address", "Carton / Case Counts", "Multiple Bank Accounts"],
    },
    {
      id: "Service" as InvoiceTemplateType,
      name: "Professional Service",
      badge: "Client Friendly",
      description: "Clean project-oriented layout highlighting milestones, service deliverables, hourly rates, and milestone sign-off.",
      bestFor: "Digital Agencies, Freelancers, Software Consultants, Legal",
      features: ["Milestone / Deliverable Breakdown", "Project & PO Reference", "Direct Wire Transfer Details", "Terms of Engagement"],
    },
  ];
}
