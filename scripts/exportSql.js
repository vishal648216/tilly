const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function exportSql() {
  let sql = `-- ==========================================================\n`;
  sql += `-- TAILY ACCOUNTING SOFTWARE - DATABASE BACKUP DUMP\n`;
  sql += `-- Exported on: ${new Date().toISOString()}\n`;
  sql += `-- ==========================================================\n\n`;

  const companies = await prisma.company.findMany();
  const users = await prisma.user.findMany();
  const accounts = await prisma.account.findMany();
  const parties = await prisma.party.findMany();
  const items = await prisma.item.findMany();
  const invoices = await prisma.invoice.findMany();
  const invoiceLines = await prisma.invoiceLine.findMany();
  const expenses = await prisma.expense.findMany();
  const vouchers = await prisma.voucher.findMany();
  const voucherEntries = await prisma.voucherEntry.findMany();

  function insertSql(table, rows) {
    if (!rows || rows.length === 0) return '';
    let out = `-- Table: ${table}\n`;
    for (const r of rows) {
      const keys = Object.keys(r);
      const values = keys.map(k => {
        const v = r[k];
        if (v === null || v === undefined) return 'NULL';
        if (v instanceof Date) return `'${v.toISOString()}'`;
        if (typeof v === 'boolean') return v ? 1 : 0;
        if (typeof v === 'number') return v;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      out += `INSERT OR REPLACE INTO "${table}" ("${keys.join('", "')}") VALUES (${values.join(', ')});\n`;
    }
    return out + '\n';
  }

  sql += insertSql('Company', companies);
  sql += insertSql('User', users);
  sql += insertSql('Account', accounts);
  sql += insertSql('Party', parties);
  sql += insertSql('Item', items);
  sql += insertSql('Invoice', invoices);
  sql += insertSql('InvoiceLine', invoiceLines);
  sql += insertSql('Expense', expenses);
  sql += insertSql('Voucher', vouchers);
  sql += insertSql('VoucherEntry', voucherEntries);

  fs.writeFileSync('taily_database_dump.sql', sql, 'utf8');
  console.log(`✅ Generated taily_database_dump.sql (${(fs.statSync('taily_database_dump.sql').size / 1024).toFixed(2)} KB)`);
  await prisma.$disconnect();
}

exportSql().catch(console.error);
