import { NextResponse } from "next/server";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assignSubscriptionToCompany } from "@/lib/plans";
import { logPlatformAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/superadmin/companies/[id]/status
 * Manage company status (ACTIVE, SUSPENDED, EXPIRED, CANCELLED) and subscription plan.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireSuperAdmin(req);
    const companyId = params.id;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { subscription: { include: { plan: true } } },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    const body = await req.json();
    const { status, suspendedReason, planCode } = body;

    const updateData: any = {};

    if (status) {
      const validStatuses = ["ACTIVE", "TRIAL", "SUSPENDED", "EXPIRED", "CANCELLED"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
      }
      updateData.status = status;

      if (status === "SUSPENDED") {
        if (!suspendedReason || typeof suspendedReason !== "string" || !suspendedReason.trim()) {
          return NextResponse.json(
            { error: "A clear suspension reason is required when suspending a company account." },
            { status: 400 }
          );
        }
        updateData.suspendedReason = suspendedReason.trim();
        updateData.suspendedAt = new Date();

        // Also suspend the subscription
        if (company.subscription) {
          await prisma.subscription.update({
            where: { id: company.subscription.id },
            data: { status: "SUSPENDED" },
          });
        }
      } else if (status === "ACTIVE" || status === "TRIAL") {
        updateData.suspendedReason = null;
        updateData.suspendedAt = null;

        // Also reactivate subscription
        if (company.subscription) {
          await prisma.subscription.update({
            where: { id: company.subscription.id },
            data: { status },
          });
        }
      }
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: updateData,
    });

    // Optional plan reassignment
    let assignedSub = null;
    if (planCode) {
      assignedSub = await assignSubscriptionToCompany(
        companyId,
        planCode,
        status === "TRIAL" ? "TRIAL" : "ACTIVE"
      );
    }

    await logPlatformAction({
      userId: admin.id,
      userEmail: admin.email,
      companyId,
      action: status === "SUSPENDED" ? "COMPANY_SUSPENDED" : "COMPANY_STATUS_UPDATED",
      entityType: "COMPANY",
      entityId: companyId,
      details: {
        previousStatus: company.status,
        newStatus: status || company.status,
        suspendedReason: updateData.suspendedReason,
        planCode: planCode || company.subscription?.plan.code,
      },
    });

    return NextResponse.json({
      ok: true,
      company: updatedCompany,
      subscription: assignedSub,
      message: `Company status successfully updated to ${status || company.status}.`,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
