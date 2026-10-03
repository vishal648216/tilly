// Taily - Phase 8: Plans, Subscriptions & Feature Tiers Engine
import { prisma } from "./prisma";

export const STANDARD_FEATURE_KEYS = [
  "OCR",
  "BARCODE",
  "REPORTS_ADVANCED",
  "API",
  "ADVANCED_INVENTORY", // Batches, Serial numbers
  "CUSTOM_BRANDING", // Custom templates, logo, colors
  "MULTI_WAREHOUSE",
  "QUOTATION_WORKFLOW", // Quotation -> Sales Order -> Delivery Challan
  "PRICE_LISTS",
  "AUDIT_TRAIL",
] as const;

export type StandardFeatureKey = (typeof STANDARD_FEATURE_KEYS)[number];

export interface CreatePlanInput {
  name: string;
  code: string;
  description?: string;
  price?: number;
  billingCycle?: "MONTHLY" | "YEARLY" | "LIFETIME";
  trialDays?: number;
  maxUsers?: number;
  maxWarehouses?: number;
  maxProducts?: number;
  maxBranches?: number;
  maxCompanies?: number;
  maxMonthlyInvoices?: number;
  ocrLimit?: number;
  apiLimit?: number;
  features?: string[];
}

/**
 * Initializes default SaaS plans (TRIAL, STARTER, PRO, ENTERPRISE) if the database has none.
 */
export async function ensureDefaultPlans() {
  const count = await prisma.plan.count();
  if (count > 0) {
    return await prisma.plan.findMany({ include: { features: true } });
  }

  // 1. Free Trial Plan
  await createPlanWithFeatures({
    name: "Free Trial",
    code: "TRIAL",
    description: "Full access 14-day evaluation trial for new businesses.",
    price: 0,
    trialDays: 14,
    maxUsers: 2,
    maxWarehouses: 1,
    maxProducts: 100,
    maxBranches: 1,
    maxCompanies: 1,
    maxMonthlyInvoices: 50,
    ocrLimit: 10,
    apiLimit: 0,
    features: ["BARCODE", "REPORTS_ADVANCED", "QUOTATION_WORKFLOW"],
  });

  // 2. Starter Plan
  await createPlanWithFeatures({
    name: "Starter Business",
    code: "STARTER",
    description: "Ideal for retail shops, single stores, and small service providers.",
    price: 999,
    trialDays: 0,
    maxUsers: 2,
    maxWarehouses: 1,
    maxProducts: 500,
    maxBranches: 1,
    maxCompanies: 1,
    maxMonthlyInvoices: 300,
    ocrLimit: 25,
    apiLimit: 0,
    features: ["BARCODE", "REPORTS_ADVANCED", "QUOTATION_WORKFLOW"],
  });

  // 3. Professional Plan
  await createPlanWithFeatures({
    name: "Professional Growth",
    code: "PRO",
    description: "For expanding distributors, manufacturers, and multi-location companies.",
    price: 2499,
    trialDays: 0,
    maxUsers: 5,
    maxWarehouses: 3,
    maxProducts: 5000,
    maxBranches: 3,
    maxCompanies: 2,
    maxMonthlyInvoices: 2000,
    ocrLimit: 150,
    apiLimit: 500,
    features: [
      "OCR",
      "BARCODE",
      "REPORTS_ADVANCED",
      "API",
      "ADVANCED_INVENTORY",
      "CUSTOM_BRANDING",
      "MULTI_WAREHOUSE",
      "QUOTATION_WORKFLOW",
      "PRICE_LISTS",
      "AUDIT_TRAIL",
    ],
  });

  // 4. Enterprise Plan
  await createPlanWithFeatures({
    name: "Enterprise Scaler",
    code: "ENTERPRISE",
    description: "Unlimited power, dedicated API limits, and white-label invoice customization.",
    price: 6999,
    trialDays: 0,
    maxUsers: 9999,
    maxWarehouses: 999,
    maxProducts: 999999,
    maxBranches: 99,
    maxCompanies: 10,
    maxMonthlyInvoices: 999999,
    ocrLimit: 1000,
    apiLimit: 10000,
    features: [
      "OCR",
      "BARCODE",
      "REPORTS_ADVANCED",
      "API",
      "ADVANCED_INVENTORY",
      "CUSTOM_BRANDING",
      "MULTI_WAREHOUSE",
      "QUOTATION_WORKFLOW",
      "PRICE_LISTS",
      "AUDIT_TRAIL",
    ],
  });

  return await prisma.plan.findMany({ include: { features: true } });
}

/**
 * Creates a plan with its linked PlanFeature rows in a transaction.
 */
