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

function rp(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = (typeof v === "string" && v.startsWith("__") && v.endsWith("__")) ? (ids[v] ?? v) : v;
  }
  return out;
}

// Direct org_id tables with correct column names
const DIRECT: { t: string; c?: Record<string, unknown> }[] = [
  { t: "alert_rules", c: { parameter: "brix", operator: "gte", threshold: 24, channel: "email" } },
  { t: "analog_vintages", c: { region: "T", year: 2099 } },
  { t: "anomaly_flags", c: { parameter: "brix", value: 30, vintage_id: "__VIN_A__" } },
  { t: "api_keys", c: { label: "t", key_prefix: "sk", key_hash: "h" } },
  { t: "audit_logs", c: { action: "rls" } },
  { t: "backup_jobs", c: { triggered_by: "manual" } },
  { t: "barrel_groups", c: { name: "TG" } },
  { t: "barrels" },
  { t: "blending_trials", c: { name: "TT" } },
  { t: "client_messages", c: { message: "t", sender_type: "winery", client_org_id: "__CORG_A__" } },
  { t: "club_members", c: { club_id: "__CLUB_A__", customer_id: "__CUST_A__" } },
  { t: "club_shipments", c: { club_id: "__CLUB_A__", shipment_date: "2099-01-01" } },
  { t: "commerce7_config" },
  { t: "contract_block_assignments", c: { contract_id: "__CT_A__" } },
  { t: "cost_categories", c: { name: "RCat" } },
  { t: "cost_entries", c: { category_id: "__CCAT_A__", method: "ad_hoc", description: "t", total_amount: 1, vintage_id: "__VIN_A__" } },
  { t: "customers", c: { email: "rls@t.com" } },
  { t: "facility_transfers", c: { from_facility_id: "__FAC_A__", to_facility_id: "__FAC_A__", sku_id: "__SKU_A__" } },
  { t: "fermentation_vessels", c: { name: "TV" } },
  { t: "google_sheet_connections", c: { google_sheet_id: "t", module: "vintage_lab", sheet_name: "T", tab_name: "S1" } },
  { t: "grower_contacts", c: { grower_id: "__GR_A__", name: "TC" } },
  { t: "grower_contracts", c: { grower_id: "__GR_A__", base_price_per_unit: 1, vintage_year: 2099 } },
  { t: "growers", c: { name: "TG" } },
  { t: "harvest_alerts_sent", c: { block_id: "__BL_A__", vintage_id: "__VIN_A__", week_start: "2099-01-06" } },
  { t: "harvest_predictions", c: { block_id: "__BL_A__" } },
  { t: "import_jobs", c: { source_type: "csv", status: "pending" } },
  { t: "import_mappings", c: { source_type: "csv", source_column: "brix" } },
  { t: "integration_sync_logs", c: { integration: "t", sync_type: "pull", records_synced: 0, errors: 0, status: "success" } },
  { t: "inventory_adjustments", c: { sku_id: "__SKU_A__", cases_delta: 1, bottles_delta: 0, reason: "production_addition" } },
  { t: "inventory_skus", c: { label: "TW" } },
  { t: "lot_cost_summaries", c: { vintage_id: "__VIN_A2__" } },
  { t: "material_unit_costs", c: { name: "TM", unit: "kg", cost_per_unit: 1 } },
  { t: "notifications", c: { user_id: "__UA__", message: "t", type: "alert", channel: "push" } },
  { t: "orders", c: { sku_id: "__SKU_A__", customer_email: "t@t.com", customer_name: "T", quantity_cases: 1, quantity_bottles: 0, unit_price: 10, subtotal: 10, shipping_cost: 0, total: 10 } },
  { t: "pick_windows" },
  { t: "saved_reports", c: { name: "TR", config_json: {} } },
  { t: "tasks", c: { title: "TT" } },
  { t: "ttb_additions", c: { vintage_id: "__VIN_A__", addition_type: "fining_agent", amount: 1, unit: "g" } },
  { t: "ttb_reports", c: { report_period_start: "2099-01-01", report_period_end: "2099-01-31" } },
  { t: "vineyards", c: { name: "TV" } },
  { t: "vintages", c: { year: 2099 } },
  { t: "weather_readings", c: { vineyard_id: "__VY_A__", recorded_at: "2099-01-01" } },
  { t: "webhook_subscriptions", c: { event_type: "vintage.created", endpoint_url: "https://t.com/h", secret: "rls_test_secret_value" } },
  { t: "weekly_summaries", c: { week_starting: "2099-01-06", content: "test" } },
  { t: "weigh_tags", c: { contract_id: "__CT_A__", grower_id: "__GR_A__", delivery_date: "2099-01-01" } },
  { t: "wine_clubs", c: { name: "TC" } },
];

