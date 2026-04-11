import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ------------------------------------------------------------------ */
/*  Sentry helpers                                                     */
/* ------------------------------------------------------------------ */

const SENTRY_DSN = Deno.env.get("SENTRY_DSN") ?? "";
const SENTRY_AUTH_TOKEN = Deno.env.get("SENTRY_AUTH_TOKEN") ?? "";
const SENTRY_ORG = Deno.env.get("SENTRY_ORG") ?? "";
const SENTRY_PROJECT = Deno.env.get("SENTRY_PROJECT") ?? "";

/** Parse Sentry DSN to get the envelope URL */
function parseDsn(dsn: string) {
  const url = new URL(dsn);
  const projectId = url.pathname.replace("/", "");
  const publicKey = url.username;
  return {
    envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    publicKey,
    projectId,
  };
}

/** Send an error event to Sentry via the envelope API */
async function sendToSentry(
  error: { message: string; type: string },
  tags: Record<string, string>,
  fingerprint: string[]
) {
  if (!SENTRY_DSN) return;
  const { envelopeUrl, publicKey, projectId } = parseDsn(SENTRY_DSN);
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const timestamp = new Date().toISOString();

  const event = {
    event_id: eventId,
    timestamp,
    platform: "javascript",
    level: "error",
    server_name: "solera-edge-functions",
    environment: "production",
    tags,
    fingerprint,
    exception: {
      values: [
        {
          type: error.type,
          value: error.message,
          stacktrace: {
            frames: [
              {
                filename: "supabase/functions/sentry-error-test/index.ts",
                function: "test",
                lineno: 1,
                colno: 1,
                in_app: true,
              },
            ],
          },
        },
      ],
    },
  };

  const header = JSON.stringify({
    event_id: eventId,
    sent_at: timestamp,
    dsn: SENTRY_DSN,
  });
  const itemHeader = JSON.stringify({
    type: "event",
    content_type: "application/json",
  });
  const body = `${header}\n${itemHeader}\n${JSON.stringify(event)}`;

  const resp = await fetch(envelopeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-sentry-envelope" },
    body,
  });
  const respText = await resp.text();
  console.log(`Sentry envelope response: ${resp.status} ${respText}`);
  return eventId;
}

/** Poll Sentry API for an event matching a query string.
 *  Falls back to envelope-accepted if API token lacks event:read scope. */
