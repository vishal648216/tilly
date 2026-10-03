import { NextResponse } from "next/server";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultPlans, createPlanWithFeatures } from "@/lib/plans";
import { logPlatformAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/superadmin/plans
 * List all platform subscription plans with feature lists and subscriber counts.
 */
export async function GET(req: Request) {
  try {
    const admin = await requireSuperAdmin(req);
    await ensureDefaultPlans();

    const plans = await prisma.plan.findMany({
      include: {
        features: true,
        _count: {
          select: { subscriptions: true },
        },
      },
      orderBy: { price: "asc" },
    });

    return NextResponse.json({ ok: true, plans });
  } catch (err: any) {
    return handleAuthError(err);
  }
}

/**
 * POST /api/superadmin/plans
 * Create or update a subscription plan with limits and feature toggles.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireSuperAdmin(req);

    const body = await req.json();
    const {
      id,
      code,
      name,
      description,
      price,
      billingCycle,
      trialDays,
      maxUsers,
      maxWarehouses,
      maxProducts,
      maxBranches,
      maxCompanies,
      maxMonthlyInvoices,
      ocrLimit,
      apiLimit,
      features, // array of string keys
    } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Plan code and name are required." }, { status: 400 });
    }

    let plan;
    if (id) {
      // Update existing plan
      plan = await prisma.plan.update({
        where: { id },
        data: {
          name,
          description,
          price: price !== undefined ? Number(price) : undefined,
          billingCycle: billingCycle || undefined,
          trialDays: trialDays !== undefined ? Number(trialDays) : undefined,
          maxUsers: maxUsers !== undefined ? Number(maxUsers) : undefined,
          maxWarehouses: maxWarehouses !== undefined ? Number(maxWarehouses) : undefined,
          maxProducts: maxProducts !== undefined ? Number(maxProducts) : undefined,
          maxBranches: maxBranches !== undefined ? Number(maxBranches) : undefined,
          maxCompanies: maxCompanies !== undefined ? Number(maxCompanies) : undefined,
          maxMonthlyInvoices: maxMonthlyInvoices !== undefined ? Number(maxMonthlyInvoices) : undefined,
          ocrLimit: ocrLimit !== undefined ? Number(ocrLimit) : undefined,
          apiLimit: apiLimit !== undefined ? Number(apiLimit) : undefined,
        },
      });

      // Update features if provided
      if (Array.isArray(features)) {
        await prisma.planFeature.deleteMany({ where: { planId: id } });
        await prisma.planFeature.createMany({
          data: features.map((f: string) => ({
            planId: id,
            featureKey: f.toUpperCase(),
            enabled: true,
          })),
        });
      }

      await logPlatformAction({
        userId: admin.id,
        userEmail: admin.email,
        action: "PLAN_UPDATED",
        entityType: "PLAN",
        entityId: plan.id,
        details: { name: plan.name, code: plan.code, features },
      });
    } else {
      // Create new plan
      plan = await createPlanWithFeatures(
        {
          code: code.toUpperCase(),
          name,
          description: description || "",
          price: Number(price) || 0,
          billingCycle: billingCycle || "MONTHLY",
          trialDays: trialDays !== undefined ? Number(trialDays) : 14,
          maxUsers: Number(maxUsers) || 5,
          maxWarehouses: Number(maxWarehouses) || 1,
          maxProducts: Number(maxProducts) || 500,
          maxBranches: Number(maxBranches) || 1,
          maxCompanies: Number(maxCompanies) || 1,
          maxMonthlyInvoices: Number(maxMonthlyInvoices) || 100,
          ocrLimit: Number(ocrLimit) || 0,
          apiLimit: Number(apiLimit) || 0,
        },
        Array.isArray(features) ? features : []
      );

      await logPlatformAction({
        userId: admin.id,
        userEmail: admin.email,
        action: "PLAN_CREATED",
        entityType: "PLAN",
        entityId: plan.id,
        details: { name: plan.name, code: plan.code, features },
      });
    }

    const result = await prisma.plan.findUnique({
      where: { id: plan.id },
      include: { features: true },
    });

    return NextResponse.json({ ok: true, plan: result });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
