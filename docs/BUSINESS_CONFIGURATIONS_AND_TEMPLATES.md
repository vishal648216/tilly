# Business Configurations, Feature Flags & Industry Templates (Phase 2)

## 1. Overview & Architectural Goals

In Phase 2, Taily was upgraded from a rigid retail-oriented accounting system into an **industry-configurable enterprise ERP platform**. Rather than branching or maintaining separate builds, a single unified codebase dynamically adapts its data models, backend rules, and UI navigation based on the active company's **Business Type** and **Company Settings**.

### Core Tenets
1. **Configurable, Not Hardcoded**: Feature flags and business types are persisted in the database (`CompanySettings` table) and loaded per company.
2. **Three-Tier Enforcement**:
   - **Database**: Schemas accommodate industry fields, custom fields, and product variants without schema rewrites.
   - **Backend Enforcement**: APIs enforce feature constraints (e.g. `requireFeature('inventoryEnabled')`, `negativeStockAllowed` checks in billing).
   - **Frontend Adaptation**: Navigation menus (`Sidebar.tsx`) and forms automatically hide irrelevant modules and fields (e.g. services never see batch/expiry/stock ledgers; garments see size/color variants).
3. **Multi-Tenant Isolation**: All settings, templates, variants, and custom fields strictly belong to a specific company (`companyId` foreign key and tenant filtering).

---

## 2. Database Models

The Prisma schema (`prisma/schema.prisma`) was extended with zero data loss to existing multi-tenant data.

### Upgraded `Company` Model
Added profile and business metadata:
- `legalName`: Official registered trade name.
- `businessType`: `Retail`, `Wholesale`, `Distributor`, `Service`, `Restaurant`, `Garments`, `Electronics`, `Hardware`, `Pharmacy`, `Manufacturing`, `Custom`.
- `industry`: Industry classification.
- `logo`, `website`, `country`, `timezone`: Localized business parameters.
- Relations: `settings` (`CompanySettings?`), `variants` (`ProductVariant[]`), `customFields` (`CustomFieldDefinition[]`).

