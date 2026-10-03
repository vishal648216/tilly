# Taily - System Architecture & Engineering Baseline

**Version:** 0.1.0 Baseline  
**Target Environment:** Production Ready  
**Date:** 2026-10-01  

---

## 1. System Overview

Taily is a modern, web-first Indian GST accounting, inventory, and billing application built on Next.js 14. It combines automated double-entry bookkeeping with invoicing, inventory tracking, party management, and GST tax reporting (GSTR-1, GSTR-3B).

### Technology Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5.0+ (Strict typing)
- **Styling:** Tailwind CSS + PostCSS
- **Database & ORM:** Prisma ORM (v5.22.0) with dynamic dual-database adapter:
  - Local development: SQLite (`file:./dev.db`)
  - Cloud / Production: PostgreSQL via connection pooling
- **Security & Cryptography:** `bcryptjs` for salted password hashing
- **Icons & UI:** `lucide-react`, Vanilla CSS animations, headless utility patterns

---

## 2. Multi-Tenancy & Data Isolation

Taily utilizes a **Logical Multi-Tenancy** architecture enforced at the application data layer.

```
                      +-------------------+
                      |   Super Admin     |
                      |   Control Plane   |
                      +---------+---------+
                                |
             +------------------+------------------+
             |                                     |
   +---------v---------+                 +---------v---------+
   |   Tenant Org A    |                 |   Tenant Org B    |
   | (companyId: abc)  |                 | (companyId: xyz)  |
   +---------+---------+                 +---------+---------+
             |                                     |
     [Isolated Data]                       [Isolated Data]
  Invoices, Items, Parties,             Invoices, Items, Parties,
  Vouchers, Accounts, Expenses          Vouchers, Accounts, Expenses
```

### Isolation Rules
1. Every business tenant has a unique `Company` record (`id`).
2. Core business models (`Invoice`, `Item`, `Party`, `Expense`, `Voucher`, `Account`) contain a mandatory `companyId` foreign key.
3. Every authenticated API request and Server Component retrieves the active `companyId` from the verified session via `getSession(req)` or `getServerSession()`.
4. All Prisma queries MUST filter by `where: { companyId: session.companyId }`.
5. Super Admins possess global oversight across all tenants and can change their active session context via `/api/superadmin/switch-company`.

---

## 3. Authentication & Session Lifecycle

Authentication is built with database-backed stateful sessions rather than stateless JWTs, enabling instant session revocation and secure tenant switching.

```
[Client Browser]
       |
       | 1. POST /api/auth/login (email, password)
       v
[Login Handler] ──> Validates bcrypt hash ──> Checks status == "ACTIVE"
       |
       | 2. Creates record in Session table (token, userId, companyId, expiresAt: +7d)
       v
[HTTP Response] ──> Sets Set-Cookie: taily_session=<token>; HttpOnly; SameSite=Lax; Path=/
       |
       | 3. Subsequent requests include cookie
       v
[Session Verifier (src/lib/session.ts)]
       |
       +──> Checks Session table & expiration
       +──> Fetches User (id, name, email, role, status) & active Company
       +──> Attaches session context to request handler
```

---

## 4. Double-Entry Accounting Core

Taily maintains formal double-entry accounting records alongside operational documents.

### 4.1 Automated Chart of Accounts (`src/lib/accounts.ts`)
During tenant signup, default system accounts are provisioned:
- **Assets:** Cash (1001), Bank Account (1002), Sundry Debtors / Receivables (1003), Input CGST (1004), Input SGST (1005), Input IGST (1006).
- **Liabilities:** Sundry Creditors / Payables (2001), Output CGST (2002), Output SGST (2003), Output IGST (2004).
- **Equity:** Capital Account (3001).
- **Revenue:** Sales Account (4001).
- **Expenses:** Purchase Account (5001), Operational Expenses (5002 - 5009).

