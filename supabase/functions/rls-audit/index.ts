import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function uuid(): string { return crypto.randomUUID(); }

const ids: Record<string, string> = {};

interface Result {
  table: string;
  readBlocked: boolean | string;
  writeBlocked: boolean | string;
  updateBlocked: boolean | string;
  deleteBlocked: boolean | string;
  notes: string;
  pass: boolean;
}

function replacePlaceholders(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.startsWith("__") && v.endsWith("__")) {
      out[k] = ids[v] ?? v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Tables with direct org_id
const DIRECT_TABLES: { table: string; cols?: Record<string, unknown> }[] = [
  { table: "alert_rules", cols: { parameter: "brix", operator: "gte", threshold: 24, channel: "email" } },
  { table: "analog_vintages", cols: { region: "Test", year: 2099 } },
  { table: "anomaly_flags", cols: { parameter: "brix", value: 30, vintage_id: "__VINTAGE_A__" } },
  { table: "api_keys", cols: { label: "t", key_prefix: "sk", key_hash: "h" } },
  { table: "audit_logs", cols: { action: "rls_test" } },
  { table: "backup_jobs", cols: { triggered_by: "manual" } },
  { table: "barrel_groups", cols: { name: "TG" } },
  { table: "barrels" },
  { table: "blending_trials", cols: { name: "TT" } },
  { table: "client_messages", cols: { message: "t", sender_type: "winery", client_org_id: "__CLIENT_ORG_A__" } },
  { table: "club_members", cols: { club_id: "__CLUB_A__", customer_id: "__CUSTOMER_A__" } },
  { table: "club_shipments", cols: { club_id: "__CLUB_A__", shipment_date: "2099-01-01" } },
  { table: "commerce7_config" },
  { table: "contract_block_assignments", cols: { contract_id: "__CONTRACT_A__" } },
  { table: "cost_categories", cols: { name: "RLS Cat" } },
  { table: "cost_entries", cols: { category_id: "__COST_CAT_A__", method: "manual", description: "t", total_amount: 1, vintage_id: "__VINTAGE_A__" } },
  { table: "customers", cols: { email: "rls@t.com" } },
  { table: "facility_transfers", cols: { from_facility_id: "__FACILITY_A__", to_facility_id: "__FACILITY_A__", sku_id: "__SKU_A__" } },
  { table: "fermentation_vessels", cols: { name: "TV" } },
  { table: "google_sheet_connections", cols: { google_sheet_id: "t", module: "lab_samples", sheet_name: "T", tab_name: "S1" } },
  { table: "grading_scales", cols: { name: "TS", contract_id: "__CONTRACT_A__" } },
  { table: "grower_contacts", cols: { grower_id: "__GROWER_A__", name: "TC" } },
  { table: "grower_contracts", cols: { grower_id: "__GROWER_A__", base_price_per_unit: 1, vintage_year: 2099 } },
  { table: "growers", cols: { name: "TG" } },
  { table: "harvest_alerts_sent", cols: { alert_rule_id: "__ALERT_RULE_A__", block_id: "__BLOCK_A__", parameter: "brix", value: 25 } },
  { table: "harvest_predictions", cols: { block_id: "__BLOCK_A__", predicted_date: "2099-09-15" } },
  { table: "import_jobs", cols: { file_name: "t.csv", module: "lab_samples", status: "pending" } },
  { table: "import_mappings", cols: { module: "lab_samples", mapping_json: {} } },
  { table: "integration_sync_logs", cols: { integration: "t", direction: "pull", status: "success" } },
  { table: "inventory_adjustments", cols: { sku_id: "__SKU_A__", adjustment_type: "count", quantity_change: 1, reason: "t" } },
  { table: "inventory_skus", cols: { sku_code: "T-SKU", wine_name: "TW" } },
  { table: "lot_cost_summaries", cols: { vintage_id: "__VINTAGE_A__" } },
  { table: "material_unit_costs", cols: { material_name: "TM", unit: "kg", cost_per_unit: 1 } },
  { table: "notifications", cols: { user_id: "__USER_A__", title: "T", message: "t" } },
  { table: "orders", cols: { customer_id: "__CUSTOMER_A__", order_number: "T-001", total_amount: 1 } },
  { table: "pick_windows", cols: { block_id: "__BLOCK_A__", window_start: "2099-09-01", window_end: "2099-09-30" } },
  { table: "saved_reports", cols: { name: "TR", report_type: "lab", config_json: {} } },
  { table: "tasks", cols: { title: "TT" } },
  { table: "ttb_additions", cols: { vintage_id: "__VINTAGE_A__", material: "T", amount: 1, unit: "g/L", addition_date: "2099-01-01" } },
  { table: "ttb_reports", cols: { report_month: "2099-01-01", report_type: "monthly" } },
  { table: "vineyards", cols: { name: "TV" } },
  { table: "vintages", cols: { name: "TV 2099", variety: "CS", vintage_year: 2099 } },
  { table: "weather_readings", cols: { vineyard_id: "__VINEYARD_A__", reading_date: "2099-01-01" } },
  { table: "webhook_subscriptions", cols: { url: "https://t.com/h", events: ["test"] } },
  { table: "weekly_summaries", cols: { week_start: "2099-01-06", summary_json: {} } },
  { table: "weigh_tag_metrics", cols: { weigh_tag_id: "__WEIGH_TAG_A__" } },
  { table: "weigh_tags", cols: { contract_id: "__CONTRACT_A__", delivery_date: "2099-01-01" } },
  { table: "wine_clubs", cols: { name: "TC" } },
];

const INDIRECT_TABLES: { table: string; fk: string; parentKey: string; cols?: Record<string, unknown> }[] = [
  { table: "ai_messages", fk: "conversation_id", parentKey: "__CONVERSATION_A__", cols: { role: "user", content: "t" } },
  { table: "blending_trial_lots", fk: "trial_id", parentKey: "__TRIAL_A__", cols: { percentage: 50 } },
  { table: "blocks", fk: "vineyard_id", parentKey: "__VINEYARD_A__", cols: { name: "TB" } },
  { table: "fermentation_logs", fk: "vessel_id", parentKey: "__VESSEL_A__", cols: { brix: 24 } },
  { table: "lab_samples", fk: "vintage_id", parentKey: "__VINTAGE_A__", cols: { sampled_at: "2099-01-01T12:00:00Z" } },
  { table: "club_shipment_members", fk: "shipment_id", parentKey: "__SHIPMENT_A__", cols: { member_id: "__CLUB_MEMBER_A__" } },
  { table: "sync_logs", fk: "connection_id", parentKey: "__SHEET_CONN_A__", cols: { synced_at: "2099-01-01T00:00:00Z", status: "success" } },
  { table: "webhook_delivery_logs", fk: "subscription_id", parentKey: "__WEBHOOK_SUB_A__", cols: { triggered_at: "2099-01-01T00:00:00Z", response_code: 200, success: true } },
  { table: "import_errors", fk: "job_id", parentKey: "__IMPORT_JOB_A__", cols: { row_number: 1, source_data: {}, error_message: "t" } },
  { table: "grading_scale_metrics", fk: "grading_scale_id", parentKey: "__GRADING_SCALE_A__", cols: { metric_key: "brix", metric_name: "Brix", direction: "higher_better", org_id: "__ORG_A__" } },
];

async function seedOrgData(orgId: string, prefix: string) {
  const v = uuid(); ids[`__VINTAGE_${prefix}__`] = v;
  await svc.from("vintages").insert({ id: v, org_id: orgId, name: `${prefix}V`, variety: "M", vintage_year: 2098 });

  const vy = uuid(); ids[`__VINEYARD_${prefix}__`] = vy;
  await svc.from("vineyards").insert({ id: vy, org_id: orgId, name: `${prefix}Vy` });

  const bl = uuid(); ids[`__BLOCK_${prefix}__`] = bl;
  await svc.from("blocks").insert({ id: bl, vineyard_id: vy, name: `${prefix}Bl` });

  const gr = uuid(); ids[`__GROWER_${prefix}__`] = gr;
  await svc.from("growers").insert({ id: gr, org_id: orgId, name: `${prefix}Gr` });

  const ct = uuid(); ids[`__CONTRACT_${prefix}__`] = ct;
  await svc.from("grower_contracts").insert({ id: ct, org_id: orgId, grower_id: gr, base_price_per_unit: 500, vintage_year: 2098 });

  const ar = uuid(); ids[`__ALERT_RULE_${prefix}__`] = ar;
  await svc.from("alert_rules").insert({ id: ar, org_id: orgId, parameter: "brix", operator: "gte", threshold: 24, channel: "email" });

  const vs = uuid(); ids[`__VESSEL_${prefix}__`] = vs;
  await svc.from("fermentation_vessels").insert({ id: vs, org_id: orgId, name: `${prefix}Vs` });

  const tr = uuid(); ids[`__TRIAL_${prefix}__`] = tr;
  await svc.from("blending_trials").insert({ id: tr, org_id: orgId, name: `${prefix}Tr` });

  const cn = uuid(); ids[`__CONVERSATION_${prefix}__`] = cn;
  await svc.from("ai_conversations").insert({ id: cn, org_id: orgId, user_id: ids[`__USER_${prefix}__`] });

  const cu = uuid(); ids[`__CUSTOMER_${prefix}__`] = cu;
  await svc.from("customers").insert({ id: cu, org_id: orgId, email: `c-${prefix.toLowerCase()}@t.com` });

  const cl = uuid(); ids[`__CLUB_${prefix}__`] = cl;
  await svc.from("wine_clubs").insert({ id: cl, org_id: orgId, name: `${prefix}Cl` });

  const cm = uuid(); ids[`__CLUB_MEMBER_${prefix}__`] = cm;
  await svc.from("club_members").insert({ id: cm, org_id: orgId, club_id: cl, customer_id: cu });

  const sh = uuid(); ids[`__SHIPMENT_${prefix}__`] = sh;
  await svc.from("club_shipments").insert({ id: sh, org_id: orgId, club_id: cl, shipment_date: "2099-01-01" });

  const co = uuid(); ids[`__CLIENT_ORG_${prefix}__`] = co;
  await svc.from("client_orgs").insert({ id: co, parent_org_id: orgId, name: `${prefix}CO` });

  const fa = uuid(); ids[`__FACILITY_${prefix}__`] = fa;
  await svc.from("facilities").insert({ id: fa, parent_org_id: orgId, name: `${prefix}Fa` });

  const sk = uuid(); ids[`__SKU_${prefix}__`] = sk;
  await svc.from("inventory_skus").insert({ id: sk, org_id: orgId, sku_code: `${prefix}-S`, wine_name: `${prefix}W` });

  const cc = uuid(); ids[`__COST_CAT_${prefix}__`] = cc;
  await svc.from("cost_categories").insert({ id: cc, org_id: orgId, name: `${prefix}CC` });

  const sc = uuid(); ids[`__SHEET_CONN_${prefix}__`] = sc;
  await svc.from("google_sheet_connections").insert({ id: sc, org_id: orgId, google_sheet_id: "t", module: "lab_samples", sheet_name: "T", tab_name: "S1" });

  const ws = uuid(); ids[`__WEBHOOK_SUB_${prefix}__`] = ws;
  await svc.from("webhook_subscriptions").insert({ id: ws, org_id: orgId, url: "https://t.com", events: ["test"] });

  const wt = uuid(); ids[`__WEIGH_TAG_${prefix}__`] = wt;
  await svc.from("weigh_tags").insert({ id: wt, org_id: orgId, contract_id: ct, delivery_date: "2099-01-01" });

  const ij = uuid(); ids[`__IMPORT_JOB_${prefix}__`] = ij;
  await svc.from("import_jobs").insert({ id: ij, org_id: orgId, file_name: "t.csv", module: "lab_samples", status: "pending" });

  const gs = uuid(); ids[`__GRADING_SCALE_${prefix}__`] = gs;
  await svc.from("grading_scales").insert({ id: gs, org_id: orgId, name: `${prefix}GS`, contract_id: ct });

  const gm = uuid(); ids[`__GRADING_METRIC_${prefix}__`] = gm;
  await svc.from("grading_scale_metrics").insert({ id: gm, org_id: orgId, grading_scale_id: gs, metric_key: "brix", metric_name: "Brix", direction: "higher_better" });
}

Deno.serve(async () => {
  const results: Result[] = [];
  const seeded: { table: string; id: string }[] = [];

  try {
    // Create orgs
    const orgA = uuid(); const orgB = uuid();
    ids["__ORG_A__"] = orgA; ids["__ORG_B__"] = orgB;
    await svc.from("organizations").insert({ id: orgA, name: "RLS Org A", tier: "mid_size" });
    await svc.from("organizations").insert({ id: orgB, name: "RLS Org B", tier: "mid_size" });

    // Create users
    const pwA = "Pa$$" + crypto.randomUUID().slice(0,8);
    const pwB = "Pa$$" + crypto.randomUUID().slice(0,8);
    const emailA = `rls-a-${Date.now()}@solera-test.local`;
    const emailB = `rls-b-${Date.now()}@solera-test.local`;
    const { data: dA } = await svc.auth.admin.createUser({ email: emailA, password: pwA, email_confirm: true });
    const { data: dB } = await svc.auth.admin.createUser({ email: emailB, password: pwB, email_confirm: true });
    const userAId = dA!.user.id; const userBId = dB!.user.id;
    ids["__USER_A__"] = userAId; ids["__USER_B__"] = userBId;

    await svc.from("profiles").upsert({ id: userAId, email: emailA, org_id: orgA });
    await svc.from("profiles").upsert({ id: userBId, email: emailB, org_id: orgB });
    await svc.from("user_roles").insert({ user_id: userAId, role: "owner" });
    await svc.from("user_roles").insert({ user_id: userBId, role: "owner" });

    await seedOrgData(orgA, "A");

    // Sign in as attacker (user B)
    const attacker = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInErr } = await attacker.auth.signInWithPassword({ email: emailB, password: pwB });
    if (signInErr) throw new Error(`Sign in failed: ${signInErr.message}`);

    // Test direct tables
    for (const spec of DIRECT_TABLES) {
      const rowId = uuid();
      const cols = replacePlaceholders(spec.cols || {});
      const { error: seedErr } = await svc.from(spec.table).insert({ id: rowId, org_id: orgA, ...cols });
      if (seedErr) {
        results.push({ table: spec.table, readBlocked: "N/A", writeBlocked: "N/A", updateBlocked: "N/A", deleteBlocked: "N/A", notes: `SEED: ${seedErr.message}`, pass: false });
        continue;
      }
      seeded.push({ table: spec.table, id: rowId });

      const r: Result = { table: spec.table, readBlocked: "N/A", writeBlocked: "N/A", updateBlocked: "N/A", deleteBlocked: "N/A", notes: "", pass: true };

      // SELECT
      const { data: sd } = await attacker.from(spec.table).select("id").eq("id", rowId);
      r.readBlocked = !sd || sd.length === 0;
      if (!r.readBlocked) { r.pass = false; r.notes += `READ LEAKED. `; }

      // INSERT
      const { data: id2, error: ie } = await attacker.from(spec.table).insert({ org_id: orgA, ...cols }).select("id");
      if (ie) { r.writeBlocked = true; }
      else { r.writeBlocked = !id2 || id2.length === 0; if (!r.writeBlocked) { r.pass = false; r.notes += `INSERT OK. `; await svc.from(spec.table).delete().eq("id", id2![0].id); } }

      // UPDATE
      const { data: ud } = await attacker.from(spec.table).update({ updated_at: new Date().toISOString() }).eq("id", rowId).select("id");
      r.updateBlocked = !ud || ud.length === 0;
      if (!r.updateBlocked) { r.pass = false; r.notes += `UPDATE OK. `; }

      // DELETE
      const { data: dd } = await attacker.from(spec.table).delete().eq("id", rowId).select("id");
      r.deleteBlocked = !dd || dd.length === 0;
      if (!r.deleteBlocked) { r.pass = false; r.notes += `DELETE OK. `; }

      results.push(r);
    }

    // Test indirect tables
    for (const spec of INDIRECT_TABLES) {
      const rowId = uuid();
      const parentId = ids[spec.parentKey] ?? spec.parentKey;
      const cols = replacePlaceholders(spec.cols || {});
      const { error: seedErr } = await svc.from(spec.table).insert({ id: rowId, [spec.fk]: parentId, ...cols });
      if (seedErr) {
        results.push({ table: `${spec.table}(i)`, readBlocked: "N/A", writeBlocked: "N/A", updateBlocked: "N/A", deleteBlocked: "N/A", notes: `SEED: ${seedErr.message}`, pass: false });
        continue;
      }
      seeded.push({ table: spec.table, id: rowId });

      const r: Result = { table: `${spec.table}(i)`, readBlocked: "N/A", writeBlocked: "N/A", updateBlocked: "N/A", deleteBlocked: "N/A", notes: "", pass: true };

      const { data: sd } = await attacker.from(spec.table).select("id").eq("id", rowId);
      r.readBlocked = !sd || sd.length === 0;
      if (!r.readBlocked) { r.pass = false; r.notes += `READ LEAKED. `; }

      const { data: id2, error: ie } = await attacker.from(spec.table).insert({ [spec.fk]: parentId, ...cols }).select("id");
      if (ie) { r.writeBlocked = true; }
      else { r.writeBlocked = !id2 || id2.length === 0; if (!r.writeBlocked) { r.pass = false; r.notes += `INSERT OK. `; await svc.from(spec.table).delete().eq("id", id2![0].id); } }

      const { data: dd } = await attacker.from(spec.table).delete().eq("id", rowId).select("id");
      r.deleteBlocked = !dd || dd.length === 0;
      if (!r.deleteBlocked) { r.pass = false; r.notes += `DELETE OK. `; }

      results.push(r);
    }

    // Cleanup
    for (const { table, id } of seeded.reverse()) {
      await svc.from(table).delete().eq("id", id);
    }
    const cleanTables = [
      "grading_scale_tiers","grading_scale_metrics","grading_scales",
      "import_errors","import_jobs","import_mappings",
      "webhook_delivery_logs","webhook_subscriptions",
      "sync_logs","google_sheet_connections",
      "weigh_tag_metrics","weigh_tags",
      "cost_entries","cost_categories","lot_cost_summaries",
      "club_shipment_members","club_shipments","club_members","wine_clubs",
      "facility_transfers","facility_users","facilities",
      "inventory_adjustments","inventory_skus",
      "contract_block_assignments","grower_contacts","grower_contracts","growers",
      "harvest_alerts_sent","harvest_predictions","harvest_progress",
      "pick_windows","weather_readings","vineyard_weather_config",
      "blocks","vineyards",
      "anomaly_flags","ttb_additions","lab_samples","fermentation_logs",
      "barrel_groups","barrels",
      "blending_trial_lots","blending_trials","fermentation_vessels",
      "ai_messages","ai_conversations",
      "client_messages","client_invite_tokens","client_users","client_orgs",
      "alert_rules","analog_vintages","api_keys",
      "audit_logs","backup_jobs","backup_schedules",
      "commerce7_config","customers",
      "notifications","orders",
      "saved_reports",
      "tasks","ttb_bond_info","ttb_reports","ttb_wine_premise_operations",
      "weekly_summaries","winedirect_config","vintages",
    ];
    for (const t of cleanTables) {
      await svc.from(t).delete().eq("org_id", orgA);
      await svc.from(t).delete().eq("org_id", orgB);
    }
    await svc.from("user_roles").delete().eq("user_id", userAId);
    await svc.from("user_roles").delete().eq("user_id", userBId);
    await svc.from("profiles").delete().eq("id", userAId);
    await svc.from("profiles").delete().eq("id", userBId);
    await svc.auth.admin.deleteUser(userAId);
    await svc.auth.admin.deleteUser(userBId);
    await svc.from("organizations").delete().eq("id", orgA);
    await svc.from("organizations").delete().eq("id", orgB);

  } catch (err) {
    results.push({ table: "FATAL", readBlocked: "N/A", writeBlocked: "N/A", updateBlocked: "N/A", deleteBlocked: "N/A", notes: String(err), pass: false });
  }

  // Build report
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const pad = (s: string, n: number) => s.padEnd(n);
  const hdr = `${pad("Table",35)} | ${pad("Read",9)} | ${pad("Write",9)} | ${pad("Update",9)} | ${pad("Delete",9)} | Result`;
  const sep = "-".repeat(hdr.length);
  const lines = [
    "=== Solera RLS Cross-Org Isolation Audit ===",
    `Date: ${new Date().toISOString()}`, "", hdr, sep
  ];
  for (const r of results) {
    const f = (v: boolean|string) => v === "N/A" ? "N/A" : v ? "BLOCKED" : "LEAKED";
    lines.push(`${pad(r.table,35)} | ${pad(f(r.readBlocked),9)} | ${pad(f(r.writeBlocked),9)} | ${pad(f(r.updateBlocked),9)} | ${pad(f(r.deleteBlocked),9)} | ${r.pass?"PASS":"FAIL"}`);
  }
  lines.push(sep, `\nSUMMARY: ${passed}/${results.length} PASS, ${failed} FAIL`);
  const failures = results.filter(r => !r.pass);
  if (failures.length) {
    lines.push("\nFAILURES:");
    for (const f of failures) lines.push(`  - ${f.table}: ${f.notes}`);
  }
  const report = lines.join("\n");

  return new Response(report, { headers: { "Content-Type": "text/plain" } });
});
