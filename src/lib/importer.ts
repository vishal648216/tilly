import { prisma } from "./prisma";
import { checkCompanyStatus, canCreateProduct, recordUsage } from "./subscriptionEnforcement";
import * as XLSX from "xlsx";

export type ImportEntityType =
  | "PRODUCTS"
  | "CUSTOMERS"
  | "SUPPLIERS"
  | "OPENING_STOCK"
  | "OPENING_BALANCES";

export interface ImportErrorDetail {
  row: number;
  field: string;
  value: any;
  error: string;
  suggestedCorrection: string;
}

export interface ValidationResult {
  valid: boolean;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  errors: ImportErrorDetail[];
  previewRows: Array<Record<string, any>>;
}

export interface ImportExecutionResult {
  success: boolean;
  totalRows: number;
  importedCount: number;
  failedCount: number;
  errors: ImportErrorDetail[];
  importedIds: string[];
}

/**
 * Standard field aliases for fuzzy/flexible column mapping.
 */
export const DEFAULT_COLUMN_MAPPINGS: Record<ImportEntityType, Record<string, string[]>> = {
  PRODUCTS: {
    name: ["name", "item name", "product name", "item", "description", "title"],
    sku: ["sku", "item code", "code", "product code"],
    barcode: ["barcode", "upc", "ean", "bar code"],
    category: ["category", "item category", "group"],
    brand: ["brand", "make", "manufacturer"],
    unit: ["unit", "uom", "unit of measure"],
    hsn: ["hsn", "hsn code", "sac", "hsn/sac"],
    salePrice: ["sale price", "saleprice", "selling price", "retail price", "price", "rate"],
    purchasePrice: ["purchase price", "cost price", "cost", "buying price"],
    mrp: ["mrp", "max retail price"],
    gstRate: ["gst rate", "gst", "tax rate", "tax %", "gst %"],
    minStock: ["min stock", "minimum stock", "reorder level"],
    openingStock: ["opening stock", "initial stock", "stock", "quantity", "qty"],
    openingStockCost: ["opening stock cost", "stock cost", "initial cost", "unit cost"],
  },
  CUSTOMERS: {
    name: ["name", "customer name", "party name", "client name", "business name"],
    email: ["email", "email address", "mail"],
    phone: ["phone", "mobile", "contact", "phone number", "tel"],
    gstin: ["gstin", "gst no", "gst number", "tax id"],
    pan: ["pan", "pan no", "pan number"],
    address: ["address", "street", "billing address"],
    city: ["city", "town"],
    state: ["state", "province"],
    pincode: ["pincode", "zip", "postal code", "pin"],
    creditLimit: ["credit limit", "max credit"],
    creditDays: ["credit days", "payment terms", "due days"],
    openingBalance: ["opening balance", "balance", "opening balance amount"],
  },
  SUPPLIERS: {
    name: ["name", "supplier name", "vendor name", "party name"],
    email: ["email", "email address"],
    phone: ["phone", "mobile", "contact", "phone number"],
    gstin: ["gstin", "gst no", "gst number"],
    pan: ["pan", "pan no"],
    address: ["address", "street"],
    city: ["city"],
    state: ["state"],
    pincode: ["pincode", "zip", "pin"],
    openingBalance: ["opening balance", "balance"],
  },
  OPENING_STOCK: {
    identifier: ["sku", "item code", "barcode", "name", "item name", "product"],
    warehouse: ["warehouse", "warehouse name", "godown", "location", "branch"],
    quantity: ["quantity", "qty", "stock", "opening stock"],
    unitCost: ["unit cost", "cost", "purchase rate", "rate"],
    batchNumber: ["batch", "batch no", "batch number"],
    expiryDate: ["expiry", "expiry date", "exp date"],
  },
  OPENING_BALANCES: {
    identifier: ["account code", "account name", "party name", "code", "ledger"],
    type: ["type", "dr/cr", "debit/credit", "balance type"],
    amount: ["amount", "balance", "opening balance"],
  },
};

