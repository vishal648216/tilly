# Taily End-User Comprehensive Guide

Welcome to **Taily**, your complete financial accounting, inventory management, and business ERP solution.

---

## 1. Getting Started & Navigation

### Command Palette (Quick Navigation)
Press `Ctrl + K` (or `Cmd + K` on macOS) anywhere in the application to summon the Universal Command Palette:
- Jump instantly to any page (`Invoices`, `Items`, `Reports`, `Manufacturing`).
- Search for products by name, SKU, or barcode.
- Search for customers and vendors by name, GSTIN, or phone.
- Trigger instant actions like **"New Invoice"**, **"New Customer"**, or **"Record Payment"**.

### Dashboard Overview
The real-time executive dashboard displays:
- **Total Revenue & Net Sales**: Trailing 30 days and FY-to-date metrics.
- **Cash & Bank Balances**: Current aggregate liquid liquidity.
- **Accounts Receivable & Payable**: Overdue amounts with aging breakdown.
- **Low Stock & Expired Batch Warnings**: Proactive operational indicators.

---

## 2. Managing Products & Parties

### Adding Products
1. Navigate to **Items > Add Product**.
2. Provide **Item Name**, **SKU**, and optional **Barcode**.
3. Set **Purchase Price**, **Selling Price**, and statutory **GST Rate** (e.g. 18%).
4. Optional configurations: Minimum Stock reorder alerts, Batch tracking, Serial numbers, or Multi-variants (Size/Color).

### Managing Customers & Suppliers
1. Navigate to **Parties > Add Party**.
2. Select **Party Type**: `Customer` or `Vendor`.
3. Enter legal name, billing address, and **GSTIN**. Entering a valid GSTIN auto-detects State and sets tax treatment (`Regular`, `Composition`, `Unregistered`, or `Overseas`).
4. Set optional **Credit Limits** and **Credit Days** to control overdue exposure.

---

## 3. The Complete Sales Workflow

Taily supports both fast direct billing and end-to-end multi-step sales cycles:

```
Quotation ➔ Sales Order ➔ Delivery Challan ➔ Tax Invoice ➔ Payment Receipt
```

1. **Quotation**: Draft proposals for client signoff with custom line items and validity dates.
2. **Sales Order**: Convert approved quotations into confirmed orders.
3. **Delivery Challan**: Dispatch inventory from a specific warehouse. Stock is deducted immediately without generating premature tax liabilities.
4. **Sales Invoice**: Convert delivery challans or sales orders into legal GST tax invoices. The system verifies that inventory was already dispatched to prevent double deduction.
5. **Payment Receipt**: Record incoming cash, bank transfer, UPI, or cheque against invoices. Supports partial payments and multi-invoice allocations.
6. **Sales Return (Credit Note)**: Record customer returns with automatic stock restoration and GST tax reversals.

---

## 4. The Complete Purchase Workflow

```
Purchase Order ➔ Goods Receipt (GRN) ➔ Purchase Bill ➔ Vendor Payment
```

1. **Purchase Order**: Formal purchase commitment issued to a vendor.
2. **Goods Receipt (GRN)**: Physical inspection and stock inward at the receiving warehouse.
3. **Purchase Bill**: Financial entry matching the vendor's physical tax invoice.
4. **Vendor Payment**: Record bank disbursements with automatic creditor balance reduction.
5. **Purchase Return (Debit Note)**: Return defective goods with automatic debit note creation and stock deduction.

---

## 5. Inventory & Warehouse Operations

- **Stock Transfers**: Move inventory seamlessly between warehouses (e.g. Central Plant to Retail Godown) with dual-entry audit logging.
- **Stock Adjustments**: Perform periodic physical inventory counts. Reconcile variances due to breakage, shrinkage, or counting errors.
- **Batch Tracking & FEFO**: Ensure products with expiration dates are sold in First-Expired-First-Out order.

---

## 6. Manufacturing & Assembly

For production and assembly businesses:
1. **Bill of Materials (BOM)**: Define recipe for finished goods, specifying raw material quantities and absorbed labor/overhead costs.
2. **Production Order**: Launch production runs.
3. **Execution**: Consumes raw material stock atomically, registers scrap/wastage, capitalizes finished goods into inventory, and generates the balancing double-entry accounting voucher.

---

## 7. Financial Accounting Reports

All accounting reports are derived directly from the immutable double-entry ledger:
- **Trial Balance**: Instant verification that Total Debits = Total Credits.
- **Profit & Loss**: Gross Profit, Operating Expenses, and Net Profit.
- **Balance Sheet**: Assets = Liabilities + Equity + Retained Earnings.
- **General Ledger & Day Book**: Detailed chronological transaction audit trails for any selected date range.
- **GSTR-1 & GSTR-3B**: Automated GST summaries ready for statutory filing.
