# Taily Production Deployment Guide

## 1. System Requirements & Architecture

Taily is a high-reliability, multi-tenant Cloud ERP and Financial Accounting platform built with Next.js (App Router), TypeScript, and Prisma ORM.

### Hardware Prerequisites
- **Node.js**: v18.18+ or v20.x LTS
- **RAM**: Minimum 2 GB (4 GB recommended for concurrent PDF rendering and bulk imports)
- **CPU**: 2+ Cores
- **Storage**: SSD with minimum 10 GB free space for backups and document attachments

### Target Platforms
- **PaaS**: Vercel, Railway, AWS App Runner, Render, Fly.io
- **Containers**: Docker / Kubernetes
- **Self-Hosted**: Ubuntu 22.04 LTS / Debian 12 / Rocky Linux 9 with PM2 and Nginx reverse proxy

---

## 2. Environment Variables & Secret Configuration

Production environments must never commit secrets to version control. Configure environment variables in your platform's secret manager.

| Variable Name | Required | Default / Format | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Enables Next.js production optimizations and secure cookie attributes |
| `AUTH_SECRET` | Yes | 32+ char random string | Session HMAC signing & AES-256 encryption key (`openssl rand -base64 32`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string | Direct or pooled connection URL for the production database |
| `ALLOW_DEV_AUTO_SEED`| No | `false` | **MUST** be `false` in production. Disables development bypass and test seeding |
| `NEXT_PUBLIC_APP_URL`| Yes | `https://app.taily.com` | Canonical public URL used for links, public invoices, and webhooks |
| `PORT` | No | `3000` | HTTP listening port |

---

## 3. Pre-Flight Production Checklist

Before launching production traffic:
1. [x] Run `npx tsc --noEmit` to verify type safety.
2. [x] Ensure `ALLOW_DEV_AUTO_SEED=false`.
3. [x] Set strong, randomly generated `AUTH_SECRET`.
4. [x] Run `npx prisma migrate deploy` against target PostgreSQL cluster.
5. [x] Configure SSL/TLS termination with HTTP to HTTPS redirect.
6. [x] Establish daily automated backups with off-site snapshot replication.

---

## 4. Deployment Steps

### Method A: Vercel / Cloud PaaS (Recommended)
1. Link GitHub repository to your Vercel project.
2. Under **Settings > Environment Variables**, supply:
   - `NODE_ENV=production`
   - `AUTH_SECRET=<generated_secret>`
   - `DATABASE_URL=<postgres_connection_string>`
   - `ALLOW_DEV_AUTO_SEED=false`
3. Configure Build Command:
   ```bash
   npx prisma generate && next build
   ```
4. Configure Deploy Hook or CI/CD to run migrations before activating new release:
   ```bash
   npx prisma migrate deploy
   ```

### Method B: Docker Container Deployment

Create a multi-stage `Dockerfile`:
```dockerfile
# Stage 1: Dependencies & Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

### Method C: PM2 & Nginx Self-Hosted
1. Clone code to `/var/www/taily`.
2. Run `npm ci --production=false`.
3. Generate Prisma client: `npx prisma generate`.
4. Execute database migrations: `npx prisma migrate deploy`.
5. Build Next.js application: `npm run build`.
6. Start process via PM2:
   ```bash
   pm2 start npm --name "taily" -- start
   pm2 save
   pm2 startup
   ```
7. Configure Nginx with TLS:
   ```nginx
   server {
       listen 80;
       server_name app.taily.com;
       return 301 https://$host$request_uri;
   }
   server {
       listen 443 ssl http2;
       server_name app.taily.com;
       ssl_certificate /etc/letsencrypt/live/app.taily.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/app.taily.com/privkey.pem;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

---

## 5. Health Checks & Monitoring

- **Health Check Endpoint**: `GET /api/backup` (verifies DB query connectivity) or custom `/api/health`.
- **Uptime Monitoring**: Configure Pingdom, BetterStack, or AWS Route53 health checks to poll every 60 seconds.
- **Log Monitoring**: Stream stdout to Datadog, Grafana Loki, or Papertrail. Taily logs structured JSON with automated credential redaction.
