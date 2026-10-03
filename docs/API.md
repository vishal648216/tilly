# Taily REST API Reference

## 1. Conventions & Authentication

### Base URL
```
https://app.taily.com/api
```

### Authentication
All authenticated endpoints require an active session cookie (`taily_session`) or a Bearer token header:
```http
Authorization: Bearer <session_token>
```
Every request is automatically scoped to the user's active tenant (`activeCompanyId`).

### Standard Response Envelope
Successful responses return structured JSON:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 150,
    "page": 1,
    "pageSize": 50
  }
}
```

### Error Responses
Error responses follow a standardized format and omit stack traces or database internals:
```json
{
  "success": false,
  "error": "Item with SKU 'PROD-001' already exists in this company.",
  "code": "DUPLICATE_RESOURCE"
}
```

---

## 2. Authentication Endpoints

### `POST /api/auth/login`
Authenticates user credentials and establishes a session.
- **Request Body**:
  ```json
  {
    "email": "admin@company.com",
    "password": "Password123!"
  }
  ```
- **Response**: Returns user metadata, memberships, and sets `HttpOnly` session cookie.

### `POST /api/auth/logout`
Terminates the active session and invalidates the session token in the database.

---

## 3. Products & Inventory Endpoints

### `GET /api/items`
Lists products for the active tenant.
- **Query Parameters**:
  - `page` (integer, default `1`)
  - `pageSize` (integer, default `50`)
  - `search` (string, matches name, SKU, or barcode)
  - `active` (boolean, filter active/inactive)

### `POST /api/items`
Creates a new product with quota enforcement.
- **Request Body**:
  ```json
  {
    "name": "Precision Hydraulic Pump",
    "sku": "PHP-2026",
    "barcode": "8901234567890",
    "purchasePrice": 1200.00,
    "salePrice": 1800.00,
    "gstRate": 18,
    "openingStock": 20,
    "warehouseId": "wh_123"
  }
  ```

### `GET /api/barcode/lookup?code=8901234567890`
Instant point-of-sale scanner endpoint. Resolves exact barcode match or fallback SKU.

---

## 4. Invoices & Billing Endpoints

### `GET /api/invoices`
Retrieves paginated invoices.
- **Query Parameters**:
  - `type`: `SALES_INVOICE` | `PURCHASE_INVOICE`
  - `status`: `POSTED` | `PAID` | `PARTIALLY_PAID` | `CANCELLED`
  - `from`, `to`: ISO Date strings

### `POST /api/invoices`
Creates and posts a new tax invoice with atomic stock deduction and double-entry voucher generation.
- **Request Body**:
  ```json
  {
    "partyId": "party_123",
    "warehouseId": "wh_123",
    "type": "SALES",
    "date": "2026-10-02T00:00:00.000Z",
    "isInterState": false,
    "lines": [
      {
        "itemId": "item_123",
        "name": "Hydraulic Pump",
        "qty": 2,
        "rate": 1800,
        "gstRate": 18
      }
    ]
  }
  ```

### `POST /api/invoices/[id]/cancel`
Audited financial cancellation. Swaps Debits and Credits to reverse the accounting voucher, restores warehouse stock, and marks the invoice as `CANCELLED`.
- **Request Body**:
  ```json
  {
    "reason": "Duplicate order entered by billing desk"
  }
  ```

---

## 5. Payments & Receivables Endpoints

### `POST /api/payments`
Records an incoming receipt from a customer or disbursement to a vendor.
- **Request Body**:
  ```json
  {
    "partyId": "party_123",
    "type": "PAYMENT_RECEIVED",
    "paymentMode": "BANK_TRANSFER",
    "amount": 3600.00,
    "date": "2026-10-02T00:00:00.000Z",
    "allocations": [
      {
        "invoiceId": "inv_123",
        "amount": 3600.00
      }
    ]
  }
  ```

---

## 6. Financial Reports Endpoints

- `GET /api/reports/trial-balance?from=...&to=...`: Returns balanced Trial Balance rows.
- `GET /api/reports/profit-loss?from=...&to=...`: Returns Net Sales, COGS, Gross Profit, Expenses, and Net Profit.
- `GET /api/reports/balance-sheet?from=...&to=...`: Returns Assets, Liabilities, Equity, and Retained Earnings.
- `GET /api/reports/general-ledger?accountId=...&from=...&to=...`: Chronological ledger entries with running balance.

---

## 7. Import, Export & Disaster Recovery

- `POST /api/import/validate`: Validates CSV/Excel files against entity schema without saving.
- `POST /api/import/commit`: Executes batch import of valid rows and returns execution report.
- `GET /api/export`: Downloads complete tenant JSON export.
- `POST /api/backup`: Triggers an atomic database snapshot.
- `POST /api/backup/restore`: Restores database from a validated snapshot file.
