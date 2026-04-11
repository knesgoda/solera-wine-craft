const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/paddle-webhook`;
const SECRET = Deno.env.get("PADDLE_NOTIFICATION_WEBHOOK_SECRET")!;

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

interface TestResult {
  name: string;
  expected: number;
  actual: number;
  pass: boolean;
  body: string;
}

async function runTest(name: string, rawBody: string, signature: string, expectedStatus: number): Promise<TestResult> {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "paddle-signature": signature },
    body: rawBody,
  });
  const body = await res.text();
  return { name, expected: expectedStatus, actual: res.status, pass: res.status === expectedStatus, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const results: TestResult[] = [];
  const basePayload = {
    event_type: "subscription.created",
    data: {
      id: "sub_test_sig_validation",
      customer_id: "ctm_test_sig",
      status: "active",
      items: [{ price: { id: "pri_01kmdx9xd7y43185qppke728d9" } }],
      custom_data: { org_id: "00000000-0000-0000-0000-000000000000" },
      next_billed_at: null,
      current_billing_period: {},
    },
  };

  // --- Test 1: Valid signature (fresh timestamp) ---
  {
    const body = JSON.stringify(basePayload);
    const ts = Math.floor(Date.now() / 1000).toString();
    const h1 = await hmacSign(`${ts}:${body}`, SECRET);
    const sig = `ts=${ts};h1=${h1}`;
    // Expect 200 (org won't exist so update is a no-op, but signature passes)
    results.push(await runTest("Valid signature", body, sig, 200));
  }

  // --- Test 2: Tampered payload ---
  {
    const originalBody = JSON.stringify(basePayload);
    const ts = Math.floor(Date.now() / 1000).toString();
    const h1 = await hmacSign(`${ts}:${originalBody}`, SECRET);
    const sig = `ts=${ts};h1=${h1}`;
    const tamperedPayload = { ...basePayload, event_type: "subscription.canceled" };
    const tamperedBody = JSON.stringify(tamperedPayload);
    results.push(await runTest("Tampered payload", tamperedBody, sig, 401));
  }

  // --- Test 3: Replayed (stale timestamp >5 min) ---
  {
    const body = JSON.stringify(basePayload);
    const staleTs = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 min ago
    const h1 = await hmacSign(`${staleTs}:${body}`, SECRET);
    const sig = `ts=${staleTs};h1=${h1}`;
    results.push(await runTest("Replayed (stale timestamp)", body, sig, 401));
  }

  const allPass = results.every(r => r.pass);
  const report = [
    "=== Paddle Webhook Signature Validation Report ===",
    `Run: ${new Date().toISOString()}`,
    "",
    ...results.map(r => [
      `[${r.pass ? "PASS" : "FAIL"}] ${r.name}`,
      `  Expected: ${r.expected}  Actual: ${r.actual}`,
      `  Response: ${r.body.substring(0, 200)}`,
      "",
    ].join("\n")),
    `Overall: ${allPass ? "ALL PASSED" : "FAILURES DETECTED"}`,
  ].join("\n");

  return new Response(JSON.stringify({ all_pass: allPass, report, results }), {
    status: allPass ? 200 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
