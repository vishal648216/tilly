// Taily - CSRF & Origin Validation Guard
// Defense-in-depth protection against cross-site request forgery and origin manipulation

import { AuthError } from "./auth";

/**
 * Validates that an incoming state-mutating request originates from the same trusted host.
 * Checks Origin and Referer headers against the host header.
 */
export function verifyCsrfOrigin(req: Request): void {
  const method = req.method.toUpperCase();

  // Safe idempotent methods do not mutate state
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }

  const hostHeader = req.headers.get("host") || req.headers.get("x-forwarded-host");
  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");

  if (!hostHeader) {
    return; // Fallback if behind certain proxies
  }

  // 1. Check Origin header if present
  if (originHeader) {
    try {
      const originUrl = new URL(originHeader);
      // Compare origin host with request host (ignoring port differences in local testing)
      const originHost = originUrl.host.toLowerCase();
      const targetHost = hostHeader.toLowerCase();

      if (originHost !== targetHost) {
        const isLocalOrigin = originHost.includes("localhost") || originHost.includes("127.0.0.1");
        const isLocalTarget = targetHost.includes("localhost") || targetHost.includes("127.0.0.1");

        if (isLocalOrigin && isLocalTarget) {
          return;
        }

        throw new AuthError(
          "Cross-Site Request Forgery detected: Request origin does not match application host.",
          403,
          "CSRF_ORIGIN_MISMATCH"
        );
      }
      return;
    } catch (err: any) {
      if (err instanceof AuthError) throw err;
    }
  }

  // 2. Check Referer header if Origin was absent
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      const refererHost = refererUrl.host.toLowerCase();
      const targetHost = hostHeader.toLowerCase();

      if (refererHost !== targetHost) {
        const isLocalReferer = refererHost.includes("localhost") || refererHost.includes("127.0.0.1");
        const isLocalTarget = targetHost.includes("localhost") || targetHost.includes("127.0.0.1");

        if (isLocalReferer && isLocalTarget) {
          return;
        }

        throw new AuthError(
          "Cross-Site Request Forgery detected: Request referer does not match application host.",
          403,
          "CSRF_REFERER_MISMATCH"
        );
      }
      return;
    } catch (err: any) {
      if (err instanceof AuthError) throw err;
    }
  }
}
