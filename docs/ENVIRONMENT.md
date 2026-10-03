# Taily - Environment Variables & Configuration Baseline

**Date:** 2026-10-01  
**Project:** Taily  

---

## 1. Overview

Taily requires a small set of environment variables for database connectivity, authentication, and execution mode control. All configuration keys are mirrored in `.env.example` with sanitized placeholders.

---

## 2. Environment Variables Specification

| Variable Name | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Optional | `development` | Execution environment: `development`, `production`, or `test`. |
| `PORT` | Optional | `3000` | Port on which the Next.js server listens. |
| `AUTH_SECRET` | Required | `<secure-random-32-byte-hex>` | Cryptographic secret used for session token validation and cookie signing. |
| `DATABASE_URL` | Optional | `"file:./dev.db"` | Standard Prisma database URL. Points to SQLite locally if `POSTGRES_URL` is omitted. |
| `POSTGRES_URL` | Cloud Only | `postgresql://user:pass@host:5432/dbname?sslmode=require` | Connection string for PostgreSQL cloud deployments (Vercel Postgres, Neon, Supabase). |
| `ALLOW_DEV_AUTO_SEED` | Dev Only | `false` | Explicitly enables fallback creation of demo credentials (`admin@admin.com`, `demo@taily.in`) during local development. Strictly ignored in production. |

---

## 3. Environment Separation

### 3.1 Local Development (`.env` or `.env.local`)
```env
NODE_ENV=development
PORT=3000
AUTH_SECRET=dev-insecure-secret-key-change-for-production
DATABASE_URL="file:./dev.db"
ALLOW_DEV_AUTO_SEED=true
```

### 3.2 Production (Vercel, Railway, Render, Docker, or VM)
Set these securely in your cloud provider's dashboard:
```env
NODE_ENV=production
AUTH_SECRET=<generate-via-openssl-rand-hex-32>
POSTGRES_URL=postgresql://<db_user>:<db_password>@<db_host>:5432/<db_name>?sslmode=require
ALLOW_DEV_AUTO_SEED=false
```

To generate a strong `AUTH_SECRET`:
```bash
# On Linux/macOS:
openssl rand -hex 32

# On Windows PowerShell:
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

---

## 4. Secret Safety Checklist

- [x] `.env`, `.env.local`, and `.env.*.local` are explicitly excluded in `.gitignore`.
- [x] `.env.example` is committed with zero actual production secrets or credentials.
- [x] Database dumps (`.sql`, `.dump`, `.db`) are excluded in `.gitignore` and untracked from git index.
- [x] Auto-seeding logic in authentication routes is disabled by default in production.
- [x] Password hashes are stored using salted `bcryptjs` with work factor 10.