// Indirect tables (no org_id, scoped via parent FK)
const INDIRECT: { t: string; fk: string; pk: string; c?: Record<string, unknown> }[] = [
  { t: "ai_messages", fk: "conversation_id", pk: "__CONV_A__", c: { role: "user", content: "t" } },
  { t: "blending_trial_lots", fk: "trial_id", pk: "__TR_A__", c: { percentage: 50 } },
  { t: "blocks", fk: "vineyard_id", pk: "__VY_A__", c: { name: "TB" } },
  { t: "fermentation_logs", fk: "vessel_id", pk: "__VS_A__", c: { brix: 24 } },
  { t: "lab_samples", fk: "vintage_id", pk: "__VIN_A__", c: { sampled_at: "2099-01-01T12:00:00Z" } },
  { t: "club_shipment_members", fk: "shipment_id", pk: "__SH_A__", c: { member_id: "__CM_A__" } },
  { t: "import_errors", fk: "job_id", pk: "__IJ_A__", c: { row_number: 1 } },
  { t: "grading_scale_metrics", fk: "grading_scale_id", pk: "__GS_A__", c: { metric_key: "ph", metric_name: "pH", direction: "lower_is_better", org_id: "__OA__" } },
];

async function seed(orgId: string, p: string) {
  const v = uuid(); ids[`__VIN_${p}__`] = v;
  await svc.from("vintages").insert({ id: v, org_id: orgId, year: 2098 });
  const v2 = uuid(); ids[`__VIN_${p}2__`] = v2;
  await svc.from("vintages").insert({ id: v2, org_id: orgId, year: 2097 });

  const vy = uuid(); ids[`__VY_${p}__`] = vy;
  await svc.from("vineyards").insert({ id: vy, org_id: orgId, name: `${p}Vy` });

  const bl = uuid(); ids[`__BL_${p}__`] = bl;
  await svc.from("blocks").insert({ id: bl, vineyard_id: vy, name: `${p}Bl` });

  const gr = uuid(); ids[`__GR_${p}__`] = gr;
  await svc.from("growers").insert({ id: gr, org_id: orgId, name: `${p}Gr` });

  const ct = uuid(); ids[`__CT_${p}__`] = ct;
  await svc.from("grower_contracts").insert({ id: ct, org_id: orgId, grower_id: gr, base_price_per_unit: 500, vintage_year: 2098 });

  const vs = uuid(); ids[`__VS_${p}__`] = vs;
  await svc.from("fermentation_vessels").insert({ id: vs, org_id: orgId, name: `${p}Vs` });

  const tr = uuid(); ids[`__TR_${p}__`] = tr;
  await svc.from("blending_trials").insert({ id: tr, org_id: orgId, name: `${p}Tr` });

  const cn = uuid(); ids[`__CONV_${p}__`] = cn;
  await svc.from("ai_conversations").insert({ id: cn, org_id: orgId, user_id: ids[`__U${p}__`] });

  const cu = uuid(); ids[`__CUST_${p}__`] = cu;
  await svc.from("customers").insert({ id: cu, org_id: orgId, email: `c-${p.toLowerCase()}@t.com` });

  const cl = uuid(); ids[`__CLUB_${p}__`] = cl;
  await svc.from("wine_clubs").insert({ id: cl, org_id: orgId, name: `${p}Cl` });

  const cm = uuid(); ids[`__CM_${p}__`] = cm;
  await svc.from("club_members").insert({ id: cm, org_id: orgId, club_id: cl, customer_id: cu });

  const sh = uuid(); ids[`__SH_${p}__`] = sh;
  await svc.from("club_shipments").insert({ id: sh, org_id: orgId, club_id: cl, shipment_date: "2099-01-01" });

  const co = uuid(); ids[`__CORG_${p}__`] = co;
  await svc.from("client_orgs").insert({ id: co, parent_org_id: orgId, name: `${p}CO` });

  const fa = uuid(); ids[`__FAC_${p}__`] = fa;
  await svc.from("facilities").insert({ id: fa, parent_org_id: orgId, name: `${p}Fa` });

  const sk = uuid(); ids[`__SKU_${p}__`] = sk;
  await svc.from("inventory_skus").insert({ id: sk, org_id: orgId, label: `${p}W` });

  const cc = uuid(); ids[`__CCAT_${p}__`] = cc;
  await svc.from("cost_categories").insert({ id: cc, org_id: orgId, name: `${p}CC` });

  const ij = uuid(); ids[`__IJ_${p}__`] = ij;
  await svc.from("import_jobs").insert({ id: ij, org_id: orgId, source_type: "csv", status: "pending" });

  const gs = uuid(); ids[`__GS_${p}__`] = gs;
  await svc.from("grading_scales").insert({ id: gs, org_id: orgId, name: `${p}GS`, contract_id: ct });

  const gm = uuid(); ids[`__GM_${p}__`] = gm;
  await svc.from("grading_scale_metrics").insert({ id: gm, org_id: orgId, grading_scale_id: gs, metric_key: "brix", metric_name: "Brix", direction: "higher_is_better" });
}

