# Taily - Phase 1 Security, Multi-Tenancy & RBAC Specification

**Version:** 1.0.0  
**Phase:** Phase 1 (Multi-Tenancy & RBAC Complete)  
**Date:** 2026-10-01  

---

## 1. Multi-Tenant Isolation Model

Taily enforces tenant data isolation at the application data layer with cryptographic session authentication and strict active company context verification.

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
   | (companyId: a123) |                 | (companyId: b456) |
   +---------+---------+                 +---------+---------+
             |                                     |
     [Isolated Data]                       [Isolated Data]
  Invoices, Items, Parties,             Invoices, Items, Parties,
  Vouchers, Accounts, Expenses,         Vouchers, Accounts, Expenses,
  Warehouses, Stock Movements           Warehouses, Stock Movements
```

### 1.1 Tenant Scoping Rules
1. Every authenticated session explicitly tracks `activeCompanyId` in the `Session` database table.
2. A client can never spoof or inject `companyId` in the URL or payload. `requireCompanyAccess()` resolves the active company server-side directly from the validated session.
3. Every operation verifies that the authenticated user has an active `CompanyMember` record for that specific company with `isActive: true`.
4. All database queries across all models are scoped by `where: { companyId: context.company.id }`.

---

## 2. In-Depth Permission Matrix

Taily defines 24 granular permissions across 9 functional business areas:

| Permission | Category | Description |
| :--- | :--- | :--- |
| `SALES_VIEW` | Sales | View sales invoices, credit notes, and customer billing histories |
| `SALES_CREATE` | Sales | Generate new GST sales invoices |
| `SALES_EDIT` | Sales | Update unfinalized sales invoice details |
| `SALES_CANCEL` | Sales | Cancel or void existing sales invoices |
| `SALES_RETURN` | Sales | Issue credit notes and restock returned sales inventory |
| `PURCHASE_VIEW` | Purchases | View vendor purchase bills and debit notes |
| `PURCHASE_CREATE` | Purchases | Record vendor purchase bills and auto-increment stock |
| `PURCHASE_EDIT` | Purchases | Modify purchase bill rates, quantities, and vendor references |
| `PURCHASE_CANCEL` | Purchases | Cancel vendor purchase bills |
| `PURCHASE_RETURN` | Purchases | Issue debit notes and deduct returned stock |
| `PRODUCT_VIEW` | Inventory | View product and service catalog, HSN codes, and pricing |
| `PRODUCT_CREATE` | Inventory | Add new products, services, and SKUs |
| `PRODUCT_EDIT` | Inventory | Update prices, HSN, tax rates, and thresholds |
| `STOCK_VIEW` | Inventory | View stock levels, warehouse inventory, and low stock alerts |
| `STOCK_ADJUST` | Inventory | Manually adjust physical inventory counts |
| `STOCK_TRANSFER` | Inventory | Transfer stock between warehouse locations |
| `PARTY_VIEW` | Parties | View customer and supplier directory and ledgers |
| `PARTY_CREATE` | Parties | Register new customer or vendor profiles |
| `PARTY_EDIT` | Parties | Modify party GSTIN, contact details, and credit limits |
| `PAYMENT_VIEW` | Payments | View payment and receipt records |
| `PAYMENT_CREATE` | Payments | Record incoming customer receipts or outgoing vendor disbursements |
| `EXPENSE_VIEW` | Expenses | View operational expense register |
| `EXPENSE_CREATE` | Expenses | Record business expenses and post automatic ledger vouchers |
| `ACCOUNTING_VIEW` | Accounting | View chart of accounts, trial balance, and general ledgers |
| `VOUCHER_CREATE` | Accounting | Post balanced manual journal, contra, and adjustment vouchers |
| `REPORT_VIEW` | Reports | View business performance reports and sales summaries |
| `GST_VIEW` | Reports | Generate GSTR-1 and GSTR-3B tax returns and tables |
| `USER_MANAGE` | Management | Add, activate, or deactivate company members |
| `ROLE_MANAGE` | Management | Assign or modify roles and custom permissions of members |
| `SETTINGS_MANAGE` | Management | Update company banking, UPI, GSTIN, and backup downloads |
| `COMPANY_MANAGE` | Management | Manage legal profile and business entity details |

---

## 3. Role-to-Permission Mapping

| Role | Canonical Permissions |
| :--- | :--- |
| **`SUPER_ADMIN`** | Global root access across all platform tenants. Full permissions in every company. |
| **`COMPANY_ADMIN`** | Full permissions across all areas within their tenant organization. |
| **`ACCOUNTANT`** | Full access to general ledger, vouchers, payments, expenses, GST returns, reports, and read-only access to sales, purchases, and parties. |
| **`SALES_USER`** | Sales view/create/edit/cancel/return, customer party management, payment recording, and product catalog view. |
| **`PURCHASE_USER`**| Purchase view/create/edit/cancel/return, vendor party management, payment recording, and product catalog view. |
| **`INVENTORY_USER`**| Product catalog management, stock viewing, manual adjustments, and warehouse stock transfers. No access to financial vouchers or settings. |
| **`VIEWER`** | Read-only access to sales, purchases, inventory, parties, reports, and accounting. **Cannot create, edit, or delete any record.** |
| **`CUSTOM_ROLE`** | Dynamically evaluates JSON-serialized permissions configured in `CompanyMember.customPermissions`. |

---

## 4. IDOR (Insecure Direct Object Reference) Protection

To prevent cross-tenant parameter tampering (e.g., Company A attempting to manipulate records belonging to Company B):

1. **Centralized Ownership Guard:**
   `validateEntityBelongsToCompany(entityType, entityId, activeCompanyId)` strictly validates that the entity's `companyId` matches `activeCompanyId`.
2. **Audit Logging on Violation:**
   If a mismatch occurs, the request is immediately rejected with `404 Not Found` (or `403 Forbidden`), and an audit log with action `IDOR_ATTEMPT_BLOCKED` is recorded with client IP, user identity, and entity metadata.
3. **Compound Foreign Key Validation:**
   Invoices, Returns, and Payments validate all child foreign keys (`partyId`, `itemId`, `invoiceId`) against the active company before processing database transactions.

---

## 5. Audit Logging Architecture

All security and state-mutating events are captured in the `ActivityLog` table via `src/lib/audit.ts`:
- **`companyId`**: Tenant scope
- **`userId` & `userEmail`**: Identity of the actor
- **`action`**: e.g., `CREATE_INVOICE`, `CANCEL_INVOICE`, `CREATE_PAYMENT`, `SWITCH_COMPANY`, `IDOR_ATTEMPT_BLOCKED`, `PERMISSION_DENIED`
- **`entity` & `entityId`**: The affected business entity
- **`beforeValue` & `afterValue`**: JSON snapshot diffs where applicable
- **`ipAddress` & `userAgent`**: Request origin telemetry

---

## 6. Persistent Dual-Tier Rate Limiting

To guard against credential stuffing, brute-force attacks, and DoS attempts without requiring external caching infrastructure:

- **Tier 1 (Fast In-Memory Sliding Window):**
  Uses an in-memory map keyed by client IP and email/identity to provide sub-millisecond rate checks for active server instances.
- **Tier 2 (Persistent Database Fallback):**
  Counts recent security activity events (`LOGIN_FAILED`, `RATE_LIMIT_HIT`, `SUSPICIOUS_ACCESS`) in `ActivityLog` within the sliding window window (`windowMs`).
  This ensures that even across server restarts or multi-instance serverless deployments, brute-force tracking persists.
- **Endpoints Protected:**
  - `/api/auth/login`: 5 failed attempts per 15 minutes per IP or email. Successful login clears the counter.
  - `/view/invoice/[id]`: 30 view requests per minute per IP.
  - API Mutations: Integrated with audit log triggers.

---

## 7. CSRF & Origin Validation Guard

All state-mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`) are verified by `verifyCsrfOrigin(req)` in `src/lib/csrf.ts`:

