import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import {
  getCompanyNotifications,
  createSystemNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/notifications";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const notificationsData = await getCompanyNotifications(context.company.id);

    return NextResponse.json({ ok: true, ...notificationsData });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const body = await req.json();

    if (body.action === "MARK_READ" && body.id) {
      await markNotificationAsRead(body.id, context.company.id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "MARK_ALL_READ") {
      await markAllNotificationsAsRead(context.company.id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "CREATE") {
      const created = await createSystemNotification({
        companyId: context.company.id,
        type: body.type || "SYSTEM",
        title: body.title,
        message: body.message,
        severity: body.severity || "INFO",
        link: body.link,
      });
      return NextResponse.json({ ok: true, notification: created });
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return handleAuthError(error);
  }
}
