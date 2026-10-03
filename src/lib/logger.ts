import { prisma } from "./prisma";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export interface LogContext {
  companyId?: string;
  userId?: string;
  action?: string;
  endpoint?: string;
  error?: any;
  metadata?: Record<string, any>;
}

const REDACTED_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "sessiontoken",
  "jwt",
  "secret",
  "authorization",
  "cookie",
  "apikey",
  "privatekey",
  "cvv",
  "creditcard",
]);

/**
 * Recursively redacts sensitive credentials, tokens, and secrets from log payloads.
 */
export function sanitizeLogPayload(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogPayload(item));
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (REDACTED_KEYS.has(lowerKey) || lowerKey.includes("password") || lowerKey.includes("secret")) {
      clean[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      clean[key] = sanitizeLogPayload(value);
    } else {
      clean[key] = value;
    }
  }

  return clean;
}

/**
 * Production-safe structured logger.
 */
export const logger = {
  info(message: string, context?: LogContext) {
    const payload = {
      level: "INFO",
      timestamp: new Date().toISOString(),
      message,
      context: sanitizeLogPayload(context),
    };
    console.log(JSON.stringify(payload));
  },

  warn(message: string, context?: LogContext) {
    const payload = {
      level: "WARN",
      timestamp: new Date().toISOString(),
      message,
      context: sanitizeLogPayload(context),
    };
    console.warn(JSON.stringify(payload));
  },

  error(message: string, context?: LogContext) {
    const sanitizedCtx = sanitizeLogPayload(context);
    const errObj = context?.error;

    const payload = {
      level: "ERROR",
      timestamp: new Date().toISOString(),
      message,
      errorMessage: errObj?.message || String(errObj || ""),
      context: sanitizedCtx,
    };
    console.error(JSON.stringify(payload));

    // Asynchronously record critical errors to database audit/activity trail if company or user is available
    if (context?.companyId || context?.action) {
      prisma.activityLog
        .create({
          data: {
            companyId: context.companyId,
            userId: context.userId,
            action: `ERROR_${context.action || "UNCAUGHT"}`,
            entity: "SYSTEM_ERROR",
            details: JSON.stringify({
              message,
              errorMessage: errObj?.message || String(errObj || ""),
              metadata: sanitizedCtx?.metadata,
            }),
          },
        })
        .catch(() => {});
    }
  },
};
