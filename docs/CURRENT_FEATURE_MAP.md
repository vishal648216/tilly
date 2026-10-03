# Taily - Current Feature Map & Implementation Audit

**Audit Date:** 2026-10-01  
**Repository Baseline:** Safe Pre-Phase 1 Inspection  
**Status Tags Used:** `IMPLEMENTED`, `PARTIAL`, `UI ONLY`, `BACKEND ONLY`, `BROKEN`, `MISSING`

---

## 1. Authentication & Tenant Authorization

### 1.1 User Login
- **Page:** `src/app/login/page.tsx`
- **Route:** `/login`
- **Backend/API:** `POST /api/auth/login` (`src/app/api/auth/login/route.ts`)
- **Database Models:** `User`, `Company`, `Session`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:**
  - Auto-seeding default demo credentials (`admin@admin.com`, `demo@taily.in`) was previously hardcoded on any failed login; now guarded by `NODE_ENV !== "production" || ALLOW_DEV_AUTO_SEED === "true"`.
  - Passwords are verified via `bcryptjs.compare`.
  - Sessions are persisted in the database (`Session` model, 7-day TTL) and set in HttpOnly `taily_session` cookie.
- **Dependencies:** `bcryptjs`, `src/lib/session.ts`, `src/lib/prisma.ts`.

### 1.2 User Registration / Signup
- **Page:** `src/app/signup/page.tsx`
- **Route:** `/signup`
- **Backend/API:** `POST /api/auth/signup` (`src/app/api/auth/signup/route.ts`)
- **Database Models:** `User`, `Company`, `Account`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:**
  - Newly created users are created with `status: "PENDING"`. They cannot log in until approved by a Super Admin or unless auto-approved.
  - Automatically provisions a default `Company` and initial Chart of Accounts for the tenant (`src/lib/accounts.ts`).
- **Dependencies:** `bcryptjs`, `src/lib/accounts.ts`, `src/lib/prisma.ts`.

### 1.3 Logout & Session Management
- **Page:** Dashboard sidebar trigger / Super Admin header
- **Route:** N/A (Client fetch)
- **Backend/API:** `POST /api/auth/logout` (`src/app/api/auth/logout/route.ts`), `src/lib/session.ts`
- **Database Models:** `Session`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Deletes session from DB and clears `taily_session` cookie with past expiry.
- **Dependencies:** `src/lib/session.ts`.

### 1.4 Company Onboarding
- **Page:** `src/app/onboarding/page.tsx`
- **Route:** `/onboarding`
- **Backend/API:** `POST /api/onboarding` (`src/app/api/onboarding/route.ts`)
- **Database Models:** `Company`, `User`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Allows business tenant to update company name, GSTIN, PAN, state, address, and bank details right after first signup.
- **Dependencies:** `src/lib/session.ts`.

---

## 2. Core Dashboard & Day Book

### 2.1 Main Dashboard
- **Page:** `src/app/(dashboard)/page.tsx`
- **Route:** `/`
- **Backend/API:** Server-rendered direct Prisma queries
- **Database Models:** `Invoice`, `Party`, `Item`, `Expense`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Computes total sales, monthly sales, pending receivables, low stock alerts, and recent transaction timeline.
- **Dependencies:** `src/lib/session.ts`, `lucide-react`.

### 2.2 Day Book
- **Page:** `src/app/(dashboard)/day-book/page.tsx`
- **Route:** `/day-book`
- **Backend/API:** Server-rendered direct Prisma queries (`Invoice`, `Expense`, `Payment`)
- **Database Models:** `Invoice`, `Expense`, `Payment`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Aggregates invoices, expenses, and standalone payments for a selected date (defaults to today).
- **Dependencies:** `src/lib/session.ts`.

---

## 3. Sales & Customer Invoicing

### 3.1 Sales Invoice List
- **Page:** `src/app/(dashboard)/invoices/page.tsx`
- **Route:** `/invoices`
- **Backend/API:** `GET /api/invoices?type=SALES` (`src/app/api/invoices/route.ts`)
- **Database Models:** `Invoice`, `Party`, `Payment`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Supports search, status filtering (`ALL`, `PAID`, `PARTIAL`, `UNPAID`), date sorting.
- **Dependencies:** `src/lib/session.ts`.

