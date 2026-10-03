// Taily - Session & Active Company Management
// Secure DB-backed sessions with multi-company context switching

import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "taily_session";
const SESSION_DAYS = 7;

/**
 * Parses cookie string from request header if next/headers cookies() is unavailable
 */
export function getSessionIdFromReq(req?: Request): string | null {
  try {
    const nextCookie = cookies().get(SESSION_COOKIE)?.value;
    if (nextCookie) return nextCookie;
  } catch {
    // cookies() might throw outside of request context in some edge cases
  }

  if (req) {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
      if (match) return decodeURIComponent(match[1]);
    }
  }

  return null;
}

export async function createSession(userId: string, initialCompanyId?: string) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  let activeCompanyId = initialCompanyId;
  if (!activeCompanyId) {
    // Resolve first active company membership
    const firstMembership = await prisma.companyMember.findFirst({
      where: { userId, isActive: true },
    });
    activeCompanyId = firstMembership?.companyId;
  }

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      activeCompanyId: activeCompanyId || null,
    },
  });

  try {
    cookies().set(SESSION_COOKIE, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
  } catch (e) {
    // Handled in caller if running in non-standard context
  }

  return session;
}

export async function getSession(req?: Request) {
  const sessionId = getSessionIdFromReq(req);
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: true,
    },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return session;
}

export async function getCurrentUser(req?: Request) {
  const session = await getSession(req);
  if (!session || !session.user) return null;
  if (session.user.status !== "APPROVED") return null;
  return session.user;
}

export async function destroySession(req?: Request) {
  const sessionId = getSessionIdFromReq(req);
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  }
  try {
    cookies().delete(SESSION_COOKIE);
    cookies().delete("taily_impersonate_company");
  } catch {
    // Ignore outside request context
  }
}

/**
 * Switches the active company context for the current session.
 * Strictly verifies that the user is an active member of that company (or is SUPER_ADMIN).
 */
export async function setActiveCompany(companyId: string, req?: Request) {
  const session = await getSession(req);
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  if (!isSuperAdmin) {
    const membership = await prisma.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId: session.userId,
          companyId,
        },
      },
    });

    if (!membership || !membership.isActive) {
      throw new Error("Access denied: You are not an active member of this company.");
    }
  } else {
    // Verify target company exists
    const exists = await prisma.company.findUnique({ where: { id: companyId } });
    if (!exists) {
      throw new Error("Company not found.");
    }
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { activeCompanyId: companyId },
  });

  return companyId;
}

/**
 * Resolves the user's verified active company context.
 * Never blindly trusts a client-provided companyId.
 */
export async function getCurrentCompany(req?: Request) {
  const session = await getSession(req);
  if (!session || !session.user) return null;

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  // 1. If session has an activeCompanyId, verify and return it
  if (session.activeCompanyId) {
    if (isSuperAdmin) {
      const company = await prisma.company.findUnique({
        where: { id: session.activeCompanyId },
        include: { settings: true },
      });
      if (company) return company;
    } else {
      const membership = await prisma.companyMember.findUnique({
        where: {
          userId_companyId: {
            userId: session.userId,
            companyId: session.activeCompanyId,
          },
        },
        include: { company: { include: { settings: true } } },
      });
      if (membership && membership.isActive && membership.company) {
        return membership.company;
      }
    }
  }

  // 2. If Super Admin has legacy impersonation cookie
  if (isSuperAdmin) {
    try {
      const impersonateId = cookies().get("taily_impersonate_company")?.value;
      if (impersonateId) {
        const company = await prisma.company.findUnique({
          where: { id: impersonateId },
          include: { settings: true },
        });
        if (company) {
          // Sync with session
          await prisma.session.update({
            where: { id: session.id },
            data: { activeCompanyId: company.id },
          }).catch(() => {});
          return company;
        }
      }
    } catch {}
  }

  // 3. Fallback: Find user's first active membership
  const firstMembership = await prisma.companyMember.findFirst({
    where: { userId: session.userId, isActive: true },
    include: { company: { include: { settings: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (firstMembership?.company) {
    // Update activeCompanyId on session for future fast lookup
    await prisma.session.update({
      where: { id: session.id },
      data: { activeCompanyId: firstMembership.company.id },
    }).catch(() => {});
    return firstMembership.company;
  }

  // 4. Fallback for Super Admin with no explicit memberships
  if (isSuperAdmin) {
    const firstCompany = await prisma.company.findFirst({
      include: { settings: true },
      orderBy: { createdAt: "desc" },
    });
    if (firstCompany) {
      await prisma.session.update({
        where: { id: session.id },
        data: { activeCompanyId: firstCompany.id },
      }).catch(() => {});
      return firstCompany;
    }
  }

  return null;
}

/**
 * Returns current company membership and assigned role for the active company
 */
export async function getCurrentMembership(req?: Request) {
  const session = await getSession(req);
  if (!session || !session.user) return null;

  const company = await getCurrentCompany(req);
  if (!company) return null;

  if (session.user.role === "SUPER_ADMIN") {
    return {
      id: "superadmin-override",
      userId: session.userId,
      companyId: company.id,
      role: "SUPER_ADMIN",
      isActive: true,
      customPermissions: null,
      company,
    };
  }

  const membership = await prisma.companyMember.findUnique({
    where: {
      userId_companyId: {
        userId: session.userId,
        companyId: company.id,
      },
    },
    include: { company: true },
  });

  return membership;
}

// Backward-compatible logActivity export (delegates to recordAuditLog)
export async function logActivity(params: {
  userId?: string | null;
  userEmail?: string | null;
  companyId?: string | null;
  action: string;
  details?: string | null;
  ipAddress?: string | null;
}) {
  const { recordAuditLog } = await import("./audit");
  await recordAuditLog({
    userId: params.userId,
    userEmail: params.userEmail,
    companyId: params.companyId,
    action: params.action,
    details: params.details,
    ipAddress: params.ipAddress,
  });
}