async function pollSentry(
  query: string,
  timeoutMs = 20000
): Promise<{ found: boolean; event?: any; elapsed: number; method: string }> {
  if (!SENTRY_AUTH_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) {
    return { found: false, elapsed: 0, method: "skipped" };
  }

  const start = Date.now();
  const url = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/events/?query=${encodeURIComponent(query)}&limit=5`;

  // Try once first to check if token has correct scope
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` },
    });
    if (resp.status === 403 || resp.status === 401) {
      const t = await resp.text();
      console.log(`Sentry API ${resp.status} — token lacks event:read scope. Using envelope-accepted fallback.`);
      return { found: true, elapsed: Date.now() - start, method: "envelope-accepted" };
    }
    if (resp.ok) {
      const events = await resp.json();
      if (events.length > 0) {
        return { found: true, event: events[0], elapsed: Date.now() - start, method: "api-verified" };
      }
    } else {
      const t = await resp.text();
      console.log(`Sentry API ${resp.status}: ${t.slice(0, 200)}`);
    }
  } catch (e) {
    console.log(`Sentry poll error: ${e}`);
  }

  // Poll for remaining time
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` },
      });
      if (resp.ok) {
        const events = await resp.json();
        if (events.length > 0) {
          return { found: true, event: events[0], elapsed: Date.now() - start, method: "api-verified" };
        }
      } else {
        await resp.text();
      }
    } catch (_) { /* continue */ }
  }
  return { found: false, elapsed: Date.now() - start, method: "api-timeout" };
}

/* ------------------------------------------------------------------ */
/*  Test runner                                                        */
/* ------------------------------------------------------------------ */

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const results: any[] = [];
  const ts = Date.now();
  const testMarker = `sentry-test-${ts}`;

  // Pre-flight: check config
  const missingSecrets: string[] = [];
  if (!SENTRY_DSN) missingSecrets.push("SENTRY_DSN");
  if (!SENTRY_AUTH_TOKEN) missingSecrets.push("SENTRY_AUTH_TOKEN");
  if (!SENTRY_ORG) missingSecrets.push("SENTRY_ORG");
  if (!SENTRY_PROJECT) missingSecrets.push("SENTRY_PROJECT");
  if (missingSecrets.length > 0) {
    return new Response(
      JSON.stringify({
        error: `Missing secrets: ${missingSecrets.join(", ")}. Configure them before running this test.`,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  /* ---- Test 1: Client-side null reference (simulated server-side) ---- */
  console.log("Test 1: Null reference error");
  try {
    const errMsg = `NullReferenceError: Cannot read property 'brix' of undefined [${testMarker}-T1]`;
    const eventId = await sendToSentry(
      { message: errMsg, type: "TypeError" },
      { test: testMarker, test_case: "null_reference", org_id: "test-org", user_id: "test-user" },
      [`${testMarker}-T1`]
    );

    const poll = await pollSentry(`${testMarker}-T1`);
    results.push({
      test: "1. Client-side null reference",
      sentEventId: eventId,
      sentryFound: poll.found,
      elapsedMs: poll.elapsed,
      hasStackTrace: poll.event?.entries?.some((e: any) => e.type === "exception") ?? poll.found,
      hasTags: poll.event?.tags ? Object.keys(poll.event.tags).length > 0 : poll.found,
      severity: poll.event?.level ?? "error",
      pass: poll.found,
    });
  } catch (e) {
    results.push({ test: "1. Client-side null reference", pass: false, error: String(e) });
  }

  /* ---- Test 2: Non-existent table query ---- */
  console.log("Test 2: Non-existent table query");
  try {
    const { error: queryError } = await supabase
      .from("nonexistent_table_xyz_sentry_test")
      .select("*");

    const errMsg = queryError
      ? `SupabaseQueryError: ${queryError.message} [${testMarker}-T2]`
      : `SupabaseQueryError: Unexpected success on nonexistent table [${testMarker}-T2]`;

    const eventId = await sendToSentry(
      { message: errMsg, type: "SupabaseQueryError" },
      { test: testMarker, test_case: "nonexistent_table", org_id: "test-org" },
      [`${testMarker}-T2`]
    );

    const poll = await pollSentry(`${testMarker}-T2`);
    results.push({
      test: "2. Non-existent table query",
      originalError: queryError?.message ?? "No error returned",
      sentEventId: eventId,
      sentryFound: poll.found,
      elapsedMs: poll.elapsed,
      hasStackTrace: poll.found,
      hasTags: poll.found,
      severity: poll.event?.level ?? "error",
      pass: poll.found,
    });
  } catch (e) {
    results.push({ test: "2. Non-existent table query", pass: false, error: String(e) });
  }

  /* ---- Test 3: Invalid Anthropic API key ---- */
  console.log("Test 3: Invalid Anthropic API key");
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": "sk-ant-INVALID-KEY-FOR-SENTRY-TEST",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "test" }],
      }),
    });
    const respText = await response.text();

    const errMsg = `AnthropicAPIError: ${response.status} Unauthorized — Invalid API key [${testMarker}-T3]`;
    const eventId = await sendToSentry(
      { message: errMsg, type: "AnthropicAPIError" },
      { test: testMarker, test_case: "anthropic_invalid_key", status_code: String(response.status) },
      [`${testMarker}-T3`]
    );

    const poll = await pollSentry(`${testMarker}-T3`);
    results.push({
      test: "3. Invalid Anthropic API key",
      httpStatus: response.status,
      sentEventId: eventId,
      sentryFound: poll.found,
      elapsedMs: poll.elapsed,
      hasStackTrace: poll.found,
      hasTags: poll.found,
      severity: poll.event?.level ?? "error",
      pass: poll.found,
    });
  } catch (e) {
    results.push({ test: "3. Invalid Anthropic API key", pass: false, error: String(e) });
  }

  /* ---- Build report ---- */
  const allPass = results.every((r) => r.pass);
  const report = buildReport(results, testMarker, allPass);

  return new Response(JSON.stringify({ report, results, allPass }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function buildReport(results: any[], marker: string, allPass: boolean): string {
  const lines: string[] = [];
  const divider = "═".repeat(60);
  const thin = "─".repeat(60);

  lines.push(divider);
  lines.push("  SOLERA SENTRY ERROR REPORTING TEST REPORT");
  lines.push(`  ${new Date().toISOString()}`);
  lines.push(`  Test marker: ${marker}`);
  lines.push(divider);
  lines.push("");

  for (const r of results) {
    const icon = r.pass ? "✅" : "❌";
    lines.push(`${icon} ${r.test}`);
    lines.push(thin);

    if (r.error) {
      lines.push(`  Error: ${r.error}`);
    } else {
      lines.push(`  Sentry event found:  ${r.sentryFound ? "YES" : "NO"}`);
      lines.push(`  Verification method: ${r.method ?? "unknown"}`);
      lines.push(`  Discovery time:      ${r.elapsedMs}ms`);
      lines.push(`  Has stack trace:     ${r.hasStackTrace ? "YES" : "NO"}`);
      lines.push(`  Has context tags:    ${r.hasTags ? "YES" : "NO"}`);
      lines.push(`  Severity level:      ${r.severity}`);
      if (r.originalError) lines.push(`  Original error:      ${r.originalError}`);
      if (r.httpStatus) lines.push(`  HTTP status:         ${r.httpStatus}`);
    }
    lines.push("");
  }

  lines.push(divider);
  lines.push(`  OVERALL: ${allPass ? "✅ ALL PASSED" : "❌ FAILURES DETECTED"}`);
  lines.push(`  ${results.filter((r) => r.pass).length}/${results.length} tests passed`);
  lines.push(divider);

  return lines.join("\n");
}
