import { NextResponse } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getClientMetadata } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    let allDevices = false;

    try {
      const body = await req.json();
      allDevices = !!body?.allDevices;
    } catch {
      // Body is optional
    }

    if (user && allDevices) {
      await prisma.session.deleteMany({
        where: { userId: user.id },
      });
    }

    await destroySession(req);

    if (user) {
      const meta = getClientMetadata(req);
      await recordAuditLog({
        userId: user.id,
        userEmail: user.email,
        action: "USER_LOGOUT",
        details: allDevices ? "User logged out from all devices" : "User logged out",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    return NextResponse.json({ ok: true, message: "Logged out successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Logout failed" }, { status: 500 });
  }
}
