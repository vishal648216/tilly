# Taily Platform & Tenant Administration Guide

## 1. Super Admin Platform Administration

The Super Admin portal is accessible to authorized operators at `/superadmin`.

### Privileges & Guardrails
- **Platform Scope**: Super Admins manage global plans, feature flags, system status, and tenant lifecycle.
- **Privacy Boundary**: Platform admins cannot view private company financial data, customer invoices, or trade secrets unless explicitly authorized by the tenant.

---

## 2. Subscription Plans & Quota Management

Taily includes 4 predefined subscription tiers out-of-the-box, fully configurable from the **Super Admin > Plans** console:

| Plan Feature / Limit | Free Trial | Starter | Professional | Enterprise |
|---|---|---|---|---|
| **Monthly Pricing** | ₹0 | ₹999 | ₹2,499 | ₹5,999 |
| **Max Users** | 2 | 3 | 10 | Unlimited |
| **Max Warehouses** | 1 | 1 | 5 | Unlimited |
| **Max Products** | 100 | 1,000 | 10,000 | Unlimited |
| **Multi-Company** | 1 | 1 | 3 | Unlimited |
| **Barcode / POS** | Included | Included | Included | Included |
| **Batch & Serial Tracking**| Disabled | Disabled | Enabled | Enabled |
| **Manufacturing BOM** | Disabled | Disabled | Enabled | Enabled |
| **OCR Smart Bill Scan** | 5 scans | 25 scans/mo | 250 scans/mo | Unlimited |
| **Custom Branding & Watermark** | Standard | Standard | Premium | White-label |

### Server-Side Quota Enforcement
Plan limits are strictly enforced server-side via `src/lib/subscriptionEnforcement.ts`:
- `assertCanCreateUser(companyId)`: Prevents inviting team members beyond plan limit.
- `assertCanCreateWarehouse(companyId)`: Rejects warehouse creation once threshold is met.
- `assertCanCreateProduct(companyId)`: Blocks product creation when catalogue cap is reached.
- `assertCanUseOCR(companyId)`: Validates monthly OCR quota before processing documents.

---

## 3. Tenant Lifecycle Management

In the **Super Admin > Companies** dashboard, operators can:
1. **Approve / Activate**: Move newly registered organizations from `PENDING` to `ACTIVE`.
2. **Assign / Upgrade Plan**: Transition a company from `TRIAL` to `PROFESSIONAL` or `ENTERPRISE`.
3. **Suspend Tenant**: Instantly freeze tenant access in cases of non-payment or compliance reviews. While suspended, users receive a non-destructive notice and cannot execute write transactions.
4. **Export Tenant Data**: Generate a clean, verified JSON export bundle of all company entities for data portability.

---

## 4. Company-Level User & Permission Management

Company Administrators manage their localized team under **Settings > Team Members**:
- **Invite Member**: Send invitation email with specified role.
- **Assign Role**:
  - `COMPANY_ADMIN`: Complete control over the tenant.
  - `ACCOUNTANT`: Financial transactions, ledgers, vouchers, and statutory tax reports.
  - `SALES_USER`: Limited to sales documents and customer directories.
  - `PURCHASE_USER`: Limited to purchase orders and vendor bills.
  - `VIEWER`: Read-only access across company records.
- **Deactivate User**: Instantly revokes session tokens and blocks subsequent access.

---

## 5. Backup, Disaster Recovery & Audit Logs

### Automated & Manual Backups
- **Manual Snapshot**: Click **"Create Database Backup"** under **Settings > Backups**. Generates an atomic, SHA-256 verified snapshot.
- **Automated Schedule**: Configure daily or hourly cron snapshots with automatic pruning (keeps last 20 snapshots).
- **Safety Rollback on Restore**: Any restore operation automatically captures an emergency rollback snapshot of the active state before applying backup data.

### Immutable Audit Trail
All security-sensitive operations (Invoice cancellation, user invitation, permission change, period lock, backup restoration) are logged to the `ActivityLog` table with:
- Timestamp (UTC)
- Actor ID & User Email
- Action Type
- Pre-change state and Post-change state (JSON diff)
- Client IP address and User Agent
