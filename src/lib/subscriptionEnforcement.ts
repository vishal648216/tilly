// Taily - Phase 8: Server-Side Plan Limit & Company Status Enforcement Engine
// Strict backend enforcement: Plans and status are NEVER enforced solely on the client.

import { prisma } from "./prisma";
import { getCompanySubscription } from "./plans";
import { getCompanySettings } from "./featureFlags";

export class SubscriptionError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 403, code = "SUBSCRIPTION_RESTRICTION") {
    super(message);
    this.name = "SubscriptionError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Checks if a company is allowed to perform operational actions.
 * Throws SubscriptionError if company is SUSPENDED, EXPIRED, or CANCELLED.
 * Automatically checks and transitions expired trials to EXPIRED.
 */
export async function checkCompanyStatus(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, status: true, suspendedReason: true },
  });

  if (!company) {
    throw new SubscriptionError("Company not found", 404, "NOT_FOUND");
  }

  // 1. Direct Company Suspension
  if (company.status === "SUSPENDED") {
    throw new SubscriptionError(
      `This business account is SUSPENDED${
        company.suspendedReason ? `: ${company.suspendedReason}` : "."
      } All financial transactions and operational modifications are blocked.`,
      403,
      "COMPANY_SUSPENDED"
    );
  }

  // 2. Subscription Status & Trial Expiration Check
  const subData = await getCompanySubscription(companyId);
  const now = new Date();

  // Handle Trial Expiration
  if (subData.status === "TRIAL" && subData.subscription.trialEndDate) {
    if (now > new Date(subData.subscription.trialEndDate)) {
      // Transition to EXPIRED
      await prisma.subscription.update({
        where: { companyId },
        data: { status: "EXPIRED" },
      });
      await prisma.company.update({
        where: { id: companyId },
        data: { status: "EXPIRED" },
      });
      throw new SubscriptionError(
        "Your 14-day Free Trial has expired. Please upgrade your plan to continue recording transactions.",
        402,
        "TRIAL_EXPIRED"
      );
    }
  }

  if (subData.status === "EXPIRED" || company.status === "EXPIRED") {
    throw new SubscriptionError(
      "Your subscription has EXPIRED. Please renew or upgrade your plan to create transactions.",
      402,
      "SUBSCRIPTION_EXPIRED"
    );
  }

  if (subData.status === "CANCELLED" || company.status === "CANCELLED") {
    throw new SubscriptionError(
      "Your subscription is CANCELLED. Please reactivate your account.",
      403,
      "SUBSCRIPTION_CANCELLED"
    );
  }

  if (subData.status === "SUSPENDED") {
    throw new SubscriptionError(
      "Your subscription is SUSPENDED. Please contact administrator.",
      403,
      "SUBSCRIPTION_SUSPENDED"
    );
  }
}

/**
 * Enforces User limit per plan.
 */
export async function canCreateUser(companyId: string): Promise<{
  allowed: boolean;
  reason?: string;
  current: number;
  max: number;
}> {
  await checkCompanyStatus(companyId);
  const sub = await getCompanySubscription(companyId);
  const max = sub.limits.maxUsers;

  const current = await prisma.companyMember.count({
    where: { companyId, isActive: true },
  });

  if (current >= max) {
    return {
      allowed: false,
      reason: `Plan limit reached: You have ${current} of ${max} permitted team members on the ${sub.plan.name} plan.`,
      current,
      max,
    };
  }

  return { allowed: true, current, max };
}

/**
 * Enforces Warehouse limit per plan.
 */
export async function canCreateWarehouse(companyId: string): Promise<{
  allowed: boolean;
  reason?: string;
  current: number;
  max: number;
}> {
  await checkCompanyStatus(companyId);
  const sub = await getCompanySubscription(companyId);
  const max = sub.limits.maxWarehouses;

  const current = await prisma.warehouse.count({
    where: { companyId, active: true },
  });

  if (current >= max) {
    return {
      allowed: false,
      reason: `Plan limit reached: You have ${current} of ${max} allowed warehouses on the ${sub.plan.name} plan. Upgrade to Professional for multi-warehouse management.`,
      current,
      max,
    };
  }

  return { allowed: true, current, max };
}

/**
 * Enforces Product/Catalog limit per plan.
 */
export async function canCreateProduct(companyId: string): Promise<{
  allowed: boolean;
  reason?: string;
  current: number;
  max: number;
}> {
  await checkCompanyStatus(companyId);
  const sub = await getCompanySubscription(companyId);
  const max = sub.limits.maxProducts;

  const current = await prisma.item.count({
    where: { companyId, active: true },
  });

  if (current >= max) {
    return {
      allowed: false,
      reason: `Plan limit reached: You have ${current} of ${max} products on the ${sub.plan.name} plan.`,
      current,
      max,
    };
  }

  return { allowed: true, current, max };
}

/**
 * Enforces Monthly Invoice limit per plan.
 */
export async function canCreateInvoice(companyId: string): Promise<{
  allowed: boolean;
  reason?: string;
  current: number;
  max: number;
}> {
  await checkCompanyStatus(companyId);
  const sub = await getCompanySubscription(companyId);
  const max = sub.limits.maxMonthlyInvoices;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const current = await prisma.invoice.count({
    where: {
      companyId,
      createdAt: { gte: monthStart, lte: monthEnd },
    },
  });

  if (current >= max) {
    return {
      allowed: false,
      reason: `Monthly billing limit reached: You have created ${current} of ${max} allowed invoices this billing cycle on the ${sub.plan.name} plan.`,
      current,
      max,
    };
  }

  return { allowed: true, current, max };
}

