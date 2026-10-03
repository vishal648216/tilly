// Taily - Persistent Dual-Tier Rate Limiting Utility
// Tier 1: In-memory sliding counter for zero-latency checks
// Tier 2: DB-backed ActivityLog fallback for cross-instance / serverless restarts

import { prisma } from "./prisma";
import { recordAuditLog } from "./audit";

interface MemoryRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryRecord>();

export type RateLimitResult = {
  allowed: boolean;
  remainingAttempts: number;
  resetAt: number;
  retryAfterSeconds: number;
};

/**
 * Checks if a specific key (e.g. `login:email` or `ip:1.2.3.4`) has exceeded rate limits.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): Promise<RateLimitResult> {
  const now = Date.now();
  let record = memoryStore.get(key);

  if (record && record.resetAt <= now) {
    memoryStore.delete(key);
    record = undefined;
  }

  // If not found in memory, query ActivityLog for recent failed actions in window
  if (!record) {
    try {
      const windowStart = new Date(now - windowMs);
      const dbCount = await prisma.activityLog.count({
        where: {
          details: { contains: key },
          action: { in: ["LOGIN_FAILED", "RATE_LIMIT_HIT", "SUSPICIOUS_ACCESS"] },
          createdAt: { gte: windowStart },
        },
      });

      if (dbCount > 0) {
        record = {
          count: dbCount,
          resetAt: now + windowMs,
        };
        memoryStore.set(key, record);
      }
    } catch {
      // Graceful fallback to memory only
    }
  }

  const currentCount = record ? record.count : 0;
  const resetAt = record ? record.resetAt : now + windowMs;
  const remaining = Math.max(0, maxAttempts - currentCount);
  const allowed = currentCount < maxAttempts;
  const retryAfterSeconds = Math.max(0, Math.ceil((resetAt - now) / 1000));

  return {
    allowed,
    remainingAttempts: remaining,
    resetAt,
    retryAfterSeconds,
  };
}

/**
 * Records a failed attempt for a key, incrementing both in-memory and database audit log.
 */
export async function recordRateLimitFailure(
  key: string,
  metadata?: {
    ipAddress?: string | null;
    userAgent?: string | null;
    userEmail?: string | null;
    action?: string;
    details?: string;
  },
  windowMs: number = 15 * 60 * 1000
): Promise<void> {
  const now = Date.now();
  const current = memoryStore.get(key) || { count: 0, resetAt: now + windowMs };
  current.count += 1;
  memoryStore.set(key, current);

  // Record audit log for persistent tracking across instances
  await recordAuditLog({
    userEmail: metadata?.userEmail || null,
    action: metadata?.action || "LOGIN_FAILED",
    details: `${key} | ${metadata?.details || "Authentication/Rate failure"} | count: ${current.count}`,
    ipAddress: metadata?.ipAddress || null,
    userAgent: metadata?.userAgent || null,
  });
}

/**
 * Clears the rate limit counter for a key upon successful action (e.g., successful login).
 */
export function resetRateLimit(key: string): void {
  memoryStore.delete(key);
}