### 3.2 Create Sales Invoice
- **Page:** `src/app/(dashboard)/invoices/new/page.tsx`
- **Route:** `/invoices/new`
- **Backend/API:** `POST /api/invoices` (`src/app/api/invoices/route.ts`)
- **Database Models:** `Invoice`, `InvoiceItem`, `Item`, `Party`, `Voucher`, `VoucherEntry`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:**
  - Auto-calculates CGST, SGST, IGST based on customer state vs company state.
  - Multi-line item support with HSN/SAC, quantity, rate, discount, and tax rate.
  - Automatically posts balanced double-entry vouchers via `src/lib/invoice.ts`.
  - Automatically updates customer pending balance and inventory stock levels.
  - Now includes server-side input validation for positive quantities and line-item names.
- **Dependencies:** `src/lib/invoice.ts`, `src/lib/session.ts`.

### 3.3 Invoice Details, Print & PDF
- **Page:** `src/app/(dashboard)/invoices/[id]/page.tsx`
- **Route:** `/invoices/[id]`
- **Backend/API:** `GET /api/invoices/[id]`
- **Database Models:** `Invoice`, `InvoiceItem`, `Party`, `Company`, `Payment`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:**
  - Renders GST compliant invoice with tax breakdown tables, amount in words, bank details, and UPI QR code.
  - Supports browser print-to-PDF (`window.print()`).
  - Native WhatsApp link generation with prefilled billing message.
- **Dependencies:** `src/components/UpiQrCode.tsx`, `src/lib/numberToWords.ts`.

### 3.4 Public Invoice View
- **Page:** `src/app/view/invoice/[id]/page.tsx`
- **Route:** `/view/invoice/[id]`
- **Backend/API:** Direct Prisma query (`src/lib/prisma.ts`)
- **Database Models:** `Invoice`, `InvoiceItem`, `Party`, `Company`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Public unauthenticated endpoint for customer self-service invoice viewing and UPI payment.
- **Dependencies:** `src/components/UpiQrCode.tsx`.

---

## 4. Purchases & Vendor Bills

### 4.1 Purchase Bill List
- **Page:** `src/app/(dashboard)/purchases/page.tsx`
- **Route:** `/purchases`
- **Backend/API:** `GET /api/invoices?type=PURCHASE` (`src/app/api/invoices/route.ts`)
- **Database Models:** `Invoice`, `Party`, `Payment`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Displays vendor bills, grand total, amount paid, and pending balance.
- **Dependencies:** `src/lib/session.ts`.

### 4.2 Record Purchase Bill
- **Page:** In-page modal on `/purchases` + `POST /api/invoices` (`type: "PURCHASE"`)
- **Route:** `/purchases`
- **Backend/API:** `POST /api/invoices`
- **Database Models:** `Invoice`, `InvoiceItem`, `Item`, `Party`, `Voucher`, `VoucherEntry`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:**
  - Automatically increments existing item stock or creates new items if not found.
  - Generates balanced purchase voucher (debits Purchase account, credits Sundry Creditor).
- **Dependencies:** `src/lib/invoice.ts`.

---

## 5. Returns (Credit & Debit Notes)

### 5.1 Sales Returns (Credit Notes)
- **Page:** `src/app/(dashboard)/sales-return/page.tsx`, `src/app/(dashboard)/sales-return/new/page.tsx`
- **Route:** `/sales-return`, `/sales-return/new`
- **Backend/API:** `GET /api/sales-returns`, `POST /api/sales-returns` (`src/app/api/sales-returns/route.ts`)
- **Database Models:** `Invoice` (type `SALES_RETURN`), `InvoiceItem`, `Item`, `Party`, `Voucher`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:**
  - Increments stock back into inventory.
  - Decreases customer outstanding balance.
  - Automatically posts balanced journal/return voucher.
- **Dependencies:** `src/lib/session.ts`, `src/lib/invoice.ts`.

### 5.2 Purchase Returns (Debit Notes)
- **Page:** `src/app/(dashboard)/purchase-return/page.tsx`, `src/app/(dashboard)/purchase-return/new/page.tsx`
- **Route:** `/purchase-return`, `/purchase-return/new`
- **Backend/API:** `GET /api/purchase-returns`, `POST /api/purchase-returns` (`src/app/api/purchase-returns/route.ts`)
- **Database Models:** `Invoice` (type `PURCHASE_RETURN`), `InvoiceItem`, `Item`, `Party`, `Voucher`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:**
  - Decrements item stock.
  - Decreases vendor payable balance.
  - Automatically posts balanced return voucher.
