# Transaction-Based Inventory Engine (Phase 3)

## 1. Overview & Architectural Goals

In Phase 3, Taily was upgraded from a basic static counter (`Item.stock`) to an **enterprise transaction-based, double-entry inventory engine**. 

Every stock change in the business is backed by an append-only, immutable `StockMovement` ledger entry. Current balances across companies and warehouses are guaranteed to reconcile with historical stock movements.

### Key Architectural Tenets
1. **Never Rely Only on `Item.stock`**:
   - `Item.stock` functions as a fast aggregate cache, but `StockMovement` transactions are the ultimate source of truth.
   - For multi-location companies, stock is tracked at the warehouse level (`WarehouseStock`).
2. **Single Authoritative Business Service**:
   - All stock mutations flow strictly through `src/lib/inventory.ts` (`recordStockMovement`, `transferStock`, `adjustStock`).
   - Direct ad-hoc SQL updates to stock columns are prohibited.
3. **Strict Backend Negative Stock Guard**:
   - When `negativeStockAllowed` is disabled in `CompanySettings`, any transaction exceeding available warehouse stock is rejected at the API/database layer with an explicit 400 error.
4. **Weighted Average Cost (WAC) Valuation**:
   - Maintains continuous historical purchase costs and recalculates the weighted average inventory cost on every incoming shipment.

---

## 2. Database Models & Schema Extensions

The Prisma schema (`prisma/schema.prisma`) was updated with zero data loss.

### A. `StockMovement` Model
Represents an individual physical stock movement transaction:
```prisma
model StockMovement {
  id            String          @id @default(cuid())
  companyId     String
  warehouseId   String?
  branchId      String?
  itemId        String
  variantId     String?
  movementType  String          // OPENING, PURCHASE, PURCHASE_RETURN, SALE, SALE_RETURN, STOCK_ADJUSTMENT, DAMAGE, TRANSFER_IN, TRANSFER_OUT, PRODUCTION_IN, PRODUCTION_OUT, WASTAGE
  referenceType String?         // INVOICE, PURCHASE, RETURN, ADJUSTMENT, TRANSFER, MANUAL
  referenceId   String?
  qtyIn         Float           @default(0)
  qtyOut        Float           @default(0)
  unitCost      Float           @default(0)
  totalCost     Float           @default(0)
  date          DateTime        @default(now())
  notes         String?
  createdBy     String?
  createdAt     DateTime        @default(now())

  company       Company         @relation(fields: [companyId], references: [id], onDelete: Cascade)
  item          Item            @relation(fields: [itemId], references: [id], onDelete: Cascade)
  warehouse     Warehouse?      @relation(fields: [warehouseId], references: [id], onDelete: SetNull)
  variant       ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)

  @@index([companyId, itemId, date])
  @@index([warehouseId])
  @@index([movementType])
  @@index([referenceId])
}
```

### B. `Warehouse` Model
Supports multi-godown networks:
```prisma
model Warehouse {
  id              String           @id @default(cuid())
  companyId       String
  name            String
  code            String?
  address         String?
  isDefault       Boolean          @default(false)
  active          Boolean          @default(true)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  company         Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  stockMovements  StockMovement[]
  warehouseStocks WarehouseStock[]

  @@unique([companyId, name])
  @@index([companyId])
}
```

### C. `WarehouseStock` Model (Stock by Warehouse)
Ensures warehouse isolation and multi-location balances:
```prisma
model WarehouseStock {
  id          String          @id @default(cuid())
  companyId   String
  warehouseId String
  itemId      String
  variantId   String?
  quantity    Float           @default(0)
  updatedAt   DateTime        @updatedAt

  company     Company         @relation(fields: [companyId], references: [id], onDelete: Cascade)
  warehouse   Warehouse       @relation(fields: [warehouseId], references: [id], onDelete: Cascade)
  item        Item            @relation(fields: [itemId], references: [id], onDelete: Cascade)
  variant     ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)

  @@unique([warehouseId, itemId, variantId])
  @@index([companyId, itemId])
  @@index([warehouseId])
}
```

