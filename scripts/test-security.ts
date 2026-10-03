// Taily - Phase 1 Security & Multi-Tenancy Automated Test Suite
// Verifies Tenant Isolation, IDOR Prevention, RBAC Roles, Company Switching & Audit Logging

import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession, setActiveCompany, getSession } from "../src/lib/session";
import { requireAuth, requireCompanyAccess, requirePermission, validateEntityBelongsToCompany, AuthError } from "../src/lib/auth";
import { PERMISSIONS, ROLES, hasPermission } from "../src/lib/permissions";
import { makePayment, receivePayment } from "../src/lib/payment";
import { createInvoice } from "../src/lib/invoice";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedCount++;
  }
}

async function runSecurityTests() {
  console.log("\n=======================================================");
  console.log("🛡️  TAILY PHASE 1: SECURITY & MULTI-TENANCY TEST SUITE");
  console.log("=======================================================\n");

  const salt = await bcrypt.hash("test@1234", 10);

  // 1. Create Isolated Test Companies
  const compA = await prisma.company.upsert({
    where: { id: "test-corp-a" },
    update: {},
    create: {
      id: "test-corp-a",
      name: "Alpha Corp A",
      legalName: "Alpha Corp Private Limited",
      gstin: "27AAAAA0000A1Z5",
      state: "Maharashtra",
    },
  });

  const compB = await prisma.company.upsert({
    where: { id: "test-corp-b" },
    update: {},
    create: {
      id: "test-corp-b",
      name: "Beta Corp B",
      legalName: "Beta Corp Private Limited",
      gstin: "24BBBBB0000B1Z5",
      state: "Gujarat",
    },
  });

  // 2. Create Users with Diverse RBAC Roles
  const userAdminA = await prisma.user.upsert({
    where: { email: "admin-a@test.com" },
    update: { status: "APPROVED" },
    create: {
      email: "admin-a@test.com",
      name: "Admin User A",
      passwordHash: salt,
      status: "APPROVED",
      role: "USER",
    },
  });

  const userAdminB = await prisma.user.upsert({
    where: { email: "admin-b@test.com" },
    update: { status: "APPROVED" },
    create: {
      email: "admin-b@test.com",
      name: "Admin User B",
      passwordHash: salt,
      status: "APPROVED",
      role: "USER",
    },
  });

  const userViewerA = await prisma.user.upsert({
    where: { email: "viewer-a@test.com" },
    update: { status: "APPROVED" },
    create: {
      email: "viewer-a@test.com",
      name: "Viewer User A",
      passwordHash: salt,
      status: "APPROVED",
      role: "USER",
    },
  });

  const userSalesA = await prisma.user.upsert({
    where: { email: "sales-a@test.com" },
    update: { status: "APPROVED" },
    create: {
      email: "sales-a@test.com",
      name: "Sales User A",
      passwordHash: salt,
      status: "APPROVED",
      role: "USER",
    },
  });

  const userInventoryA = await prisma.user.upsert({
    where: { email: "inventory-a@test.com" },
    update: { status: "APPROVED" },
    create: {
      email: "inventory-a@test.com",
      name: "Inventory User A",
      passwordHash: salt,
      status: "APPROVED",
      role: "USER",
    },
  });

  // 3. Establish Memberships
  await prisma.companyMember.upsert({
    where: { userId_companyId: { userId: userAdminA.id, companyId: compA.id } },
    update: { role: ROLES.COMPANY_ADMIN, isActive: true },
    create: { userId: userAdminA.id, companyId: compA.id, role: ROLES.COMPANY_ADMIN, isActive: true },
  });

  // Ensure userAdminA has NO membership in compB initially
  await prisma.companyMember.deleteMany({
    where: { userId: userAdminA.id, companyId: compB.id },
  });

  await prisma.companyMember.upsert({
    where: { userId_companyId: { userId: userAdminB.id, companyId: compB.id } },
    update: { role: ROLES.COMPANY_ADMIN, isActive: true },
    create: { userId: userAdminB.id, companyId: compB.id, role: ROLES.COMPANY_ADMIN, isActive: true },
  });

  await prisma.companyMember.upsert({
    where: { userId_companyId: { userId: userViewerA.id, companyId: compA.id } },
    update: { role: ROLES.VIEWER, isActive: true },
    create: { userId: userViewerA.id, companyId: compA.id, role: ROLES.VIEWER, isActive: true },
  });

  await prisma.companyMember.upsert({
    where: { userId_companyId: { userId: userSalesA.id, companyId: compA.id } },
    update: { role: ROLES.SALES_USER, isActive: true },
    create: { userId: userSalesA.id, companyId: compA.id, role: ROLES.SALES_USER, isActive: true },
  });

  await prisma.companyMember.upsert({
    where: { userId_companyId: { userId: userInventoryA.id, companyId: compA.id } },
    update: { role: ROLES.INVENTORY_USER, isActive: true },
    create: { userId: userInventoryA.id, companyId: compA.id, role: ROLES.INVENTORY_USER, isActive: true },
  });

  // 4. Create Company B Resources
  const partyB = await prisma.party.upsert({
    where: { id: "test-party-b" },
    update: {},
    create: {
      id: "test-party-b",
      companyId: compB.id,
      name: "Company B Vendor Ltd",
      type: "VENDOR",
    },
  });

  const itemB = await prisma.item.upsert({
    where: { id: "test-item-b" },
    update: {},
    create: {
      id: "test-item-b",
      companyId: compB.id,
      name: "Company B Secret Product",
      salePrice: 500,
      stock: 100,
    },
  });

  const invoiceB = await prisma.invoice.upsert({
    where: { companyId_invoiceNo: { companyId: compB.id, invoiceNo: "INV-B-000001" } },
    update: {},
    create: {
      companyId: compB.id,
      invoiceNo: "INV-B-000001",
      type: "SALES",
      date: new Date(),
      subTotal: 1000,
      grandTotal: 1180,
      paidAmount: 0,
      status: "UNPAID",
    },
  });

  // Create sessions
  const sessionAdminA = await createSession(userAdminA.id, compA.id);
  const sessionViewerA = await createSession(userViewerA.id, compA.id);
  const sessionSalesA = await createSession(userSalesA.id, compA.id);
  const sessionInventoryA = await createSession(userInventoryA.id, compA.id);

  console.log("--- TEST GROUP 1: IDOR & Cross-Company Data Isolation ---");

  // TEST 1: Entity validation blocks cross-tenant access to Company B's invoice
  try {
    await validateEntityBelongsToCompany("invoice", invoiceB.id, compA.id);
    assert(false, "Company A should NOT be able to access Company B invoice");
  } catch (err: any) {
    assert(err instanceof AuthError && err.code === "NOT_FOUND_OR_CROSS_TENANT", "IDOR Check: Blocked Company A accessing Company B invoice");
  }

  // TEST 2: Entity validation blocks cross-tenant access to Company B's item
  try {
    await validateEntityBelongsToCompany("item", itemB.id, compA.id);
    assert(false, "Company A should NOT be able to access Company B item");
  } catch (err: any) {
    assert(err instanceof AuthError && err.code === "NOT_FOUND_OR_CROSS_TENANT", "IDOR Check: Blocked Company A accessing Company B item");
  }

  // TEST 3: Entity validation blocks cross-tenant access to Company B's party
  try {
    await validateEntityBelongsToCompany("party", partyB.id, compA.id);
    assert(false, "Company A should NOT be able to access Company B party");
  } catch (err: any) {
    assert(err instanceof AuthError && err.code === "NOT_FOUND_OR_CROSS_TENANT", "IDOR Check: Blocked Company A accessing Company B party");
  }

  // TEST 4: Payment Mutation IDOR Protection
  try {
    await receivePayment({
      companyId: compA.id,
      invoiceId: invoiceB.id,
      amount: 100,
      date: new Date(),
      mode: "CASH",
    });
    assert(false, "Company A should NOT be able to record payment on Company B invoice");
  } catch (err: any) {
    assert(err.message.includes("Cross-tenant access violation"), "IDOR Check: Blocked payment recorded by Company A on Company B invoice");
  }

  // TEST 5: Invoice Creation referencing Company B Item
  try {
    await createInvoice({
      companyId: compA.id,
      type: "SALES",
      date: new Date(),
      isInterState: false,
      lines: [
        {
          itemId: itemB.id, // Malicious item ID from Company B!
          name: "Company B Secret Product",
          qty: 1,
          rate: 500,
          gstRate: 18,
        },
      ],
    });
    assert(false, "Company A should NOT be able to sell Company B's item");
  } catch (err: any) {
    assert(err.message.includes("Cross-tenant access violation"), "IDOR Check: Blocked invoice creation referencing Company B item");
  }

  // TEST 6: Invoice Creation referencing Company B Party
  try {
    await createInvoice({
      companyId: compA.id,
      type: "SALES",
      partyId: partyB.id, // Malicious party ID from Company B!
      date: new Date(),
      isInterState: false,
      lines: [
        {
          name: "Generic Test Product",
          qty: 1,
          rate: 100,
          gstRate: 0,
        },
      ],
    });
    assert(false, "Company A should NOT be able to bill Company B's customer");
  } catch (err: any) {
    assert(err.message.includes("Cross-tenant access violation"), "IDOR Check: Blocked invoice creation referencing Company B party");
  }

  console.log("\n--- TEST GROUP 2: Role-Based Access Control (RBAC) ---");

  // TEST 7: Viewer cannot create invoices
  const viewerCanCreate = hasPermission(ROLES.VIEWER, PERMISSIONS.SALES_CREATE);
  assert(!viewerCanCreate, "RBAC: VIEWER role is NOT granted SALES_CREATE permission");

  // TEST 8: Sales User cannot manage roles
  const salesCanManageRoles = hasPermission(ROLES.SALES_USER, PERMISSIONS.ROLE_MANAGE);
  assert(!salesCanManageRoles, "RBAC: SALES_USER role is NOT granted ROLE_MANAGE permission");

  // TEST 9: Inventory User cannot modify accounting vouchers
  const inventoryCanCreateVoucher = hasPermission(ROLES.INVENTORY_USER, PERMISSIONS.VOUCHER_CREATE);
  assert(!inventoryCanCreateVoucher, "RBAC: INVENTORY_USER role is NOT granted VOUCHER_CREATE permission");

  // TEST 10: Company Admin has full permissions
  const adminHasCompanyManage = hasPermission(ROLES.COMPANY_ADMIN, PERMISSIONS.COMPANY_MANAGE);
  const adminHasSalesCreate = hasPermission(ROLES.COMPANY_ADMIN, PERMISSIONS.SALES_CREATE);
  assert(adminHasCompanyManage && adminHasSalesCreate, "RBAC: COMPANY_ADMIN role has full permissions within tenant");

  console.log("\n--- TEST GROUP 3: Session Security & Company Switching ---");

  // TEST 11: Unauthenticated request fails requireAuth
  const fakeEmptyReq = new Request("http://localhost:3000/api/invoices");
  try {
    await requireAuth(fakeEmptyReq);
    assert(false, "Unauthenticated request should throw AuthError 401");
  } catch (err: any) {
    assert(err instanceof AuthError && err.statusCode === 401, "Session Security: Unauthenticated request safely rejected (401)");
  }

  // TEST 12: Unauthorized Company Switch rejected
  const reqUserA = new Request("http://localhost:3000/api/companies/switch", {
    headers: { cookie: `taily_session=${sessionAdminA.id}` },
  });
  try {
    // Admin A tries to switch to Company B (where they have NO membership)
    await setActiveCompany(compB.id, reqUserA);
    assert(false, "User should NOT be allowed to switch into a company they do not belong to");
  } catch (err: any) {
    assert(err.message.includes("Access denied"), "Multi-Company: Cross-company switch denied for non-member");
  }

  // TEST 13: Authorized Company Switch succeeds
  // Give User A membership in Company B as VIEWER
  await prisma.companyMember.upsert({
    where: { userId_companyId: { userId: userAdminA.id, companyId: compB.id } },
    update: { role: ROLES.VIEWER, isActive: true },
    create: { userId: userAdminA.id, companyId: compB.id, role: ROLES.VIEWER, isActive: true },
  });

  try {
    await setActiveCompany(compB.id, reqUserA);
    const updatedSession = await getSession(reqUserA);
    assert(updatedSession?.activeCompanyId === compB.id, "Multi-Company: Authorized switch updates activeCompanyId in DB session");
  } catch (err: any) {
    assert(false, `Authorized switch failed: ${err.message}`);
  }

  console.log("\n--- TEST GROUP 4: Audit Log Verification ---");

  // TEST 14: Audit log records IDOR and Security events
  const blockedLogs = await prisma.activityLog.findMany({
    where: {
      action: "IDOR_ATTEMPT_BLOCKED",
    },
    take: 5,
  });
  assert(blockedLogs.length > 0, `Audit Trail: Successfully captured ${blockedLogs.length} IDOR blocked events in ActivityLog table`);

  console.log("\n--- TEST GROUP 5: Rate Limiting & CSRF Protection ---");

  // TEST 15: Rate Limiter blocks after threshold exceeded
  const { checkRateLimit, recordRateLimitFailure, resetRateLimit } = await import("../src/lib/rateLimit");
  const testLimitKey = "test:ratelimit:user1";
  resetRateLimit(testLimitKey);

  for (let i = 0; i < 5; i++) {
    await recordRateLimitFailure(testLimitKey, { details: "Simulated failed attempt" }, 60000);
  }
  const limitCheck = await checkRateLimit(testLimitKey, 5, 60000);
  assert(!limitCheck.allowed && limitCheck.remainingAttempts === 0, "Rate Limiting: Threshold enforced and blocks further attempts");
  resetRateLimit(testLimitKey);

  // TEST 16: CSRF Guard rejects mismatched origin on state mutation
  const { verifyCsrfOrigin } = await import("../src/lib/csrf");
  const forgedReq = new Request("http://localhost:3000/api/invoices", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "https://evil-phishing-site.com",
    },
  });
  try {
    verifyCsrfOrigin(forgedReq);
    assert(false, "CSRF Guard should reject cross-origin request");
  } catch (err: any) {
    assert(err instanceof AuthError && err.code === "CSRF_ORIGIN_MISMATCH", "CSRF Guard: Blocked cross-origin mutation attempt (403)");
  }

  // TEST 17: CSRF Guard allows same-origin requests
  const legitimateReq = new Request("http://localhost:3000/api/invoices", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
    },
  });
  try {
    verifyCsrfOrigin(legitimateReq);
    assert(true, "CSRF Guard: Permitted legitimate same-origin mutation");
  } catch {
    assert(false, "CSRF Guard should permit same-origin request");
  }

  console.log("\n=======================================================");
  console.log(`🏁 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSecurityTests()
  .catch((e) => {
    console.error("Test error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
