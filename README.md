# 🧾 Taily — Tally se bhi easy accounting

**AI-powered, GST-ready accounting software for Indian SMEs.**

> "Tally, but smarter."

## ✨ Features (MVP)

- ✅ **Double-entry ledger** — immutable, balanced, production-grade accounting engine
- ✅ **GST-ready invoicing** — CGST/SGST + IGST auto-calculation (inter-state vs intra-state)
- ✅ **Auto voucher posting** — invoice save = double-entry auto-created in backend
- ✅ **Parties management** — Customers, Vendors with GSTIN tracking
- ✅ **Items & Stock** — HSN, GST rates, stock alerts
- ✅ **Trial Balance** — always balanced, verified
- ✅ **Profit & Loss** — real-time from ledger
- ✅ **Chart of Accounts** — Indian SME standard (Tally-style groups)
- ✅ **Journal Entries** — manual debit/credit with balance validation
- ✅ **Multi-user auth** — signup, login, cookie sessions
- ✅ **Multi-company support** — one user, multiple businesses
- ✅ **Mobile responsive** — works on phone/tablet/desktop
- ✅ **100% FREE to run** — SQLite + Vercel free tier = ₹0/month

## 🚀 Quick Start (5 minutes)

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ installed
- npm (comes with Node.js)

### Setup

```bash
# 1. Clone / open the project
cd taily

# 2. Install dependencies
npm install

# 3. Create database (SQLite file, no server needed!)
npx prisma db push

# 4. Seed demo data (optional — creates demo user, company, items, parties)
npm run db:seed

# 5. Start development server
npm run dev
```

Open **http://localhost:3000**

### Demo Login

```
Email:    demo@taily.in
Password: demo1234
```

## 📁 Project Structure

```
taily/
├── prisma/
│   ├── schema.prisma      # Database schema (double-entry ledger)
│   └── seed.ts             # Demo data seeder
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Moved to (dashboard)/page.tsx
│   │   ├── globals.css          # Tailwind + component styles
│   │   ├── login/page.tsx       # Login page
│   │   ├── signup/page.tsx     # Signup (creates company too)
│   │   ├── onboarding/page.tsx # Company setup wizard
│   │   ├── (dashboard)/         # Protected route group (with sidebar)
│   │   │   ├── layout.tsx       # Dashboard layout + sidebar
│   │   │   ├── page.tsx         # Dashboard home (stats + recent invoices)
│   │   │   ├── invoices/        # Invoice list + create
│   │   │   ├── parties/         # Customer/Vendor management
│   │   │   ├── items/           # Product & stock management
│   │   │   ├── vouchers/        # Journal entry + voucher list
│   │   │   └── reports/         # Trial Balance, P&L, Chart of Accounts
│   │   └── api/
│   │       ├── auth/            # login, signup, logout
│   │       ├── invoices/        # Create invoice (auto voucher)
│   │       ├── parties/         # CRUD parties
│   │       ├── items/           # CRUD items
│   │       ├── vouchers/        # Create journal voucher
│   │       └── onboarding/      # Create company
│   ├── components/
│   │   └── Sidebar.tsx          # Dashboard sidebar navigation
│   └── lib/
│       ├── prisma.ts            # Prisma client singleton
│       ├── session.ts           # Cookie-based auth
│       ├── currency.ts          # ₹ formatting + number to words
│       ├── voucher.ts           # Double-entry voucher engine
│       ├── invoice.ts           # GST invoice + auto voucher creation
│       └── accounts.ts          # Default chart of accounts seed
├── .env                        # Environment variables (AUTH_SECRET, DATABASE_URL)
├── tailwind.config.ts          # Tailwind CSS (brand colors)
├── tsconfig.json               # TypeScript config
├── next.config.mjs             # Next.js config
└── package.json                # Dependencies & scripts
```

## 🗄️ Database Architecture

The core follows **double-entry bookkeeping principles**:

```
Every Invoice → Auto-creates a Voucher
Every Voucher → Has balanced entries (Debits = Credits)

Sales Invoice Example:
  Dr. Sundry Debtors  ₹1,180
    Cr. Sales              ₹1,000
    Cr. Output CGST         ₹90
    Cr. Output SGST         ₹90
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `User` / `Session` | Auth (cookie-based) |
| `Company` / `CompanyMember` | Multi-company + roles |
| `Account` | Chart of accounts |
| `Party` | Customers & Vendors |
| `Item` | Products with GST & stock |
| `Voucher` / `VoucherEntry` | Double-entry ledger (immutable) |
| `Invoice` / `InvoiceLine` | GST billing on top of vouchers |

## 🔧 Tech Stack (All FREE)

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend | Next.js 14 + React + TypeScript | Free |
| Styling | Tailwind CSS | Free |
| Database | SQLite (via Prisma ORM) | Free (file-based, no server!) |
| Auth | Cookie-based sessions + bcrypt | Free (built-in) |
| Hosting | Vercel (frontend) + any static host | Free tier |
| Upgrade path | SQLite → PostgreSQL (via Supabase free) | Free |

## 🛣️ Roadmap

- [ ] **Phase 1** (current): Core accounting + invoicing (MVP)
- [ ] **Phase 2**: GST e-Invoice API integration, GSTR reports
- [ ] **Phase 3**: AI bill reader (OCR), WhatsApp invoicing
- [ ] **Phase 4**: Mobile app (React Native), payroll, multi-branch
- [ ] **Phase 5**: Subscription billing, marketplace

## 📄 License

Private project. All rights reserved.
