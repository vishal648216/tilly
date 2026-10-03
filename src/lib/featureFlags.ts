// Taily - Reusable Feature Flags & Company Settings Service
// Manages backend feature enforcement, database persistence, and template provisioning

import { prisma } from "./prisma";
import { BUSINESS_TEMPLATES, BusinessType } from "./businessTemplates";

export type FeatureFlagKey =
  | "inventoryEnabled"
  | "gstEnabled"
  | "warehouseEnabled"
  | "multiWarehouseEnabled"
  | "barcodeEnabled"
  | "batchEnabled"
  | "expiryEnabled"
  | "serialEnabled"
  | "manufacturingEnabled"
  | "quotationEnabled"
  | "salesOrderEnabled"
  | "purchaseOrderEnabled"
  | "deliveryChallanEnabled"
  | "goodsReceiptEnabled"
  | "salespersonEnabled"
  | "priceListsEnabled"
  | "negativeStockAllowed"
  | "taxInclusivePricing"
  | "roundOffEnabled"
  | "creditLimitBlock"
  | "duplicateSupplierInvoiceBlock";

export interface CompanySettingsData {
  inventoryEnabled: boolean;
  gstEnabled: boolean;
  warehouseEnabled: boolean;
  multiWarehouseEnabled: boolean;
  barcodeEnabled: boolean;
  batchEnabled: boolean;
  expiryEnabled: boolean;
  serialEnabled: boolean;
  manufacturingEnabled: boolean;
  quotationEnabled: boolean;
  salesOrderEnabled: boolean;
  purchaseOrderEnabled: boolean;
  deliveryChallanEnabled: boolean;
  goodsReceiptEnabled: boolean;
  salespersonEnabled: boolean;
  priceListsEnabled: boolean;
  negativeStockAllowed: boolean;
  taxInclusivePricing: boolean;
  roundOffEnabled: boolean;
  creditLimitBlock: boolean;
  duplicateSupplierInvoiceBlock: boolean;
  featuresConfig?: string | null;
}

export const DEFAULT_SETTINGS: CompanySettingsData = {
  inventoryEnabled: true,
  gstEnabled: true,
  warehouseEnabled: false,
  multiWarehouseEnabled: false,
  barcodeEnabled: false,
  batchEnabled: false,
  expiryEnabled: false,
  serialEnabled: false,
  manufacturingEnabled: false,
  quotationEnabled: false,
  salesOrderEnabled: false,
  purchaseOrderEnabled: false,
  deliveryChallanEnabled: false,
  goodsReceiptEnabled: false,
  salespersonEnabled: false,
  priceListsEnabled: false,
  negativeStockAllowed: false,
  taxInclusivePricing: false,
  roundOffEnabled: true,
  creditLimitBlock: false,
  duplicateSupplierInvoiceBlock: true,
};

/**
 * Retrieves the CompanySettings for a given company.
 * If no settings row exists yet, it creates one seeded with the company's business template defaults.
 */
export async function getCompanySettings(
  companyId: string,
  tx: any = prisma
): Promise<CompanySettingsData> {
  const existing = await tx.companySettings.findUnique({
    where: { companyId },
  });

  if (existing) {
    return {
      inventoryEnabled: existing.inventoryEnabled,
      gstEnabled: existing.gstEnabled,
      warehouseEnabled: existing.warehouseEnabled,
      multiWarehouseEnabled: existing.multiWarehouseEnabled,
      barcodeEnabled: existing.barcodeEnabled,
      batchEnabled: existing.batchEnabled,
      expiryEnabled: existing.expiryEnabled,
      serialEnabled: existing.serialEnabled,
      manufacturingEnabled: existing.manufacturingEnabled,
      quotationEnabled: existing.quotationEnabled,
      salesOrderEnabled: existing.salesOrderEnabled,
      purchaseOrderEnabled: existing.purchaseOrderEnabled,
      deliveryChallanEnabled: existing.deliveryChallanEnabled,
      goodsReceiptEnabled: existing.goodsReceiptEnabled,
      salespersonEnabled: existing.salespersonEnabled,
      priceListsEnabled: existing.priceListsEnabled,
      negativeStockAllowed: existing.negativeStockAllowed,
      taxInclusivePricing: existing.taxInclusivePricing,
      roundOffEnabled: existing.roundOffEnabled,
      creditLimitBlock: existing.creditLimitBlock ?? false,
      duplicateSupplierInvoiceBlock: existing.duplicateSupplierInvoiceBlock ?? true,
      featuresConfig: existing.featuresConfig,
    };
  }

  // Find company to check businessType
  const company = await tx.company.findUnique({
    where: { id: companyId },
    select: { businessType: true },
  });

  const bType = (company?.businessType as BusinessType) || "Retail";
  const template = BUSINESS_TEMPLATES[bType] || BUSINESS_TEMPLATES.Retail;

  const created = await tx.companySettings.create({
    data: {
      companyId,
      ...template.settings,
    },
  });

  return created;
}

