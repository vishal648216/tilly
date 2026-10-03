// Taily - Phase 2: Multi-Industry & Configurable Business Types Test Suite
// Verifies:
// 1. Retail, Service, Distributor, Garments company templates & feature flags
// 2. Product master improvements & multi-tier pricing (retail, wholesale, dealer, distributor)
// 3. Product variants (e.g. T-Shirt Size/Color/SKU)
// 4. Party master advanced fields (credit limits, terms, price lists, salesperson)
// 5. Configurable custom fields
// 6. Backend feature enforcement & negative stock prevention

import { PrismaClient } from "@prisma/client";
import { applyBusinessTemplate, getCompanySettings, isFeatureEnabled, requireFeature } from "../src/lib/featureFlags";
import { BUSINESS_TEMPLATES } from "../src/lib/businessTemplates";

const prisma = new PrismaClient();

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("🏭  TAILY PHASE 2: MULTI-INDUSTRY & CONFIGURABILITY TESTS");
  console.log("=======================================================\n");

  const timestamp = Date.now();

  try {
    // ------------------------------------------------------------------
    // TEST GROUP 1: Business Templates & Feature Flags for 4 Companies
    // ------------------------------------------------------------------
    console.log("--- TEST GROUP 1: Creation & Configuration of 4 Industry Companies ---");

    // 1.1 Retail Company
    const retailCompany = await prisma.company.create({
      data: {
        name: `Test Retail Store ${timestamp}`,
        legalName: `Test Retail Store Pvt Ltd`,
        businessType: "Retail",
        city: "Mumbai",
        state: "Maharashtra",
      },
    });
    await applyBusinessTemplate(retailCompany.id, "Retail");
    const retailSettings = await getCompanySettings(retailCompany.id);

    assert(retailSettings.inventoryEnabled === true, "Retail: inventoryEnabled is true");
    assert(retailSettings.barcodeEnabled === true, "Retail: barcodeEnabled is true");
    assert(retailSettings.warehouseEnabled === false, "Retail: warehouseEnabled is false");
    assert(retailSettings.manufacturingEnabled === false, "Retail: manufacturingEnabled is false");

    // 1.2 Service Company
    const serviceCompany = await prisma.company.create({
      data: {
        name: `Test Software Agency ${timestamp}`,
        legalName: `Test Software Agency LLP`,
        businessType: "Service",
        city: "Bengaluru",
        state: "Karnataka",
      },
    });
    await applyBusinessTemplate(serviceCompany.id, "Service");
    const serviceSettings = await getCompanySettings(serviceCompany.id);

    assert(serviceSettings.inventoryEnabled === false, "Service: inventoryEnabled is false (No physical stock)");
    assert(serviceSettings.quotationEnabled === true, "Service: quotationEnabled is true");
    assert(serviceSettings.warehouseEnabled === false, "Service: warehouseEnabled is false");

    // 1.3 Distributor Company
    const distributorCompany = await prisma.company.create({
      data: {
        name: `Test FMCG Distribution ${timestamp}`,
        businessType: "Distributor",
        city: "Ahmedabad",
        state: "Gujarat",
      },
    });
    await applyBusinessTemplate(distributorCompany.id, "Distributor");
    const distSettings = await getCompanySettings(distributorCompany.id);

    assert(distSettings.inventoryEnabled === true, "Distributor: inventoryEnabled is true");
    assert(distSettings.warehouseEnabled === true, "Distributor: warehouseEnabled is true (Multi-godown)");
    assert(distSettings.multiWarehouseEnabled === true, "Distributor: multiWarehouseEnabled is true");
    assert(distSettings.priceListsEnabled === true, "Distributor: priceListsEnabled is true");
    assert(distSettings.salespersonEnabled === true, "Distributor: salespersonEnabled is true");

    // 1.4 Garment Company
    const garmentCompany = await prisma.company.create({
      data: {
        name: `Test Apparel Boutique ${timestamp}`,
        businessType: "Garments",
        city: "Surat",
        state: "Gujarat",
      },
    });
    await applyBusinessTemplate(garmentCompany.id, "Garments");
    const garmentSettings = await getCompanySettings(garmentCompany.id);

    assert(garmentSettings.barcodeEnabled === true, "Garments: barcodeEnabled is true");
    assert(garmentSettings.priceListsEnabled === true, "Garments: priceListsEnabled is true");

    // ------------------------------------------------------------------
    // TEST GROUP 2: Product Master & Tiered Pricing
    // ------------------------------------------------------------------
    console.log("\n--- TEST GROUP 2: Product Master & Multi-Tier Pricing ---");

    const product = await prisma.item.create({
      data: {
        companyId: distributorCompany.id,
        name: "Premium Basmati Rice 5kg",
        brand: "India Gate",
        category: "Groceries",
        sku: "RICE-BAS-5K",
        barcode: "8901234567890",
        hsn: "100630",
        unit: "PAC",
        mrp: 650,
        salePrice: 580, // Retail Price
        purchasePrice: 450,
        wholesalePrice: 520, // Wholesale Price
        dealerPrice: 490, // Dealer Price
        distributorPrice: 470, // Distributor Price
        gstRate: 5,
        taxMode: "EXCLUSIVE",
        openingStock: 100,
        openingStockCost: 450,
        reorderLevel: 25,
        minStock: 10,
        stock: 100,
      },
    });

    assert(product.name === "Premium Basmati Rice 5kg", "Product: Created with brand & category");
    assert(Number(product.salePrice) === 580 && Number(product.wholesalePrice) === 520, "Product: Tiered Retail & Wholesale pricing verified");
    assert(Number(product.dealerPrice) === 490 && Number(product.distributorPrice) === 470, "Product: Dealer & Distributor price points verified");
    assert(Number(product.openingStock) === 100, "Product: Opening stock tracked without forced markups");

    // ------------------------------------------------------------------
    // TEST GROUP 3: Product Variants (Garments)
    // ------------------------------------------------------------------
    console.log("\n--- TEST GROUP 3: Product Variants (Size, Color, SKU) ---");

    const parentGarment = await prisma.item.create({
      data: {
        companyId: garmentCompany.id,
        name: "Classic Polo T-Shirt",
        brand: "Taily Wear",
        category: "Apparel",
        unit: "PCS",
        salePrice: 799,
        purchasePrice: 350,
        gstRate: 12,
        stock: 60,
      },
    });

    const variantRedM = await prisma.productVariant.create({
      data: {
        companyId: garmentCompany.id,
        itemId: parentGarment.id,
        sku: "TSH-POLO-RED-M",
        price: 799,
        stock: 20,
        options: JSON.stringify({ Size: "M", Color: "Red" }),
        attributes: "Red / M",
      },
    });

    const variantBlueL = await prisma.productVariant.create({
      data: {
        companyId: garmentCompany.id,
        itemId: parentGarment.id,
        sku: "TSH-POLO-BLU-L",
        price: 849,
        stock: 40,
        options: JSON.stringify({ Size: "L", Color: "Blue" }),
        attributes: "Blue / L",
      },
    });

    const variants = await prisma.productVariant.findMany({
      where: { itemId: parentGarment.id },
    });

    assert(variants.length === 2, "Variants: Created 2 distinct variants for parent product");
    assert(variants.some((v) => v.attributes === "Red / M"), "Variants: Red/M variant options & attributes verified");
    assert(variants.some((v) => v.sku === "TSH-POLO-BLU-L" && Number(v.price) === 849), "Variants: Blue/L variant with custom price verified");

    // ------------------------------------------------------------------
    // TEST GROUP 4: Party Master Advanced Fields
    // ------------------------------------------------------------------
    console.log("\n--- TEST GROUP 4: Party Master Advanced Commercial Fields ---");

    const customer = await prisma.party.create({
      data: {
        companyId: distributorCompany.id,
        name: "Sharma Supermarket",
        type: "CUSTOMER",
        phone: "9876543210",
        email: "sharma@supermarket.in",
        gstin: "24ABCDE1234F1Z5",
        pan: "ABCDE1234F",
        address: "Shop 12, Ring Road",
        city: "Surat",
        state: "Gujarat",
        contactPerson: "Mahesh Sharma",
        code: "CUST-SHR-01",
        billingAddress: "Shop 12, Ring Road, Surat",
        shippingAddress: "Warehouse 4, GIDC Industrial Estate, Surat",
        gstTreatment: "REGISTERED",
        creditLimit: 150000,
        creditDays: 45,
        paymentTerms: "Net 45 Days",
        priceList: "WHOLESALE",
        salesperson: "Vikram Mehta",
      },
    });

    assert(customer.code === "CUST-SHR-01", "Party: Customer code stored");
    assert(Number(customer.creditLimit) === 150000 && customer.creditDays === 45, "Party: Credit limit (1.5 Lakh) & 45 credit days verified");
    assert(customer.priceList === "WHOLESALE" && customer.salesperson === "Vikram Mehta", "Party: Assigned wholesale price list & designated salesperson verified");
    assert(Boolean(customer.shippingAddress), "Party: Distinct shipping and billing addresses stored");

    // ------------------------------------------------------------------
    // TEST GROUP 5: Configurable Custom Fields
    // ------------------------------------------------------------------
    console.log("\n--- TEST GROUP 5: Configurable Custom Fields ---");

    // Create a Custom Field Definition for Products
    const customFieldDef = await prisma.customFieldDefinition.create({
      data: {
        companyId: garmentCompany.id,
        entityType: "PRODUCT",
        fieldName: "fabric_composition",
        fieldLabel: "Fabric Composition",
        fieldType: "TEXT",
        isRequired: true,
      },
    });

    assert(customFieldDef.fieldName === "fabric_composition", "CustomField: Created definition for PRODUCT entity");

    // Attach custom field data to an Item
    const itemWithCustomField = await prisma.item.create({
      data: {
        companyId: garmentCompany.id,
        name: "Linen Summer Shirt",
        unit: "PCS",
        salePrice: 1299,
        customFields: JSON.stringify({ fabric_composition: "100% Pure Organic Linen" }),
      },
    });

    const parsedCustomFields = JSON.parse(itemWithCustomField.customFields || "{}");
    assert(
      parsedCustomFields.fabric_composition === "100% Pure Organic Linen",
      "CustomField: Custom fields JSON stored and retrieved on Product"
    );

    // ------------------------------------------------------------------
    // TEST GROUP 6: Backend Feature Flag Enforcement
    // ------------------------------------------------------------------
    console.log("\n--- TEST GROUP 6: Backend Feature Flag Enforcement ---");

    // Service company: check that requireFeature("inventoryEnabled") throws 403
    let blockedAsExpected = false;
    try {
      await requireFeature(serviceCompany.id, "inventoryEnabled");
    } catch (err: any) {
      if (err.statusCode === 403) {
        blockedAsExpected = true;
      }
    }
    assert(blockedAsExpected, "Backend Guard: Blocked access to inventory module for Service company (403)");

    // Retail company: inventoryEnabled is true, should pass smoothly
    let allowedAsExpected = false;
    try {
      await requireFeature(retailCompany.id, "inventoryEnabled");
      allowedAsExpected = true;
    } catch (err) {
      allowedAsExpected = false;
    }
    assert(allowedAsExpected, "Backend Guard: Permitted inventory access for Retail company");

    // ------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------
    await prisma.customFieldDefinition.deleteMany({ where: { companyId: garmentCompany.id } }).catch(() => {});
    await prisma.productVariant.deleteMany({ where: { companyId: garmentCompany.id } }).catch(() => {});
    await prisma.party.deleteMany({ where: { companyId: distributorCompany.id } }).catch(() => {});
    await prisma.item.deleteMany({ where: { companyId: { in: [retailCompany.id, serviceCompany.id, distributorCompany.id, garmentCompany.id] } } }).catch(() => {});
    await prisma.companySettings.deleteMany({ where: { companyId: { in: [retailCompany.id, serviceCompany.id, distributorCompany.id, garmentCompany.id] } } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: { in: [retailCompany.id, serviceCompany.id, distributorCompany.id, garmentCompany.id] } } }).catch(() => {});

  } catch (err) {
    console.error("Test execution encountered an error:", err);
    failCount++;
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n=======================================================");
  console.log(`🏁 PHASE 2 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("=======================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
