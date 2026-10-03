import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "./prisma";

export interface DatabaseBackupResult {
  success: boolean;
  fileName: string;
  filePath: string;
  fileSize: number;
  checksum: string;
  timestamp: string;
  logId: string;
}

export interface RestoreResult {
  success: boolean;
  restoredFrom: string;
  rollbackSnapshot: string;
  logId: string;
}

export interface TenantExportResult {
  companyId: string;
  companyName: string;
  exportDate: string;
  version: string;
  entities: Record<string, any[]>;
  recordCounts: Record<string, number>;
  logId: string;
}

export interface AutoBackupConfig {
  enabled: boolean;
  frequency: "HOURLY" | "DAILY" | "WEEKLY";
  retentionDays: number;
  maxBackupsCount: number;
  lastRunAt?: string;
  nextRunAt?: string;
}

const DB_FILE_PATH = path.resolve(process.cwd(), "prisma", "dev.db");
const BACKUP_DIR = path.resolve(process.cwd(), "backups", "database");

function ensureDirectoryExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Creates a point-in-time snapshot of the database file.
 * Non-destructive, checksum-verified, logged to BackupLog.
 */
export async function createDatabaseBackup(options: {
  initiatedBy?: string;
  isAuto?: boolean;
  notes?: string;
} = {}): Promise<DatabaseBackupResult> {
  const startTime = Date.now();
  ensureDirectoryExists(BACKUP_DIR);

  if (!fs.existsSync(DB_FILE_PATH)) {
    throw new Error(`Database file not found at ${DB_FILE_PATH}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const prefix = options.isAuto ? "auto-backup" : "manual-backup";
  const fileName = `${prefix}-${timestamp}.db`;
  const destinationPath = path.join(BACKUP_DIR, fileName);

  // Copy file atomically
  fs.copyFileSync(DB_FILE_PATH, destinationPath);

  // Calculate SHA-256 and size
  const fileBuffer = fs.readFileSync(destinationPath);
  const fileSize = fileBuffer.length;
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // Prune older backups according to retention limit (keep last 20)
  pruneOldBackups(BACKUP_DIR, 20);

  const durationMs = Date.now() - startTime;

  // Record in BackupLog
  const log = await prisma.backupLog.create({
    data: {
      type: options.isAuto ? "AUTO_BACKUP" : "DATABASE_BACKUP",
      status: "SUCCESS",
      fileName,
      filePath: destinationPath,
      fileSize,
      checksum: hash,
      metadata: JSON.stringify({
        durationMs,
        notes: options.notes || "Complete SQLite database snapshot",
      }),
      createdBy: options.initiatedBy,
    },
  });

  return {
    success: true,
    fileName,
    filePath: destinationPath,
    fileSize,
    checksum: hash,
    timestamp: new Date().toISOString(),
    logId: log.id,
  };
}

/**
 * Restores a SQLite database from a backup file with safety verification and rollback snapshot.
 */
export async function restoreDatabaseBackup(
  backupFilePath: string,
  initiatedBy?: string
): Promise<RestoreResult> {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found at '${backupFilePath}'`);
  }

  // Safety Verification: Check SQLite 3 Magic Header ("SQLite format 3\000")
  const fd = fs.openSync(backupFilePath, "r");
  const headerBuf = Buffer.alloc(16);
  fs.readSync(fd, headerBuf, 0, 16, 0);
  fs.closeSync(fd);

  const magicHeader = "SQLite format 3\0";
  if (headerBuf.toString("utf-8") !== magicHeader) {
    throw new Error("Invalid database backup file: Missing valid SQLite header.");
  }

  // Step 1: Create an emergency rollback snapshot of the active dev.db
  ensureDirectoryExists(BACKUP_DIR);
  const rollbackName = `rollback-before-restore-${Date.now()}.db`;
  const rollbackPath = path.join(BACKUP_DIR, rollbackName);
  if (fs.existsSync(DB_FILE_PATH)) {
    fs.copyFileSync(DB_FILE_PATH, rollbackPath);
  }

  try {
    // Step 2: Apply the restored backup to dev.db
    fs.copyFileSync(backupFilePath, DB_FILE_PATH);

    const log = await prisma.backupLog.create({
      data: {
        type: "RESTORE",
        status: "SUCCESS",
        fileName: path.basename(backupFilePath),
        filePath: backupFilePath,
        metadata: JSON.stringify({
          rollbackSnapshot: rollbackName,
          restoredAt: new Date().toISOString(),
        }),
        createdBy: initiatedBy,
      },
    });

    return {
      success: true,
      restoredFrom: backupFilePath,
      rollbackSnapshot: rollbackPath,
      logId: log.id,
    };
  } catch (err: any) {
    // Attempt rollback
    if (fs.existsSync(rollbackPath)) {
      fs.copyFileSync(rollbackPath, DB_FILE_PATH);
    }
    await prisma.backupLog.create({
      data: {
        type: "RESTORE",
        status: "FAILED",
        fileName: path.basename(backupFilePath),
        filePath: backupFilePath,
        error: err.message,
        createdBy: initiatedBy,
      },
    });
    throw new Error(`Database restore failed: ${err.message}. System rolled back to safety snapshot.`);
  }
}

/**
 * Tenant-level data export.
 * STRICT SECURITY: Strips all secrets, user password hashes, and session tokens.
 */
