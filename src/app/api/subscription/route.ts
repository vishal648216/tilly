import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { getCompanySubscription, ensureDefaultPlans } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { isFeatureAccessible, getMetricUsage } from "@/lib/subscriptionEnforcement";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription
 * Retrieves complete subscription, usage metrics, limits, and dual-condition feature status.
 */
export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    await ensureDefaultPlans();

    const sub = await getCompanySubscription(companyId);

    // Current entity counts
    const userCount = await prisma.companyMember.count({
      where: { companyId, isActive: true },
    });
    const warehouseCount = await prisma.warehouse.count({
      where: { companyId, active: true },
    });
    const productCount = await prisma.item.count({
      where: { companyId, active: true },
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthlyInvoiceCount = await prisma.invoice.count({
      where: { companyId, createdAt: { gte: monthStart, lte: monthEnd } },
    });

    const ocrUsage = await getMetricUsage(sub.subscription.id, "OCR_SCANS");
    const apiUsage = await getMetricUsage(sub.subscription.id, "API_CALLS");

    // Check features dual-condition
    const featureKeys = [
      "OCR",
      "BARCODE",
      "MULTI_WAREHOUSE",
      "ADVANCED_INVENTORY",
      "QUOTATION_WORKFLOW",
      "PRICE_LISTS",
      "CUSTOM_BRANDING",
      "REPORTS_ADVANCED",
      "API",
      "AUDIT_TRAIL",
    ];

    const featureStatus: Record<string, { planPermits: boolean; accessible: boolean }> = {};
    for (const key of featureKeys) {
      const planPermits = sub.enabledFeatures.has(key);
      const accessible = await isFeatureAccessible(companyId, key);
      featureStatus[key] = { planPermits, accessible };
    }

    // Trial remaining calculation
    let trialDaysRemaining: number | null = null;
    if (sub.status === "TRIAL" && sub.subscription.trialEndDate) {
      const msLeft = new Date(sub.subscription.trialEndDate).getTime() - Date.now();
      trialDaysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    }

    // All available public plans for comparison
    const allPlans = await prisma.plan.findMany({
      where: { isActive: true },
      include: { features: true },
      orderBy: { price: "asc" },
    });

    return NextResponse.json({
      ok: true,
      subscription: {
        id: sub.subscription.id,
        status: sub.status,
        companyStatus: context.company.status,
        plan: sub.plan,
        trialStartDate: sub.subscription.trialStartDate,
        trialEndDate: sub.subscription.trialEndDate,
        trialDaysRemaining,
        currentPeriodStart: sub.subscription.currentPeriodStart,
        currentPeriodEnd: sub.subscription.currentPeriodEnd,
      },
      usage: {
        users: { current: userCount, max: sub.limits.maxUsers },
        warehouses: { current: warehouseCount, max: sub.limits.maxWarehouses },
        products: { current: productCount, max: sub.limits.maxProducts },
        monthlyInvoices: { current: monthlyInvoiceCount, max: sub.limits.maxMonthlyInvoices },
        ocrScans: { current: ocrUsage, max: sub.limits.ocrLimit },
        apiCalls: { current: apiUsage, max: sub.limits.apiLimit },
      },
      features: featureStatus,
      availablePlans: allPlans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        price: p.price,
        billingCycle: p.billingCycle,
        limits: {
          maxUsers: p.maxUsers,
          maxWarehouses: p.maxWarehouses,
          maxProducts: p.maxProducts,
          maxMonthlyInvoices: p.maxMonthlyInvoices,
          ocrLimit: p.ocrLimit,
        },
        features: (p.features as any[]).map((f) => f.featureKey),
      })),
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
