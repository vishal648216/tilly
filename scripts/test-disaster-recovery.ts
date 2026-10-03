/**
 * TAILY PRODUCTION HARDENING: DISASTER RECOVERY & BACKUP/RESTORE TEST
 * 
 * Verifies:
 * 1. Safe point-in-time database snapshot creation
 * 2. SQLite magic header validation (blocks corrupt files)
 * 3. Emergency rollback snapshot creation before restore
 * 4. Full database restoration after state corruption / data loss
 * 5. SHA-256 and data integrity post-restore
 */

import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { createDatabaseBackup, restoreDatabaseBackup } from "../src/lib/backup";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

async function runDisasterRecoveryTest() {
  console.log("\n=======================================================");
  console.log("💾 TAILY DISASTER RECOVERY & RESTORE AUDIT");
  console.log("=======================================================\n");

  const ts = Date.now();
  const canaryName = `Canary Corp Disaster Test ${ts}`;
  const canaryToken = `CANARY-SECRET-TOKEN-${ts}`;

  // 1. Create a Canary entity to test recovery
  console.log("1️⃣  Creating Canary Company with Critical Business Data...");
  const canaryCompany = await prisma.company.create({
    data: {
      name: canaryName,
      status: "ACTIVE",
    },
  });

  const canaryItem = await prisma.item.create({
    data: {
      companyId: canaryCompany.id,
      name: "Mission Critical Sensor",
      sku: `MC-SENSOR-${ts}`,
      salePrice: 99999,
      stock: 42,
    },
  });

  assert(canaryCompany.id !== undefined, "Canary company successfully created in active database");

  // 2. Create point-in-time backup
  console.log("\n2️⃣  Executing Point-in-Time Database Backup Snapshot...");
  const backupResult = await createDatabaseBackup({
    initiatedBy: "disaster-recovery-test",
    notes: "Snapshot containing Canary Corp",
  });

  assert(backupResult.success, "Database backup completed successfully");
  assert(fs.existsSync(backupResult.filePath), "Backup file exists on disk");
  assert(backupResult.fileSize > 100000, `Backup file size is valid (${backupResult.fileSize} bytes)`);
  assert(backupResult.checksum.length === 64, `SHA-256 checksum generated (${backupResult.checksum.slice(0, 16)}...)`);

  // 3. Test Invalid Backup Header Guard
  console.log("\n3️⃣  Testing Corrupted File Header Rejection Guard...");
  const corruptFile = path.resolve(process.cwd(), "backups", "database", `fake-corrupted-${ts}.db`);
  fs.writeFileSync(corruptFile, Buffer.from("NOT_A_VALID_SQLITE_FILE_AT_ALL_JUST_RANDOM_TEXT"));

  let rejectionTriggered = false;
  try {
    await restoreDatabaseBackup(corruptFile, "test-user");
  } catch (err: any) {
    if (err.message.includes("Missing valid SQLite header")) {
      rejectionTriggered = true;
    }
  }
  if (fs.existsSync(corruptFile)) fs.unlinkSync(corruptFile);
  assert(rejectionTriggered, "Restore engine strictly rejects corrupt files without valid SQLite magic header");

  // 4. Simulate Disaster: Catastrophic Data Loss (Delete canary company)
  console.log("\n4️⃣  Simulating Catastrophic Data Loss (Deleting Canary Company)...");
  await prisma.item.deleteMany({ where: { companyId: canaryCompany.id } });
  await prisma.company.deleteMany({ where: { id: canaryCompany.id } });

  const checkPostDisaster = await prisma.company.findUnique({
    where: { id: canaryCompany.id },
  });
  assert(checkPostDisaster === null, "Canary company confirmed permanently destroyed in live DB");

  // 5. Restore Database from Valid Backup
  console.log("\n5️⃣  Restoring Database from Snapshot...");
  // Disconnect prisma before restoring database file
  await prisma.$disconnect();

  const restoreResult = await restoreDatabaseBackup(backupResult.filePath, "disaster-recovery-test");
  assert(restoreResult.success, "Database restore process reported success");
  assert(fs.existsSync(restoreResult.rollbackSnapshot), "Emergency rollback snapshot preserved on disk");

  // Reconnect Prisma
  await prisma.$connect();

  // 6. Verify Data Restoration
  console.log("\n6️⃣  Verifying Post-Restore Data Parity...");
  const restoredCompany = await prisma.company.findUnique({
    where: { id: canaryCompany.id },
  });
  assert(restoredCompany !== null, "Canary company successfully resurrected from backup");
  assert(restoredCompany?.name === canaryName, `Company name matches exact original: '${restoredCompany?.name}'`);

  const restoredItem = await prisma.item.findUnique({
    where: { id: canaryItem.id },
  });
  assert(restoredItem !== null && restoredItem.stock.toNumber() === 42, "Canary item and stock (42 units) restored perfectly");

  // Cleanup
  console.log("\n🧹 Cleaning up disaster test data...");
  await prisma.item.deleteMany({ where: { companyId: canaryCompany.id } });
  await prisma.company.deleteMany({ where: { id: canaryCompany.id } });
  if (fs.existsSync(backupResult.filePath)) fs.unlinkSync(backupResult.filePath);
  if (fs.existsSync(restoreResult.rollbackSnapshot)) fs.unlinkSync(restoreResult.rollbackSnapshot);

  console.log("\n=======================================================");
  console.log(`📊 DISASTER RECOVERY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

runDisasterRecoveryTest().catch((err) => {
  console.error("Disaster recovery audit failure:", err);
  process.exit(1);
});
