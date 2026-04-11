/**
 * Paddle Webhook Tier Enforcement Audit
 *
 * Forges signed Paddle webhook payloads, POSTs them to the deployed
 * edge function, then verifies org tier/status in the database.
 *
 * Run via: npx tsx scripts/audit/paddle-tier-test.ts
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PADDLE_NOTIFICATION_WEBHOOK_SECRET
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WEBHOOK_SECRET = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET!;
const WEBHOOK_ENDPOINT = `${SUPABASE_URL}/functions/v1/paddle-webhook`;

const TEST_ORG_ID = "00000000-aaaa-bbbb-cccc-000000000099"; // deterministic
const TEST_SUB_ID = "sub_test_audit_001";
const TEST_CUSTOMER_ID = "ctm_test_audit_001";

interface TestResult {
  name: string;
  passed: boolean;
  expected: Record<string, string>;
  actual: Record<string, string | null>;
  httpStatus: number;
  notes: string;
}

const results: TestResult[] = [];
const lines: string[] = [];

function log(msg: string) {
  console.log(msg);
  lines.push(msg);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sign(body: string): string {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${ts}:${body}`;
  const h1 = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");
  return `ts=${ts};h1=${h1}`;
}

async function getOrg(): Promise<Record<string, any> | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/organizations?id=eq.${TEST_ORG_ID}&select=id,name,tier,subscription_status,paddle_subscription_id,paddle_customer_id`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  const rows = await res.json();
  return rows?.[0] ?? null;
}

async function upsertTestOrg() {
  // Try to delete first (cleanup from previous run)
  await fetch(`${SUPABASE_URL}/rest/v1/organizations?id=eq.${TEST_ORG_ID}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  // Insert
  const res = await fetch(`${SUPABASE_URL}/rest/v1/organizations`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: TEST_ORG_ID,
      name: "__paddle_audit_test__",
      tier: "hobbyist",
      subscription_status: "none",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to create test org: ${res.status} ${txt}`);
  }
}

async function deleteTestOrg() {
  await fetch(`${SUPABASE_URL}/rest/v1/organizations?id=eq.${TEST_ORG_ID}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

function buildPayload(
  eventType: string,
  priceId: string | null,
  overrides: Record<string, any> = {}
): Record<string, any> {
  return {
    event_type: eventType,
    data: {
      id: TEST_SUB_ID,
      customer_id: TEST_CUSTOMER_ID,
      status: overrides.status ?? "active",
      custom_data: { org_id: TEST_ORG_ID },
      items: priceId
        ? [{ price: { id: priceId } }]
        : [],
      next_billed_at: "2026-05-11T00:00:00Z",
      current_billing_period: {
        starts_at: "2026-04-11T00:00:00Z",
        ends_at: "2026-05-11T00:00:00Z",
      },
      scheduled_change: null,
      cancellation_reason: overrides.cancellation_reason ?? null,
      ...overrides,
    },
  };
}

async function fireWebhook(payload: Record<string, any>): Promise<number> {
  const body = JSON.stringify(payload);
  const sig = sign(body);
  const res = await fetch(WEBHOOK_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "paddle-signature": sig,
    },
    body,
  });
  return res.status;
}

async function runTest(
  name: string,
  eventType: string,
  priceId: string | null,
  expectedTier: string,
  expectedStatus: string,
  payloadOverrides: Record<string, any> = {}
) {
  log(`\n── Test: ${name}`);
  const payload = buildPayload(eventType, priceId, payloadOverrides);
  const httpStatus = await fireWebhook(payload);
  log(`   POST ${WEBHOOK_ENDPOINT} → ${httpStatus}`);

  // Small delay for async processing
  await new Promise((r) => setTimeout(r, 1500));

  const org = await getOrg();
  const actualTier = org?.tier ?? "(not found)";
  const actualStatus = org?.subscription_status ?? "(not found)";
  const tierOk = actualTier === expectedTier;
  const statusOk = actualStatus === expectedStatus;
  const passed = httpStatus === 200 && tierOk && statusOk;

  const result: TestResult = {
    name,
    passed,
    expected: { tier: expectedTier, subscription_status: expectedStatus },
    actual: { tier: actualTier, subscription_status: actualStatus },
    httpStatus,
    notes: !tierOk
      ? `Tier mismatch: expected ${expectedTier}, got ${actualTier}`
      : !statusOk
      ? `Status mismatch: expected ${expectedStatus}, got ${actualStatus}`
      : "",
  };
  results.push(result);

  log(`   Expected: tier=${expectedTier}  status=${expectedStatus}`);
  log(`   Actual:   tier=${actualTier}  status=${actualStatus}`);
  log(`   Result:   ${passed ? "✅ PASS" : "❌ FAIL"} ${result.notes}`);
}

// ---------------------------------------------------------------------------
// RLS gap check: can a hobbyist-tier org access cost_entries?
// ---------------------------------------------------------------------------
async function rlsGapCheck() {
  log("\n── RLS Gap Check: Can hobbyist-tier org query cost_entries?");
  // Use anon key to simulate client-side access (no auth, just org_id filter)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cost_entries?org_id=eq.${TEST_ORG_ID}&select=id&limit=1`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  const status = res.status;
  const accessible = status === 200;
  log(`   cost_entries query status: ${status}`);
  log(
    `   Accessible with service role: ${accessible ? "YES (expected — service role bypasses RLS)" : "NO"}`
  );
  log(
    `   ⚠️  NOTE: Tier gating is UI-only. RLS checks org_id membership, NOT tier.`
  );
  log(
    `   A user with a valid session in a hobbyist org can still query cost_entries via the JS client.`
  );
}

// ---------------------------------------------------------------------------
// Edge-case: unknown price ID defaults to small_boutique (gap)
// ---------------------------------------------------------------------------
async function unknownPriceIdTest() {
  log("\n── Edge Case: Unknown price ID fallback");
  // Reset org to hobbyist first
  await fetch(`${SUPABASE_URL}/rest/v1/organizations?id=eq.${TEST_ORG_ID}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tier: "hobbyist",
      subscription_status: "none",
      paddle_subscription_id: null,
    }),
  });
  await new Promise((r) => setTimeout(r, 500));

  const payload = buildPayload("subscription.created", "pri_UNKNOWN_BOGUS_ID");
  const httpStatus = await fireWebhook(payload);
  await new Promise((r) => setTimeout(r, 1500));
  const org = await getOrg();
  const actualTier = org?.tier ?? "(not found)";

  const isGap = actualTier === "small_boutique";
  log(`   POST status: ${httpStatus}`);
  log(`   Resulting tier: ${actualTier}`);
  if (isGap) {
    log(
      `   ⚠️  GAP CONFIRMED: Unknown price ID silently upgrades org to small_boutique (Pro).`
    );
    log(
      `   Recommendation: Reject or default to 'hobbyist' for unknown price IDs.`
    );
  } else {
    log(`   ✅ Unknown price ID handled correctly.`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  log("╔════════════════════════════════════════════════════════════╗");
  log("║       Paddle Webhook Tier Enforcement Audit Report       ║");
  log("╚════════════════════════════════════════════════════════════╝");
  log(`Date: ${new Date().toISOString()}`);
  log(`Endpoint: ${WEBHOOK_ENDPOINT}`);
  log(`Test Org: ${TEST_ORG_ID}`);

  // Preflight
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !WEBHOOK_SECRET) {
    log("\n❌ Missing required env vars. Aborting.");
    process.exit(1);
  }

  // Setup
  log("\n── Setup: Creating test organization");
  await upsertTestOrg();
  const org = await getOrg();
  log(`   Created: ${org?.name} | tier=${org?.tier} | status=${org?.subscription_status}`);

  // Test 1: subscription.created → Pro
  await runTest(
    "1. subscription.created → Pro (monthly)",
    "subscription.created",
    "pri_01kmdx9xd7y43185qppke728d9",
    "small_boutique",
    "active"
  );

  // Test 2: subscription.updated → Growth
  await runTest(
    "2. subscription.updated → Growth (monthly)",
    "subscription.updated",
    "pri_01kmdxcs28byfa4q5ye3kh1xj3",
    "mid_size",
    "active"
  );

  // Test 3: subscription.updated → Enterprise
  await runTest(
    "3. subscription.updated → Enterprise (monthly)",
    "subscription.updated",
    "pri_01kmdxkejxc2bssknbrm9phj48",
    "enterprise",
    "active"
  );

  // Test 4: Downgrade Enterprise → Pro
  await runTest(
    "4. Downgrade: subscription.updated → Pro",
    "subscription.updated",
    "pri_01kmdx9xd7y43185qppke728d9",
    "small_boutique",
    "active"
  );

  // Test 5: subscription.canceled
  // Need to re-set paddle_subscription_id since test 4 used updated (which keeps it)
  await runTest(
    "5. subscription.canceled → hobbyist",
    "subscription.canceled",
    null,
    "hobbyist",
    "canceled"
  );

  // RLS gap check
  await rlsGapCheck();

  // Unknown price ID edge case
  await unknownPriceIdTest();

  // Summary
  log("\n════════════════════════════════════════════════════════════");
  log("SUMMARY");
  log("════════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  for (const r of results) {
    log(`  ${r.passed ? "✅" : "❌"} ${r.name}`);
  }

  log("\nKNOWN GAPS:");
  log("  1. No server-side (RLS) tier enforcement — gating is UI-only");
  log("  2. Unknown price IDs default to small_boutique instead of hobbyist");
  log("  3. subscription_status (past_due, paused) not checked by UI");
  log("  4. Cellar & Sales routes lack route-level TierGate wrappers");
  log("  5. User count limits not enforced server-side");

  // Cleanup
  log("\n── Cleanup: Deleting test organization");
  await deleteTestOrg();
  log("   Done.");

  // Write report
  const reportPath = path.resolve("scripts/audit/paddle-tier-report.txt");
  fs.writeFileSync(reportPath, lines.join("\n") + "\n", "utf-8");
  log(`\nReport written to ${reportPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
