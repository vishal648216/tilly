import { NextResponse } from "next/server";
import { getCurrentUser, logActivity } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      include: {
        memberships: {
          include: { company: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error("Super Admin users GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, status, role, newPassword } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (role) dataToUpdate.role = role;
    if (newPassword && newPassword.length >= 6) {
      dataToUpdate.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    await logActivity({
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE_USER",
      details: `Updated user ${updated.email} (${Object.keys(dataToUpdate).join(", ")})`,
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    console.error("Super Admin users PATCH error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json({ error: "Cannot delete your own Super Admin account" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.delete({ where: { id: userId } });

    await logActivity({
      userId: user.id,
      userEmail: user.email,
      action: "DELETE_USER",
      details: `Super Admin deleted user ${targetUser.name} (${targetUser.email})`,
    });

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (err: any) {
    console.error("Super Admin users DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