/**
 * Enforces OCR Document Scanning feature and monthly scan quota.
 */
export async function canUseOCR(companyId: string): Promise<{
  allowed: boolean;
  reason?: string;
  current?: number;
  max?: number;
}> {
  await checkCompanyStatus(companyId);
  const isEnabled = await isFeatureAccessible(companyId, "OCR");
  if (!isEnabled) {
    return {
      allowed: false,
      reason: "OCR Smart Bill extraction is not permitted by your plan. Upgrade to Professional to unlock OCR.",
    };
  }

  const sub = await getCompanySubscription(companyId);
  const max = sub.limits.ocrLimit;
  if (max === 0) {
    return { allowed: false, reason: "OCR scans not included in your current plan." };
  }

  // Check usage
  const usage = await getMetricUsage(sub.subscription.id, "OCR_SCANS");
  if (usage >= max) {
    return {
      allowed: false,
      reason: `Monthly OCR limit reached (${usage}/${max} scans used).`,
      current: usage,
      max,
    };
  }

  return { allowed: true, current: usage, max };
}

/**
 * Enforces API access per plan.
 */
export async function canUseAPI(companyId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  await checkCompanyStatus(companyId);
  const isEnabled = await isFeatureAccessible(companyId, "API");
  if (!isEnabled) {
    return {
      allowed: false,
      reason: "REST API developer access requires Professional or Enterprise plan.",
    };
  }
  return { allowed: true };
}

/**
 * Enforces Custom White-label Branding per plan.
 */
export async function canUseCustomBranding(companyId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  await checkCompanyStatus(companyId);
  const isEnabled = await isFeatureAccessible(companyId, "CUSTOM_BRANDING");
  if (!isEnabled) {
    return {
      allowed: false,
      reason: "Custom invoice templates and color branding require Professional or Enterprise plan.",
    };
  }
  return { allowed: true };
}

/**
 * DUAL CONDITION CHECK:
 * A feature is available only when:
 * Company setting permits it AND Plan permits it!
 *
 * Example:
 * OCR: Plan permits it AND Company setting permits it.
 */
export async function isFeatureAccessible(
  companyId: string,
  featureKey: string
): Promise<boolean> {
  const sub = await getCompanySubscription(companyId);

  // 1. Check if the active plan permits it
  const planPermits = sub.enabledFeatures.has(featureKey.toUpperCase());
  if (!planPermits) {
    return false;
  }

  // 2. Check if company settings permits it (for features controlled by settings toggles)
  const settings = await getCompanySettings(companyId);
  let customFeatures: Record<string, any> = {};
  if (settings.featuresConfig) {
    try {
      customFeatures = typeof settings.featuresConfig === "string"
        ? JSON.parse(settings.featuresConfig)
        : settings.featuresConfig;
    } catch {
      customFeatures = {};
    }
  }

  switch (featureKey.toUpperCase()) {
    case "OCR":
      return customFeatures.ocrEnabled !== false;
    case "BARCODE":
      return Boolean(settings.barcodeEnabled || customFeatures.barcodeEnabled);
    case "MULTI_WAREHOUSE":
      return Boolean(settings.multiWarehouseEnabled || customFeatures.multiWarehouseEnabled);
    case "ADVANCED_INVENTORY":
      return Boolean(settings.batchEnabled || settings.serialEnabled || customFeatures.advancedInventoryEnabled);
    case "QUOTATION_WORKFLOW":
      return Boolean(settings.quotationEnabled || settings.salesOrderEnabled || settings.deliveryChallanEnabled || customFeatures.quotationWorkflowEnabled);
    case "PRICE_LISTS":
      return Boolean(settings.priceListsEnabled || customFeatures.priceListsEnabled);
    case "API":
      return customFeatures.apiEnabled !== false;
    case "CUSTOM_BRANDING":
      return customFeatures.customBrandingEnabled !== false;
    default:
      return Boolean(customFeatures[featureKey.toLowerCase()] ?? true);
  }
}

/**
 * Records usage increment for a subscription metric.
 */
export async function recordUsage(
  companyId: string,
  metric: string,
  delta = 1
): Promise<void> {
  const sub = await getCompanySubscription(companyId);
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  await prisma.subscriptionUsage.upsert({
    where: {
      subscriptionId_metric: {
        subscriptionId: sub.subscription.id,
        metric: metric.toUpperCase(),
      },
    },
    create: {
      subscriptionId: sub.subscription.id,
      metric: metric.toUpperCase(),
      currentUsage: delta,
      periodStart,
      periodEnd,
    },
    update: {
      currentUsage: { increment: delta },
    },
  });
}

/**
 * Gets current period usage count for a metric.
 */
export async function getMetricUsage(subscriptionId: string, metric: string): Promise<number> {
  const usage = await prisma.subscriptionUsage.findUnique({
    where: {
      subscriptionId_metric: {
        subscriptionId,
        metric: metric.toUpperCase(),
      },
    },
  });

  return usage?.currentUsage ?? 0;
}
