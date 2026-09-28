const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('=============================================');
  console.log('       TAILY SYSTEM HEALTH & DATA AUDIT      ');
  console.log('=============================================');

  // 1. Company
  const companies = await prisma.company.findMany();
  console.log(`✅ [1/8] Companies (${companies.length}):`, companies.map(c => c.name).join(', '));

  // 2. Users
  const users = await prisma.user.findMany();
  console.log(`✅ [2/8] Users (${users.length}):`, users.map(u => u.email).join(', '));

  // 3. Chart of Accounts
  const accounts = await prisma.account.findMany();
  console.log(`✅ [3/8] Chart of Accounts (${accounts.length} heads loaded)`);

  // 4. Invoices
  const invoices = await prisma.invoice.findMany({ include: { lines: true, party: true } });
  const sales = invoices.filter(i => i.type === 'SALES');
  const purchases = invoices.filter(i => i.type === 'PURCHASE');
  console.log(`✅ [4/8] Invoices (${invoices.length} total): ${sales.length} Sales, ${purchases.length} Purchases`);

  // 5. Parties (Customers / Vendors)
  const parties = await prisma.party.findMany();
  const customers = parties.filter(p => p.type === 'CUSTOMER');
  const vendors = parties.filter(p => p.type === 'VENDOR');
  console.log(`✅ [5/8] CRM Parties (${parties.length} total): ${customers.length} Customers, ${vendors.length} Vendors`);

  // 6. Stock Items & Services
  const items = await prisma.item.findMany();
  const products = items.filter(i => i.type === 'PRODUCT');
  const services = items.filter(i => i.type === 'SERVICE');
  console.log(`✅ [6/8] Catalog (${items.length} total): ${products.length} Products, ${services.length} Services`);

  // 7. Expenses
  const expenses = await prisma.expense.findMany();
  const totalExp = expenses.reduce((s, e) => s + parseFloat(e.amount.toString()), 0);
  console.log(`✅ [7/8] Expenses (${expenses.length} records): Total ₹${totalExp.toFixed(2)}`);

  // 8. Double Entry Accounting Balance Validation
  const vouchers = await prisma.voucher.findMany({ include: { entries: true } });
  console.log(`✅ [8/8] Double-Entry Ledger Vouchers (${vouchers.length} total posted)`);

  let unbalanced = 0;
  for (const v of vouchers) {
    const dr = v.entries.reduce((s, e) => s + parseFloat(e.debit.toString()), 0);
    const cr = v.entries.reduce((s, e) => s + parseFloat(e.credit.toString()), 0);
    if (Math.abs(dr - cr) > 0.01) {
      console.error(`❌ Unbalanced voucher: ${v.voucherNo} | Dr: ₹${dr} != Cr: ₹${cr}`);
      unbalanced++;
    }
  }

  if (unbalanced === 0) {
    console.log('🌟 [AUDIT PASSED] 100% Mathematical Ledger Accuracy: All Debits equal Credits across the system!');
  } else {
    console.error(`⚠️ Found ${unbalanced} unbalanced vouchers.`);
  }

  console.log('=============================================');
  await prisma.$disconnect();
}

check().catch(e => {
  console.error('Audit failed with error:', e);
  process.exit(1);
});