/**
 * Robust CSV/XLSX buffer parser into array of row objects.
 */
export function parseSpreadsheetBuffer(buffer: Buffer, originalFilename: string): Array<Record<string, any>> {
  const isCsv = originalFilename.toLowerCase().endsWith(".csv");
  if (isCsv) {
    return parseCsvString(buffer.toString("utf-8"));
  }

  // Use SheetJS (xlsx) for binary formats (.xlsx, .xls, .ods)
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
}

/**
 * RFC 4180 compliant CSV text parser.
 */
export function parseCsvString(csvText: string): Array<Record<string, any>> {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  const normalized = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if (char === "\n" && !insideQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some((c) => c !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((c) => c !== "")) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const data: Array<Record<string, any>> = [];

  for (let r = 1; r < rows.length; r++) {
    const rowValues = rows[r];
    const rowObj: Record<string, any> = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (header) {
        rowObj[header] = rowValues[c] !== undefined ? rowValues[c] : "";
      }
    }
    data.push(rowObj);
  }

  return data;
}

/**
 * Automatically maps input raw columns to standard entity fields using aliases.
 */
export function autoMapColumns(
  entityType: ImportEntityType,
  rawColumns: string[]
): Record<string, string> {
  const aliases = DEFAULT_COLUMN_MAPPINGS[entityType] || {};
  const mapping: Record<string, string> = {};

  for (const rawCol of rawColumns) {
    const normalized = rawCol.toLowerCase().trim();
    let matchedField: string | null = null;

    for (const [field, aliasList] of Object.entries(aliases)) {
      if (normalized === field.toLowerCase() || aliasList.includes(normalized)) {
        matchedField = field;
        break;
      }
    }

    if (matchedField) {
      mapping[matchedField] = rawCol;
    }
  }

  return mapping;
}

/**
 * Validate imported rows strictly against database constraints, business rules, and formats.
 */
