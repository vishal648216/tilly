# 🚀 Taily cPanel Deployment Guide

Follow these simple steps to deploy and run **Taily** on your cPanel web hosting using **Node.js App Manager**.

---

## 📁 Included Files in Deployment Package:
1. **`taily_cpanel_upload.zip`**: Complete production bundle with Next.js pre-compiled files (`.next`), UI components, API routes, and database schema.
2. **`taily_database_backup.db`**: Live SQLite database file with all demo data, company settings, and accounting accounts.
3. **`taily_database_dump.sql`**: Full SQL dump of all tables and records.

---

## 📋 Step-by-Step cPanel Deployment:

### Step 1: Upload and Extract Files
1. Log in to your **cPanel**.
2. Open **File Manager** and navigate to your application root (e.g. `/home/username/taily` or `/public_html`).
3. Click **Upload** and upload `taily_cpanel_upload.zip`.
4. Right-click the uploaded ZIP and select **Extract**.

---

### Step 2: Configure Node.js Application in cPanel
1. In cPanel, search for and open **"Setup Node.js App"** (or **Node.js Application Manager**).
2. Click **"Create Application"**.
3. Fill in the following settings:
   - **Node.js version**: Select `18.x` or `20.x` (Recommended: `20.x`).
   - **Application mode**: `Production`
   - **Application root**: Path where files were extracted (e.g. `taily` or `public_html`).
   - **Application URL**: Select your domain or subdomain (e.g. `https://yourdomain.com`).
   - **Application startup file**: Type `server.js`
4. Click **Create**.

---

### Step 3: Install Dependencies
1. In the Node.js App page, click **"Run NPM Install"** (or open the cPanel Terminal and run `npm install`).
2. Run Prisma client generation:
   ```bash
   npx prisma generate
   ```

---

### Step 4: Setup Environment Variables
Under the **Environment variables** section of your Node.js app, add:
- `NODE_ENV` = `production`
- `PORT` = `3000`
- `DATABASE_URL` = `"file:./dev.db"`
- `AUTH_SECRET` = `your-super-secret-production-key-here-12345`

---

### Step 5: Start / Restart Application
1. Click **"Restart"** or **"Start Application"** at the top of the Node.js App page.
2. Open your website URL in the browser.

---

## 🔐 Default Admin Login Credentials:
- **Email**: `demo@taily.in`
- **Password**: `demo1234`
