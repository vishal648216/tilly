import { NextResponse } from "next/server";
import { getCurrentUser, logActivity } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const pendingUsers = await prisma.user.findMany({
      where: { status: "PENDING" },
      include: {
        memberships: {
          include: { company: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ pendingUsers });
  } catch (err: any) {
    console.error("Super Admin approvals GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, action, rejectionReason } = body;

    if (!userId || !action || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Valid userId and action (APPROVE/REJECT) are required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { company: true } } },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "APPROVE") {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedBy: user.email,
          rejectionReason: null,
        },
      });

      await logActivity({
        userId: user.id,
        userEmail: user.email,
        companyId: targetUser.memberships[0]?.companyId,
        action: "APPROVE_USER",
        details: `Super Admin approved account of ${targetUser.name} (${targetUser.email}) for company "${targetUser.memberships[0]?.company?.name || "N/A"}"`,
      });

      return NextResponse.json({ success: true, message: `${targetUser.name} approved successfully`, user: updated });
    } else {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          status: "REJECTED",
          rejectionReason: rejectionReason || "Rejected by Super Admin",
        },
      });

      await logActivity({
        userId: user.id,
        userEmail: user.email,
        companyId: targetUser.memberships[0]?.companyId,
        action: "REJECT_USER",
        details: `Super Admin rejected account of ${targetUser.name} (${targetUser.email}). Reason: ${rejectionReason || "None"}`,
      });

      return NextResponse.json({ success: true, message: `${targetUser.name} rejected`, user: updated });
    }
  } catch (err: any) {
    console.error("Super Admin approvals POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
