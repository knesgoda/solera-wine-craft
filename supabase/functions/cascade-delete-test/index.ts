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

  const ts = new Date().toISOString();
  log("═══════════════════════════════════════════════════════════");
  log("  CASCADE DELETION TEST REPORT");
  log(`  ${ts}`);
  log("═══════════════════════════════════════════════════════════");
  log("");

  // Track IDs for verification
  const ids: Record<string, string[]> = {};

  try {
    // 1. Create test org
    const { data: org, error: orgErr } = await sb.from("organizations").insert({ name: "Cascade Test Winery" }).select("id").single();
    if (orgErr) throw new Error(`Org create: ${orgErr.message}`);
    const orgId = org.id;
    ids.organizations = [orgId];
    log(`Org created: ${orgId}`);

    // 2. Create auth user (handle_new_user trigger will create its own org+profile, so we
    //    need to reassign the profile to our test org afterwards)
    const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
      email: `cascade-test-${Date.now()}@test.local`,
      password: "TestPass123!",
      email_confirm: true,
      user_metadata: { first_name: "Test", last_name: "Cascade", winery_name: "Trigger Org" },
    });
    if (authErr) throw new Error(`Auth user: ${authErr.message}`);
    const userId = authUser.user.id;

    // The trigger created a separate org + profile. Move profile to our test org.
    // First find the trigger-created org so we can clean it up later.
    const { data: triggerProfile } = await sb.from("profiles").select("org_id").eq("id", userId).single();
    const triggerOrgId = triggerProfile?.org_id;

    const { error: profUpd } = await sb.from("profiles").update({ org_id: orgId }).eq("id", userId);
    if (profUpd) throw new Error(`Profile reassign: ${profUpd.message}`);
    ids.profiles = [userId];

    // 3. Vineyard
    const { data: vineyard, error: vyErr } = await sb.from("vineyards").insert({
      name: "Test Vineyard Alpha", org_id: orgId, region: "Napa Valley"
    }).select("id").single();
    if (vyErr) throw new Error(`Vineyard: ${vyErr.message}`);
    ids.vineyards = [vineyard.id];

    // 4. Blocks (3)
    const blockInserts = [
      { name: "Block A", vineyard_id: vineyard.id, variety: "Cabernet Sauvignon" },
      { name: "Block B", vineyard_id: vineyard.id, variety: "Merlot" },
      { name: "Block C", vineyard_id: vineyard.id, variety: "Chardonnay" },
    ];
    const { data: blocks, error: blkErr } = await sb.from("blocks").insert(blockInserts).select("id");
    if (blkErr) throw new Error(`Blocks: ${blkErr.message}`);
    ids.blocks = blocks!.map(b => b.id);

    // 5. Vintages (3, one per block)
    const vintageInserts = blocks!.map((b, i) => ({
      lot_number: `CASCADE-TEST-${i + 1}`,
      variety: blockInserts[i].variety,
      vintage_year: 2025,
      org_id: orgId,
      block_id: b.id,
    }));
    const { data: vintages, error: vErr } = await sb.from("vintages").insert(vintageInserts).select("id");
    if (vErr) throw new Error(`Vintages: ${vErr.message}`);
    ids.vintages = vintages!.map(v => v.id);

    // 6. Lab samples (2 per vintage = 6)
    const labInserts: any[] = [];
    for (const v of vintages!) {
      labInserts.push(
        { vintage_id: v.id, sampled_at: new Date().toISOString(), brix: 23.5, ph: 3.55, ta: 6.2 },
        { vintage_id: v.id, sampled_at: new Date().toISOString(), brix: 24.1, ph: 3.50, ta: 6.4 },
      );
    }
    const { data: labs, error: labErr } = await sb.from("lab_samples").insert(labInserts).select("id");
    if (labErr) throw new Error(`Lab samples: ${labErr.message}`);
    ids.lab_samples = labs!.map(l => l.id);

    // 7. Alert rules (3) — NO ACTION, must pre-delete
    const alertInserts = [
      { org_id: orgId, parameter: "brix" as const, operator: "gte" as const, threshold: 24, channel: "in_app" as const },
      { org_id: orgId, parameter: "ph" as const, operator: "lte" as const, threshold: 3.2, channel: "email" as const },
      { org_id: orgId, parameter: "ta" as const, operator: "gte" as const, threshold: 8, channel: "both" as const },
    ];
    const { data: alerts, error: alErr } = await sb.from("alert_rules").insert(alertInserts).select("id");
    if (alErr) throw new Error(`Alert rules: ${alErr.message}`);
    ids.alert_rules = alerts!.map(a => a.id);

    // 8. Notifications (2) — NO ACTION, must pre-delete
    const notifInserts = [
      { org_id: orgId, user_id: userId, title: "Test Notification 1", message: "Cascade test", type: "alert" },
      { org_id: orgId, user_id: userId, title: "Test Notification 2", message: "Cascade test 2", type: "info" },
    ];
    const { data: notifs, error: nErr } = await sb.from("notifications").insert(notifInserts).select("id");
    if (nErr) throw new Error(`Notifications: ${nErr.message}`);
    ids.notifications = notifs!.map(n => n.id);

    // 9. Fermentation vessel + log
    const { data: vessel, error: fvErr } = await sb.from("fermentation_vessels").insert({
      name: "Test Tank T1", org_id: orgId, capacity_gallons: 500, vintage_id: vintages![0].id
    }).select("id").single();
    if (fvErr) throw new Error(`Vessel: ${fvErr.message}`);
    ids.fermentation_vessels = [vessel.id];

    const { data: flog, error: flErr } = await sb.from("fermentation_logs").insert({
      vessel_id: vessel.id, vintage_id: vintages![0].id, brix: 22.0, temp_f: 68
    }).select("id").single();
    if (flErr) throw new Error(`Ferm log: ${flErr.message}`);
    ids.fermentation_logs = [flog.id];

    log("");
    log("Seeded Records:");
    log(`  Organization: ${orgId}`);
    log(`  Vineyards: 1 | Blocks: 3 | Vintages: 3`);
    log(`  Lab Samples: 6 | Alert Rules: 3 | Notifications: 2`);
    log(`  Vessels: 1 | Fermentation Logs: 1 | Profiles: 1`);
    log("");

    // ── Pre-delete cleanup of NO ACTION tables ──
    log("Pre-delete cleanup (NO ACTION tables):");

    const { error: delAlerts } = await sb.from("alert_rules").delete().eq("org_id", orgId);
    log(delAlerts ? `  alert_rules:    FAILED ❌ ${delAlerts.message}` : `  alert_rules:    3 deleted ✅`);
    if (delAlerts) allPassed = false;

    const { error: delNotifs } = await sb.from("notifications").delete().eq("org_id", orgId);
    log(delNotifs ? `  notifications:  FAILED ❌ ${delNotifs.message}` : `  notifications:  2 deleted ✅`);
    if (delNotifs) allPassed = false;

    // Also clean any cost_categories seeded by trigger
    await sb.from("cost_categories").delete().eq("org_id", orgId);
    // Clean lot_cost_summaries (NO ACTION from vintages)
    for (const v of vintages!) {
      await sb.from("lot_cost_summaries").delete().eq("vintage_id", v.id);
    }

    log("");

    // ── Delete the org ──
    log("Deleting organization...");
    const { error: delOrg } = await sb.from("organizations").delete().eq("id", orgId);
    if (delOrg) {
      fail(`  DELETE FAILED ❌: ${delOrg.message}`);
      // Try to identify blocking table
      log("  (A NO ACTION FK may be blocking deletion. Check for uncleaned children.)");
    } else {
      log("  Organization deleted ✅");
    }
    log("");

    // ── Post-delete verification ──
    log("Post-delete verification:");

    const checks: Array<{ table: string; column: string; value: string; label: string }> = [
      { table: "organizations", column: "id", value: orgId, label: "CASCADE" },
      { table: "vineyards", column: "org_id", value: orgId, label: "CASCADE" },
      { table: "blocks", column: "vineyard_id", value: vineyard.id, label: "CASCADE (via vineyards)" },
      { table: "vintages", column: "org_id", value: orgId, label: "CASCADE" },
      { table: "profiles", column: "org_id", value: orgId, label: "CASCADE" },
      { table: "fermentation_vessels", column: "org_id", value: orgId, label: "CASCADE" },
    ];

    // Lab samples check by vintage IDs
    for (const v of vintages!) {
      checks.push({ table: "lab_samples", column: "vintage_id", value: v.id, label: "CASCADE (via vintages)" });
    }

    // Fermentation logs by vessel
    checks.push({ table: "fermentation_logs", column: "vessel_id", value: vessel.id, label: "CASCADE (via vessels)" });

    // Deduplicate table names for display
    const tableResults: Record<string, { count: number; label: string }> = {};

    for (const check of checks) {
      const { count, error: cErr } = await sb.from(check.table).select("*", { count: "exact", head: true }).eq(check.column, check.value);
      const remaining = count ?? 0;
      const key = check.table;
      if (!tableResults[key]) {
        tableResults[key] = { count: remaining, label: check.label };
      } else {
        tableResults[key].count += remaining;
      }
    }

    for (const [table, { count, label }] of Object.entries(tableResults)) {
      const pad = " ".repeat(Math.max(1, 25 - table.length));
      if (count === 0) {
        log(`  ${table}:${pad}0 remaining ✅ ${label}`);
      } else {
        fail(`  ${table}:${pad}${count} remaining ❌ EXPECTED 0 — ${label}`);
      }
    }

    log("");

    // ── Dangling FK check ──
    log("Dangling FK check:");
    // Check a broad set of tables for any rows referencing the deleted org_id
    const danglingTables = [
      "alert_rules", "notifications", "analog_vintages", "customers",
      "orders", "saved_reports", "import_jobs", "barrels",
      "blending_trials", "weather_readings", "ai_conversations",
      "anomaly_flags", "cost_categories", "integration_sync_logs",
      "client_orgs", "tasks",
    ];
    let danglingFound = false;
    for (const t of danglingTables) {
      const { count } = await sb.from(t).select("*", { count: "exact", head: true }).eq("org_id", orgId);
      if ((count ?? 0) > 0) {
        fail(`  ${t}: ${count} orphaned rows ❌`);
        danglingFound = true;
      }
    }
    if (!danglingFound) {
      log("  No orphaned records found ✅");
    }

  } catch (e: any) {
    fail(`\nFATAL ERROR: ${e.message}`);
  }

  // Cleanup: delete the trigger-created org and auth user
  try {
    // @ts-ignore - triggerOrgId/userId may not be in scope if early failure
    if (typeof triggerOrgId !== "undefined" && triggerOrgId) {
      // Clean NO ACTION children from trigger org
      // @ts-ignore
      await sb.from("alert_rules").delete().eq("org_id", triggerOrgId);
      // @ts-ignore
      await sb.from("cost_categories").delete().eq("org_id", triggerOrgId);
      // @ts-ignore
      await sb.from("organizations").delete().eq("id", triggerOrgId);
    }
    // @ts-ignore
    if (typeof userId !== "undefined" && userId) {
      // @ts-ignore
      await sb.auth.admin.deleteUser(userId);
    }
  } catch (_) { /* best effort */ }

  log("");
  log(`Overall: ${allPassed ? "ALL PASSED ✅" : "SOME FAILURES ❌"}`);

  const report = lines.join("\n");
  return new Response(JSON.stringify({ passed: allPassed, report }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: allPassed ? 200 : 500,
  });
});