### D. Optional `Batch` & `SerialNumber` Models
Enables tracking for pharmaceuticals, electronics, and warranty goods:
```prisma
model Batch {
  id                String    @id @default(cuid())
  companyId         String
  itemId            String
  batchNumber       String
  manufacturingDate DateTime?
  expiryDate        DateTime?
  mrp               Float?
  cost              Float?
  quantity          Float     @default(0)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

model SerialNumber {
  id                String    @id @default(cuid())
  companyId         String
  itemId            String
  serialNumber      String
  purchaseReference String?
  saleReference     String?
  warranty          String?
  status            String    @default("AVAILABLE")
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

---

## 3. The Authoritative Business Service (`src/lib/inventory.ts`)

All inventory operations must execute through this unified service.

### Core Service Methods

| Method | Purpose | Key Guarantees |
|---|---|---|
| `recordStockMovement(params, tx?)` | Records any physical stock event | Validates negative stock, computes WAC, updates `WarehouseStock`, updates `Item.stock`, logs movement |
| `getAvailableStock(params, tx?)` | Fetches available stock | Warehouse-specific or aggregate company stock |
| `transferStock(params, tx?)` | Moves stock between godowns | Atomic `TRANSFER_OUT` & `TRANSFER_IN` with single `TRF-...` reference |
| `adjustStock(params, tx?)` | Physical counts & write-offs | `DAMAGE`, `WASTAGE`, `STOCK_ADJUSTMENT` with audit log |
| `getStockLedger(companyId, filters)` | Audit trail query | Computes running balances chronologically |
| `getDefaultWarehouse(companyId, tx?)` | Fallback godown | Auto-provisions Primary Godown if none exists |

---

## 4. Stock Valuation: Weighted Average Cost (WAC)

When incoming shipments or opening balances are recorded with `qtyIn > 0` and `unitCost > 0`:

$$\text{New WAC} = \frac{(\text{Current Qty} \times \text{Current WAC}) + (\text{Incoming Qty} \times \text{Incoming Unit Cost})}{\text{Current Qty} + \text{Incoming Qty}}$$

### Verification Example
1. Opening stock: 100 units @ ₹200/unit $\rightarrow$ Valuation = ₹20,000, WAC = ₹200.
2. Purchase: +50 units @ ₹260/unit $\rightarrow$ Incoming = ₹13,000.
3. Total quantity = 150 units.
4. Total Valuation = ₹20,000 + ₹13,000 = ₹33,000.
5. New WAC = $\frac{33,000}{150} = \mathbf{₹220}$.
6. When 20 units are sold, they are valued at ₹220, leaving 130 units @ ₹220 = ₹28,600.

---

## 5. Multi-Warehouse Transfers & Isolation

Stock transfers between warehouses are executed atomically inside a Prisma transaction:
```typescript
const result = await transferStock({
  companyId,
  fromWarehouseId: "wh_ahmedabad",
  toWarehouseId: "wh_surat",
  itemId: "pump_101",
  quantity: 20,
  notes: "Depot stock replenishment",
});
```

### Internal Atomic Execution:
1. `TRANSFER_OUT` created on `fromWarehouseId` with `qtyOut: 20`.
2. `fromWarehouseId` stock decreased by 20.
3. `TRANSFER_IN` created on `toWarehouseId` with `qtyIn: 20`.
4. `toWarehouseId` stock increased by 20.
5. Both records share the exact same `referenceId` (e.g. `TRF-20261001-4921`).
6. Company-level total stock remains invariant ($120 + 20 = 140$).

---

## 6. End-to-End Transaction Flow Matrix

| Transaction Screen | Movement Type | `qtyIn` | `qtyOut` | Cost Tracking | Warehouse Effect |
|---|:---:|:---:|:---:|---|---|
| **Opening Takeover** | `OPENING` | $+Q$ | $0$ | Sets initial WAC | Increments warehouse stock |
| **Purchase Bill** | `PURCHASE` | $+Q$ | $0$ | Recalculates WAC | Increments warehouse stock |
| **Purchase Return (Debit Note)**| `PURCHASE_RETURN`| $0$ | $-Q$ | Historical vendor cost | Decrements warehouse stock |
| **Sales Invoice** | `SALE` | $0$ | $-Q$ | Evaluates COGS at WAC | Decrements warehouse stock |
| **Sales Return (Credit Note)** | `SALE_RETURN` | $+Q$ | $0$ | Credit rate | Restocks warehouse |
| **Stock Damage** | `DAMAGE` | $0$ | $-Q$ | WAC write-off | Deducts from warehouse |
| **Stock Transfer Out** | `TRANSFER_OUT` | $0$ | $-Q$ | Preserves unit cost | Decrements source warehouse |
| **Stock Transfer In** | `TRANSFER_IN` | $+Q$ | $0$ | Transfers unit cost | Increments destination warehouse |

---

## 7. Barcode Scanner Support

In billing and invoice creation ([src/app/(dashboard)/invoices/new/NewInvoiceForm.tsx](file:///e:/pransh_project/taily/src/app/(dashboard)/invoices/new/NewInvoiceForm.tsx)):
- Added dedicated **Barcode Scanner Input Banner**.
- Scanners emitting physical barcode + Enter keypress automatically:
  1. Match product by `barcode`, `sku`, or `name`.
  2. If already in bill: increments quantity by $+1$.
  3. If not in bill: adds a new line populated with item, HSN, rate, and GST%.
  4. Clears input ready for the next consecutive scan.

---

## 8. Verification & Test Suite

The test suite ([scripts/test-phase3.ts](file:///e:/pransh_project/taily/scripts/test-phase3.ts)) tests the exact sequence required by the prompt:

```
=======================================================
📦  TAILY PHASE 3: TRANSACTION-BASED INVENTORY ENGINE
=======================================================