1. **Origin / Referer Validation:**
   The request `Origin` (or `Referer` fallback) is extracted and compared against the server's `Host` / `x-forwarded-host` header.
2. **Rejection Policy:**
   If an external domain (e.g. `https://malicious-site.com`) attempts to trigger a cross-origin state mutation using ambient cookie credentials, the request is immediately rejected with `403 Forbidden: Cross-Origin Request Blocked (CSRF Guard)`.
3. **Safe Development Exception:**
   Local development (`localhost` and `127.0.0.1`) across varied dev ports is accommodated safely.

---

## 8. Public Invoice View Hardening

The public customer invoice sharing route (`/view/invoice/[id]`) has been hardened:

1. **Anti-Indexing Metadata:**
   Embedded Next.js metadata `robots: { index: false, follow: false }` instructs search engine crawlers not to index or display customer billing documents in public search engines.
2. **Access Control by Invoice Type:**
   Strictly restricted to customer-facing invoices: `invoice.type === "SALES" || invoice.type === "SALES_RETURN"`. Internal documents (e.g., vendor `PURCHASE` bills, debit notes, internal receipts) return a `404 Not Found`, preventing exposure of vendor costs and internal records even if a CUID is obtained.
3. **Per-IP Rate Limiting:**
   Enforces a limit of 30 views per minute per IP to prevent automated scraping or ID enumeration attempts.

---

## 9. Session Management & Password Security

Implemented in `src/app/api/auth/change-password/route.ts` and `src/app/api/auth/logout/route.ts`:

1. **Password Change Verification:**
   Requires the user's current password, verified via `bcrypt.compare`.
2. **Strong Password Enforcement:**
   Requires a minimum of 8 characters containing at least one digit or special character.
3. **Multi-Device Session Revocation:**
   Upon successful password change, all other active sessions for the user (`id: { not: currentSessionId }`) are immediately revoked in the database.
4. **All-Device Logout:**
   The logout endpoint supports an `allDevices: true` flag to allow users to sign out of all active web sessions across all devices simultaneously.
5. **Comprehensive Security Auditing:**
   Every password modification and session revocation is logged in `ActivityLog` with the client's IP and user agent.

---

## 10. Automated Verification & Test Coverage

The test suite in [test-security.ts](file:///e:/pransh_project/taily/scripts/test-security.ts) validates 17 critical security assertions:

- **Tests 1-6:** IDOR & Cross-Tenant Data Isolation (Invoices, Items, Parties, Payments)
- **Tests 7-10:** Role-Based Access Control (VIEWER, SALES_USER, INVENTORY_USER, COMPANY_ADMIN)
- **Tests 11-13:** Session Security & Company Switching
- **Test 14:** Audit Trail Verification in `ActivityLog`
- **Tests 15-17:** Rate Limiting Thresholds & CSRF Cross-Origin Blocking
