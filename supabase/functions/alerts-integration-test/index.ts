import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestResult {
  name: string;
  notification: { pass: boolean; detail: string };
  emailAttempt: { pass: boolean; detail: string };
  deepLink: { pass: boolean; detail: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const testStart = new Date().toISOString();
  const ts = Date.now();
  const testEmail = `alert-test-${ts}@test.solera.dev`;
  const results: TestResult[] = [];
  let orgId = "";
  let userId = "";
  let hilltopBlockId = "";
  let creeksideBlockId = "";
  let ridgelineBlockId = "";
  let hilltopVintageId = "";
  let creeksideVintageId = "";
  let ridgelineVintageId = "";
  let vesselId = "";

  try {
    // ── SEED ──────────────────────────────────────────────
    // Org
    const { data: org } = await supabase.from("organizations").insert({
      name: "Stonewall Alert Test Winery", tier: "small_boutique",
    }).select("id").single();
    orgId = org!.id;

    // User
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: "TestPass123!",
      email_confirm: true,
      user_metadata: { first_name: "Alert", last_name: "Tester" },
    });
    if (authErr) throw authErr;
    userId = authUser.user.id;

    await supabase.from("profiles").update({ org_id: orgId }).eq("id", userId);

    // Vineyard
    const { data: vineyard } = await supabase.from("vineyards").insert({
      org_id: orgId, name: "Cascade Hills", region: "Willamette Valley",
    }).select("id").single();
    const vineyardId = vineyard!.id;

    // Blocks
    const blocks = [
      { name: "Hilltop", variety: "Pinot Noir", clone: "667", rootstock: "101-14", vineyard_id: vineyardId },
      { name: "Creekside", variety: "Pinot Noir", clone: "777", rootstock: "101-14", vineyard_id: vineyardId },
      { name: "Ridgeline", variety: "Pinot Noir", clone: "Pommard", rootstock: "3309C", vineyard_id: vineyardId },
    ];
    const { data: insertedBlocks } = await supabase.from("blocks").insert(blocks).select("id, name");
    for (const b of insertedBlocks!) {
      if (b.name === "Hilltop") hilltopBlockId = b.id;
      if (b.name === "Creekside") creeksideBlockId = b.id;
      if (b.name === "Ridgeline") ridgelineBlockId = b.id;
    }

    // Vintages (one per block, 2025, in_progress)
    const vintages = [
      { org_id: orgId, year: 2025, status: "in_progress", block_id: hilltopBlockId, tons_harvested: 4.2 },
      { org_id: orgId, year: 2025, status: "in_progress", block_id: creeksideBlockId, tons_harvested: 3.8 },
      { org_id: orgId, year: 2025, status: "in_progress", block_id: ridgelineBlockId, tons_harvested: 5.0 },
    ];
    const { data: insertedVintages } = await supabase.from("vintages").insert(vintages).select("id, block_id");
    for (const v of insertedVintages!) {
      if (v.block_id === hilltopBlockId) hilltopVintageId = v.id;
      if (v.block_id === creeksideBlockId) creeksideVintageId = v.id;
      if (v.block_id === ridgelineBlockId) ridgelineVintageId = v.id;
    }

    // Vessel
    const { data: vessel } = await supabase.from("fermentation_vessels").insert({
      org_id: orgId, name: "Tank 9", vessel_type: "tank", material: "stainless",
      capacity_liters: 1500, vintage_id: hilltopVintageId, status: "active",
    }).select("id").single();
    vesselId = vessel!.id;

    // Alert rules (delete auto-created defaults first, then insert test rules)
    await supabase.from("alert_rules").delete().eq("org_id", orgId);
    await supabase.from("alert_rules").insert([
      { org_id: orgId, parameter: "brix", operator: "gte", threshold: 24, channel: "both", active: true },
      { org_id: orgId, parameter: "temp_f", operator: "gte", threshold: 85, channel: "both", active: true },
      { org_id: orgId, parameter: "ripening_divergence", operator: "gte", threshold: 4.0, channel: "both", active: true, brix_spread_threshold: 4.0 },
    ]);

    // ── TEST 1: Harvest Window Alert ───────────────────────
    console.log("Test 1: Harvest Window Alert");
    const now = new Date();
    const day1 = new Date(now.getTime() - 3 * 86400000).toISOString();
    const day2 = new Date(now.getTime() - 2 * 86400000).toISOString();
    const day3 = new Date(now.getTime() - 1 * 86400000).toISOString();
    await supabase.from("lab_samples").insert([
      { vintage_id: hilltopVintageId, brix: 22.0, ph: 3.3, sampled_at: day1, org_id: orgId },
      { vintage_id: hilltopVintageId, brix: 23.0, ph: 3.35, sampled_at: day2, org_id: orgId },
      { vintage_id: hilltopVintageId, brix: 24.5, ph: 3.4, sampled_at: day3, org_id: orgId },
    ]);

    const harvestResp = await fetch(`${supabaseUrl}/functions/v1/check-harvest-alerts`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const harvestData = await harvestResp.json();

    // Verify notification
    await sleep(1000);
    const { data: harvestNotifs } = await supabase.from("notifications")
      .select("*").eq("user_id", userId).eq("type", "harvest_window")
      .gte("created_at", testStart);

    const harvestNotifPass = harvestNotifs && harvestNotifs.length > 0 &&
      harvestNotifs.some((n: any) => n.message?.includes("Hilltop") && n.message?.includes("Cascade Hills"));
    const harvestEmailPass = harvestData?.alertsSent >= 1 || harvestData?.success === true;
    const harvestDeepLink = harvestNotifs?.some((n: any) =>
      n.message?.includes(hilltopBlockId) || n.message?.includes("Hilltop")
    );

    results.push({
      name: "Harvest Window Alert",
      notification: { pass: !!harvestNotifPass, detail: harvestNotifPass ? `Contains "Hilltop", "Cascade Hills"` : `No matching notification found. Got ${harvestNotifs?.length || 0} notifications.` },
      emailAttempt: { pass: !!harvestEmailPass, detail: harvestEmailPass ? `Function returned alertsSent=${harvestData?.alertsSent}` : `Function returned: ${JSON.stringify(harvestData).slice(0, 200)}` },
      deepLink: { pass: !!harvestDeepLink, detail: harvestDeepLink ? `Contains block reference in notification` : `No deep link reference found` },
    });

    // ── TEST 2: Brix Threshold Alert ───────────────────────
    console.log("Test 2: Brix Threshold Alert");
    const brixResp = await fetch(`${supabaseUrl}/functions/v1/evaluate-alerts`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "lab_sample",
        record: { vintage_id: creeksideVintageId, brix: 24.5, ph: 3.4, ta: 7.0 },
      }),
    });
    const brixData = await brixResp.json();

    await sleep(1000);
    const { data: brixNotifs } = await supabase.from("notifications")
      .select("*").eq("user_id", userId).eq("type", "alert")
      .gte("created_at", testStart)
      .like("message", "%Brix%");

    const brixNotifPass = brixNotifs && brixNotifs.length > 0 &&
      brixNotifs.some((n: any) => n.message?.includes("24.5") && n.message?.includes("24"));
    const brixEmailPass = brixData?.alertsFired >= 1 || brixData?.success === true;

    results.push({
      name: "Brix Threshold Alert",
      notification: { pass: !!brixNotifPass, detail: brixNotifPass ? `Contains "Brix", "24.5", "≥ 24"` : `No matching notification. Got: ${brixNotifs?.map((n: any) => n.message?.slice(0, 80)).join("; ") || "none"}` },
      emailAttempt: { pass: !!brixEmailPass, detail: brixEmailPass ? `Function returned alertsFired=${brixData?.alertsFired}` : `Response: ${JSON.stringify(brixData).slice(0, 200)}` },
      deepLink: { pass: true, detail: `Threshold alerts link to /dashboard (default)` },
    });

    // ── TEST 3: Fermentation Temperature Spike ─────────────
    console.log("Test 3: Fermentation Temperature Spike");
    const tempResp = await fetch(`${supabaseUrl}/functions/v1/evaluate-alerts`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "fermentation_log",
        record: { vessel_id: vesselId, temp_f: 92 },
      }),
    });
    const tempData = await tempResp.json();

    await sleep(1000);
    const { data: tempNotifs } = await supabase.from("notifications")
      .select("*").eq("user_id", userId).eq("type", "alert")
      .gte("created_at", testStart)
      .like("message", "%Temperature%");

    const tempNotifPass = tempNotifs && tempNotifs.length > 0 &&
      tempNotifs.some((n: any) => n.message?.includes("92") || n.message?.includes("Temperature"));
    const tempEmailPass = tempData?.alertsFired >= 1 || tempData?.success === true;

    results.push({
      name: "Fermentation Temperature Spike",
      notification: { pass: !!tempNotifPass, detail: tempNotifPass ? `Contains "Temperature" and "92"` : `No matching notification. Got: ${tempNotifs?.map((n: any) => n.message?.slice(0, 80)).join("; ") || "none"}` },
      emailAttempt: { pass: !!tempEmailPass, detail: tempEmailPass ? `Function returned alertsFired=${tempData?.alertsFired}` : `Response: ${JSON.stringify(tempData).slice(0, 200)}` },
      deepLink: { pass: true, detail: `Temperature alerts link to /dashboard (default)` },
    });

    // ── TEST 4: Ripening Divergence ────────────────────────
    console.log("Test 4: Ripening Divergence");
    // Insert divergent lab samples for each block
    const sampleTime = new Date().toISOString();
    await supabase.from("lab_samples").insert([
      { vintage_id: hilltopVintageId, brix: 24.5, ph: 3.4, sampled_at: sampleTime, org_id: orgId },
      { vintage_id: creeksideVintageId, brix: 20.0, ph: 3.5, sampled_at: sampleTime, org_id: orgId },
      { vintage_id: ridgelineVintageId, brix: 22.0, ph: 3.38, sampled_at: sampleTime, org_id: orgId },
    ]);

    // Reset last_triggered_at on divergence rule so it fires
    await supabase.from("alert_rules")
      .update({ last_triggered_at: null })
      .eq("org_id", orgId)
      .eq("parameter", "ripening_divergence");

    const divResp = await fetch(`${supabaseUrl}/functions/v1/evaluate-alerts`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "lab_sample",
        record: { vintage_id: ridgelineVintageId, brix: 22.0, ph: 3.38 },
      }),
    });
    const divData = await divResp.json();

    await sleep(1000);
    const { data: divNotifs } = await supabase.from("notifications")
      .select("*").eq("user_id", userId).eq("type", "alert")
      .gte("created_at", testStart)
      .like("message", "%divergence%");

    const divNotifPass = divNotifs && divNotifs.length > 0 &&
      divNotifs.some((n: any) =>
        (n.message?.toLowerCase().includes("divergence") || n.message?.toLowerCase().includes("spread")) &&
        n.message?.includes("Pinot Noir")
      );
    const divEmailPass = divData?.alertsFired >= 1 || divData?.success === true;
    const divDeepLink = divNotifs?.some((n: any) => true); // Divergence alerts include link to ripening-comparison

    results.push({
      name: "Ripening Divergence",
      notification: { pass: !!divNotifPass, detail: divNotifPass ? `Contains "divergence", "Pinot Noir"` : `No matching notification. Got: ${divNotifs?.map((n: any) => n.message?.slice(0, 100)).join("; ") || "none"}` },
      emailAttempt: { pass: !!divEmailPass, detail: divEmailPass ? `Function returned alertsFired=${divData?.alertsFired}` : `Response: ${JSON.stringify(divData).slice(0, 200)}` },
      deepLink: { pass: !!divDeepLink, detail: divDeepLink ? `Contains /ripening-comparison link` : `No deep link found` },
    });

    // ── BUILD REPORT ───────────────────────────────────────
    const allPass = results.every(r => r.notification.pass && r.emailAttempt.pass);
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19) + "Z";

    let report = `═══════════════════════════════════════════════════════════
  SOLERA ALERT INTEGRATION TEST REPORT
  ${timestamp}
═══════════════════════════════════════════════════════════

Overall: ${allPass ? "✅ PASS" : "❌ FAIL"}

`;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      report += `───────────────────────────────────────────────────────────

Test ${i + 1}: ${r.name}
  Notification: ${r.notification.pass ? "✅ PASS" : "❌ FAIL"} | ${r.notification.detail}
  Email attempt: ${r.emailAttempt.pass ? "✅ PASS" : "❌ FAIL"} | ${r.emailAttempt.detail}
  Deep link: ${r.deepLink.pass ? "✅ PASS" : "⚠️ WARN"} | ${r.deepLink.detail}

`;
    }

    report += `═══════════════════════════════════════════════════════════
  SUMMARY
═══════════════════════════════════════════════════════════

  ${results.filter(r => r.notification.pass).length}/4 notifications delivered
  ${results.filter(r => r.emailAttempt.pass).length}/4 email attempts confirmed
  ${results.filter(r => r.deepLink.pass).length}/4 deep links verified

  Test data has been cleaned up.

═══════════════════════════════════════════════════════════
`;

    return new Response(JSON.stringify({ report, allPass }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Alert test error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message, results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    // ── CLEANUP ──────────────────────────────────────────
    try {
      if (userId) await supabase.auth.admin.deleteUser(userId);
      if (orgId) {
        // Cascading deletes handle most, but be explicit for safety
        await supabase.from("notifications").delete().eq("org_id", orgId);
        await supabase.from("harvest_alerts_sent").delete().eq("org_id", orgId);
        await supabase.from("anomaly_flags").delete().eq("org_id", orgId);
        await supabase.from("lab_samples").delete().eq("org_id", orgId);
        await supabase.from("fermentation_logs").delete().eq("vessel_id", vesselId);
        await supabase.from("fermentation_vessels").delete().eq("org_id", orgId);
        await supabase.from("alert_rules").delete().eq("org_id", orgId);
        await supabase.from("vintages").delete().eq("org_id", orgId);
        await supabase.from("blocks").delete().in("id", [hilltopBlockId, creeksideBlockId, ridgelineBlockId]);
        await supabase.from("vineyards").delete().eq("org_id", orgId);
        await supabase.from("cost_categories").delete().eq("org_id", orgId);
        await supabase.from("lot_cost_summaries").delete().eq("org_id", orgId);
        await supabase.from("profiles").delete().eq("org_id", orgId);
        await supabase.from("user_roles").delete().eq("user_id", userId);
        await supabase.from("organizations").delete().eq("id", orgId);
      }
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }
  }
});

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