- **Dependencies:** `src/lib/session.ts`, `src/lib/invoice.ts`.

---

## 6. Inventory & Items

### 6.1 Item Management
- **Page:** `src/app/(dashboard)/items/page.tsx`, `src/app/(dashboard)/items/new/page.tsx`
- **Route:** `/items`, `/items/new`
- **Backend/API:** `GET /api/items`, `POST /api/items`, `PUT /api/items` (`src/app/api/items/route.ts`)
- **Database Models:** `Item`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:**
  - Tracks unit, selling price, purchase price, current stock, low stock alert threshold, HSN/SAC code, and GST rate.
  - Search by name and filter by low-stock status.
- **Dependencies:** `src/lib/session.ts`.

---

## 7. Parties (Customers & Suppliers)

### 7.1 Party List & Directory
- **Page:** `src/app/(dashboard)/parties/page.tsx`, `src/app/(dashboard)/parties/new/page.tsx`
- **Route:** `/parties`, `/parties/new`
- **Backend/API:** `GET /api/parties`, `POST /api/parties`, `PUT /api/parties` (`src/app/api/parties/route.ts`)
- **Database Models:** `Party`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Filter by `CUSTOMER` or `SUPPLIER`. Validates 15-character GSTIN format.
- **Dependencies:** `src/lib/session.ts`.

### 7.2 Party Detail & Statement
- **Page:** `src/app/(dashboard)/parties/[id]/page.tsx`
- **Route:** `/parties/[id]`
- **Backend/API:** Direct Prisma query (`Party`, `Invoice`, `Payment`)
- **Database Models:** `Party`, `Invoice`, `Payment`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Shows full party ledger statement, outstanding balances, and allows recording ad-hoc payments directly.
- **Dependencies:** `src/lib/session.ts`.

---

## 8. Payments & Cash Flow

### 8.1 Payment Recording
- **Page:** Modals across `/invoices`, `/purchases`, `/parties/[id]`
- **Route:** Modals embedded in dashboard pages
- **Backend/API:** `POST /api/payments` (`src/app/api/payments/route.ts`)
- **Database Models:** `Payment`, `Invoice`, `Party`, `Voucher`, `VoucherEntry`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:**
  - Automatically updates linked invoice `paidAmount` and transitions invoice status (`PAID` or `PARTIAL`).
  - Supports Cash, Bank Transfer, UPI, Cheque, and Card payment methods.
  - Creates balanced payment/receipt double-entry voucher via `src/lib/payment.ts`.
- **Dependencies:** `src/lib/payment.ts`, `src/lib/session.ts`.

---

## 9. Expenses

### 9.1 Expense Management
- **Page:** `src/app/(dashboard)/expenses/page.tsx`
- **Route:** `/expenses`
- **Backend/API:** `GET /api/expenses`, `POST /api/expenses`, `DELETE /api/expenses/[id]` (`src/app/api/expenses/route.ts`, `src/app/api/expenses/[id]/route.ts`)
- **Database Models:** `Expense`, `Voucher`, `VoucherEntry`, `Account`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:**
  - Categorizes expenses (Rent, Utilities, Salaries, Logistics, Marketing, Office, Maintenance, Miscellaneous).
  - Posts balanced journal voucher debiting expense category account and crediting Cash/Bank.
- **Dependencies:** `src/lib/session.ts`.

---

## 10. General Ledger & Double-Entry Accounting

### 10.1 Chart of Accounts & Trial Balances
- **Page:** `src/app/(dashboard)/ledger/page.tsx`, `src/app/(dashboard)/ledger/account/page.tsx`
- **Route:** `/ledger`, `/ledger/account`
- **Backend/API:** Direct Prisma query (`Account`, `VoucherEntry`)
- **Database Models:** `Account`, `VoucherEntry`, `Voucher`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Computes debit, credit, net balance, and individual account ledger entries across the full fiscal timeline.
- **Dependencies:** `src/lib/session.ts`.

### 10.2 Vouchers (Journal, Payment, Receipt, Contra)
- **Page:** `src/app/(dashboard)/vouchers/page.tsx`, `src/app/(dashboard)/vouchers/new/page.tsx`
- **Route:** `/vouchers`, `/vouchers/new`
- **Backend/API:** `GET /api/vouchers`, `POST /api/vouchers` (`src/app/api/vouchers/route.ts`)
- **Database Models:** `Voucher`, `VoucherEntry`, `Account`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:**
  - Manual creation enforces mathematical balance: $\sum \text{Debits} == \sum \text{Credits}$.
  - Supports CONTRA, PAYMENT, RECEIPT, JOURNAL voucher types.