export async function validateImportRows(
  companyId: string,
  entityType: ImportEntityType,
  rows: Array<Record<string, any>>,
  columnMapping: Record<string, string>
): Promise<ValidationResult> {
  const errors: ImportErrorDetail[] = [];
  const previewRows: Array<Record<string, any>> = [];

  // Helper to extract value using mapping
  const getValue = (row: Record<string, any>, standardField: string) => {
    const rawHeader = columnMapping[standardField] || standardField;
    const val = row[rawHeader];
    return val !== undefined && val !== null ? String(val).trim() : "";
  };

  const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  // Pre-fetch caches for foreign key lookups & uniqueness
  const existingItems = await prisma.item.findMany({
    where: { companyId },
    select: { id: true, name: true, sku: true, barcode: true },
  });
  const existingParties = await prisma.party.findMany({
    where: { companyId },
    select: { id: true, name: true, gstin: true, phone: true },
  });
  const existingWarehouses = await prisma.warehouse.findMany({
    where: { companyId },
    select: { id: true, name: true, code: true },
  });
  const existingAccounts = await prisma.account.findMany({
    where: { companyId },
    select: { id: true, code: true, name: true },
  });

  const seenSkusInFile = new Set<string>();
  const seenPartyNamesInFile = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // Row 1 is header
    const row = rows[i];
    const transformed: Record<string, any> = {};

    if (entityType === "PRODUCTS") {
      const name = getValue(row, "name");
      const sku = getValue(row, "sku");
      const barcode = getValue(row, "barcode");
      const salePriceStr = getValue(row, "salePrice");
      const purchasePriceStr = getValue(row, "purchasePrice");
      const gstRateStr = getValue(row, "gstRate");
      const openingStockStr = getValue(row, "openingStock");

      if (!name) {
        errors.push({
          row: rowNum,
          field: "name",
          value: name,
          error: "Product Name is required.",
          suggestedCorrection: "Enter a valid product title (e.g., 'Wireless Mouse').",
        });
      }

      if (sku) {
        if (seenSkusInFile.has(sku.toLowerCase())) {
          errors.push({
            row: rowNum,
            field: "sku",
            value: sku,
            error: `Duplicate SKU '${sku}' found multiple times in this import file.`,
            suggestedCorrection: "Ensure every product has a unique SKU code.",
          });
        }
        seenSkusInFile.add(sku.toLowerCase());

        const existing = existingItems.find((it) => it.sku?.toLowerCase() === sku.toLowerCase());
        if (existing) {
          errors.push({
            row: rowNum,
            field: "sku",
            value: sku,
            error: `SKU '${sku}' already exists in company catalog for item '${existing.name}'.`,
            suggestedCorrection: "Use a new unique SKU or update existing item directly.",
          });
        }
      }

      if (salePriceStr && isNaN(Number(salePriceStr))) {
        errors.push({
          row: rowNum,
          field: "salePrice",
          value: salePriceStr,
          error: "Sale Price must be a valid number.",
          suggestedCorrection: "Provide a numeric value like 499.00 without currency symbols.",
        });
      }

      if (purchasePriceStr && isNaN(Number(purchasePriceStr))) {
        errors.push({
          row: rowNum,
          field: "purchasePrice",
          value: purchasePriceStr,
          error: "Purchase Price must be a valid number.",
          suggestedCorrection: "Provide a numeric value like 250.00.",
        });
      }

      if (gstRateStr) {
        const gst = Number(gstRateStr);
        const validRates = [0, 5, 12, 18, 28];
        if (isNaN(gst) || !validRates.includes(gst)) {
          errors.push({
            row: rowNum,
            field: "gstRate",
            value: gstRateStr,
            error: `Invalid GST Rate '${gstRateStr}'. Must be standard rate.`,
            suggestedCorrection: "Use one of: 0, 5, 12, 18, 28.",
          });
        }
      }

      if (openingStockStr && isNaN(Number(openingStockStr))) {
        errors.push({
          row: rowNum,
          field: "openingStock",
          value: openingStockStr,
          error: "Opening Stock must be a valid numeric quantity.",
          suggestedCorrection: "Enter quantity as a number, e.g., 50.",
        });
      }

      transformed.name = name;
      transformed.sku = sku;
      transformed.barcode = barcode;
      transformed.salePrice = Number(salePriceStr) || 0;
      transformed.purchasePrice = Number(purchasePriceStr) || 0;
      transformed.gstRate = Number(gstRateStr) || 0;
      transformed.openingStock = Number(openingStockStr) || 0;
    } else if (entityType === "CUSTOMERS" || entityType === "SUPPLIERS") {
      const name = getValue(row, "name");
      const phone = getValue(row, "phone");
      const email = getValue(row, "email");
      const gstin = getValue(row, "gstin").toUpperCase();
      const openingBalanceStr = getValue(row, "openingBalance");

      if (!name) {
        errors.push({
          row: rowNum,
          field: "name",
          value: name,
          error: "Party Name is required.",
          suggestedCorrection: "Enter the customer or vendor business name.",
        });
      }

      if (name && seenPartyNamesInFile.has(name.toLowerCase())) {
        errors.push({
          row: rowNum,
          field: "name",
          value: name,
          error: `Duplicate party name '${name}' found multiple times in import file.`,
          suggestedCorrection: "Combine rows or use distinct names/branch codes.",
        });
      }
      if (name) seenPartyNamesInFile.add(name.toLowerCase());

      if (gstin && !gstPattern.test(gstin)) {
        errors.push({
          row: rowNum,
          field: "gstin",
          value: gstin,
          error: `Invalid Indian GSTIN format '${gstin}'.`,
          suggestedCorrection: "Format: 2 digits state code + 10 chars PAN + 1 entity + 1 'Z' + 1 check char (e.g., '27AAACP1234A1Z5').",
        });
      }

      if (openingBalanceStr && isNaN(Number(openingBalanceStr))) {
        errors.push({
          row: rowNum,
          field: "openingBalance",
          value: openingBalanceStr,
          error: "Opening Balance must be numeric.",
          suggestedCorrection: "Enter positive number for debit / receivable, or negative for credit / payable.",
        });
      }

      transformed.name = name;
      transformed.phone = phone;
      transformed.email = email;
      transformed.gstin = gstin;
      transformed.openingBalance = Number(openingBalanceStr) || 0;
    } else if (entityType === "OPENING_STOCK") {
      const identifier = getValue(row, "identifier");
      const warehouseName = getValue(row, "warehouse");
      const qtyStr = getValue(row, "quantity");
      const unitCostStr = getValue(row, "unitCost");

      if (!identifier) {
        errors.push({
          row: rowNum,
          field: "identifier",
          value: identifier,
          error: "Product SKU or Name identifier is required.",
          suggestedCorrection: "Specify existing item SKU or Name to apply opening inventory.",
        });
      } else {
        const itemMatch = existingItems.find(
          (it) =>
            it.sku?.toLowerCase() === identifier.toLowerCase() ||
            it.name.toLowerCase() === identifier.toLowerCase() ||
            it.barcode?.toLowerCase() === identifier.toLowerCase()
        );
        if (!itemMatch) {
          errors.push({
            row: rowNum,
            field: "identifier",
            value: identifier,
            error: `Item '${identifier}' not found in catalog.`,
            suggestedCorrection: "Import products first or correct SKU/name.",
          });
        } else {
          transformed.itemId = itemMatch.id;
          transformed.itemName = itemMatch.name;
        }
      }

      let warehouseId: string | null = null;
      if (warehouseName) {
        const whMatch = existingWarehouses.find(
          (w) =>
            w.name.toLowerCase() === warehouseName.toLowerCase() ||
            w.code?.toLowerCase() === warehouseName.toLowerCase()
        );
        if (!whMatch) {
          errors.push({
            row: rowNum,
            field: "warehouse",
            value: warehouseName,
            error: `Warehouse '${warehouseName}' not found.`,
            suggestedCorrection: "Create warehouse in settings first or use default warehouse name.",
          });
        } else {
          warehouseId = whMatch.id;
        }
      } else {
        warehouseId = existingWarehouses[0]?.id || null;
      }
      transformed.warehouseId = warehouseId;

      const qty = Number(qtyStr);
      if (isNaN(qty) || qty <= 0) {
        errors.push({
          row: rowNum,
          field: "quantity",
          value: qtyStr,
          error: "Opening quantity must be a positive number.",
          suggestedCorrection: "Enter quantity > 0 (e.g., 25).",
        });
      }
      transformed.quantity = qty || 0;

      const cost = Number(unitCostStr);
      if (unitCostStr && isNaN(cost)) {
        errors.push({
          row: rowNum,
          field: "unitCost",
          value: unitCostStr,
          error: "Unit Cost must be a valid number.",
          suggestedCorrection: "Enter unit purchase cost (e.g., 120.00).",
        });
      }
      transformed.unitCost = cost || 0;
    } else if (entityType === "OPENING_BALANCES") {
      const identifier = getValue(row, "identifier");
      const typeStr = getValue(row, "type").toUpperCase();
      const amountStr = getValue(row, "amount");

      if (!identifier) {
        errors.push({
          row: rowNum,
          field: "identifier",
          value: identifier,
          error: "Account Code or Party Name is required.",
          suggestedCorrection: "Provide Account Code (e.g., '1001') or Customer/Vendor name.",
        });
      } else {
        const accMatch = existingAccounts.find(
          (a) => a.code === identifier || a.name.toLowerCase() === identifier.toLowerCase()
        );
        const partyMatch = existingParties.find(
          (p) => p.name.toLowerCase() === identifier.toLowerCase()
        );

        if (!accMatch && !partyMatch) {
          errors.push({
            row: rowNum,
            field: "identifier",
            value: identifier,
            error: `Neither Account nor Party found matching '${identifier}'.`,
            suggestedCorrection: "Verify chart of accounts code or party master name.",
          });
        } else {
          transformed.targetType = accMatch ? "ACCOUNT" : "PARTY";
          transformed.targetId = accMatch ? accMatch.id : partyMatch!.id;
          transformed.targetName = accMatch ? accMatch.name : partyMatch!.name;
        }
      }

      if (typeStr && !["DR", "CR", "DEBIT", "CREDIT"].includes(typeStr)) {
        errors.push({
          row: rowNum,
          field: "type",
          value: typeStr,
          error: "Balance type must be DR (Debit) or CR (Credit).",
          suggestedCorrection: "Specify 'DR' for receivables/assets or 'CR' for payables/liabilities.",
        });
      }

      const amount = Number(amountStr);
      if (isNaN(amount) || amount <= 0) {
        errors.push({
          row: rowNum,
          field: "amount",
          value: amountStr,
          error: "Opening balance amount must be positive number.",
          suggestedCorrection: "Enter amount > 0. Use 'DR' or 'CR' column for direction.",
        });
      }
      transformed.amount = amount || 0;
      transformed.balanceType = typeStr.startsWith("C") ? "CREDIT" : "DEBIT";
    }

    if (previewRows.length < 10) {
      previewRows.push({ ...row, _rowNum: rowNum, _hasError: errors.some((e) => e.row === rowNum) });
    }
  }

  const validRowsCount = rows.length - new Set(errors.map((e) => e.row)).size;
  const invalidRowsCount = rows.length - validRowsCount;

  return {
    valid: errors.length === 0,
    totalRows: rows.length,
    validRowsCount,
    invalidRowsCount,
    errors,
    previewRows,
  };
}

