# Taily Security Architecture & Audit Report

## 1. Executive Summary

Taily is engineered with a **Zero-Trust Multi-Tenant Architecture**. Security controls are enforced at every application layer: HTTP ingress, route middleware, application service boundaries, and atomic database transaction constraints.

All security controls have been audited and verified via automated test suites (`scripts/test-security-audit.ts` and `scripts/test-multi-company-isolation.ts`).

---

## 2. Authentication & Credential Storage

### Password Hashing
- Passwords are salted and hashed using **bcrypt** with a minimum work factor of 10 rounds.
- Plaintext passwords are never logged, stored, or echoed in API responses.
- Passwords must satisfy complexity constraints: minimum 8 characters, requiring mixed alphanumeric characters.

### Session Security
- Sessions are stored in the database (`Session` model) with cryptographic tokens.
- Cookies are transmitted with strict security flags:
  - `HttpOnly: true` (prevents JavaScript access and XSS theft)
  - `Secure: true` (enforced in production, requires HTTPS)
  - `SameSite: Lax` (protects against Cross-Site Request Forgery)
- Active company tenancy is bound to the server-side session. Switching active companies invalidates stale context and re-verifies `CompanyMember` privileges.

---

## 3. Authorization & Multi-Tenant Isolation (RBAC)

### Role Hierarchy
1. **SUPER_ADMIN**: Platform operator. Can manage platform plans, global subscriptions, platform feature flags, and tenant lifecycle. **Strict Rule**: Super Admin views cannot query or leak private tenant financial ledgers.
2. **COMPANY_ADMIN**: Full administrative authority over their assigned company tenant. Can invite users, configure company settings, manage warehouses, and approve workflows.
3. **ACCOUNTANT**: Access to all financial records, vouchers, journal entries, P&L, balance sheets, and tax reports. Cannot modify company legal ownership or subscription tiers.
4. **SALES_USER**: Limited to quotations, sales orders, delivery challans, sales invoices, and customer directories.
5. **PURCHASE_USER**: Limited to purchase orders, goods receipts, purchase bills, and vendor directories.
6. **VIEWER**: Strict read-only access across assigned records.

### IDOR (Insecure Direct Object Reference) Prevention
All database queries MUST explicitly include `companyId: session.activeCompanyId`. 
Even if an attacker discovers or guesses a valid primary key (e.g. `itemId`, `invoiceId`, `voucherId`) belonging to another tenant, the compound query:
```typescript
where: {
  id: targetId,
  companyId: activeCompanyId, // Scoped to caller's company
}
```
evaluates to `null`, completely blocking cross-tenant visibility or tampering.

---

## 4. Public Invoice Read-Only Security Boundary

Taily provides public invoice share links (`/view/invoice/:id`) for customer convenience.
- **Strict Read-Only Projection**: The public endpoint queries only presentation-safe fields (`invoiceNo`, `date`, `grandTotal`, company name, GSTIN, and line items).
- **Prohibited Data**: The public endpoint never queries or includes `passwordHash`, internal user records, voucher journals, bank account numbers, or platform configuration.
- **Rate-Limiting**: Protected by IP-based rate limiting to prevent automated scraping.

---

## 5. File Upload & OCR Bill Safety

- **MIME & Extension Whitelisting**: Only valid document formats (`image/jpeg`, `image/png`, `application/pdf`, `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) are accepted.
- **File Header Magic Byte Inspection**: Backups and uploaded files are verified against binary file magic headers (e.g. SQLite magic header `SQLite format 3\000`).
- **Temporary Execution Isolation**: Uploaded files for OCR and CSV import are processed in memory or ephemeral temporary directories and unlinked immediately after processing.

---

## 6. Secret Redaction & Log Hygiene

Taily enforces automated log redaction via `src/lib/logger.ts`. Before writing to stdout or persisting to `ActivityLog`:
- Any object key matching `/password|hash|token|secret|authorization|cookie|session|creditcard|cvv/i` is automatically masked to `[REDACTED]`.
- System errors caught in try/catch blocks do not leak raw SQL strings, table schemas, or internal file paths to API callers. Generic, localized user messages are returned with unique trace IDs.

---

## 7. Vulnerability Disclosure Policy

If you discover a potential security vulnerability in Taily, please report it privately:
- **Email**: security@taily.com
- **Response SLA**: Within 24 business hours
- **Fix Timeline**: Critical vulnerabilities are resolved and hotfixed within 48 hours.
