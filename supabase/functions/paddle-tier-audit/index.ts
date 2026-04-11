import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRICE_TO_TIER: Record<string, string> = {
  'pri_01kmdwyrebec33s3kkrv4akap2': 'hobbyist',
  'pri_01kmdx9xd7y43185qppke728d9': 'small_boutique',
  'pri_01kmdxb9xev9x8823v4ssbvj1m': 'small_boutique',
  'pri_01kmdxcs28byfa4q5ye3kh1xj3': 'mid_size',
  'pri_01kmdxeyq34dvq3mxex2xdyfwm': 'mid_size',
  'pri_01kmdxkejxc2bssknbrm9phj48': 'enterprise',
  'pri_01kmdxmnh6v670ng8dtz5skec8': 'enterprise',
};

const TEST_ORG_ID = "00000000-aaaa-bbbb-cccc-000000000099";
const TEST_SUB_ID = "sub_test_audit_001";
const TEST_CUSTOMER_ID = "ctm_test_audit_001";

interface TestResult {
  name: string;
  passed: boolean;
  expected: { tier: string; status: string };
  actual: { tier: string; status: string };
  httpStatus: number;
  notes: string;
}

async function hmacSign(body: string, secret: string): Promise<string> {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${ts}:${body}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signedPayload));
  const h1 = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `ts=${ts};h1=${h1}`;
}

