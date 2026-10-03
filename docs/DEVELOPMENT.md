# Taily - Developer Workflow & Standards Guide

**Date:** 2026-10-01  
**Project:** Taily  

---

## 1. Prerequisites

- **Node.js:** v18.17.0 or later (v20+ recommended)
- **Package Manager:** npm v9+ or later
- **Operating System:** Windows, macOS, or Linux

---

## 2. Quickstart Setup

### Step 1: Clone and Install
```bash
git clone <repository-url>
cd taily
npm install
```

### Step 2: Configure Environment Variables
Copy the sanitized environment template:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Review the `.env` file. For local SQLite development, no changes to `POSTGRES_URL` are needed.

### Step 3: Initialize Database Schema
Run the non-destructive local database setup command:
```bash
npm run db:setup:dev
```
This runs `scripts/prepare-db.js`, creates the local SQLite database if missing, synchronizes schema, and generates Prisma Client.

### Step 4: Seed Development Data (Optional)
To populate sample demo businesses, accounts, items, and an administrator account:
```bash
npm run db:seed
```

> **Default Development Accounts (Local Only):**
> - **Super Admin:** `admin@admin.com` | Password: `admin123`
> - **Demo Business:** `demo@taily.in` | Password: `demo123`

### Step 5: Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Available npm Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `next dev` | Starts Next.js development server with hot-reloading |
| `npm run build` | `node ./scripts/prepare-db.js && prisma generate && next build` | Safe production build (dynamic schema detection, no destructive data loss) |
| `npm run start` | `next start` | Starts Next.js production server |
| `npm run lint` | `next lint` | Runs ESLint over all TS/TSX source files |
| `npm run typecheck` | `tsc --noEmit` | Validates TypeScript types across the entire project |
| `npm run db:setup:dev` | `node ./scripts/prepare-db.js && prisma db push && prisma generate` | Safe local schema initialization |
| `npm run db:seed` | `tsx prisma/seed.ts` | Explicitly seeds default accounts and demo data |
| `npm run db:deploy` | `prisma migrate deploy` | Safely applies pending Prisma migrations in production |

---

## 4. Code Standards & Best Practices

### 4.1 Strict Multi-Tenancy
Always retrieve tenant identity through the session helper:
```typescript
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session || !session.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.item.findMany({
    where: { companyId: session.companyId }, // Mandatory tenant isolation filter
  });

  return NextResponse.json({ items });
}
```

### 4.2 Language & Tone
- All user-facing error messages, toasts, validation alerts, and logs must be written in **clear, professional English**.
- Do not mix colloquial or non-English phrases in error strings.

### 4.3 Validation Baseline
- Frontend form validation is an ergonomic enhancement; **server-side validation is mandatory**.
- Validate all incoming numbers (e.g., quantities must be $> 0$, rates must be $\ge 0$).
- Reject malformed dates and empty strings.

### 4.4 Decimal Handling
- Always parse and round currency values carefully.
- Avoid raw floating point comparisons. Use `Math.round((val + Number.EPSILON) * 100) / 100` or Decimal types for financial computations.
