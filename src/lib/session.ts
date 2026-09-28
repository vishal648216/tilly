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

// Get the user's active company (first company they're a member of)
export async function getCurrentCompany() {
  const user = await getCurrentUser();
  if (!user) return null;

  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id },
    include: { company: true },
  });

  return membership?.company ?? null;
}
