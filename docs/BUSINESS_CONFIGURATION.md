# Taily Business Configuration & Setup Guide

## 1. Company Profile & Legal Registration

Upon creating an organization in Taily, configure company identity under **Settings > Company Profile**:
- **Legal Entity Name**: Displayed on all statutory invoices and tax returns.
- **GSTIN**: 15-character Goods and Services Tax Identification Number (e.g. `27AABCU9603R1ZM`). First 2 digits dictate State Code for automatic intra/inter-state tax routing.
- **PAN**: 10-character Permanent Account Number.
- **State & State Code**: Determines default POS (Place of Supply).
- **Registered Address**: Full street address, city, state, and pincode printed on document headers.

---

## 2. Financial Year Configuration & Period Locking

Taily natively supports standard April-to-March Indian financial years as well as custom calendar years:
- **Active Financial Year**: Sets the default date filter for Day Book, General Ledger, and P&L.
- **Period Locking**: Administrators can lock accounting entries prior to a selected date (e.g. quarterly audit signoff). Once locked, vouchers, invoices, and payments before the lock date cannot be edited or created.

---

## 3. Chart of Accounts Customization

Taily seeds an industry-standard SME Chart of Accounts following classical Tally groups:
- **Assets (1000–1999)**: Cash in Hand (1001), Bank Accounts (1002, 1003), Sundry Debtors (1100), Stock in Hand (1200), Input GST (1300–1302).
- **Liabilities (2000–2999)**: Sundry Creditors (2001), Output GST (2100–2102), Loans (2200).
- **Equity (3000–3999)**: Capital Account (3001), Drawings (3002), Retained Earnings (3003).
- **Income (4000–4999)**: Sales Accounts (4001), Sales Returns (4002), Other Income (4100).
- **Expenses (5000–5999)**: Purchases (5001), Cost of Goods Sold (5400), Operating Expenses (5100–5600).

Custom accounts and sub-ledgers can be added under any primary group without altering double-entry balance constraints.

---

## 4. Invoice Numbering Sequences

Customizable sequential prefixes ensure compliance and audit clarity:
- **Sales Invoices**: `INV-2026-{0001}` or `SL/{BRANCH}/{0001}`
- **Quotations**: `QTN-2026-{0001}`
- **Sales Orders**: `SO-2026-{0001}`
- **Delivery Challans**: `DC-2026-{0001}`
- **Purchase Orders**: `PO-2026-{0001}`
- **Credit Notes**: `CN-2026-{0001}`
- **Debit Notes**: `DN-2026-{0001}`

Sequences are auto-incrementing, collision-safe, and isolated per tenant company.

---

## 5. Invoice Print Templates & Custom Branding

Under **Settings > Branding & Invoice Templates**:
- **Templates Available**:
  - `CLASSIC`: Traditional corporate layout with formal tabular borders.
  - `MODERN`: Sleek, contemporary design with subtle header accents.
  - `MINIMAL`: Clean whitespace aesthetic, ideal for high-tech services.
  - `GST_DETAILED`: Full statutory breakdown including HSN summary, CGST/SGST/IGST split columns, and Place of Supply.
- **Custom Branding**:
  - Upload corporate logo (PNG / JPEG / WebP).
  - Primary Brand Accent Color (HEX format).
  - Bank Account Details & UPI QR Code for instant client payments.
  - Terms & Conditions and Authorized Signatory stamp upload.

---

## 6. Modular Feature Flags & Business Vertical Presets

Taily adapts to specific business models via **Settings > Features**:
- **Manufacturing / Production**: Enables Bill of Materials (BOM), Production Orders, component consumption, scrap recording, and finished goods capitalization.
- **Batch & Expiry Tracking**: Enables pharmaceutical and FMCG FEFO (First-Expired-First-Out) dispatching.
- **Serial Number Tracking**: Enables electronics IMEI/serial unit-level registration.
- **Multi-Warehouse**: Enables inter-warehouse stock transfers and location-based delivery challans.
- **OCR Smart Bill Scanning**: Enables AI-assisted extraction of vendor bills into draft purchase entries.
