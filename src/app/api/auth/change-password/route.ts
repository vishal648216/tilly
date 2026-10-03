import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Current password, new password, and confirmation are required." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirmation do not match." },
        { status: 400 }
      );
    }

    // Password strength policy: minimum 8 chars with a number or special character
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    if (!hasNumberOrSymbol) {
      return NextResponse.json(
        { error: "New password must contain at least one digit or special character." },
        { status: 400 }
      );
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      const meta = getClientMetadata(req);
      await recordAuditLog({
        userId: user.id,
        userEmail: user.email,
        action: "PASSWORD_CHANGE_FAILED",
        details: "Incorrect current password entered during password change attempt.",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return NextResponse.json(
        { error: "The current password you entered is incorrect." },
        { status: 400 }
      );
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Invalidate all other active sessions for this user (security best practice)
    const currentSession = await getSession(req);
    if (currentSession) {
      await prisma.session.deleteMany({
        where: {
          userId: user.id,
          id: { not: currentSession.id },
        },
      });
    }

    const meta = getClientMetadata(req);
    await recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: "CHANGE_PASSWORD",
      details: "Password changed successfully. All other concurrent sessions revoked.",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      ok: true,
      message: "Password changed successfully. Other sessions have been revoked.",
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