### `CompanySettings` (19 Granular Feature Flags)
```prisma
model CompanySettings {
  id                    String   @id @default(cuid())
  companyId             String   @unique
  company               Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  
  // Core Modules
  inventoryEnabled      Boolean  @default(true)
  gstEnabled            Boolean  @default(true)
  warehouseEnabled      Boolean  @default(false)
  multiWarehouseEnabled Boolean  @default(false)
  
  // Tracking & Identification
  barcodeEnabled        Boolean  @default(true)
  batchEnabled          Boolean  @default(false)
  expiryEnabled         Boolean  @default(false)
  serialEnabled         Boolean  @default(false)
  
  // Operations & Workflow
  manufacturingEnabled  Boolean  @default(false)
  quotationEnabled      Boolean  @default(true)
  salesOrderEnabled     Boolean  @default(false)
  purchaseOrderEnabled  Boolean  @default(false)
  deliveryChallanEnabled Boolean @default(false)
  goodsReceiptEnabled   Boolean  @default(false)
  salespersonEnabled    Boolean  @default(false)
  priceListsEnabled     Boolean  @default(false)
  
  // Accounting & Calculation Rules
  negativeStockAllowed  Boolean  @default(false)
  taxInclusivePricing   Boolean  @default(false)
  roundOffEnabled       Boolean  @default(true)
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### `ProductVariant` Model
Enables multi-attribute matrixing (Size, Color, Material, Model) for apparel, footwear, and consumer goods:
```prisma
model ProductVariant {
  id             String   @id @default(cuid())
  companyId      String
  company        Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  itemId         String
  item           Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  sku            String?
  barcode        String?
  price          Float
  wholesalePrice Float?
  stock          Float    @default(0)
  options        String   // JSON string: e.g. {"Size":"L","Color":"Navy"}
  attributes     String?  // JSON string
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### `CustomFieldDefinition` Model
Allows non-technical admins to define dynamic custom attributes per company without code changes:
```prisma
model CustomFieldDefinition {
  id           String   @id @default(cuid())
  companyId    String
  company      Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  entityType   String   // "CUSTOMER", "SUPPLIER", "PRODUCT", "INVOICE", "EXPENSE"
  fieldName    String   // alphanumeric identifier, e.g. "fabricComposition"
  fieldLabel   String   // Human readable label, e.g. "Fabric Composition"
  fieldType    String   // "TEXT", "NUMBER", "DATE", "SELECT", "BOOLEAN"
  isRequired   Boolean  @default(false)
  options      String?  // Comma-separated or JSON list for dropdown selects
  defaultValue String?
  displayOrder Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([companyId, entityType, fieldName])
}
```

### Upgraded `Item` Master
- **Tiered Pricing**: `price` (retail), `mrp`, `wholesalePrice`, `dealerPrice`, `distributorPrice`.
- **Inventory Metrics**: `openingStock`, `openingStockCost`, `reorderLevel`, `minimumStock`.
- **Tracking / Industry**: `brand`, `model`, `batchNo`, `expiryDate`, `warrantyMonths`, `imei`, `taxMode` (`EXCLUSIVE` / `INCLUSIVE`).
- **Dynamic Extensibility**: `customFields` (JSON).

### Upgraded `Party` Master
- **Advanced Parameters**: `contactPerson`, `code`, `billingAddress`, `shippingAddress`, `gstTreatment`, `creditLimit`, `creditDays`, `paymentTerms`, `priceList`, `bankDetails`, `salesperson`, `notes`, `tags`.
- **Dynamic Extensibility**: `customFields` (JSON).

---

## 3. Feature Flag Architecture

The feature flag architecture spans three synchronized tiers:

```
[ Database: CompanySettings ]
           │
           ▼
[ Backend: src/lib/featureFlags.ts ]
     ├── getCompanySettings(companyId) -> Cached in session & Prisma
     ├── isFeatureEnabled(companyId, flag) -> Boolean check
     └── requireFeature(companyId, flag) -> Throws 403 Forbidden with descriptive code
           │
           ▼
[ Frontend: src/context/CompanySettingsContext.tsx ]
     ├── useCompanySettings()
     │     ├── settings: CompanySettings
     │     ├── isEnabled(flagName): boolean
     │     ├── reloadSettings(): Promise<void>
     └── Context injected into (dashboard)/layout.tsx
```

### Backend Enforcement Example
```typescript
import { requireFeature } from '@/lib/featureFlags';

export async function POST(req: NextRequest) {
  const context = await getCompanyContext(req);
  // Rejects with 403 if company has disabled physical inventory
  await requireFeature(context.companyId, 'inventoryEnabled', 'Inventory is disabled for this company profile');
  ...
}
```

### Billing Engine Stock Rules (`src/lib/invoice.ts`)
- **Service Companies**: If `inventoryEnabled === false`, billing does **not** deduct physical inventory or create `StockMovement` records.
- **Negative Stock Control**: If `negativeStockAllowed === false`, invoices abort transaction if any item's available stock is lower than billed quantity.

---

## 4. Business Templates Engine

The template engine (`src/lib/businessTemplates.ts`) defines out-of-the-box configurations for 11 distinct industries:

| Business Type | Inventory | Warehouses | Barcode | Batch | Expiry | Serial / IMEI | Quotations | Price Lists | Negative Stock | Default Custom Fields |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **Retail** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Rack Location, Loyalty Card |
| **Wholesale** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | Minimum Order Qty, Freight Terms |
| **Distributor** | ✅ | ✅ (Multi) | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | Route / Territory, Credit Rating |
| **Service** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | Service Type, Service SLA Days |
| **Garments** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | Fabric Material, Season / Collection |
| **Electronics** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | IMEI Number, Warranty Period |
| **Pharmacy** | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | Drug License No, Storage Temp |
| **Restaurant** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Table Number, Kitchen Station |
| **Manufacturing**| ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | Production Batch, Quality Grade |
| **Hardware** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | Technical Spec, Bin Location |
| **Custom** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | None |

### 1-Click Template Switching
Admins can apply templates anytime via `/api/settings/templates`:
```bash
POST /api/settings/templates
Body: { "businessType": "GARMENTS" }
```
This updates company metadata, synchronizes all 19 feature flags, and auto-provisions industry custom field definitions.

---

## 5. Master Data & Form Modularization

### 5-Tab Product Form (`src/app/(dashboard)/items/new/NewItemForm.tsx`)
1. **Basic Tab**: Name, Type (`GOODS` / `SERVICE`), Category, Brand, Unit, SKU, Barcode, Active status.
2. **Inventory Tab**: Track Inventory toggle, Opening Stock, Stock Cost, Reorder Level, Min Stock. (Hidden if `inventoryEnabled === false`).
3. **Pricing Tab**: Tiered pricing with non-fixed markups:
   - Purchase Price
   - Retail Price
   - Wholesale Price
   - Dealer Price
   - Distributor Price
   - MRP
4. **Tax Tab**: Tax Mode (`EXCLUSIVE` / `INCLUSIVE`), HSN/SAC Code, GST Rate dropdown (0%, 5%, 12%, 18%, 28%).
5. **Advanced Tab**:
   - Industry-specific tracking: Model, IMEI, Warranty (Electronics), Batch No & Expiry (Pharmacy).
   - Product Variants Builder: Interactive matrix to add variants (e.g. Size `M`, Color `Navy`, Price, Stock, SKU).
   - Dynamic Custom Fields: Form inputs automatically rendered based on `CustomFieldDefinition` records.

### 2-Tab Party Form (`src/app/(dashboard)/parties/new/NewPartyForm.tsx`)
1. **Basic Information**: Name, Party Type (`CUSTOMER` / `SUPPLIER`), Phone, Email, GSTIN, PAN, Address, State, Pincode.
2. **Advanced Terms**:
   - Contact Person & Vendor/Customer Code.
   - Dual Addresses: Billing Address and separate Shipping Address.
   - Financial Terms: Credit Limit (₹), Credit Period (Days), Payment Terms dropdown.
   - Pricing & Sales: Assigned Price List Tier, Salesperson name.
   - Bank Details: Bank Name, Account Number, IFSC Code.
   - Tags & Internal Notes.
   - Dynamic Custom Fields: Auto-rendered based on entity type (`CUSTOMER` or `SUPPLIER`).

---

## 6. Quick Add Workflows

In invoice creation (`src/app/(dashboard)/invoices/new/NewInvoiceForm.tsx`) and purchase order screens:
- Users can click **"+ Quick Add"** next to the Customer dropdown.
  - Opens a lightweight modal.
  - Submits to `/api/parties`.
  - On success, **automatically selects** the newly created customer without page reload or loss of bill draft.
- Users can click **"+ Add New Product"** directly inside the bill items table.
  - Opens a fast item creation modal.
  - Submits to `/api/items`.
  - On success, **automatically inserts and selects** the new product row in the invoice.

---

## 7. Dynamic Navigation

The sidebar (`src/components/Sidebar.tsx`) uses `useCompanySettings()` to adapt the menu in real time:
- **Service Companies**: "Stock Ledger", "Stock Movements", "Warehouses" are completely hidden.
- **Retail / Garments**: Barcode utilities are visible; multi-warehouse and manufacturing menus remain hidden unless enabled.
- **Distributors / Wholesalers**: Warehouses, Stock Transfers, and Wholesale Pricing links appear.
- **Profile Header**: Badges the active business type (e.g. `[RETAIL]`, `[SERVICE]`, `[DISTRIBUTOR]`).

---

## 8. Verification & Test Suite

The test suite (`scripts/test-phase2.ts`) tests all 12 Phase 2 specifications:

| Test ID | Category | Description | Result |
|---|---|---|:---:|
| `TC-01` to `TC-04` | Company Setup | Profile attributes, logo, website, timezone, currency | **PASS** |
| `TC-05` to `TC-09` | Feature Flags | DB persistence of 19 settings, backend enforcement | **PASS** |
| `TC-10` to `TC-14` | Business Templates | Retail, Service, Distributor, Garments template provisioning | **PASS** |
| `TC-15` to `TC-18` | Master Data | Tiered pricing (no fixed markups), opening stock, brand, MRP | **PASS** |
| `TC-19` to `TC-21` | Product Variants | Variant creation, matrix options (Size/Color), SKU/pricing | **PASS** |
| `TC-22` to `TC-24` | Party Master | Advanced fields, dual addresses, credit limits, terms | **PASS** |
| `TC-25` to `TC-27` | Custom Fields | Dynamic entity fields (Customer, Product, Invoice) | **PASS** |
| `TC-28` to `TC-29` | Multi-Tenant Isolation | Cross-company flag isolation and IDOR validation | **PASS** |

**Summary: 29 Passed, 0 Failed.**
**Phase 1 Security Suite: 17 Passed, 0 Failed.**
**Next.js Production Build: 50/50 Pages Static & Dynamic Server-Rendered Cleanly (Exit Code 0).**

---

## 9. Known Limitations & Production Recommendations

1. **SQLite JSON Storage**:
   - In the local dev environment (`prisma/dev.db`), `customFields` and variant `options` are stored as JSON strings.
   - For PostgreSQL production deployment, these fields can use native `Json` types with GIN indexing for fast filtering.
2. **Variant Stock Deductions in Billing**:
   - Invoices currently deduct stock at the parent item level. Future enhancements can allow line items to specify a `variantId` to decrement variant-level stock counters directly.
3. **Complex BOM Calculations**:
   - While `manufacturingEnabled` toggle is present, multi-level raw material bill-of-materials (BOM) disassembly will be expanded in the dedicated Manufacturing Phase.