- **Dependencies:** `src/lib/session.ts`.

---

## 11. GST Reports

### 11.1 GSTR-1 (Outward Supplies)
- **Page:** `src/app/(dashboard)/reports/gstr-1/page.tsx`
- **Route:** `/reports/gstr-1`
- **Backend/API:** Direct Prisma aggregation (`Invoice` where `type = SALES`)
- **Database Models:** `Invoice`, `InvoiceItem`, `Party`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Segregates B2B vs B2C invoices, taxable value, CGST, SGST, IGST totals. Export to JSON/CSV available.
- **Dependencies:** `src/lib/session.ts`.

### 11.2 GSTR-3B (Summary Return)
- **Page:** `src/app/(dashboard)/reports/gstr-3b/page.tsx`
- **Route:** `/reports/gstr-3b`
- **Backend/API:** Direct Prisma aggregation (`SALES` outward tax vs `PURCHASE` ITC)
- **Database Models:** `Invoice`, `InvoiceItem`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Calculates net tax liability (Outward tax minus Eligible Input Tax Credit).
- **Dependencies:** `src/lib/session.ts`.

---

## 12. Settings & Data Portability

### 12.1 Company Settings & Bank Details
- **Page:** `src/app/(dashboard)/settings/page.tsx`
- **Route:** `/settings`
- **Backend/API:** `GET /api/settings`, `POST /api/settings` (`src/app/api/settings/route.ts`)
- **Database Models:** `Company`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Updates company name, address, GSTIN, PAN, bank account, IFSC, UPI ID, terms and invoice notes.
- **Dependencies:** `src/lib/session.ts`.

### 12.2 JSON Backup & Export
- **Page:** In-page button on `/settings`
- **Route:** `/settings`
- **Backend/API:** `GET /api/backup` (`src/app/api/backup/route.ts`)
- **Database Models:** `Company`, `Invoice`, `Party`, `Item`, `Expense`, `Voucher`, `Account`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Generates full tenant data JSON dump for local offline archival.
- **Dependencies:** `src/lib/session.ts`.

---

## 13. Super Admin & Platform Control

### 13.1 Super Admin Dashboard & System Control
- **Page:** `src/app/superadmin/page.tsx`, `src/app/superadmin/system/page.tsx`
- **Route:** `/superadmin`, `/superadmin/system`
- **Backend/API:** `GET /api/superadmin/stats`, `GET /api/superadmin/system`
- **Database Models:** `User`, `Company`, `Invoice`, `Session`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Accessible only to users with `role: "SUPERADMIN"`.
- **Dependencies:** `src/lib/session.ts`.

### 13.2 Tenant Approvals & Switching
- **Page:** `src/app/superadmin/approvals/page.tsx`, `src/app/superadmin/companies/page.tsx`, `src/app/superadmin/users/page.tsx`
- **Route:** `/superadmin/approvals`, `/superadmin/companies`, `/superadmin/users`
- **Backend/API:** `GET/POST /api/superadmin/approvals`, `GET/POST /api/superadmin/companies`, `POST /api/superadmin/switch-company`
- **Database Models:** `User`, `Company`
- **Current Status:** `IMPLEMENTED`
- **Known Issues:** Allows Super Admin to approve pending users and switch active session company context into any tenant workspace for administrative support.
- **Dependencies:** `src/lib/session.ts`.

---

## 14. Non-Functional, Stubs & Ghost Directories

### 14.1 OCR Invoice Scanner
- **Page:** `src/app/(dashboard)/invoices/ocr/` (Empty directory)
- **Backend/API:** `src/app/api/ocr/` (Empty directory)
- **Current Status:** `MISSING`
- **Notes:** Empty folders present in repo; no UI or API implementation exists.

### 14.2 Tally / Excel Bulk Data Import
- **Page:** `src/app/(dashboard)/reports/import/` (Empty directory)
- **Backend/API:** `src/app/api/import/` (Empty directory)
- **Current Status:** `MISSING`
- **Notes:** Empty folders present in repo; feature not yet authored.

### 14.3 Invoice Nested Payments API
- **Backend/API:** `src/app/api/invoices/[id]/payments/` (Empty directory)
- **Current Status:** `MISSING`
- **Notes:** Payments are handled via top-level `POST /api/payments` endpoint.
