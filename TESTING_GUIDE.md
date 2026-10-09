# Taily ERP - Testing & Verification Guide

Welcome to Taily ERP. This package includes the complete application source code, pre-configured SQLite database with sample transactions, and automated test suites.

---

## 🚀 Quick Start (Running Locally)

### 1. Install Dependencies
Open your terminal inside the extracted directory and run:
```bash
npm install
```
*(The post-install script will automatically configure SQLite and generate the Prisma Client).*

### 2. Start the Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔑 Login Credentials

The pre-loaded database includes the following active test accounts:

| Role | Email | Password |
|---|---|---|
| **Super Administrator** | `admin@admin.com` | `admin@1234` |
| **Enterprise Master Tester** | `test@taily.in` | `test1234` |
| **Standard Business User** | `demo@taily.in` | `demo1234` |

---

## 🧪 Pre-Loaded Business Transactions to Test

The included database (`prisma/dev.db`) is pre-populated with realistic GST transactions:

1. **Customers & Vendors**:
   - `Ramesh Traders` (Customer - Intra-state Maharashtra, GSTIN: `27AAACR1234L1Z2`)
   - `Bangalore Tech Solutions` (Customer - Inter-state Karnataka, GSTIN: `29AADCB2233M1Z4`)
   - `Sharma Electronics Ltd` (Supplier / Vendor - Maharashtra, GSTIN: `27AAACS5678P1Z3`)
   - `Metro Paper Mills` (Supplier / Vendor - Gujarat, GSTIN: `24AABCM9988Q1Z1`)

2. **Inventory & Products**:
   - `Laptop Core i5 16GB SSD` (SKU: `LAP-I5`, HSN: `8471`, Stock: 50 PCS, 18% GST)
   - `Wireless Optical Mouse` (SKU: `WM-01`, HSN: `8471`, Stock: 200 PCS, 18% GST)
   - `A4 Copier Paper Ream` (SKU: `A4-500`, HSN: `4802`, Stock: 150 PCS, 12% GST)

3. **Invoices & Purchase Bills**:
   - Sales Invoice `INV-000001` (PO: `PO-2026-001`) with automatic CGST + SGST tax split and double-entry ledger vouchers.
   - Purchase Bill `PUR-000001` (PO: `PO-2026-001`) with Input Tax Credit (ITC) and inventory inward ledger entries.

4. **Independent Numbering Sequences**:
   - Sales Invoices follow `INV-000001`, `INV-000002`...
   - Purchase Bills follow `PUR-000001`, `PUR-000002`...
   - Each stream maintains separate, non-colliding order/PO references starting from 1 (`1, 2, 3...`).

---

## 🔬 Automated Test Execution

You can run the end-to-end test suites using standard npm commands:

```bash
# Run all 5 core test suites (Sales, Procurement, Accounting, Isolation, Security)
npm test

# Run individual test suites
npm run test:sales         # Quotation -> Sales Order -> Delivery Challan -> Sales Invoice
npm run test:purchase      # Purchase Order -> Goods Receipt (GRN) -> Purchase Bill
npm run test:accounting    # 19 E2E Double-Entry Ledger, Voucher & P&L tests
npm run test:isolation     # Multi-company tenant data isolation
npm run test:security      # Bcrypt hashing, IDOR prevention & audit security
```

---

## 🛠️ Database Utility Commands

- **Re-seed Sample Data at any time**:
  ```bash
  npm run db:seed
  ```
- **Inspect Database Visually**:
  ```bash
  npm run db:studio
  ```
- **Production Build Check**:
  ```bash
  npm run build
  ```