/**
 * Updates or sets specific settings flags for a company.
 */
export async function updateCompanySettings(
  companyId: string,
  data: Partial<CompanySettingsData>,
  tx: any = prisma
): Promise<CompanySettingsData> {
  const updated = await tx.companySettings.upsert({
    where: { companyId },
    create: {
      companyId,
      ...DEFAULT_SETTINGS,
      ...data,
    },
    update: {
      ...data,
    },
  });
  return updated;
}

/**
 * Checks if a specific feature is enabled for a given company.
 */
export async function isFeatureEnabled(
  companyId: string,
  feature: FeatureFlagKey,
  tx: any = prisma
): Promise<boolean> {
  const settings = await getCompanySettings(companyId, tx);
  return Boolean(settings[feature]);
}

/**
 * Backend Feature Enforcement Guard.
 * Throws an Error with 403 status code if a feature is disabled.
 */
export async function requireFeature(
  companyId: string,
  feature: FeatureFlagKey,
  tx: any = prisma
): Promise<void> {
  const enabled = await isFeatureEnabled(companyId, feature, tx);
  if (!enabled) {
    const error: any = new Error(
      `Feature '${feature}' is currently disabled for this company. Please enable it in Settings.`
    );
    error.statusCode = 403;
    error.feature = feature;
    throw error;
  }
}

/**
 * Applies a complete business template to a company, updating its businessType,
 * industry, settings flags, and automatically provisioning industry-specific custom fields.
 */
export async function applyBusinessTemplate(
  companyId: string,
  templateType: BusinessType,
  tx: any = prisma
) {
  const template = BUSINESS_TEMPLATES[templateType];
  if (!template) {
    throw new Error(`Invalid business template type: ${templateType}`);
  }

  // 1. Update Company metadata
  await tx.company.update({
    where: { id: companyId },
    data: {
      businessType: template.id,
      industry: template.industry,
    },
  });

  // 2. Upsert CompanySettings
  const updatedSettings = await tx.companySettings.upsert({
    where: { companyId },
    create: {
      companyId,
      ...template.settings,
    },
    update: {
      ...template.settings,
    },
  });

  // 3. Provision Default Custom Fields if any
  if (template.defaultCustomFields && template.defaultCustomFields.length > 0) {
    for (const field of template.defaultCustomFields) {
      await tx.customFieldDefinition.upsert({
        where: {
          companyId_entityType_fieldName: {
            companyId,
            entityType: field.entityType,
            fieldName: field.fieldName,
          },
        },
        create: {
          companyId,
          entityType: field.entityType,
          fieldName: field.fieldName,
          fieldLabel: field.fieldLabel,
          fieldType: field.fieldType,
          isRequired: field.isRequired || false,
          options: field.options ? JSON.stringify(field.options) : null,
        },
        update: {
          fieldLabel: field.fieldLabel,
          fieldType: field.fieldType,
          options: field.options ? JSON.stringify(field.options) : null,
        },
      });
    }
  }

  return { ok: true, template, settings: updatedSettings };
}
