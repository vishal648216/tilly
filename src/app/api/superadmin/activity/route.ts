import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
    }

    const activities = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ activities });
  } catch (err: any) {
    console.error("Super Admin activities GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