/**
 * Execute actual import with database transaction integrity.
 * If requireAllValid is true, rolls back if any row is invalid.
 */
export async function executeImport(
  companyId: string,
  entityType: ImportEntityType,
  rows: Array<Record<string, any>>,
  columnMapping: Record<string, string>,
  requireAllValid = true
): Promise<ImportExecutionResult> {
  await checkCompanyStatus(companyId);

  const validation = await validateImportRows(companyId, entityType, rows, columnMapping);

  if (requireAllValid && !validation.valid) {
    return {
      success: false,
      totalRows: rows.length,
      importedCount: 0,
      failedCount: rows.length,
      errors: validation.errors,
      importedIds: [],
    };
  }

  const errorRowIndices = new Set(validation.errors.map((e) => e.row - 2));
  const importedIds: string[] = [];

  const getValue = (row: Record<string, any>, standardField: string) => {
    const rawHeader = columnMapping[standardField] || standardField;
    const val = row[rawHeader];
    return val !== undefined && val !== null ? String(val).trim() : "";
  };

  // Execute in Prisma Transaction for atomicity and double-entry consistency
  await prisma.$transaction(async (tx) => {
    // Default warehouse fallback
    let defaultWarehouse = await tx.warehouse.findFirst({
      where: { companyId, isDefault: true },
    });
    if (!defaultWarehouse) {
      defaultWarehouse = await tx.warehouse.findFirst({ where: { companyId } });
      if (!defaultWarehouse) {
        defaultWarehouse = await tx.warehouse.create({
          data: {
            companyId,
            name: "Main Warehouse",
            code: "MAIN",
            isDefault: true,
          },
        });
      }
    }

    // Default Capital / Opening Balance Equity Account (3001)
    let capitalAccount = await tx.account.findFirst({
      where: { companyId, code: "3001" },
    });
    if (!capitalAccount) {
      capitalAccount = await tx.account.findFirst({
        where: { companyId, type: "EQUITY" },
      });
    }

    // Default Stock in Hand Account (1200)
    let stockAccount = await tx.account.findFirst({
      where: { companyId, code: "1200" },
    });

    for (let i = 0; i < rows.length; i++) {
      if (errorRowIndices.has(i)) continue; // skip invalid rows if partial import allowed
      const row = rows[i];

      if (entityType === "PRODUCTS") {
        await canCreateProduct(companyId);
        const name = getValue(row, "name");
        const sku = getValue(row, "sku") || undefined;
        const barcode = getValue(row, "barcode") || undefined;
        const category = getValue(row, "category") || undefined;
        const brand = getValue(row, "brand") || undefined;
        const unit = getValue(row, "unit") || "PCS";
        const hsn = getValue(row, "hsn") || undefined;
        const salePrice = Number(getValue(row, "salePrice")) || 0;
        const purchasePrice = Number(getValue(row, "purchasePrice")) || 0;
        const mrp = Number(getValue(row, "mrp")) || salePrice;
        const gstRate = Number(getValue(row, "gstRate")) || 0;
        const minStock = Number(getValue(row, "minStock")) || 0;
        const openingStock = Number(getValue(row, "openingStock")) || 0;
        const openingStockCost = Number(getValue(row, "openingStockCost")) || purchasePrice;

        const createdItem = await tx.item.create({
          data: {
            companyId,
            name,
            sku,
            barcode,
            category,
            brand,
            unit,
            hsn,
            salePrice,
            purchasePrice,
            mrp,
            gstRate,
            minStock,
            stock: openingStock,
            openingStock,
            openingStockCost,
          },
        });
        importedIds.push(createdItem.id);

        // Record opening stock movement and ledger if opening stock > 0
        if (openingStock > 0) {
          await tx.stockMovement.create({
            data: {
              companyId,
              itemId: createdItem.id,
              warehouseId: defaultWarehouse.id,
              movementType: "OPENING",
              referenceType: "MANUAL",
              referenceId: "IMPORT_OPENING",
              qtyIn: openingStock,
              qtyOut: 0,
              unitCost: openingStockCost,
              totalCost: openingStock * openingStockCost,
              notes: "Imported Opening Stock",
            },
          });

          const existingStock = await tx.warehouseStock.findFirst({
            where: {
              warehouseId: defaultWarehouse.id,
              itemId: createdItem.id,
              variantId: null,
            },
          });

          if (existingStock) {
            await tx.warehouseStock.update({
              where: { id: existingStock.id },
              data: { quantity: { increment: openingStock } },
            });
          } else {
            await tx.warehouseStock.create({
              data: {
                companyId,
                warehouseId: defaultWarehouse.id,
                itemId: createdItem.id,
                quantity: openingStock,
              },
            });
          }

          // Ledger Entry: Debit Stock in Hand (1200), Credit Capital/Opening Equity (3001)
          if (stockAccount && capitalAccount && openingStockCost > 0) {
            const totalStockValue = Math.round(openingStock * openingStockCost * 100) / 100;
            const voucherNo = `JV-OP-${Date.now().toString().slice(-6)}-${createdItem.id.slice(-4)}`;
            const voucher = await tx.voucher.create({
              data: {
                companyId,
                voucherNo,
                type: "JOURNAL",
                date: new Date(),
                narration: `Opening Stock Valuation for ${name} (${openingStock} @ ₹${openingStockCost})`,
              },
            });
            await tx.voucherEntry.createMany({
              data: [
                {
                  voucherId: voucher.id,
                  accountId: stockAccount.id,
                  debit: totalStockValue,
                  credit: 0,
                },
                {
                  voucherId: voucher.id,
                  accountId: capitalAccount.id,
                  debit: 0,
                  credit: totalStockValue,
                },
              ],
            });
          }
        }
      } else if (entityType === "CUSTOMERS" || entityType === "SUPPLIERS") {
        const type = entityType === "CUSTOMERS" ? "CUSTOMER" : "VENDOR";
        const name = getValue(row, "name");
        const email = getValue(row, "email") || undefined;
        const phone = getValue(row, "phone") || undefined;
        const gstin = getValue(row, "gstin") || undefined;
        const pan = getValue(row, "pan") || undefined;
        const address = getValue(row, "address") || undefined;
        const city = getValue(row, "city") || undefined;
        const state = getValue(row, "state") || undefined;
        const pincode = getValue(row, "pincode") || undefined;
        const creditLimit = Number(getValue(row, "creditLimit")) || 0;
        const creditDays = Number(getValue(row, "creditDays")) || 0;
        const openingBalance = Number(getValue(row, "openingBalance")) || 0;

        const party = await tx.party.create({
          data: {
            companyId,
            name,
            type,
            email,
            phone,
            gstin,
            pan,
            address,
            city,
            state,
            pincode,
            creditLimit,
            creditDays,
            openingBalance,
          },
        });
        importedIds.push(party.id);

        // Ledger Entry for Opening Balance
        if (openingBalance !== 0 && capitalAccount) {
          const debtorsAcc = await tx.account.findFirst({
            where: { companyId, code: type === "CUSTOMER" ? "1100" : "2001" },
          });

          if (debtorsAcc) {
            const voucherNo = `OPB-${Date.now().toString().slice(-6)}-${party.id.slice(-4)}`;
            const isDebit = openingBalance > 0;
            const absAmount = Math.abs(openingBalance);

            const voucher = await tx.voucher.create({
              data: {
                companyId,
                voucherNo,
                type: "JOURNAL",
                date: new Date(),
                partyId: party.id,
                narration: `Opening Balance for ${name} (${type})`,
              },
            });

            await tx.voucherEntry.createMany({
              data: [
                {
                  voucherId: voucher.id,
                  accountId: debtorsAcc.id,
                  debit: isDebit ? absAmount : 0,
                  credit: isDebit ? 0 : absAmount,
                },
                {
                  voucherId: voucher.id,
                  accountId: capitalAccount.id,
                  debit: isDebit ? 0 : absAmount,
                  credit: isDebit ? absAmount : 0,
                },
              ],
            });
          }
        }
      } else if (entityType === "OPENING_STOCK") {
        const identifier = getValue(row, "identifier");
        const warehouseName = getValue(row, "warehouse");
        const quantity = Number(getValue(row, "quantity")) || 0;
        const unitCost = Number(getValue(row, "unitCost")) || 0;
        const batchNumber = getValue(row, "batchNumber") || undefined;
        const expiryStr = getValue(row, "expiryDate") || undefined;

        const item = await tx.item.findFirst({
          where: {
            companyId,
            OR: [
              { sku: identifier },
              { name: identifier },
              { barcode: identifier },
            ],
          },
        });

        if (item) {
          let warehouse = defaultWarehouse;
          if (warehouseName) {
            const foundWh = await tx.warehouse.findFirst({
              where: {
                companyId,
                OR: [{ name: warehouseName }, { code: warehouseName }],
              },
            });
            if (foundWh) warehouse = foundWh;
          }

          let batchId: string | undefined = undefined;
          if (batchNumber) {
            const expiryDate = expiryStr ? new Date(expiryStr) : undefined;
            const batch = await tx.batch.upsert({
              where: {
                companyId_itemId_batchNumber: {
                  companyId,
                  itemId: item.id,
                  batchNumber,
                },
              },
              create: {
                companyId,
                itemId: item.id,
                batchNumber,
                expiryDate,
                cost: unitCost,
                quantity,
              },
              update: {
                quantity: { increment: quantity },
                expiryDate: expiryDate || undefined,
              },
            });
            batchId = batch.id;
          }

          await tx.stockMovement.create({
            data: {
              companyId,
              itemId: item.id,
              warehouseId: warehouse.id,
              movementType: "OPENING",
              referenceType: "MANUAL",
              referenceId: "BULK_OPENING_IMPORT",
              batchId,
              batchNumber,
              qtyIn: quantity,
              qtyOut: 0,
              unitCost,
              totalCost: quantity * unitCost,
              notes: `Bulk Imported Opening Stock${batchNumber ? ` (Batch: ${batchNumber})` : ""}`,
            },
          });

          const existingWhStock = await tx.warehouseStock.findFirst({
            where: {
              warehouseId: warehouse.id,
              itemId: item.id,
              variantId: null,
            },
          });

          if (existingWhStock) {
            await tx.warehouseStock.update({
              where: { id: existingWhStock.id },
              data: { quantity: { increment: quantity } },
            });
          } else {
            await tx.warehouseStock.create({
              data: {
                companyId,
                warehouseId: warehouse.id,
                itemId: item.id,
                quantity,
              },
            });
          }

          await tx.item.update({
            where: { id: item.id },
            data: {
              stock: { increment: quantity },
            },
          });

          importedIds.push(item.id);
        }
      } else if (entityType === "OPENING_BALANCES") {
        const identifier = getValue(row, "identifier");
        const typeStr = getValue(row, "type").toUpperCase();
        const amount = Number(getValue(row, "amount")) || 0;
        const isDebit = !typeStr.startsWith("C");

        const acc = await tx.account.findFirst({
          where: {
            companyId,
            OR: [{ code: identifier }, { name: identifier }],
          },
        });

        if (acc && capitalAccount && acc.id !== capitalAccount.id) {
          const voucherNo = `OP-ACC-${Date.now().toString().slice(-6)}-${acc.code}`;
          const voucher = await tx.voucher.create({
            data: {
              companyId,
              voucherNo,
              type: "JOURNAL",
              date: new Date(),
              narration: `Opening balance for Account ${acc.name} (${acc.code})`,
            },
          });

          await tx.voucherEntry.createMany({
            data: [
              {
                voucherId: voucher.id,
                accountId: acc.id,
                debit: isDebit ? amount : 0,
                credit: isDebit ? 0 : amount,
              },
              {
                voucherId: voucher.id,
                accountId: capitalAccount.id,
                debit: isDebit ? 0 : amount,
                credit: isDebit ? amount : 0,
              },
            ],
          });
          importedIds.push(acc.id);
        }
      }
    }
  });

  return {
    success: true,
    totalRows: rows.length,
    importedCount: importedIds.length,
    failedCount: rows.length - importedIds.length,
    errors: validation.errors,
    importedIds,
  };
}