Deno.serve(async () => {
  const results: Result[] = [];
  const seeded: { t: string; id: string }[] = [];
  let userAId = "", userBId = "", orgA = "", orgB = "";

  try {
    orgA = uuid(); orgB = uuid();
    ids["__OA__"] = orgA; ids["__OB__"] = orgB;
    await svc.from("organizations").insert({ id: orgA, name: "RLS A", tier: "mid_size" });
    await svc.from("organizations").insert({ id: orgB, name: "RLS B", tier: "mid_size" });

    const pwA = "Pa$$" + crypto.randomUUID().slice(0,8);
    const pwB = "Pa$$" + crypto.randomUUID().slice(0,8);
    const eA = `rls-a-${Date.now()}@solera-test.local`;
    const eB = `rls-b-${Date.now()}@solera-test.local`;
    const { data: dA } = await svc.auth.admin.createUser({ email: eA, password: pwA, email_confirm: true });
    const { data: dB } = await svc.auth.admin.createUser({ email: eB, password: pwB, email_confirm: true });
    userAId = dA!.user.id; userBId = dB!.user.id;
    ids["__UA__"] = userAId; ids["__UB__"] = userBId;

    await svc.from("profiles").upsert({ id: userAId, email: eA, org_id: orgA });
    await svc.from("profiles").upsert({ id: userBId, email: eB, org_id: orgB });
    await svc.from("user_roles").insert({ user_id: userAId, role: "owner" });
    await svc.from("user_roles").insert({ user_id: userBId, role: "owner" });

    await seed(orgA, "A");

    const atk = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: siErr } = await atk.auth.signInWithPassword({ email: eB, password: pwB });
    if (siErr) throw new Error(`Sign in: ${siErr.message}`);

    // Test direct tables
    for (const spec of DIRECT) {
      // Skip tables with placeholder issues
      if (spec.c && "__skip__" === Object.values(spec.c)[0]) {
        // Check if we need to look up correct columns
      }

      const rowId = uuid();
      const cols = rp(spec.c || {});
      const { error: se } = await svc.from(spec.t).insert({ id: rowId, org_id: orgA, ...cols });
      if (se) {
        results.push({ table: spec.t, readBlocked: "N/A", writeBlocked: "N/A", updateBlocked: "N/A", deleteBlocked: "N/A", notes: `SEED: ${se.message}`, pass: false });
        continue;
      }
      seeded.push({ t: spec.t, id: rowId });

      const r: Result = { table: spec.t, readBlocked: "N/A", writeBlocked: "N/A", updateBlocked: "N/A", deleteBlocked: "N/A", notes: "", pass: true };

      const { data: sd } = await atk.from(spec.t).select("id").eq("id", rowId);
      r.readBlocked = !sd || sd.length === 0;
      if (!r.readBlocked) { r.pass = false; r.notes += `READ LEAKED. `; }

      const { data: id2, error: ie } = await atk.from(spec.t).insert({ org_id: orgA, ...cols }).select("id");
      if (ie) r.writeBlocked = true;
      else { r.writeBlocked = !id2 || id2.length === 0; if (!r.writeBlocked) { r.pass = false; r.notes += `INSERT OK. `; await svc.from(spec.t).delete().eq("id", id2![0].id); } }

      const { data: ud } = await atk.from(spec.t).update({ created_at: new Date().toISOString() }).eq("id", rowId).select("id");
      r.updateBlocked = !ud || ud.length === 0;
      if (!r.updateBlocked) { r.pass = false; r.notes += `UPDATE OK. `; }

      const { data: dd } = await atk.from(spec.t).delete().eq("id", rowId).select("id");
      r.deleteBlocked = !dd || dd.length === 0;
      if (!r.deleteBlocked) { r.pass = false; r.notes += `DELETE OK. `; }

      results.push(r);
    }

    // Test indirect tables
    for (const spec of INDIRECT) {
      const rowId = uuid();
      const pid = ids[spec.pk] ?? spec.pk;
      const cols = rp(spec.c || {});
      const { error: se } = await svc.from(spec.t).insert({ id: rowId, [spec.fk]: pid, ...cols });
      if (se) {
        results.push({ table: `${spec.t}(i)`, readBlocked: "N/A", writeBlocked: "N/A", updateBlocked: "N/A", deleteBlocked: "N/A", notes: `SEED: ${se.message}`, pass: false });
        continue;
      }
      seeded.push({ t: spec.t, id: rowId });

      const r: Result = { table: `${spec.t}(i)`, readBlocked: "N/A", writeBlocked: "N/A", updateBlocked: "N/A", deleteBlocked: "N/A", notes: "", pass: true };

      const { data: sd } = await atk.from(spec.t).select("id").eq("id", rowId);
      r.readBlocked = !sd || sd.length === 0;
      if (!r.readBlocked) { r.pass = false; r.notes += `READ LEAKED. `; }

      const { data: id2, error: ie } = await atk.from(spec.t).insert({ [spec.fk]: pid, ...cols }).select("id");
      if (ie) r.writeBlocked = true;
      else { r.writeBlocked = !id2 || id2.length === 0; if (!r.writeBlocked) { r.pass = false; r.notes += `INSERT OK. `; await svc.from(spec.t).delete().eq("id", id2![0].id); } }

      const { data: dd } = await atk.from(spec.t).delete().eq("id", rowId).select("id");
      r.deleteBlocked = !dd || dd.length === 0;
      if (!r.deleteBlocked) { r.pass = false; r.notes += `DELETE OK. `; }

      results.push(r);
    }

  } catch (err) {
    results.push({ table: "FATAL", readBlocked: "N/A", writeBlocked: "N/A", updateBlocked: "N/A", deleteBlocked: "N/A", notes: String(err), pass: false });
  }

  // Cleanup (always)
  try {
    for (const { t, id } of seeded.reverse()) await svc.from(t).delete().eq("id", id);
    const ct = ["grading_scale_tiers","grading_scale_metrics","grading_scales","import_errors","import_jobs","import_mappings",
      "webhook_delivery_logs","webhook_subscriptions","sync_logs","google_sheet_connections","weigh_tag_metrics","weigh_tags",
      "cost_entries","cost_categories","lot_cost_summaries","club_shipment_members","club_shipments","club_members","wine_clubs",
      "facility_transfers","facility_users","facilities","inventory_adjustments","inventory_skus",
      "contract_block_assignments","grower_contacts","grower_contracts","growers","harvest_alerts_sent","harvest_predictions",
      "harvest_progress","pick_windows","weather_readings","vineyard_weather_config","blocks","vineyards",
      "anomaly_flags","ttb_additions","lab_samples","fermentation_logs","barrel_groups","barrels",
      "blending_trial_lots","blending_trials","fermentation_vessels","ai_messages","ai_conversations",
      "client_messages","client_invite_tokens","client_users","client_orgs","alert_rules","analog_vintages","api_keys",
      "audit_logs","backup_jobs","backup_schedules","commerce7_config","customers","notifications","orders",
      "saved_reports","tasks","ttb_bond_info","ttb_reports","ttb_wine_premise_operations",
      "weekly_summaries","winedirect_config","vintages","integration_sync_logs","material_unit_costs",
      "public_ratings_config","quickbooks_config","shipcompliant_config","shopify_config","sms_config","sso_configs","storefront_config"];
    for (const t of ct) { await svc.from(t).delete().eq("org_id", orgA); await svc.from(t).delete().eq("org_id", orgB); }
    if (userAId) { await svc.from("user_roles").delete().eq("user_id", userAId); await svc.from("profiles").delete().eq("id", userAId); await svc.auth.admin.deleteUser(userAId); }
    if (userBId) { await svc.from("user_roles").delete().eq("user_id", userBId); await svc.from("profiles").delete().eq("id", userBId); await svc.auth.admin.deleteUser(userBId); }
    if (orgA) await svc.from("organizations").delete().eq("id", orgA);
    if (orgB) await svc.from("organizations").delete().eq("id", orgB);
  } catch (_) { /* best effort */ }

  // Report
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const pad = (s: string, n: number) => s.padEnd(n);
  const hdr = `${pad("Table",35)} | ${pad("Read",9)} | ${pad("Write",9)} | ${pad("Update",9)} | ${pad("Delete",9)} | Result`;
  const sep = "-".repeat(hdr.length);
  const lines = ["=== Solera RLS Cross-Org Isolation Audit ===", `Date: ${new Date().toISOString()}`, "", hdr, sep];
  for (const r of results) {
    const f = (v: boolean|string) => v === "N/A" ? "N/A" : v ? "BLOCKED" : "LEAKED";
    lines.push(`${pad(r.table,35)} | ${pad(f(r.readBlocked),9)} | ${pad(f(r.writeBlocked),9)} | ${pad(f(r.updateBlocked),9)} | ${pad(f(r.deleteBlocked),9)} | ${r.pass?"PASS":"FAIL"}`);
  }
  lines.push(sep, `\nSUMMARY: ${passed}/${results.length} PASS, ${failed} FAIL`);
  const failures = results.filter(r => !r.pass);
  if (failures.length) { lines.push("\nFAILURES:"); for (const f of failures) lines.push(`  - ${f.table}: ${f.notes}`); }

  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain" } });
});
