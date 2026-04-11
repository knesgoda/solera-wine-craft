import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const lines: string[] = [];
  const log = (s: string) => lines.push(s);
  let allPassed = true;
  const fail = (s: string) => { log(s); allPassed = false; };
  const pass = (s: string) => log(s);

  log("═══════════════════════════════════════════════════════════");
  log("  RIPENING DIVERGENCE ALERT TEST REPORT");
  log(`  ${new Date().toISOString()}`);
  log("═══════════════════════════════════════════════════════════");
  log("");

  let orgId: string | null = null;
  let triggerOrgId: string | null = null;
  let userId: string | null = null;

  try {
    // ── SETUP ──
    // Org with small_boutique tier (Pro+) so divergence alerts are enabled
    const { data: org, error: orgErr } = await sb.from("organizations").insert({
      name: "Divergence Test Winery", tier: "small_boutique",
    }).select("id").single();
    if (orgErr) throw new Error(`Org: ${orgErr.message}`);
    orgId = org.id;

    // Auth user
    const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
      email: `divergence-test-${Date.now()}@test.local`,
      password: "TestPass123!",
      email_confirm: true,
      user_metadata: { first_name: "Diverge", last_name: "Tester", winery_name: "Trigger Org" },
    });
    if (authErr) throw new Error(`Auth: ${authErr.message}`);
    userId = authUser.user.id;

    const { data: triggerProfile } = await sb.from("profiles").select("org_id").eq("id", userId).single();
    triggerOrgId = triggerProfile?.org_id ?? null;
    await sb.from("profiles").update({ org_id: orgId }).eq("id", userId);

    // Vineyard
    const { data: vineyard, error: vyErr } = await sb.from("vineyards").insert({
      name: "Divergence Vineyard", org_id: orgId, region: "Napa Valley",
    }).select("id").single();
    if (vyErr) throw new Error(`Vineyard: ${vyErr.message}`);

    // 3 blocks of the same variety
    const blockNames = ["Block Alpha", "Block Beta", "Block Gamma"];
    const blockInserts = blockNames.map(name => ({
      name, vineyard_id: vineyard.id, variety: "Cabernet Sauvignon", status: "active" as const,
    }));
    const { data: blocks, error: blkErr } = await sb.from("blocks").insert(blockInserts).select("id, name");
    if (blkErr) throw new Error(`Blocks: ${blkErr.message}`);

    // 3 vintages (one per block)
    const vintageInserts = blocks!.map((b, i) => ({
      name: `Div Test Lot ${i + 1}`, variety: "Cabernet Sauvignon", year: 2025, org_id: orgId, block_id: b.id,
    }));
    const { data: vintages, error: vErr } = await sb.from("vintages").insert(vintageInserts).select("id, block_id");
    if (vErr) throw new Error(`Vintages: ${vErr.message}`);

    // Create ripening_divergence alert rule (threshold 4.0, no cooldown yet)
    const { data: rule, error: ruleErr } = await sb.from("alert_rules").insert({
      org_id: orgId,
      parameter: "ripening_divergence",
      operator: "gte",
      threshold: 0, // not used for divergence; brix_spread_threshold is
      brix_spread_threshold: 4.0,
      channel: "email",
      active: true,
    }).select("id").single();
    if (ruleErr) throw new Error(`Rule: ${ruleErr.message}`);

    // Delete default alert rules created by org trigger (except our divergence rule)
    await sb.from("alert_rules").delete().eq("org_id", orgId).neq("id", rule.id);

    log("Setup: org (small_boutique), vineyard, 3 blocks, 3 vintages, divergence rule");
    log(`  Block Alpha → Vintage ${vintages![0].id}`);
    log(`  Block Beta  → Vintage ${vintages![1].id}`);
    log(`  Block Gamma → Vintage ${vintages![2].id}`);
    log(`  Rule: brix_spread_threshold = 4.0`);
    log("");

    // ═══════════════════════════════════════════════════════
    // TEST 1: Insert lab samples with 5.2° spread → alert fires
    // ═══════════════════════════════════════════════════════
    log("── TEST 1: Divergence alert fires (5.2° spread > 4.0° threshold) ──");

    // Brix values: 24.8, 21.5, 19.6 → spread = 24.8 - 19.6 = 5.2
    const brixValues = [24.8, 21.5, 19.6];
    const sampledAt = new Date().toISOString();

    for (let i = 0; i < 3; i++) {
      const { error } = await sb.from("lab_samples").insert({
        vintage_id: vintages![i].id,
        sampled_at: sampledAt,
        brix: brixValues[i],
        ph: 3.5,
        ta: 6.0,
      });
      if (error) throw new Error(`Lab sample ${i}: ${error.message}`);
    }
    pass("  Inserted 3 lab samples: Brix 24.8, 21.5, 19.6 (spread = 5.2)");

    // Call evaluate-alerts with the last lab sample as trigger
    const { data: lastSample } = await sb.from("lab_samples")
      .select("*").eq("vintage_id", vintages![2].id).order("sampled_at", { ascending: false }).limit(1).single();

    const evalResp = await fetch(`${supabaseUrl}/functions/v1/evaluate-alerts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "lab_sample", record: lastSample }),
    });
    const evalResult = await evalResp.json();

    if (evalResp.ok && evalResult.alertsFired > 0) {
      pass(`  evaluate-alerts returned: ${evalResult.alertsFired} alert(s) fired ✅`);
    } else {
      fail(`  evaluate-alerts: expected alertsFired > 0, got ${JSON.stringify(evalResult)} ❌`);
    }

    // Verify notification was created
    const { data: notifs } = await sb.from("notifications")
      .select("message, link_url, type")
      .eq("org_id", orgId)
      .eq("type", "alert")
      .ilike("message", "%divergence%");

    if (notifs && notifs.length > 0) {
      const n = notifs[0];
      pass(`  Notification created ✅`);

      // Check block names in message
      const hasAlpha = n.message.includes("Block Alpha") || n.message.includes("Block Gamma");
      const hasBrix = n.message.includes("24.8") || n.message.includes("19.6");
      const hasSpread = n.message.includes("5.2");

      if (hasAlpha && hasBrix && hasSpread) {
        pass(`  Message contains block names, Brix values, and spread ✅`);
      } else {
        fail(`  Message content incomplete ❌: ${n.message}`);
      }

      // Check link URL
      if (n.link_url && n.link_url.includes("ripening-comparison")) {
        pass(`  Link URL points to ripening comparison page ✅`);
      } else {
        fail(`  Link URL missing or wrong ❌: ${n.link_url}`);
      }

      log(`  Message: ${n.message.substring(0, 120)}...`);
    } else {
      fail("  No divergence notification found ❌");
    }

    // Verify rule's last_triggered_at was updated
    const { data: updatedRule } = await sb.from("alert_rules").select("last_triggered_at").eq("id", rule.id).single();
    if (updatedRule?.last_triggered_at) {
      pass(`  Rule last_triggered_at updated ✅`);
    } else {
      fail(`  Rule last_triggered_at NOT updated ❌`);
    }

    log("");

    // ═══════════════════════════════════════════════════════
    // TEST 2: Second batch within 24h → cooldown blocks duplicate
    // ═══════════════════════════════════════════════════════
    log("── TEST 2: 24-hour cooldown prevents duplicate alert ──");

    // Count notifications before
    const { count: beforeCount } = await sb.from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("type", "alert");

    // Insert another batch of lab samples (still divergent)
    const sampledAt2 = new Date().toISOString();
    for (let i = 0; i < 3; i++) {
      await sb.from("lab_samples").insert({
        vintage_id: vintages![i].id,
        sampled_at: sampledAt2,
        brix: brixValues[i] + 0.3, // slightly different but still > 4.0 spread
        ph: 3.48,
        ta: 6.1,
      });
    }
    pass("  Inserted second batch of lab samples (still divergent)");

    // Get latest sample for trigger
    const { data: lastSample2 } = await sb.from("lab_samples")
      .select("*").eq("vintage_id", vintages![2].id).order("sampled_at", { ascending: false }).limit(1).single();

    const evalResp2 = await fetch(`${supabaseUrl}/functions/v1/evaluate-alerts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "lab_sample", record: lastSample2 }),
    });
    const evalResult2 = await evalResp2.json();

    // Should return 0 alerts (cooldown active)
    const alertsFired2 = evalResult2.alertsFired ?? 0;
    if (alertsFired2 === 0) {
      pass(`  Cooldown active: 0 alerts fired ✅`);
    } else {
      fail(`  Cooldown FAILED: ${alertsFired2} alert(s) fired ❌`);
    }

    // Verify notification count unchanged
    const { count: afterCount } = await sb.from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("type", "alert");

    if (afterCount === beforeCount) {
      pass(`  Notification count unchanged (${afterCount}) ✅`);
    } else {
      fail(`  Notification count changed: ${beforeCount} → ${afterCount} ❌`);
    }

  } catch (e: any) {
    fail(`\nFATAL ERROR: ${e.message}`);
  }

  // ── Cleanup ──
  try {
    if (orgId) {
      await sb.from("alert_rules").delete().eq("org_id", orgId);
      await sb.from("notifications").delete().eq("org_id", orgId);
      await sb.from("cost_categories").delete().eq("org_id", orgId);
      await sb.from("organizations").delete().eq("id", orgId);
    }
    if (triggerOrgId) {
      await sb.from("alert_rules").delete().eq("org_id", triggerOrgId);
      await sb.from("cost_categories").delete().eq("org_id", triggerOrgId);
      await sb.from("organizations").delete().eq("id", triggerOrgId);
    }
    if (userId) await sb.auth.admin.deleteUser(userId);
    log("\nCleanup: all test data removed ✅");
  } catch (_) { log("\nCleanup: partial (best effort)"); }

  log("");
  log(`Overall: ${allPassed ? "ALL PASSED ✅" : "SOME FAILURES ❌"}`);

  const report = lines.join("\n");
  return new Response(JSON.stringify({ passed: allPassed, report }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: allPassed ? 200 : 500,
  });
});