--- SETUP: Created Test Company 'Phase3 Logistics Hub 2810' ---
  ✅ PASS: Warehouse A created as Default Godown
  ✅ PASS: Warehouse B created as Secondary Godown
  ✅ PASS: Item initialized with 0 stock

--- STEP 1: Opening Stock (100 units @ ₹200) ---
  ✅ PASS: Opening movement created successfully
  ✅ PASS: Warehouse A available stock is 100
  ✅ PASS: Aggregate company stock is 100
  ✅ PASS: Weighted average cost after opening is ₹200

--- STEP 2: Purchase Bill (+50 units @ ₹260) ---
  ✅ PASS: Warehouse A available stock after purchase is 150 (100 + 50)
  ✅ PASS: Weighted Average Cost accurately computed to ₹220

--- STEP 3: Sale Invoice (-20 units) ---
  ✅ PASS: Warehouse A stock after sale is 130 (150 - 20)

--- STEP 4: Sales Return (+5 units) ---
  ✅ PASS: Warehouse A stock after sales return is 135 (130 + 5)

--- STEP 5: Purchase Return (-3 units) ---
  ✅ PASS: Warehouse A stock after purchase return is 132 (135 - 3)

--- STEP 6: Stock Adjustment (-2 units damage) ---
  ✅ PASS: Adjustment logged with DAMAGE movementType
  ✅ PASS: Warehouse A stock after adjustment is 130 (132 - 2)

--- STEP 7: Inter-Godown Stock Transfer (10 units WH-A -> WH-B) ---
  ✅ PASS: Generated standardized transfer reference
  ✅ PASS: Outward transfer movement logged 10 units
  ✅ PASS: Inward transfer movement logged 10 units

--- STEP 8: Final Balances & Multi-Godown Isolation ---
  ✅ PASS: Warehouse A final balance is exactly 120 (130 - 10)
  ✅ PASS: Warehouse B final balance is exactly 10 (0 + 10)
  ✅ PASS: Company total stock agrees with sum (120 + 10 = 130)
  ✅ PASS: Warehouse isolation confirmed: WH-A stock is distinct from WH-B stock

--- STEP 9: Negative Stock Enforcement (Backend Guard) ---
  ✅ PASS: Sale rejected with clear 'Insufficient stock' error message
  ✅ PASS: Negative stock was strictly blocked by backend service
  ✅ PASS: Warehouse B balance remained intact at 10 after rejected sale

--- STEP 10: Stock Ledger Audit Trail Integrity ---
  ✅ PASS: Stock ledger captured all 7 sequential transaction events
  ✅ PASS: Ledger running balance accurately equals final stock of 130
  ✅ PASS: Purchase movement preserved in ledger history
  ✅ PASS: Historical purchase unitCost preserved at ₹260

=======================================================
🏁 PHASE 3 TEST SUMMARY: 28 PASSED, 0 FAILED
=======================================================
```

### Full Regression Health
- **Phase 3 Inventory Suite**: **28 Passed, 0 Failed**.
- **Phase 2 Config Suite**: **29 Passed, 0 Failed**.
- **Phase 1 Multi-Tenant Security**: **17 Passed, 0 Failed**.
- **TypeScript Check (`tsc --noEmit`)**: **Clean (Exit Code 0)**.
- **ESLint**: **Clean (Exit Code 0)**.
- **Total Automated Assertions**: **74 Passed, 0 Failed**.
