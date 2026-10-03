# Taily - Database Architecture & Migration Baseline

**Date:** 2026-10-01  
**ORM:** Prisma 5.22.0  
**Supported Engines:** SQLite (Local Development) & PostgreSQL (Cloud Production)  

---

## 1. Schema Overview

The database comprises 13 interrelated models providing multi-tenant isolation, billing, inventory, and double-entry accounting.

```
+-----------+        +-------------+        +-------------+
|   User    |*<----->|   Company   |<------>|   Session   |
+-----------+        +------+------+        +-------------+
                            |
       +--------------------+--------------------+--------------------+
       |                    |                    |                    |
+------v------+      +------v------+      +------v------+      +------v------+
|    Party    |      |    Item     |      |   Account   |      |   Expense   |
+------+------+      +------+------+      +------+------+      +------+------+
       |                    |                    |                    |
       +----------+---------+                    |                    |
                  |                              |                    |
           +------v------+                +------v------+             |
           |   Invoice   |                |   Voucher   |<------------+
           +------+------+                +------+------+
                  |                              |
           +------v------+                +------v------+
           | InvoiceItem |                |VoucherEntry |
           +-------------+                +-------------+
                  |                              |
           +------v------+                       |
           |   Payment   |<----------------------+
           +-------------+
```

### 1.1 Core Entities

| Model | Primary Purpose | Foreign Keys |
| :--- | :--- | :--- |
| **`Company`** | Tenant root organization. Stores business identity, GSTIN, PAN, bank details, and settings. | None |
| **`User`** | Tenant users and Super Admins. Stores email, hashed password, role, and approval status. | `companyId -> Company` (Optional for Super Admin) |
| **`Session`** | DB-backed active user sessions with 7-day TTL and instant revocation. | `userId -> User` |
| **`Party`** | Customers and Suppliers. Stores GSTIN, PAN, address, balance, and state. | `companyId -> Company` |
| **`Item`** | Product & service catalog. Stores SKU, HSN, price, purchase price, GST rate, and stock. | `companyId -> Company` |
| **`Invoice`** | Operational billing document. Types: `SALES`, `PURCHASE`, `SALES_RETURN`, `PURCHASE_RETURN`. | `companyId -> Company`, `partyId -> Party` |
| **`InvoiceItem`** | Individual line items within an invoice. Stores item name, HSN, rate, qty, tax amounts. | `invoiceId -> Invoice`, `itemId -> Item` (Optional) |
| **`Payment`** | Financial settlements against invoices or direct party balances. | `companyId -> Company`, `partyId -> Party`, `invoiceId -> Invoice` |
| **`Expense`** | Operational business expenses. Stores category, payment mode, and voucher link. | `companyId -> Company`, `voucherId -> Voucher` |
| **`Account`** | Ledger chart of accounts. Stores account code, type (ASSET, LIABILITY, etc.), and balance. | `companyId -> Company` |
| **`Voucher`** | Double-entry accounting voucher (JOURNAL, PAYMENT, RECEIPT, CONTRA, SALES, PURCHASE). | `companyId -> Company` |
| **`VoucherEntry`** | Balanced debit/credit lines belonging to a Voucher. | `voucherId -> Voucher`, `accountId -> Account` |
| **`AuditLog`** | Security and administrative audit trail. | `userId -> User` (Optional) |

---

## 2. Dynamic Dual-Engine Strategy

Taily supports zero-friction local development using SQLite while powering scalable cloud deployments using PostgreSQL.

### Dynamic Build-Time Adapter (`scripts/prepare-db.js`)
During `npm run build`:
1. The script inspects environment variables (`POSTGRES_URL`, `DATABASE_URL`, or `VERCEL`).
2. If `POSTGRES_URL` or `VERCEL` is detected:
   - Configures `datasource db` in `prisma/schema.prisma` with `provider = "postgresql"` and `url = env("POSTGRES_URL")`.
3. If running locally without PostgreSQL credentials:
   - Configures `datasource db` with `provider = "sqlite"` and `url = "file:./dev.db"`.
4. Executes `prisma generate` to produce engine-optimized client bindings.

---

## 3. Database Safety & Migration Protocol

### ⚠️ Strict Prohibition of Destructive Commands
Never run the following destructive commands in any staging or production workflow:
```bash
# FORBIDDEN: Will wipe or discard data if columns change
prisma db push --accept-data-loss
prisma migrate reset --force
```

### 3.1 Local Development Workflow
When making schema modifications locally:
```bash
# 1. Update prisma/schema.prisma
# 2. Validate the schema
npx prisma validate

# 3. Create a safe migration
npx prisma migrate dev --name <descriptive_migration_name>

# 4. Generate the updated Prisma client
npx prisma generate
```

### 3.2 Production Deployment Workflow
In continuous integration (CI) or production servers:
```bash
# Apply pending migrations safely without schema drifting or data loss
npx prisma migrate deploy
```

---

## 4. Backups and Disaster Recovery

### 4.1 Automated Git Tracking Guard
All `.db`, `.sql`, and `.dump` files are ignored in `.gitignore` to prevent leaking production or staging snapshots into version control.

### 4.2 Local SQLite Snapshot
To back up the local database safely:
```powershell
# Copy the database while the server is stopped or via SQLite backup API
Copy-Item "prisma/dev.db" "backups/dev_$(Get-Date -Format 'yyyyMMdd_HHmmss').db"
```

### 4.3 Tenant JSON Export
Every tenant can download a complete export of their operational data from `/settings` (powered by `GET /api/backup`).
