// Taily - Session/Auth helpers (cookie-based, no third-party lib)
// For learning/MVP. Production should use iron-session or next-auth.

import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SESSION_COOKIE = "taily_session";
const SESSION_DAYS = 7;

export async function createSession(userId: string) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  const session = await prisma.session.create({
    data: { userId, expiresAt },
  });

  cookies().set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return session;
}

export async function getCurrentUser() {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return session.user;
}

export async function destroySession() {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  }
  cookies().delete(SESSION_COOKIE);
}

// Get the user's active company (first company they're a member of, or impersonated company for SUPER_ADMIN)
export async function getCurrentCompany() {
  const user = await getCurrentUser();
  if (!user) return null;

  // If Super Admin has selected an impersonated company
  if (user.role === "SUPER_ADMIN") {
    const impersonateId = cookies().get("taily_impersonate_company")?.value;
    if (impersonateId) {
      const company = await prisma.company.findUnique({
        where: { id: impersonateId },
      });
      if (company) return company;
    }
  }

  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id },
    include: { company: true },
  });

  if (membership?.company) return membership.company;

  // Fallback for Super Admin if no direct membership
  if (user.role === "SUPER_ADMIN") {
    const firstCompany = await prisma.company.findFirst({
      orderBy: { createdAt: "desc" },
    });
    return firstCompany ?? null;
  }

  return null;
}

export async function logActivity(params: {
  userId?: string | null;
  userEmail?: string | null;
  companyId?: string | null;
  action: string;
  details?: string | null;
  ipAddress?: string | null;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId || null,
        userEmail: params.userEmail || null,
        companyId: params.companyId || null,
        action: params.action,
        details: params.details || null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
}

