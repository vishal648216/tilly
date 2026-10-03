// Taily - Multi-Industry Business Templates Engine
// Preconfigures module visibility, feature flags, and custom fields per industry

export type BusinessType =
  | "Retail"
  | "Wholesale"
  | "Distributor"
  | "Service"
  | "Restaurant"
  | "Garments"
  | "Electronics"
  | "Hardware"
  | "Pharmacy/Cosmetics"
  | "Manufacturing"
  | "Custom";

export interface BusinessTemplateConfig {
  id: BusinessType;
  name: string;
  industry: string;
  description: string;
  settings: {
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
  };
  defaultCustomFields?: Array<{
    entityType: "CUSTOMER" | "SUPPLIER" | "PRODUCT" | "INVOICE" | "EXPENSE";
    fieldName: string;
    fieldLabel: string;
    fieldType: "TEXT" | "NUMBER" | "DATE" | "SELECT" | "BOOLEAN";
    isRequired?: boolean;
    options?: string[];
  }>;
}

export const BUSINESS_TEMPLATES: Record<BusinessType, BusinessTemplateConfig> = {
  Retail: {
    id: "Retail",
    name: "Retail Store / Shop",
    industry: "Retail & Consumer Goods",
    description: "Ideal for retail counters, grocery stores, supermarkets, and general stores with barcode scanning and low-stock alerts.",
    settings: {
      inventoryEnabled: true,
      gstEnabled: true,
      warehouseEnabled: false,
      multiWarehouseEnabled: false,
      barcodeEnabled: true,
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
    },
  },
  Service: {
    id: "Service",
    name: "Professional / IT / Agency Services",
    industry: "Services & Consulting",
    description: "Designed for consultants, agencies, freelancing firms, and repair services. Disables physical inventory, stock ledgers, and warehouses.",
    settings: {
      inventoryEnabled: false,
      gstEnabled: true,
      warehouseEnabled: false,
      multiWarehouseEnabled: false,
      barcodeEnabled: false,
      batchEnabled: false,
      expiryEnabled: false,
      serialEnabled: false,
      manufacturingEnabled: false,
      quotationEnabled: true,
      salesOrderEnabled: false,
      purchaseOrderEnabled: false,
      deliveryChallanEnabled: false,
      goodsReceiptEnabled: false,
      salespersonEnabled: false,
      priceListsEnabled: false,
      negativeStockAllowed: false,
      taxInclusivePricing: false,
      roundOffEnabled: true,
    },
    defaultCustomFields: [
      {
        entityType: "INVOICE",
        fieldName: "project_code",
        fieldLabel: "Project Code / Milestone",
        fieldType: "TEXT",
      },
      {
        entityType: "CUSTOMER",
        fieldName: "client_poc",
        fieldLabel: "Client Project Manager",
        fieldType: "TEXT",
      },
    ],
  },
  Distributor: {
    id: "Distributor",
    name: "Wholesale & FMCG Distribution",
    industry: "Distribution & Logistics",
    description: "Built for distributors managing multiple godowns/warehouses, sales executives, credit terms, and tiered dealer pricing.",
    settings: {
      inventoryEnabled: true,
      gstEnabled: true,
      warehouseEnabled: true,
      multiWarehouseEnabled: true,
      barcodeEnabled: true,
      batchEnabled: true,
      expiryEnabled: false,
      serialEnabled: false,
      manufacturingEnabled: false,
      quotationEnabled: true,
      salesOrderEnabled: true,
      purchaseOrderEnabled: true,
      deliveryChallanEnabled: true,
      goodsReceiptEnabled: true,
      salespersonEnabled: true,
      priceListsEnabled: true,
      negativeStockAllowed: false,
      taxInclusivePricing: false,
      roundOffEnabled: true,
    },
    defaultCustomFields: [
      {
        entityType: "CUSTOMER",
        fieldName: "route_beat",
        fieldLabel: "Route / Beat Name",
        fieldType: "TEXT",
      },
      {
        entityType: "INVOICE",
        fieldName: "dispatch_vehicle_no",
        fieldLabel: "Dispatch Vehicle No.",
        fieldType: "TEXT",
      },
    ],
  },
  Garments: {
    id: "Garments",
    name: "Apparel & Garment Boutique",
    industry: "Fashion & Textile",
    description: "Equipped for clothing brands and apparel retailers requiring multi-attribute variants (Size, Color, Fabric, Fit).",
    settings: {
      inventoryEnabled: true,
      gstEnabled: true,
      warehouseEnabled: false,
      multiWarehouseEnabled: false,
      barcodeEnabled: true,
      batchEnabled: false,
      expiryEnabled: false,
      serialEnabled: false,
      manufacturingEnabled: false,
      quotationEnabled: false,
      salesOrderEnabled: false,
      purchaseOrderEnabled: false,
      deliveryChallanEnabled: false,
      goodsReceiptEnabled: false,
      salespersonEnabled: true,
      priceListsEnabled: true,
      negativeStockAllowed: false,
      taxInclusivePricing: false,
      roundOffEnabled: true,
    },
    defaultCustomFields: [
      {
        entityType: "PRODUCT",
        fieldName: "fabric_type",
        fieldLabel: "Fabric / Material",
        fieldType: "TEXT",
      },
      {
        entityType: "PRODUCT",
        fieldName: "season_collection",
        fieldLabel: "Season / Collection",
        fieldType: "SELECT",
        options: ["Summer 2026", "Monsoon 2026", "Winter 2026", "Festive", "All-Season"],
      },
    ],
  },
  Electronics: {
    id: "Electronics",
    name: "Electronics, Mobile & IT Hardware",
    industry: "Consumer Electronics & Appliances",
    description: "Tailored for electronics stores requiring brand, model, serial number, warranty duration, and IMEI tracking.",
    settings: {
      inventoryEnabled: true,
      gstEnabled: true,
      warehouseEnabled: false,
      multiWarehouseEnabled: false,
      barcodeEnabled: true,
      batchEnabled: false,
      expiryEnabled: false,
      serialEnabled: true,
      manufacturingEnabled: false,
      quotationEnabled: true,
      salesOrderEnabled: false,
      purchaseOrderEnabled: false,
      deliveryChallanEnabled: false,
      goodsReceiptEnabled: false,
      salespersonEnabled: true,
      priceListsEnabled: false,
      negativeStockAllowed: false,
      taxInclusivePricing: false,
      roundOffEnabled: true,
    },
    defaultCustomFields: [
      {
        entityType: "PRODUCT",
        fieldName: "warranty_terms",
        fieldLabel: "Warranty Coverage (Months/Years)",
        fieldType: "TEXT",
      },
    ],
  },
  Restaurant: {
    id: "Restaurant",
    name: "Restaurant, Cafe & Cloud Kitchen",
    industry: "Food & Beverage",
    description: "Configured for quick service food billing, table numbers, tax-inclusive pricing, and food raw material purchasing.",
    settings: {
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
      salespersonEnabled: true,
      priceListsEnabled: false,
      negativeStockAllowed: true,
      taxInclusivePricing: true,
      roundOffEnabled: true,
    },
    defaultCustomFields: [
      {
        entityType: "INVOICE",
        fieldName: "table_no",
        fieldLabel: "Table / Order Token No.",
        fieldType: "TEXT",
      },
      {
        entityType: "INVOICE",
        fieldName: "waiter_name",
        fieldLabel: "Steward / Server Name",
        fieldType: "TEXT",
      },
    ],
  },
  Manufacturing: {
    id: "Manufacturing",
    name: "Production & Manufacturing Unit",
    industry: "Manufacturing & Industrial",
    description: "Configured for production plants tracking raw material inventory, bill of materials (BOM), finished goods, and wastage.",
    settings: {
      inventoryEnabled: true,
      gstEnabled: true,
      warehouseEnabled: true,
      multiWarehouseEnabled: true,
      barcodeEnabled: true,
      batchEnabled: true,
      expiryEnabled: false,
      serialEnabled: false,
      manufacturingEnabled: true,
      quotationEnabled: true,
      salesOrderEnabled: true,
      purchaseOrderEnabled: true,
      deliveryChallanEnabled: true,
      goodsReceiptEnabled: true,
      salespersonEnabled: false,
      priceListsEnabled: true,
      negativeStockAllowed: false,
      taxInclusivePricing: false,
      roundOffEnabled: true,
    },
    defaultCustomFields: [
      {
        entityType: "PRODUCT",
        fieldName: "batch_yield_rate",
        fieldLabel: "Standard Batch Yield %",
        fieldType: "NUMBER",
      },
    ],
  },
  Wholesale: {
    id: "Wholesale",
    name: "Wholesale Trader & Merchant",
    industry: "Wholesale Trade",
    description: "Focuses on bulk volumes, customer credit limits, multi-tier pricing, and payment term tracking.",
    settings: {
      inventoryEnabled: true,
      gstEnabled: true,
      warehouseEnabled: true,
      multiWarehouseEnabled: false,
      barcodeEnabled: true,
      batchEnabled: false,
      expiryEnabled: false,
      serialEnabled: false,
      manufacturingEnabled: false,
      quotationEnabled: true,
      salesOrderEnabled: true,
      purchaseOrderEnabled: true,
      deliveryChallanEnabled: true,
      goodsReceiptEnabled: false,
      salespersonEnabled: true,
      priceListsEnabled: true,
      negativeStockAllowed: false,
      taxInclusivePricing: false,
      roundOffEnabled: true,
    },
  },
  Hardware: {
    id: "Hardware",
    name: "Hardware, Electrical & Sanitary",
    industry: "Hardware & Building Materials",
    description: "Supports diverse units of measurement (Kgs, Meters, Bundles, Pcs), contractor ledgers, and trade pricing.",
    settings: {
      inventoryEnabled: true,
      gstEnabled: true,
      warehouseEnabled: true,
      multiWarehouseEnabled: false,
      barcodeEnabled: true,
      batchEnabled: false,
      expiryEnabled: false,
      serialEnabled: false,
      manufacturingEnabled: false,
      quotationEnabled: true,
      salesOrderEnabled: false,
      purchaseOrderEnabled: false,
      deliveryChallanEnabled: true,
      goodsReceiptEnabled: false,
      salespersonEnabled: false,
      priceListsEnabled: true,
      negativeStockAllowed: false,
      taxInclusivePricing: false,
      roundOffEnabled: true,
    },
  },
  "Pharmacy/Cosmetics": {
    id: "Pharmacy/Cosmetics",
    name: "Pharmacy, Chemist & Cosmetics",
    industry: "Healthcare & Pharmaceuticals",
    description: "Strictly tracks drug batches, expiry dates, supplier drug license numbers, and salt composition.",
    settings: {
      inventoryEnabled: true,
      gstEnabled: true,
      warehouseEnabled: false,
      multiWarehouseEnabled: false,
      barcodeEnabled: true,
      batchEnabled: true,
      expiryEnabled: true,
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
    },
    defaultCustomFields: [
      {
        entityType: "PRODUCT",
        fieldName: "salt_composition",
        fieldLabel: "Generic / Salt Composition",
        fieldType: "TEXT",
      },
      {
        entityType: "SUPPLIER",
        fieldName: "drug_license_no",
        fieldLabel: "Drug License No. (DL)",
        fieldType: "TEXT",
      },
      {
        entityType: "CUSTOMER",
        fieldName: "doctor_registration",
        fieldLabel: "Prescribing Doctor / Reg No.",
        fieldType: "TEXT",
      },
    ],
  },
  Custom: {
    id: "Custom",
    name: "Custom / Flexible Setup",
    industry: "General Business",
    description: "Unrestricted configuration. Customize every single module, feature flag, and field according to your specific enterprise workflows.",
    settings: {
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
    },
  },
};