/**
 * Generate a CSV error report for invalid rows so users can easily correct and re-upload.
 */
export function generateErrorReportCsv(
  originalRows: Array<Record<string, any>>,
  errors: ImportErrorDetail[]
): string {
  const errorMapByRow = new Map<number, ImportErrorDetail[]>();
  for (const err of errors) {
    const list = errorMapByRow.get(err.row) || [];
    list.push(err);
    errorMapByRow.set(err.row, list);
  }

  const sampleHeaders = originalRows.length > 0 ? Object.keys(originalRows[0]) : [];
  const exportHeaders = ["Row", ...sampleHeaders, "Error Field", "Error Reason", "Suggested Correction"];

  const csvLines: string[] = [exportHeaders.map(escapeCsvValue).join(",")];

  for (let i = 0; i < originalRows.length; i++) {
    const rowNum = i + 2;
    const rowErrors = errorMapByRow.get(rowNum);
    if (!rowErrors || rowErrors.length === 0) continue; // Only include problematic rows

    for (const err of rowErrors) {
      const lineValues = [
        String(rowNum),
        ...sampleHeaders.map((h) => String(originalRows[i][h] ?? "")),
        err.field,
        err.error,
        err.suggestedCorrection,
      ];
      csvLines.push(lineValues.map(escapeCsvValue).join(","));
    }
  }

  return csvLines.join("\n");
}

function escapeCsvValue(val: any): string {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