export async function createPlanWithFeatures(
  input: CreatePlanInput | (Omit<CreatePlanInput, "features">),
  featuresArg?: string[]
) {
  const features = Array.isArray(featuresArg)
    ? featuresArg
    : (input as CreatePlanInput).features || [];
  const planData = input;

  return await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: {
        name: planData.name,
        code: planData.code.toUpperCase(),
        description: planData.description,
        price: planData.price ?? 0,
        billingCycle: planData.billingCycle ?? "MONTHLY",
        trialDays: planData.trialDays ?? 0,
        maxUsers: planData.maxUsers ?? 1,
        maxWarehouses: planData.maxWarehouses ?? 1,
        maxProducts: planData.maxProducts ?? 100,
        maxBranches: planData.maxBranches ?? 1,
        maxCompanies: planData.maxCompanies ?? 1,
        maxMonthlyInvoices: planData.maxMonthlyInvoices ?? 100,
        ocrLimit: planData.ocrLimit ?? 0,
        apiLimit: planData.apiLimit ?? 0,
      },
    });

    if (features.length > 0) {
      await tx.planFeature.createMany({
        data: features.map((featureKey) => ({
          planId: plan.id,
          featureKey: featureKey.toUpperCase(),
          isEnabled: true,
        })),
      });
    }

    return plan;
  });
}

/**
 * Assigns or updates a company's subscription to a plan.
 * Supports both object params and positional arguments.
 */
export async function assignSubscriptionToCompany(
  paramsOrCompanyId:
    | {
        companyId: string;
        planCode: string;
        status?: "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "CANCELLED";
        periodDays?: number;
      }
    | string,
  planCodeArg?: string,
  statusArg?:
    | "TRIAL"
    | "ACTIVE"
    | "SUSPENDED"
    | "EXPIRED"
    | "CANCELLED"
    | { status?: "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "CANCELLED"; periodDays?: number },
  periodDaysArg?: number
) {
  await ensureDefaultPlans();

  const companyId =
    typeof paramsOrCompanyId === "string"
      ? paramsOrCompanyId
      : paramsOrCompanyId.companyId;
  const planCode =
    typeof paramsOrCompanyId === "string"
      ? planCodeArg!
      : paramsOrCompanyId.planCode;
  const status =
    typeof paramsOrCompanyId === "string"
      ? (typeof statusArg === "object" && statusArg !== null ? (statusArg as any).status : statusArg)
      : paramsOrCompanyId.status;
  const periodDays =
    typeof paramsOrCompanyId === "string"
      ? (typeof statusArg === "object" && statusArg !== null ? (statusArg as any).periodDays : periodDaysArg)
      : paramsOrCompanyId.periodDays;

  const plan = await prisma.plan.findUnique({
    where: { code: planCode.toUpperCase() },
  });

  if (!plan) {
    throw new Error(`Plan with code '${planCode}' not found`);
  }

  const now = new Date();
  const isTrial = plan.code === "TRIAL" || status === "TRIAL";
  const duration = periodDays ?? (isTrial ? plan.trialDays || 14 : 30);

  const periodEnd = new Date(now);
  periodEnd.setDate(now.getDate() + duration);

  const subStatus = status ?? (isTrial ? "TRIAL" : "ACTIVE");

  const subscription = await prisma.subscription.upsert({
    where: { companyId },
    create: {
      companyId,
      planId: plan.id,
      status: subStatus,
      trialStartDate: isTrial ? now : null,
      trialEndDate: isTrial ? periodEnd : null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      planId: plan.id,
      status: subStatus,
      trialStartDate: isTrial ? now : null,
      trialEndDate: isTrial ? periodEnd : null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    },
    include: { plan: { include: { features: true } }, usages: true },
  });

  // Ensure company status is synchronized
  await prisma.company.update({
    where: { id: companyId },
    data: {
      status: subStatus === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
    },
  });

  return subscription;
}

/**
 * Fetches the active subscription, plan, and enabled feature keys for a company.
 * Automatically provisions a Free Trial if the company has no subscription.
 */
export async function getCompanySubscription(companyId: string) {
  let sub = await prisma.subscription.findUnique({
    where: { companyId },
    include: {
      plan: { include: { features: true } },
      usages: true,
      company: { select: { id: true, name: true, status: true, suspendedReason: true } },
    },
  });

  if (!sub) {
    // Automatically assign Free Trial
    await ensureDefaultPlans();
    sub = (await assignSubscriptionToCompany({
      companyId,
      planCode: "TRIAL",
      status: "TRIAL",
    })) as any;
  }

  const enabledFeatures = new Set(
    sub!.plan.features.filter((f) => f.isEnabled).map((f) => f.featureKey)
  );

  return {
    subscription: sub!,
    plan: sub!.plan,
    status: sub!.status,
    companyStatus: sub!.company?.status || "ACTIVE",
    isTrial: sub!.status === "TRIAL",
    enabledFeatures,
    limits: {
      maxUsers: sub!.plan.maxUsers,
      maxWarehouses: sub!.plan.maxWarehouses,
      maxProducts: sub!.plan.maxProducts,
      maxBranches: sub!.plan.maxBranches,
      maxCompanies: sub!.plan.maxCompanies,
      maxMonthlyInvoices: sub!.plan.maxMonthlyInvoices,
      ocrLimit: sub!.plan.ocrLimit,
      apiLimit: sub!.plan.apiLimit,
    },
  };
}
