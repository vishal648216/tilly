const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function generateMysqlDump() {
  let sql = `-- ==========================================================\n`;
  sql += `-- TAILY ACCOUNTING - MYSQL DATABASE DUMP (FOR CPANEL / PHPMYADMIN)\n`;
  sql += `-- Database: if0_42731043_tilly\n`;
  sql += `-- Generated on: ${new Date().toISOString()}\n`;
  sql += `-- ==========================================================\n\n`;

  sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

  // 1. User
  sql += `CREATE TABLE IF NOT EXISTS \`User\` (
  \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
  \`email\` VARCHAR(191) NOT NULL UNIQUE,
  \`name\` VARCHAR(191) NOT NULL,
  \`passwordHash\` VARCHAR(191) NOT NULL,
  \`phone\` VARCHAR(191) NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  // 2. Company
  sql += `CREATE TABLE IF NOT EXISTS \`Company\` (
  \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
  \`name\` VARCHAR(191) NOT NULL,
  \`legalName\` VARCHAR(191) NULL,
  \`email\` VARCHAR(191) NULL,
  \`phone\` VARCHAR(191) NULL,
  \`address\` TEXT NULL,
  \`city\` VARCHAR(191) NULL,
  \`state\` VARCHAR(191) NULL,
  \`pincode\` VARCHAR(191) NULL,
  \`gstin\` VARCHAR(191) NULL,
  \`pan\` VARCHAR(191) NULL,
  \`upiId\` VARCHAR(191) NULL,
  \`bankName\` VARCHAR(191) NULL,
  \`accountNo\` VARCHAR(191) NULL,
  \`ifscCode\` VARCHAR(191) NULL,
  \`branchName\` VARCHAR(191) NULL,
  \`terms\` TEXT NULL,
  \`currency\` VARCHAR(191) NOT NULL DEFAULT 'INR',
  \`financialYear\` VARCHAR(191) NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  // 3. CompanyMember
  sql += `CREATE TABLE IF NOT EXISTS \`CompanyMember\` (
  \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
  \`userId\` VARCHAR(191) NOT NULL,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`role\` VARCHAR(191) NOT NULL DEFAULT 'ADMIN',
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY \`CompanyMember_userId_companyId_key\` (\`userId\`, \`companyId\`),
  KEY \`CompanyMember_companyId_idx\` (\`companyId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  // 4. Session
  sql += `CREATE TABLE IF NOT EXISTS \`Session\` (
  \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
  \`userId\` VARCHAR(191) NOT NULL,
  \`expiresAt\` DATETIME(3) NOT NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY \`Session_userId_idx\` (\`userId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  // 5. Account
  sql += `CREATE TABLE IF NOT EXISTS \`Account\` (
  \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`code\` VARCHAR(191) NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`type\` VARCHAR(191) NOT NULL,
  \`groupId\` VARCHAR(191) NULL,
  \`openingBalance\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY \`Account_companyId_code_key\` (\`companyId\`, \`code\`),
  KEY \`Account_companyId_idx\` (\`companyId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  // 6. Party
  sql += `CREATE TABLE IF NOT EXISTS \`Party\` (
  \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`type\` VARCHAR(191) NOT NULL DEFAULT 'CUSTOMER',
  \`email\` VARCHAR(191) NULL,
  \`phone\` VARCHAR(191) NULL,
  \`gstin\` VARCHAR(191) NULL,
  \`pan\` VARCHAR(191) NULL,
  \`address\` TEXT NULL,
  \`city\` VARCHAR(191) NULL,
  \`state\` VARCHAR(191) NULL,
  \`pincode\` VARCHAR(191) NULL,
  \`openingBalance\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY \`Party_companyId_idx\` (\`companyId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  // 7. Item
  sql += `CREATE TABLE IF NOT EXISTS \`Item\` (
  \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`sku\` VARCHAR(191) NULL,
  \`barcode\` VARCHAR(191) NULL,
  \`category\` VARCHAR(191) NULL,
  \`type\` VARCHAR(191) NOT NULL DEFAULT 'PRODUCT',
  \`hsn\` VARCHAR(191) NULL,
  \`unit\` VARCHAR(191) NOT NULL DEFAULT 'PCS',
  \`salePrice\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`purchasePrice\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`gstRate\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`stock\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`minStock\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY \`Item_companyId_idx\` (\`companyId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  // 8. Voucher
  sql += `CREATE TABLE IF NOT EXISTS \`Voucher\` (
  \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`voucherNo\` VARCHAR(191) NOT NULL,
  \`type\` VARCHAR(191) NOT NULL,
  \`date\` DATETIME(3) NOT NULL,
  \`narration\` TEXT NULL,
  \`partyId\` VARCHAR(191) NULL,
  \`invoiceId\` VARCHAR(191) NULL,
  \`isReversed\` BOOLEAN NOT NULL DEFAULT false,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY \`Voucher_companyId_voucherNo_key\` (\`companyId\`, \`voucherNo\`),
  KEY \`Voucher_companyId_date_idx\` (\`companyId\`, \`date\`),
  KEY \`Voucher_companyId_type_idx\` (\`companyId\`, \`type\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  // 9. VoucherEntry
  sql += `CREATE TABLE IF NOT EXISTS \`VoucherEntry\` (
  \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
  \`voucherId\` VARCHAR(191) NOT NULL,
  \`accountId\` VARCHAR(191) NOT NULL,
  \`debit\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`credit\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  KEY \`VoucherEntry_voucherId_idx\` (\`voucherId\`),
  KEY \`VoucherEntry_accountId_idx\` (\`accountId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  // 10. Invoice
  sql += `CREATE TABLE IF NOT EXISTS \`Invoice\` (
  \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`invoiceNo\` VARCHAR(191) NOT NULL,
  \`type\` VARCHAR(191) NOT NULL DEFAULT 'SALES',
  \`partyId\` VARCHAR(191) NULL,
  \`date\` DATETIME(3) NOT NULL,
  \`dueDate\` DATETIME(3) NULL,
  \`subTotal\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`cgstTotal\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`sgstTotal\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`igstTotal\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`cessTotal\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`roundOff\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`grandTotal\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`paidAmount\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`status\` VARCHAR(191) NOT NULL DEFAULT 'UNPAID',
  \`notes\` TEXT NULL,
  \`voucherId\` VARCHAR(191) NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY \`Invoice_companyId_invoiceNo_key\` (\`companyId\`, \`invoiceNo\`),
  KEY \`Invoice_companyId_date_idx\` (\`companyId\`, \`date\`),
  KEY \`Invoice_partyId_idx\` (\`partyId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  // 11. InvoiceLine
  sql += `CREATE TABLE IF NOT EXISTS \`InvoiceLine\` (
  \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
  \`invoiceId\` VARCHAR(191) NOT NULL,
  \`itemId\` VARCHAR(191) NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`hsn\` VARCHAR(191) NULL,
  \`qty\` DECIMAL(65, 30) NOT NULL DEFAULT '1',
  \`rate\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`amount\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`gstRate\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`cgst\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`sgst\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`igst\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  KEY \`InvoiceLine_invoiceId_idx\` (\`invoiceId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  // 12. Expense
  sql += `CREATE TABLE IF NOT EXISTS \`Expense\` (
  \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
  \`companyId\` VARCHAR(191) NOT NULL,
  \`expenseDate\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`category\` VARCHAR(191) NOT NULL,
  \`amount\` DECIMAL(65, 30) NOT NULL DEFAULT '0',
  \`paymentMode\` VARCHAR(191) NOT NULL DEFAULT 'Cash',
  \`accountId\` VARCHAR(191) NOT NULL,
  \`paidFromId\` VARCHAR(191) NOT NULL,
  \`voucherId\` VARCHAR(191) NULL,
  \`notes\` TEXT NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY \`Expense_companyId_expenseDate_idx\` (\`companyId\`, \`expenseDate\`),
  KEY \`Expense_accountId_idx\` (\`accountId\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  function insertMysql(table, rows) {
    if (!rows || rows.length === 0) return '';
    let out = `-- Records for \`${table}\`\n`;
    for (const r of rows) {
      const keys = Object.keys(r);
      const values = keys.map(k => {
        const v = r[k];
        if (v === null || v === undefined) return 'NULL';
        if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
        if (typeof v === 'boolean') return v ? 1 : 0;
        if (typeof v === 'number') return v;
        return `'${String(v).replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
          switch (char) {
            case "\0": return "\\0";
            case "\x08": return "\\b";
            case "\x09": return "\\t";
            case "\x1a": return "\\z";
            case "\n": return "\\n";
            case "\r": return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
              return "\\" + char;
            default:
              return char;
          }
        })}'`;
      });
      out += `INSERT INTO \`${table}\` (\`${keys.join('`, `')}\`) VALUES (${values.join(', ')});\n`;
    }
    return out + '\n';
  }

  sql += insertMysql('User', await prisma.user.findMany());
  sql += insertMysql('Company', await prisma.company.findMany());
  sql += insertMysql('CompanyMember', await prisma.companyMember.findMany());
  sql += insertMysql('Account', await prisma.account.findMany());
  sql += insertMysql('Party', await prisma.party.findMany());
  sql += insertMysql('Item', await prisma.item.findMany());
  sql += insertMysql('Invoice', await prisma.invoice.findMany());
  sql += insertMysql('InvoiceLine', await prisma.invoiceLine.findMany());
  sql += insertMysql('Expense', await prisma.expense.findMany());
  sql += insertMysql('Voucher', await prisma.voucher.findMany());
  sql += insertMysql('VoucherEntry', await prisma.voucherEntry.findMany());

  sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

  fs.writeFileSync('taily_mysql_infinityfree.sql', sql, 'utf8');
  console.log(`✅ Generated taily_mysql_infinityfree.sql for phpMyAdmin import!`);
  await prisma.$disconnect();
}

generateMysqlDump().catch(console.error);