### 4.2 Invoice Voucher Synchronization (`src/lib/invoice.ts`)
When a Sales or Purchase invoice is created:
1. **Sales Invoice Posting:**
   - **Debit:** Sundry Debtors (Customer account) for Grand Total.
   - **Credit:** Sales Account for Subtotal.
   - **Credit:** Output CGST / SGST / IGST for Tax Amount.
2. **Purchase Bill Posting:**
   - **Debit:** Purchase Account for Subtotal.
   - **Debit:** Input CGST / SGST / IGST for Tax Amount.
   - **Credit:** Sundry Creditors (Supplier account) for Grand Total.

### 4.3 Payment Voucher Synchronization (`src/lib/payment.ts`)
When a customer or supplier payment is recorded:
- **Receipt (Customer Payment):**
  - **Debit:** Cash or Bank Account.
  - **Credit:** Sundry Debtors.
- **Payment (Vendor Payment):**
  - **Debit:** Sundry Creditors.
  - **Credit:** Cash or Bank Account.

### 4.4 Mathematical Balance Invariant
Every voucher in the `Voucher` table has child `VoucherEntry` records satisfying:
$$\sum \text{Debit Amounts} = \sum \text{Credit Amounts}$$

---

## 5. Inventory Stock Management

Item stock levels are tracked directly on the `Item` model (`currentStock`):
- **Sales Invoice:** When finalized, decrements stock for each item sold.
- **Purchase Bill:** When recorded, increments stock (or creates the item if it does not yet exist).
- **Sales Return (Credit Note):** Re-increments stock for returned items.
- **Purchase Return (Debit Note):** Decrements stock for items sent back to suppliers.

---

## 6. Indian GST Tax Calculation Engine

The GST engine determines tax classification automatically:
- **Intrastate Supply:** When Supplier State Code == Customer State Code:
  $$\text{Tax Rate} = 50\% \text{ CGST} + 50\% \text{ SGST}$$
- **Interstate Supply:** When Supplier State Code $\neq$ Customer State Code:
  $$\text{Tax Rate} = 100\% \text{ IGST}$$

Tax amounts are computed line-by-line using standard half-up rounding, and summarized in GSTR-1 and GSTR-3B reporting pages.

---

## 7. Directory Structure

```
taily/
├── docs/                      # Baseline architectural and operational docs
│   ├── ARCHITECTURE.md
│   ├── CURRENT_FEATURE_MAP.md
│   ├── DATABASE.md
│   ├── DEVELOPMENT.md
│   └── ENVIRONMENT.md
├── prisma/
│   ├── schema.prisma          # Database schema (13 models)
│   └── seed.ts                # Explicit database seeding script
├── public/                    # Static assets
├── scripts/
│   └── prepare-db.js          # Dynamic schema adapter (SQLite vs Postgres)
├── src/
│   ├── app/                   # Next.js 14 App Router routes & API endpoints
│   │   ├── (dashboard)/       # Authenticated business tenant routes
│   │   ├── api/               # Server-side REST endpoints
│   │   ├── superadmin/        # Super Admin management interface
│   │   ├── view/              # Public unauthenticated views
│   │   ├── login/             # Auth login page
│   │   ├── signup/            # Auth registration page
│   │   └── onboarding/        # First-time tenant setup
│   ├── components/            # Reusable UI & business widgets
│   ├── lib/                   # Core business logic & database client
│   │   ├── accounts.ts        # Chart of accounts provisioning
│   │   ├── invoice.ts         # Double-entry posting for invoices
│   │   ├── payment.ts         # Double-entry posting for payments
│   │   ├── prisma.ts          # Singleton Prisma client instance
│   │   └── session.ts         # Cookie & database session management
│   └── types/                 # Shared TypeScript interfaces
├── .env.example               # Sanitized environment template
├── package.json               # Dependencies & safe scripts
└── tsconfig.json              # TypeScript compiler configuration
```
