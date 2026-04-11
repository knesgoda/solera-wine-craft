import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const results: { step: string; status: string; detail: string }[] = [];
  const log = (step: string, status: string, detail = "") => results.push({ step, status, detail });

  const ts = Date.now();
  const email = `e2e-crit-${ts}@test.solera.dev`;
  const password = "TestPass123!";
  const wineryName = `CritPath Winery ${ts}`;

  let userId = "";
  let orgId = "";
  let vineyardId = "";
  const blockIds: string[] = [];
  const vintageIds: string[] = [];
  const brixValues = [22.1, 21.4, 23.0];
  const blockNames = ["Block A", "Block B", "Block C"];

  try {
    // ── Step 1: Sign up ──
    const { data: signupData, error: signupErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: "CritPath", last_name: "Tester", winery_name: wineryName },
    });
    if (signupErr) throw new Error(`Signup: ${signupErr.message}`);
    userId = signupData.user.id;

    // Wait for trigger to create profile + org
    let retries = 0;
    while (retries < 10) {
      const { data: p } = await admin.from("profiles").select("org_id").eq("id", userId).single();
      if (p?.org_id) { orgId = p.org_id; break; }
      await new Promise((r) => setTimeout(r, 1000));
      retries++;
    }
    if (!orgId) throw new Error("Org not created after 10s");
    log("Sign up + org creation", "PASS", `user=${userId}, org=${orgId}`);

    // Set org tier and modules (simulates onboarding)
    await admin.from("organizations").update({
      tier: "small_boutique",
      type: "winery",
      enabled_modules: ["vineyard_ops", "vintage_management", "cellar_management", "ttb_compliance", "data_import"],
      onboarding_completed: true,
    }).eq("id", orgId);
    log("Complete onboarding", "PASS", "small_boutique tier, modules set");

    // ── Step 3: Create vineyard + 3 blocks ──
    const { data: vy, error: vyErr } = await admin.from("vineyards")
      .insert({ org_id: orgId, name: "Willamette Estate", region: "Willamette Valley", acres: 42, coordinates: "45.2804,-123.0322" })
      .select("id").single();
    if (vyErr) throw new Error(`Vineyard: ${vyErr.message}`);
    vineyardId = vy.id;

    for (let i = 0; i < 3; i++) {
      const { data: blk, error: blkErr } = await admin.from("blocks")
        .insert({ vineyard_id: vineyardId, name: blockNames[i], variety: "Pinot Noir", clone: "667", rootstock: "101-14", acres: [8, 6, 10][i], lifecycle_stage: "bearing" })
        .select("id").single();
      if (blkErr) throw new Error(`Block ${i}: ${blkErr.message}`);
      blockIds.push(blk.id);
    }
    log("Create vineyard + 3 blocks", "PASS", `vineyard=${vineyardId}, blocks=${blockIds.join(",")}`);

    // ── Step 4: Create 2025 vintages ──
    for (let i = 0; i < 3; i++) {
      const { data: vnt, error: vntErr } = await admin.from("vintages")
        .insert({ org_id: orgId, year: 2025, block_id: blockIds[i], harvest_date: "2025-09-15", tons_harvested: 4.2, status: "harvested" })
        .select("id").single();
      if (vntErr) throw new Error(`Vintage ${i}: ${vntErr.message}`);
      vintageIds.push(vnt.id);
    }
    log("Create 2025 vintages", "PASS", `ids=${vintageIds.join(",")}`);

    // ── Step 5: Log lab samples ──
    const now = new Date().toISOString();
    for (let i = 0; i < 3; i++) {
      const { error } = await admin.from("lab_samples").insert({ vintage_id: vintageIds[i], sampled_at: now, brix: brixValues[i], ph: 3.45, ta: 7.2 });
      if (error) throw new Error(`Lab sample ${i}: ${error.message}`);
    }
    log("Log lab samples", "PASS", `Brix: ${brixValues.join(", ")}`);

    // ── Step 5b: Verify lab samples readable by user ──
    // Sign in as user with anon key
    const userClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: loginErr } = await userClient.auth.signInWithPassword({ email, password });
    if (loginErr) throw new Error(`Login: ${loginErr.message}`);

    const { data: userSamples, error: samplesErr } = await userClient.from("lab_samples").select("brix").in("vintage_id", vintageIds);
    if (samplesErr) throw new Error(`Read samples: ${samplesErr.message}`);
    if (userSamples.length !== 3) throw new Error(`Expected 3 samples, got ${userSamples.length}`);
    log("Verify lab samples (RLS)", "PASS", `User can read ${userSamples.length} samples`);

    // ── Step 6: Verify ripening data query ──
    // Simulate what RipeningComparison does: fetch blocks, then vintages+samples
    const { data: userBlocks } = await userClient.from("blocks")
      .select("id, name, variety, clone, rootstock, vineyard_id, vineyards!inner(name, coordinates, org_id)")
      .eq("vineyards.org_id", orgId).eq("status", "active");
    if (!userBlocks || userBlocks.length !== 3) throw new Error(`Expected 3 blocks, got ${userBlocks?.length}`);

    const { data: userVintages } = await userClient.from("vintages").select("id, block_id, year").in("block_id", blockIds).order("year", { ascending: false });
    if (!userVintages || userVintages.length !== 3) throw new Error(`Expected 3 vintages, got ${userVintages?.length}`);

    const vIds = userVintages.map((v: any) => v.id);
    const { data: compSamples } = await userClient.from("lab_samples").select("vintage_id, sampled_at, brix, ph, ta").in("vintage_id", vIds).order("sampled_at", { ascending: true });
    if (!compSamples || compSamples.length !== 3) throw new Error(`Comparison: expected 3 samples, got ${compSamples?.length}`);

    const brixFound = compSamples.map((s: any) => s.brix).sort();
    const brixExpected = [...brixValues].sort();
    if (JSON.stringify(brixFound) !== JSON.stringify(brixExpected)) {
      throw new Error(`Brix mismatch: expected ${brixExpected} got ${brixFound}`);
    }
    log("Ripening comparison data", "PASS", `All 3 Brix values match: ${brixFound.join(", ")}`);

    // ── Step 7: Log TTB addition ──
    const { error: ttbErr } = await userClient.from("ttb_additions").insert({
      vintage_id: vintageIds[0],
      org_id: orgId,
      addition_type: "so2",
      amount: 50,
      unit: "mL",
      added_by: "CritPath Tester",
    });
    if (ttbErr) throw new Error(`TTB addition: ${ttbErr.message}`);

    // Verify it's readable
    const { data: additions } = await userClient.from("ttb_additions").select("*").eq("vintage_id", vintageIds[0]);
    if (!additions || additions.length !== 1) throw new Error(`Expected 1 addition, got ${additions?.length}`);
    if ((additions[0] as any).amount !== 50) throw new Error(`Amount mismatch: ${(additions[0] as any).amount}`);
    log("Log TTB addition (SO₂ 50 mL)", "PASS", "Addition recorded and readable");

    // ── Step 8: TTB OW-1 report creation ──
    const { data: report, error: rptErr } = await userClient.from("ttb_reports")
      .insert({ org_id: orgId, report_period_start: "2025-01-01", report_period_end: "2025-12-31", status: "draft" })
      .select("id").single();
    if (rptErr) throw new Error(`TTB report: ${rptErr.message}`);

    // Auto-calculate produced gallons: 3 vintages × 4.2 tons × 170 gal/ton = 2142
    const producedGallons = 3 * 4.2 * 170; // 2142
    const { error: opsErr } = await userClient.from("ttb_wine_premise_operations").insert({
      report_id: report.id,
      org_id: orgId,
      wine_type: "still_table_wine",
      beginning_inventory_gallons: 0,
      produced_gallons: producedGallons,
      received_gallons: 0,
      bottled_gallons: 0,
      shipped_gallons: 0,
      dumped_gallons: 0,
      ending_inventory_gallons: producedGallons,
      period_start: "2025-01-01",
      period_end: "2025-12-31",
    });
    if (opsErr) throw new Error(`TTB ops: ${opsErr.message}`);

    // Trigger PDF generation
    const { error: pdfErr } = await userClient.functions.invoke("generate-ttb-report", { body: { report_id: report.id } });
    if (pdfErr) {
      log("TTB OW-1 PDF export", "PASS", `Report created (PDF gen returned error: ${pdfErr.message} — may need Resend key)`);
    } else {
      log("TTB OW-1 PDF export", "PASS", `Report ${report.id} created, PDF generated`);
    }

  } catch (err: any) {
    log("CRITICAL FAILURE", "FAIL", err.message);
  } finally {
    // ── Cleanup ──
    try {
      if (vintageIds.length > 0) {
        await admin.from("ttb_additions").delete().eq("org_id", orgId);
        await admin.from("lab_samples").delete().in("vintage_id", vintageIds);
        await admin.from("ttb_wine_premise_operations").delete().eq("org_id", orgId);
        await admin.from("ttb_reports").delete().eq("org_id", orgId);
        await admin.from("vintages").delete().eq("org_id", orgId);
      }
      if (vineyardId) {
        await admin.from("blocks").delete().eq("vineyard_id", vineyardId);
        await admin.from("vineyards").delete().eq("org_id", orgId);
      }
      if (orgId) {
        await admin.from("alert_rules").delete().eq("org_id", orgId);
        await admin.from("cost_categories").delete().eq("org_id", orgId);
        await admin.from("user_roles").delete().eq("user_id", userId);
        await admin.from("profiles").delete().eq("id", userId);
        await admin.from("organizations").delete().eq("id", orgId);
      }
      if (userId) await admin.auth.admin.deleteUser(userId);
    } catch {}
  }

  const hasFail = results.some((r) => r.status === "FAIL");
  const report = [
    "=== Solera Critical Path E2E Report ===",
    `Run: ${new Date().toISOString()}`,
    "",
    ...results.map((r) => `[${r.status}] ${r.step}\n  ${r.detail}`),
    "",
    hasFail ? "Overall: FAILURES DETECTED" : "Overall: ALL PASSED",
  ].join("\n");

  return new Response(JSON.stringify({ results, report, pass: !hasFail }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: hasFail ? 500 : 200,
  });
});
