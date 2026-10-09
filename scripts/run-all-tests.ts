/**
 * Taily ERP - Master Test Runner
 * Executes all core automated test suites:
 * 1. Sales & Invoicing Pipeline
 * 2. Procurement & Vendor Bills Pipeline
 * 3. Double-Entry Accounting & Ledger Integrity
 * 4. Multi-Tenant Enterprise Isolation
 * 5. Production Security & IDOR Audit
 */

import { execSync } from "child_process";

const testSuites = [
  { name: "Sales & Invoicing Pipeline", script: "scripts/test-sales-workflow.ts" },
  { name: "Procurement & Vendor Bills Pipeline", script: "scripts/test-purchase-workflow.ts" },
  { name: "Double-Entry Accounting & Ledger Suite", script: "scripts/test-accounting-e2e.ts" },
  { name: "Multi-Tenant Enterprise Isolation", script: "scripts/test-multi-company-isolation.ts" },
  { name: "Production Security & IDOR Audit", script: "scripts/test-security-audit.ts" },
];

console.log("=======================================================");
console.log("🚀 TAILY ERP AUTOMATED TEST SUITE EXECUTION");
console.log("=======================================================\n");

let passedCount = 0;
let failedCount = 0;
const results: { name: string; status: "PASSED" | "FAILED"; durationMs: number }[] = [];

for (const suite of testSuites) {
  process.stdout.write(`Running: ${suite.name}... `);
  const start = Date.now();
  try {
    execSync(`npx tsx ${suite.script}`, { stdio: "pipe" });
    const duration = Date.now() - start;
    console.log(`✅ PASSED (${(duration / 1000).toFixed(2)}s)`);
    results.push({ name: suite.name, status: "PASSED", durationMs: duration });
    passedCount++;
  } catch (err: any) {
    const duration = Date.now() - start;
    console.log(`❌ FAILED (${(duration / 1000).toFixed(2)}s)`);
    console.error(err.stdout?.toString() || err.message);
    results.push({ name: suite.name, status: "FAILED", durationMs: duration });
    failedCount++;
  }
}

console.log("\n=======================================================");
console.log("📊 TEST EXECUTION SUMMARY");
console.log("=======================================================");
results.forEach((r) => {
  const icon = r.status === "PASSED" ? "✅" : "❌";
  console.log(`${icon} ${r.name.padEnd(45)} [${r.status}] (${(r.durationMs / 1000).toFixed(2)}s)`);
});
console.log("-------------------------------------------------------");
console.log(`Total Suites: ${testSuites.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

if (failedCount > 0) {
  console.log("❌ One or more test suites failed!");
  process.exit(1);
} else {
  console.log("🎉 ALL TEST SUITES PASSED WITH 100% SUCCESS!");
  process.exit(0);
}