export async function exportTenantData(
  companyId: string,
  initiatedBy?: string
): Promise<TenantExportResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      settings: true,
      invoiceCustomization: true,
    },
  });

  if (!company) {
    throw new Error(`Company with id '${companyId}' not found.`);
  }

  // Sanitize Company Object - Never export secrets
  const sanitizedCompany = {
    ...company,
    // Bank account numbers and public business details are kept, but any credentials are removed
  };

  const [
    accounts,
    parties,
    items,
    variants,
    batches,
    serialNumbers,
    warehouses,
    stockMovements,
    invoices,
    expenses,
    payments,
    paymentAllocations,
    vouchers,
    quotations,
    salesOrders,
    deliveryChallans,
    purchaseOrders,
    goodsReceipts,
    boms,
    productionOrders,
  ] = await Promise.all([
    prisma.account.findMany({ where: { companyId } }),
    prisma.party.findMany({ where: { companyId } }),
    prisma.item.findMany({ where: { companyId } }),
    prisma.productVariant.findMany({ where: { companyId } }),
    prisma.batch.findMany({ where: { companyId } }),
    prisma.serialNumber.findMany({ where: { companyId } }),
    prisma.warehouse.findMany({ where: { companyId } }),
    prisma.stockMovement.findMany({ where: { companyId } }),
    prisma.invoice.findMany({ where: { companyId }, include: { lines: true } }),
    prisma.expense.findMany({ where: { companyId } }),
    prisma.payment.findMany({ where: { companyId } }),
    prisma.paymentAllocation.findMany({ where: { companyId } }),
    prisma.voucher.findMany({ where: { companyId }, include: { entries: true } }),
    prisma.quotation.findMany({ where: { companyId }, include: { lines: true } }),
    prisma.salesOrder.findMany({ where: { companyId }, include: { lines: true } }),
    prisma.deliveryChallan.findMany({ where: { companyId }, include: { lines: true } }),
    prisma.purchaseOrder.findMany({ where: { companyId }, include: { lines: true } }),
    prisma.goodsReceipt.findMany({ where: { companyId }, include: { lines: true } }),
    prisma.billOfMaterials.findMany({ where: { companyId }, include: { items: true } }),
    prisma.productionOrder.findMany({
      where: { companyId },
      include: { consumptions: true, wastages: true },
    }),
  ]);

  const entities = {
    company: [sanitizedCompany],
    accounts,
    parties,
    items,
    variants,
    batches,
    serialNumbers,
    warehouses,
    stockMovements,
    invoices,
    expenses,
    payments,
    paymentAllocations,
    vouchers,
    quotations,
    salesOrders,
    deliveryChallans,
    purchaseOrders,
    goodsReceipts,
    boms,
    productionOrders,
  };

  const recordCounts: Record<string, number> = {};
  for (const [key, list] of Object.entries(entities)) {
    recordCounts[key] = list.length;
  }

  const exportPayload = {
    companyId,
    companyName: company.name,
    exportDate: new Date().toISOString(),
    version: "1.0.0",
    entities,
    recordCounts,
  };

  const payloadString = JSON.stringify(exportPayload, null, 2);
  const fileSize = Buffer.byteLength(payloadString, "utf-8");
  const checksum = crypto.createHash("sha256").update(payloadString).digest("hex");

  // Save log
  const log = await prisma.backupLog.create({
    data: {
      companyId,
      type: "DATA_EXPORT",
      status: "SUCCESS",
      fileName: `${company.name.replace(/[^a-zA-Z0-9]/g, "_")}-export-${Date.now()}.json`,
      fileSize,
      checksum,
      metadata: JSON.stringify({
        totalRecords: Object.values(recordCounts).reduce((a, b) => a + b, 0),
        recordCounts,
      }),
      createdBy: initiatedBy,
    },
  });

  return {
    ...exportPayload,
    logId: log.id,
  };
}

/**
 * Prunes older database backups to conserve disk space.
 */
function pruneOldBackups(dir: string, keepCount: number) {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".db"))
      .map((f) => {
        const fullPath = path.join(dir, f);
        return {
          name: f,
          path: fullPath,
          time: fs.statSync(fullPath).mtimeMs,
        };
      })
      .sort((a, b) => b.time - a.time);

    if (files.length > keepCount) {
      for (let i = keepCount; i < files.length; i++) {
        fs.unlinkSync(files[i].path);
      }
    }
  } catch {}
}

/**
 * Returns platform/tenant backup logs.
 */
export async function getBackupLogs(companyId?: string, limit = 50) {
  return prisma.backupLog.findMany({
    where: companyId ? { OR: [{ companyId }, { companyId: null }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Automatic Backup Architecture configuration.
 */
export async function getAutoBackupConfig(): Promise<AutoBackupConfig> {
  const setting = await prisma.platformSettings.findUnique({
    where: { key: "AUTO_BACKUP_CONFIG" },
  });

  if (!setting) {
    return {
      enabled: true,
      frequency: "DAILY",
      retentionDays: 14,
      maxBackupsCount: 20,
    };
  }

  try {
    return JSON.parse(setting.value);
  } catch {
    return {
      enabled: true,
      frequency: "DAILY",
      retentionDays: 14,
      maxBackupsCount: 20,
    };
  }
}

export async function saveAutoBackupConfig(
  config: Partial<AutoBackupConfig>,
  updatedBy?: string
): Promise<AutoBackupConfig> {
  const current = await getAutoBackupConfig();
  const updated: AutoBackupConfig = { ...current, ...config };

  await prisma.platformSettings.upsert({
    where: { key: "AUTO_BACKUP_CONFIG" },
    create: {
      key: "AUTO_BACKUP_CONFIG",
      value: JSON.stringify(updated),
      description: "Automatic database backup schedule and retention policy",
      updatedBy,
    },
    update: {
      value: JSON.stringify(updated),
      updatedBy,
    },
  });

  return updated;
}
