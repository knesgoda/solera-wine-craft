import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEST_ORG_ID = "00000000-aaaa-bbbb-cccc-000000000077";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { action } = await req.json();

  if (action === "setup") {
    // Cleanup first
    await supabase.from("organizations").delete().eq("id", TEST_ORG_ID);

    // Create test org
    await supabase.from("organizations").insert({
      id: TEST_ORG_ID, name: "__offline_test__", tier: "small_boutique",
      subscription_status: "active",
    });

    // Create test user
    const testEmail = `offline-test-${Date.now()}@test.solera.dev`;
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: "TestPass123!",
      email_confirm: true,
      user_metadata: { first_name: "Offline", last_name: "Tester", winery_name: "__offline_test__" },
    });
    if (authErr) return new Response(JSON.stringify({ error: authErr.message }), { status: 500, headers: corsHeaders });

    const userId = authUser.user.id;

    // Wait for trigger to create profile
    await new Promise(r => setTimeout(r, 2000));

    // Get the auto-created org and delete it later, reassign to test org
    const { data: profileRow } = await supabase.from("profiles").select("org_id").eq("id", userId).single();
    const autoOrgId = profileRow?.org_id;

    // Update profile to our test org
    await supabase.from("profiles").update({ org_id: TEST_ORG_ID }).eq("id", userId);

    // Vineyard → Block → Vintage → Task
    const { data: vy, error: vyErr } = await supabase.from("vineyards")
      .insert({ org_id: TEST_ORG_ID, name: "Offline Vineyard", region: "Sonoma", acres: 20 })
      .select("id").single();
    if (vyErr) return new Response(JSON.stringify({ error: "vineyard: " + vyErr.message }), { status: 500, headers: corsHeaders });

    const { data: blk, error: blkErr } = await supabase.from("blocks")
      .insert({ vineyard_id: vy!.id, name: "Block Offline", variety: "Merlot", acres: 5 })
      .select("id").single();
    if (blkErr) return new Response(JSON.stringify({ error: "block: " + blkErr.message }), { status: 500, headers: corsHeaders });

    const { data: vnt, error: vntErr } = await supabase.from("vintages")
      .insert({ org_id: TEST_ORG_ID, year: 2025, block_id: blk!.id, status: "in_cellar" })
      .select("id").single();
    if (vntErr) return new Response(JSON.stringify({ error: "vintage: " + vntErr.message }), { status: 500, headers: corsHeaders });

    const { data: tsk, error: tskErr } = await supabase.from("tasks")
      .insert({
        org_id: TEST_ORG_ID, title: "Offline Spray Task", status: "pending",
        assigned_to: userId, block_id: blk!.id,
        due_date: new Date().toISOString().slice(0, 10),
      } as any)
      .select("id").single();
    if (tskErr) return new Response(JSON.stringify({ error: "task: " + tskErr.message }), { status: 500, headers: corsHeaders });

    return new Response(JSON.stringify({
      user_id: userId, org_id: TEST_ORG_ID,
      email: testEmail, auto_org_id: autoOrgId,
      vineyard_id: vy!.id, block_id: blk!.id,
      vintage_id: vnt!.id, task_id: tsk!.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "verify") {
    // Check task status
    const { data: tasks } = await supabase.from("tasks")
      .select("id, title, status").eq("org_id", TEST_ORG_ID);

    // Check lab samples
    const { data: vintages } = await supabase.from("vintages")
      .select("id").eq("org_id", TEST_ORG_ID);
    const vintageIds = (vintages || []).map(v => v.id);

    let samples: any[] = [];
    if (vintageIds.length > 0) {
      const { data } = await supabase.from("lab_samples")
        .select("id, brix, vintage_id").in("vintage_id", vintageIds);
      samples = data || [];
    }

    return new Response(JSON.stringify({
      tasks: tasks || [],
      lab_samples: samples,
      task_count: tasks?.length || 0,
      sample_count: samples.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "cleanup") {
    const { data: profiles } = await supabase.from("profiles")
      .select("id").eq("org_id", TEST_ORG_ID);
    for (const p of (profiles || [])) {
      await supabase.auth.admin.deleteUser(p.id);
    }

    const { data: vintages } = await supabase.from("vintages")
      .select("id").eq("org_id", TEST_ORG_ID);
    const vids = (vintages || []).map(v => v.id);
    if (vids.length > 0) {
      await supabase.from("lab_samples").delete().in("vintage_id", vids);
    }

    await supabase.from("tasks").delete().eq("org_id", TEST_ORG_ID);
    await supabase.from("vintages").delete().eq("org_id", TEST_ORG_ID);
    const { data: vys } = await supabase.from("vineyards").select("id").eq("org_id", TEST_ORG_ID);
    for (const v of (vys || [])) {
      await supabase.from("blocks").delete().eq("vineyard_id", v.id);
    }
    await supabase.from("vineyards").delete().eq("org_id", TEST_ORG_ID);
    await supabase.from("alert_rules").delete().eq("org_id", TEST_ORG_ID);
    await supabase.from("cost_categories").delete().eq("org_id", TEST_ORG_ID);
    for (const p of (profiles || [])) {
      await supabase.from("user_roles").delete().eq("user_id", p.id);
      await supabase.from("profiles").delete().eq("id", p.id);
    }
    await supabase.from("organizations").delete().eq("id", TEST_ORG_ID);

    return new Response(JSON.stringify({ cleaned: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Unknown action", { status: 400, headers: corsHeaders });
});