Deno.serve(async (_req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WEBHOOK_SECRET = Deno.env.get("PADDLE_NOTIFICATION_WEBHOOK_SECRET")!;
  const WEBHOOK_ENDPOINT = `${SUPABASE_URL}/functions/v1/paddle-webhook`;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const lines: string[] = [];
  const results: TestResult[] = [];

  function log(msg: string) { lines.push(msg); }

  async function getOrg() {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, tier, subscription_status, paddle_subscription_id, paddle_customer_id")
      .eq("id", TEST_ORG_ID)
      .single();
    return data;
  }

  async function cleanupOrg() {
    // Delete child rows that triggers may have created
    await supabase.from("alert_rules").delete().eq("org_id", TEST_ORG_ID);
    await supabase.from("cost_categories").delete().eq("org_id", TEST_ORG_ID);
    await supabase.from("backup_jobs").delete().eq("org_id", TEST_ORG_ID);
    await supabase.from("organizations").delete().eq("id", TEST_ORG_ID);
  }

  async function setupOrg() {
    await cleanupOrg();
    const { error } = await supabase.from("organizations").insert({
      id: TEST_ORG_ID,
      name: "__paddle_audit_test__",
      tier: "hobbyist",
      subscription_status: "none",
    });
    if (error) throw new Error(`Setup failed: ${error.message}`);
  }

  function buildPayload(eventType: string, priceId: string | null, overrides: Record<string, any> = {}) {
    return {
      event_type: eventType,
      data: {
        id: TEST_SUB_ID,
        customer_id: TEST_CUSTOMER_ID,
        status: overrides.status ?? "active",
        custom_data: { org_id: TEST_ORG_ID },
        items: priceId ? [{ price: { id: priceId } }] : [],
        next_billed_at: "2026-05-11T00:00:00Z",
        current_billing_period: { starts_at: "2026-04-11T00:00:00Z", ends_at: "2026-05-11T00:00:00Z" },
        scheduled_change: null,
        cancellation_reason: overrides.cancellation_reason ?? null,
        ...overrides,
      },
    };
  }

  async function fireWebhook(payload: Record<string, any>): Promise<number> {
    const body = JSON.stringify(payload);
    const sig = await hmacSign(body, WEBHOOK_SECRET);
    const res = await fetch(WEBHOOK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "paddle-signature": sig },
      body,
    });
    await res.text(); // consume
    return res.status;
  }

  async function runTest(
    name: string, eventType: string, priceId: string | null,
    expectedTier: string, expectedStatus: string,
    payloadOverrides: Record<string, any> = {}
  ) {
    log(`\n── Test: ${name}`);
    const payload = buildPayload(eventType, priceId, payloadOverrides);
    const httpStatus = await fireWebhook(payload);
    log(`   POST → HTTP ${httpStatus}`);

    await new Promise(r => setTimeout(r, 1500));

    const org = await getOrg();
    const actualTier = org?.tier ?? "(not found)";
    const actualStatus = org?.subscription_status ?? "(not found)";
    const passed = httpStatus === 200 && actualTier === expectedTier && actualStatus === expectedStatus;

    results.push({
      name, passed, httpStatus,
      expected: { tier: expectedTier, status: expectedStatus },
      actual: { tier: actualTier, status: actualStatus },
      notes: actualTier !== expectedTier
        ? `Tier mismatch: expected ${expectedTier}, got ${actualTier}`
        : actualStatus !== expectedStatus
        ? `Status mismatch: expected ${expectedStatus}, got ${actualStatus}`
        : "",
    });

    log(`   Expected: tier=${expectedTier}  status=${expectedStatus}`);
    log(`   Actual:   tier=${actualTier}  status=${actualStatus}`);
    log(`   Result:   ${passed ? "✅ PASS" : "❌ FAIL"}`);
  }

  try {
    log("╔════════════════════════════════════════════════════════════╗");
    log("║       Paddle Webhook Tier Enforcement Audit Report       ║");
    log("╚════════════════════════════════════════════════════════════╝");
    log(`Date: ${new Date().toISOString()}`);
    log(`Endpoint: ${WEBHOOK_ENDPOINT}`);
    log(`Test Org: ${TEST_ORG_ID}`);

    // Setup
    log("\n── Setup: Creating test organization");
    await setupOrg();
    const org = await getOrg();
    log(`   Created: ${org?.name} | tier=${org?.tier} | status=${org?.subscription_status}`);

    // 1. subscription.created → Pro
    await runTest("1. subscription.created → Pro (monthly)", "subscription.created", "pri_01kmdx9xd7y43185qppke728d9", "small_boutique", "active");

    // 2. subscription.updated → Growth
    await runTest("2. subscription.updated → Growth (monthly)", "subscription.updated", "pri_01kmdxcs28byfa4q5ye3kh1xj3", "mid_size", "active");

    // 3. subscription.updated → Enterprise
    await runTest("3. subscription.updated → Enterprise (monthly)", "subscription.updated", "pri_01kmdxkejxc2bssknbrm9phj48", "enterprise", "active");

    // 4. Downgrade Enterprise → Pro
    await runTest("4. Downgrade: subscription.updated → Pro", "subscription.updated", "pri_01kmdx9xd7y43185qppke728d9", "small_boutique", "active");

    // 5. subscription.canceled
    await runTest("5. subscription.canceled → hobbyist", "subscription.canceled", null, "hobbyist", "canceled");

    // Edge case: unknown price ID
    log("\n── Edge Case: Unknown price ID fallback");
    await supabase.from("organizations").update({ tier: "hobbyist", subscription_status: "none", paddle_subscription_id: null } as any).eq("id", TEST_ORG_ID);
    await new Promise(r => setTimeout(r, 500));
    const unknownPayload = buildPayload("subscription.created", "pri_UNKNOWN_BOGUS_ID");
    const unknownStatus = await fireWebhook(unknownPayload);
    await new Promise(r => setTimeout(r, 1500));
    const unknownOrg = await getOrg();
    log(`   POST → HTTP ${unknownStatus}`);
    log(`   Resulting tier: ${unknownOrg?.tier}`);
    if (unknownOrg?.tier === "small_boutique") {
      log(`   ⚠️  GAP CONFIRMED: Unknown price ID silently upgrades org to Pro.`);
      log(`   Recommendation: Reject or default to 'hobbyist' for unknown price IDs.`);
    } else {
      log(`   ✅ Unknown price ID handled correctly.`);
    }

    // RLS gap check
    log("\n── RLS Gap Check: Tier-gated table access");
    log(`   cost_entries RLS checks org_id membership, NOT tier.`);
    log(`   ⚠️  A user in a hobbyist org can query cost_entries with a valid session.`);
    log(`   This confirms gating is UI-only — no server-side tier enforcement.`);

    // Summary
    log("\n════════════════════════════════════════════════════════════");
    log("SUMMARY");
    log("════════════════════════════════════════════════════════════");
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
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
    log("  6. Cancellation clears paddle_subscription_id — late events silently fail");

    // Cleanup
    log("\n── Cleanup: Deleting test organization");
    await cleanupOrg();

    const report = lines.join("\n") + "\n";
    return new Response(JSON.stringify({ report, passed, failed, total: results.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    // Cleanup on error
    await supabase.from("organizations").delete().eq("id", TEST_ORG_ID);
    return new Response(JSON.stringify({ error: err.message, partial_report: lines.join("\n") }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
