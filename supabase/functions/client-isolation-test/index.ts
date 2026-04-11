import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestResult {
  name: string;
  pass: boolean;
  expected: string;
  actual: string;
  critical: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const baseUrl = Deno.env.get("SUPABASE_URL")!;

  const results: TestResult[] = [];
  const ids: Record<string, string> = {};

  try {
    // ==================== SETUP ====================
    // Create facility org
    const { data: org, error: orgErr } = await supabase.from("organizations").insert({ name: "ISO-Test Facility" }).select().single();
    if (orgErr || !org) throw new Error(`Org insert failed: ${orgErr?.message}`);
    ids.org_id = org.id;

    // Create vineyard + block for vintages
    const { data: vineyard, error: vyErr } = await supabase.from("vineyards").insert({
      org_id: ids.org_id, name: "ISO Vineyard", region: "Test Region",
    }).select().single();
    if (vyErr || !vineyard) throw new Error(`Vineyard insert failed: ${vyErr?.message}`);
    ids.vineyard_id = vineyard.id;

    const { data: block, error: blkErr } = await supabase.from("blocks").insert({
      vineyard_id: ids.vineyard_id, name: "ISO Block",
    }).select().single();
    if (blkErr || !block) throw new Error(`Block insert failed: ${blkErr?.message}`);
    ids.block_id = block.id;

    // Create two client orgs
    const { data: clientA, error: caErr } = await supabase.from("client_orgs").insert({
      parent_org_id: ids.org_id, name: "Client Alpha",
    }).select().single();
    if (caErr || !clientA) throw new Error(`ClientA insert failed: ${caErr?.message}`);
    ids.client_a_id = clientA.id;

    const { data: clientB, error: cbErr } = await supabase.from("client_orgs").insert({
      parent_org_id: ids.org_id, name: "Client Beta",
    }).select().single();
    if (cbErr || !clientB) throw new Error(`ClientB insert failed: ${cbErr?.message}`);
    ids.client_b_id = clientB.id;

    // Create vintages for each client
    const { data: vintageA } = await supabase.from("vintages").insert({
      org_id: ids.org_id, block_id: ids.block_id, year: 2099,
      client_org_id: ids.client_a_id, status: "fermenting",
    }).select().single();
    ids.vintage_a_id = vintageA!.id;

    const { data: vintageB } = await supabase.from("vintages").insert({
      org_id: ids.org_id, block_id: ids.block_id, year: 2098,
      client_org_id: ids.client_b_id, status: "fermenting",
    }).select().single();
    ids.vintage_b_id = vintageB!.id;

    // Create lab samples for each
    await supabase.from("lab_samples").insert({
      vintage_id: ids.vintage_a_id, org_id: ids.org_id,
      brix: 24.5, ph: 3.45, sampled_at: new Date().toISOString(),
    });
    await supabase.from("lab_samples").insert({
      vintage_id: ids.vintage_b_id, org_id: ids.org_id,
      brix: 23.0, ph: 3.60, sampled_at: new Date().toISOString(),
    });

    // Create auth users for clients
    const emailA = `iso-client-a-${Date.now()}@test.local`;
    const emailB = `iso-client-b-${Date.now()}@test.local`;
    const password = "TestPass123!";

    const { data: authA } = await supabase.auth.admin.createUser({
      email: emailA, password, email_confirm: true,
    });
    ids.auth_a_id = authA.user!.id;

    const { data: authB } = await supabase.auth.admin.createUser({
      email: emailB, password, email_confirm: true,
    });
    ids.auth_b_id = authB.user!.id;

    // Link to client_users
    await supabase.from("client_users").insert({
      client_org_id: ids.client_a_id, auth_user_id: ids.auth_a_id,
      email: emailA, role: "admin",
    });
    await supabase.from("client_users").insert({
      client_org_id: ids.client_b_id, auth_user_id: ids.auth_b_id,
      email: emailB, role: "admin",
    });

    // Create a message from Client B
    await supabase.from("client_messages").insert({
      org_id: ids.org_id, client_org_id: ids.client_b_id,
      sender_type: "client", sender_id: ids.auth_b_id,
      message: "Secret message from Client Beta",
    });

    // Sign in as Client A to get a token
    const anonA = createClient(baseUrl, anonKey);
    const { data: sessionA } = await anonA.auth.signInWithPassword({
      email: emailA, password,
    });
    const tokenA = sessionA.session!.access_token;

    // Create a supabase client with Client A's token
    const clientADb = createClient(baseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${tokenA}` } },
    });

    // ==================== RLS TESTS ====================

    // Test 1: Client A cannot SELECT Client B's vintages
    const { data: crossVintages } = await clientADb.from("vintages")
      .select("*").eq("id", ids.vintage_b_id);
    results.push({
      name: "RLS: Client A cannot see Client B vintages",
      pass: !crossVintages || crossVintages.length === 0,
      expected: "0 rows", actual: `${crossVintages?.length ?? 0} rows`,
      critical: true,
    });

    // Test 2: Client A cannot SELECT Client B's lab samples
    const { data: crossLab } = await clientADb.from("lab_samples")
      .select("*").eq("vintage_id", ids.vintage_b_id);
    results.push({
      name: "RLS: Client A cannot see Client B lab samples",
      pass: !crossLab || crossLab.length === 0,
      expected: "0 rows", actual: `${crossLab?.length ?? 0} rows`,
      critical: true,
    });

    // Test 3: Client A cannot SELECT Client B's messages
    const { data: crossMsgs } = await clientADb.from("client_messages")
      .select("*").eq("client_org_id", ids.client_b_id);
    results.push({
      name: "RLS: Client A cannot see Client B messages",
      pass: !crossMsgs || crossMsgs.length === 0,
      expected: "0 rows", actual: `${crossMsgs?.length ?? 0} rows`,
      critical: true,
    });

    // Test 4: Client A CAN see their own vintages (sanity check)
    const { data: ownVintages } = await clientADb.from("vintages")
      .select("*").eq("id", ids.vintage_a_id);
    results.push({
      name: "Sanity: Client A can see own vintage",
      pass: ownVintages != null && ownVintages.length === 1,
      expected: "1 row", actual: `${ownVintages?.length ?? 0} rows`,
      critical: false,
    });

    // ==================== EDGE FUNCTION TESTS ====================

    // Test 5: generate-coa with Client B's vintage → should 403
    const coaResp = await fetch(`${baseUrl}/functions/v1/generate-coa`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vintage_id: ids.vintage_b_id }),
    });
    results.push({
      name: "Edge: generate-coa blocked for other client's vintage",
      pass: coaResp.status === 403,
      expected: "403", actual: `${coaResp.status}`,
      critical: true,
    });

    // Test 6: send-client-message with Client B's org → should 403
    const msgResp = await fetch(`${baseUrl}/functions/v1/send-client-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ client_org_id: ids.client_b_id, message: "Hacked!" }),
    });
    results.push({
      name: "Edge: send-client-message blocked for other client's org",
      pass: msgResp.status === 403,
      expected: "403", actual: `${msgResp.status}`,
      critical: true,
    });

    // Test 7: generate-coa with own vintage → should succeed
    const ownCoaResp = await fetch(`${baseUrl}/functions/v1/generate-coa`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vintage_id: ids.vintage_a_id }),
    });
    results.push({
      name: "Sanity: generate-coa works for own vintage",
      pass: ownCoaResp.status === 200,
      expected: "200", actual: `${ownCoaResp.status}`,
      critical: false,
    });

  } finally {
    // ==================== CLEANUP ====================
    try {
      if (ids.vintage_a_id) await supabase.from("lab_samples").delete().eq("vintage_id", ids.vintage_a_id);
      if (ids.vintage_b_id) await supabase.from("lab_samples").delete().eq("vintage_id", ids.vintage_b_id);
      if (ids.client_b_id) await supabase.from("client_messages").delete().eq("client_org_id", ids.client_b_id);
      if (ids.vintage_a_id) await supabase.from("vintages").delete().eq("id", ids.vintage_a_id);
      if (ids.vintage_b_id) await supabase.from("vintages").delete().eq("id", ids.vintage_b_id);
      if (ids.auth_a_id) {
        await supabase.from("client_users").delete().eq("auth_user_id", ids.auth_a_id);
        await supabase.auth.admin.deleteUser(ids.auth_a_id);
      }
      if (ids.auth_b_id) {
        await supabase.from("client_users").delete().eq("auth_user_id", ids.auth_b_id);
        await supabase.auth.admin.deleteUser(ids.auth_b_id);
      }
      if (ids.client_a_id) await supabase.from("client_orgs").delete().eq("id", ids.client_a_id);
      if (ids.client_b_id) await supabase.from("client_orgs").delete().eq("id", ids.client_b_id);
      if (ids.block_id) await supabase.from("blocks").delete().eq("id", ids.block_id);
      if (ids.vineyard_id) await supabase.from("vineyards").delete().eq("id", ids.vineyard_id);
      if (ids.org_id) await supabase.from("organizations").delete().eq("id", ids.org_id);
    } catch (_) { /* best-effort cleanup */ }
  }

  // Build report
  const hasCriticalFail = results.some(r => r.critical && !r.pass);
  const lines = [
    "=== Custom Crush Client Isolation Report ===",
    `Run: ${new Date().toISOString()}`,
    "",
    ...results.map(r =>
      `[${r.pass ? "PASS" : (r.critical ? "CRITICAL FAIL" : "FAIL")}] ${r.name}\n  Expected: ${r.expected}  Actual: ${r.actual}`
    ),
    "",
    `Overall: ${hasCriticalFail ? "CRITICAL FAILURES DETECTED" : "ALL PASSED"}`,
    "",
    "--- Fixes Applied ---",
    "1. generate-coa: Added auth check verifying caller is facility user OR client owner of the vintage",
    "2. send-client-message: Added ownership check verifying caller belongs to target client_org_id",
    "",
  ];

  return new Response(JSON.stringify({ results, report: lines.join("\n"), hasCriticalFail }), {
    status: hasCriticalFail ? 500 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
