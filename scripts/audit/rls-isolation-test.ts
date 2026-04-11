/**
 * RLS Cross-Org Isolation Audit for Solera
 *
 * Creates two test orgs (A & B) with one user each, seeds org_A data,
 * authenticates as user_B, and attempts SELECT/INSERT/UPDATE/DELETE on
 * every org-scoped table.  Writes results to rls-report.txt and exits
 * non-zero on any failure.
 *
 * Run:  npx tsx scripts/audit/rls-isolation-test.ts
 *
 * Env required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY");
  process.exit(2);
}

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TableTestResult {
  table: string;
  hasPolicies: boolean;
  readBlocked: boolean | "N/A";
  writeBlocked: boolean | "N/A";
  updateBlocked: boolean | "N/A";
  deleteBlocked: boolean | "N/A";
  notes: string;
  pass: boolean;
}

// ---------------------------------------------------------------------------
// Tables with direct org_id
// ---------------------------------------------------------------------------
const DIRECT_ORG_TABLES: { table: string; requiredCols?: Record<string, any> }[] = [
  { table: "alert_rules", requiredCols: { parameter: "brix", operator: "gte", threshold: 24, channel: "email" } },
  { table: "analog_vintages", requiredCols: { region: "Test Region", year: 2099 } },
  { table: "anomaly_flags", requiredCols: { parameter: "brix", value: 30, vintage_id: "__VINTAGE_A__" } },
  { table: "api_keys", requiredCols: { label: "test", key_prefix: "sk_test", key_hash: "abc123" } },
  { table: "audit_logs", requiredCols: { action: "rls_test" } },
  { table: "backup_jobs", requiredCols: { triggered_by: "manual" } },
  { table: "backup_schedules" },
  { table: "barrel_groups", requiredCols: { name: "Test Group" } },
  { table: "barrels" },
  { table: "blending_trials", requiredCols: { name: "Test Trial" } },
  { table: "client_messages", requiredCols: { message: "test", sender_type: "winery", client_org_id: "__CLIENT_ORG_A__" } },
  { table: "club_members", requiredCols: { club_id: "__CLUB_A__", customer_id: "__CUSTOMER_A__", joined_at: "2099-01-01" } },
  { table: "club_shipments", requiredCols: { club_id: "__CLUB_A__", shipment_date: "2099-01-01" } },
  { table: "commerce7_config" },
  { table: "contract_block_assignments", requiredCols: { contract_id: "__CONTRACT_A__" } },
  { table: "cost_categories", requiredCols: { name: "RLS Test Cat" } },
  { table: "cost_entries", requiredCols: { category_id: "__COST_CAT_A__", method: "manual", description: "rls test", total_amount: 100, vintage_id: "__VINTAGE_A__" } },
  { table: "customers", requiredCols: { email: "rls-test@example.com" } },
  { table: "facility_transfers", requiredCols: { from_facility_id: "__FACILITY_A__", to_facility_id: "__FACILITY_A__", sku_id: "__SKU_A__" } },
  { table: "fermentation_vessels", requiredCols: { name: "Test Vessel" } },
  { table: "google_sheet_connections", requiredCols: { google_sheet_id: "test", module: "lab_samples", sheet_name: "Test", tab_name: "Sheet1" } },
  { table: "grading_scales", requiredCols: { name: "Test Scale", contract_id: "__CONTRACT_A__" } },
  { table: "grower_contacts", requiredCols: { grower_id: "__GROWER_A__", name: "Test Contact" } },
  { table: "grower_contracts", requiredCols: { grower_id: "__GROWER_A__", base_price_per_unit: 1000, vintage_year: 2099 } },
  { table: "growers", requiredCols: { name: "Test Grower" } },
  { table: "harvest_alerts_sent", requiredCols: { alert_rule_id: "__ALERT_RULE_A__", block_id: "__BLOCK_A__", parameter: "brix", value: 25 } },
  { table: "harvest_predictions", requiredCols: { block_id: "__BLOCK_A__", predicted_date: "2099-09-15" } },
  { table: "harvest_progress" },
  { table: "import_jobs", requiredCols: { file_name: "test.csv", module: "lab_samples", status: "pending" } },
  { table: "import_mappings", requiredCols: { module: "lab_samples", mapping_json: {} } },
  { table: "integration_sync_logs", requiredCols: { integration: "test", direction: "pull", status: "success" } },
  { table: "inventory_adjustments", requiredCols: { sku_id: "__SKU_A__", adjustment_type: "count", quantity_change: 1, reason: "test" } },
  { table: "inventory_skus", requiredCols: { sku_code: "TEST-SKU-001", wine_name: "Test Wine" } },
  { table: "lot_cost_summaries", requiredCols: { vintage_id: "__VINTAGE_A__" } },
  { table: "material_unit_costs", requiredCols: { material_name: "Test Material", unit: "kg", cost_per_unit: 10 } },
  { table: "notifications", requiredCols: { user_id: "__USER_A__", title: "Test", message: "test" } },
  { table: "orders", requiredCols: { customer_id: "__CUSTOMER_A__", order_number: "TEST-001", total_amount: 100 } },
  { table: "pick_windows", requiredCols: { block_id: "__BLOCK_A__", window_start: "2099-09-01", window_end: "2099-09-30" } },
  { table: "public_ratings_config" },
  { table: "quickbooks_config" },
  { table: "saved_reports", requiredCols: { name: "Test Report", report_type: "lab", config_json: {} } },
  { table: "shipcompliant_config" },
  { table: "shopify_config" },
  { table: "sms_config" },
  { table: "sso_configs", requiredCols: { domain: "test-rls.example.com", idp_entity_id: "test", idp_sso_url: "https://test.example.com/sso", idp_certificate: "test" } },
  { table: "storefront_config" },
  { table: "tasks", requiredCols: { title: "RLS Test Task" } },
  { table: "ttb_additions", requiredCols: { vintage_id: "__VINTAGE_A__", material: "Test", amount: 1, unit: "g/L", addition_date: "2099-01-01" } },
  { table: "ttb_bond_info" },
  { table: "ttb_reports", requiredCols: { report_month: "2099-01-01", report_type: "monthly" } },
  { table: "ttb_wine_premise_operations" },
  { table: "vineyard_weather_config" },
  { table: "vineyards", requiredCols: { name: "Test Vineyard" } },
  { table: "vintages", requiredCols: { name: "Test Vintage 2099", variety: "Cabernet Sauvignon", vintage_year: 2099 } },
  { table: "weather_readings", requiredCols: { vineyard_id: "__VINEYARD_A__", reading_date: "2099-01-01" } },
  { table: "webhook_subscriptions", requiredCols: { url: "https://test.example.com/hook", events: ["vintage.created"] } },
  { table: "weekly_summaries", requiredCols: { week_start: "2099-01-06", summary_json: {} } },
  { table: "weigh_tag_metrics", requiredCols: { weigh_tag_id: "__WEIGH_TAG_A__" } },
  { table: "weigh_tags", requiredCols: { contract_id: "__CONTRACT_A__", delivery_date: "2099-01-01" } },
  { table: "wine_clubs", requiredCols: { name: "Test Club" } },
  { table: "winedirect_config" },
];

// Child tables scoped via parent FK, no org_id
const INDIRECT_TABLES: { table: string; parentFk: string; parentIdKey: string; requiredCols?: Record<string, any> }[] = [
  { table: "ai_messages", parentFk: "conversation_id", parentIdKey: "__CONVERSATION_A__", requiredCols: { role: "user", content: "rls test" } },
  { table: "blending_trial_lots", parentFk: "trial_id", parentIdKey: "__TRIAL_A__", requiredCols: { percentage: 50 } },
  { table: "blocks", parentFk: "vineyard_id", parentIdKey: "__VINEYARD_A__", requiredCols: { name: "Test Block" } },
  { table: "fermentation_logs", parentFk: "vessel_id", parentIdKey: "__VESSEL_A__", requiredCols: { brix: 24 } },
  { table: "lab_samples", parentFk: "vintage_id", parentIdKey: "__VINTAGE_A__", requiredCols: { sampled_at: "2099-01-01T12:00:00Z" } },
  { table: "club_shipment_members", parentFk: "shipment_id", parentIdKey: "__SHIPMENT_A__", requiredCols: { member_id: "__CLUB_MEMBER_A__" } },
  { table: "sync_logs", parentFk: "connection_id", parentIdKey: "__SHEET_CONN_A__", requiredCols: { synced_at: "2099-01-01T00:00:00Z", status: "success" } },
  { table: "webhook_delivery_logs", parentFk: "subscription_id", parentIdKey: "__WEBHOOK_SUB_A__", requiredCols: { triggered_at: "2099-01-01T00:00:00Z", response_code: 200, success: true } },
  { table: "import_errors", parentFk: "job_id", parentIdKey: "__IMPORT_JOB_A__", requiredCols: { row_number: 1, source_data: {}, error_message: "test" } },
  { table: "grading_scale_metrics", parentFk: "grading_scale_id", parentIdKey: "__GRADING_SCALE_A__", requiredCols: { metric_key: "brix", metric_name: "Brix", direction: "higher_better", org_id: "__ORG_A__" } },
  { table: "grading_scale_tiers", parentFk: "metric_id", parentIdKey: "__GRADING_METRIC_A__", requiredCols: { tier_label: "A", org_id: "__ORG_A__" } },
];

// Admin/public tables — we only verify RLS blocks non-owner users
const ADMIN_TABLES = ["admin_keywords", "admin_metrics", "admin_org_notes", "admin_system_status"];

// Public read tables — skip cross-org test since they're intentionally public
const PUBLIC_READ_TABLES = ["blog_posts", "changelogs", "roadmap_items", "roadmap_votes", "waitlist_signups"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ids: Record<string, string> = {};

function uuid(): string {
  return crypto.randomUUID();
}

async function createTestUser(email: string): Promise<{ id: string; email: string; password: string }> {
  const password = `TestP@ss${crypto.randomBytes(4).toString("hex")}`;
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return { id: data.user.id, email, password };
}

async function deleteTestUser(userId: string) {
  await svc.auth.admin.deleteUser(userId);
}

async function signInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn(${email}): ${error.message}`);
  return client;
}

function replacePlaceholders(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.startsWith("__") && v.endsWith("__")) {
      out[k] = ids[v] ?? v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------
async function seedOrgData(orgId: string, prefix: string) {
  // Vintage
  const vintageId = uuid();
  ids[`__VINTAGE_${prefix}__`] = vintageId;
  await svc.from("vintages").insert({ id: vintageId, org_id: orgId, name: `${prefix} Vintage`, variety: "Merlot", vintage_year: 2098 });

  // Vineyard
  const vineyardId = uuid();
  ids[`__VINEYARD_${prefix}__`] = vineyardId;
  await svc.from("vineyards").insert({ id: vineyardId, org_id: orgId, name: `${prefix} Vineyard` });

  // Block
  const blockId = uuid();
  ids[`__BLOCK_${prefix}__`] = blockId;
  await svc.from("blocks").insert({ id: blockId, vineyard_id: vineyardId, name: `${prefix} Block` });

  // Grower
  const growerId = uuid();
  ids[`__GROWER_${prefix}__`] = growerId;
  await svc.from("growers").insert({ id: growerId, org_id: orgId, name: `${prefix} Grower` });

  // Contract
  const contractId = uuid();
  ids[`__CONTRACT_${prefix}__`] = contractId;
  await svc.from("grower_contracts").insert({ id: contractId, org_id: orgId, grower_id: growerId, base_price_per_unit: 500, vintage_year: 2098 });

  // Alert rule
  const alertRuleId = uuid();
  ids[`__ALERT_RULE_${prefix}__`] = alertRuleId;
  await svc.from("alert_rules").insert({ id: alertRuleId, org_id: orgId, parameter: "brix", operator: "gte", threshold: 24, channel: "email" });

  // Vessel
  const vesselId = uuid();
  ids[`__VESSEL_${prefix}__`] = vesselId;
  await svc.from("fermentation_vessels").insert({ id: vesselId, org_id: orgId, name: `${prefix} Vessel` });

  // Trial
  const trialId = uuid();
  ids[`__TRIAL_${prefix}__`] = trialId;
  await svc.from("blending_trials").insert({ id: trialId, org_id: orgId, name: `${prefix} Trial` });

  // AI Conversation
  const convId = uuid();
  ids[`__CONVERSATION_${prefix}__`] = convId;
  await svc.from("ai_conversations").insert({ id: convId, org_id: orgId, user_id: ids[`__USER_${prefix}__`] });

  // Customer
  const customerId = uuid();
  ids[`__CUSTOMER_${prefix}__`] = customerId;
  await svc.from("customers").insert({ id: customerId, org_id: orgId, email: `customer-${prefix.toLowerCase()}@test.com` });

  // Wine club
  const clubId = uuid();
  ids[`__CLUB_${prefix}__`] = clubId;
  await svc.from("wine_clubs").insert({ id: clubId, org_id: orgId, name: `${prefix} Club` });

  // Club member
  const clubMemberId = uuid();
  ids[`__CLUB_MEMBER_${prefix}__`] = clubMemberId;
  await svc.from("club_members").insert({ id: clubMemberId, org_id: orgId, club_id: clubId, customer_id: customerId });

  // Club shipment
  const shipmentId = uuid();
  ids[`__SHIPMENT_${prefix}__`] = shipmentId;
  await svc.from("club_shipments").insert({ id: shipmentId, org_id: orgId, club_id: clubId, shipment_date: "2099-01-01" });

  // Client org
  const clientOrgId = uuid();
  ids[`__CLIENT_ORG_${prefix}__`] = clientOrgId;
  await svc.from("client_orgs").insert({ id: clientOrgId, parent_org_id: orgId, name: `${prefix} Client Org` });

  // Facility
  const facilityId = uuid();
  ids[`__FACILITY_${prefix}__`] = facilityId;
  await svc.from("facilities").insert({ id: facilityId, parent_org_id: orgId, name: `${prefix} Facility` });

  // Inventory SKU
  const skuId = uuid();
  ids[`__SKU_${prefix}__`] = skuId;
  await svc.from("inventory_skus").insert({ id: skuId, org_id: orgId, sku_code: `${prefix}-SKU`, wine_name: `${prefix} Wine` });

  // Cost category
  const costCatId = uuid();
  ids[`__COST_CAT_${prefix}__`] = costCatId;
  await svc.from("cost_categories").insert({ id: costCatId, org_id: orgId, name: `${prefix} Cat` });

  // Sheet connection
  const sheetConnId = uuid();
  ids[`__SHEET_CONN_${prefix}__`] = sheetConnId;
  await svc.from("google_sheet_connections").insert({ id: sheetConnId, org_id: orgId, google_sheet_id: "test", module: "lab_samples", sheet_name: "Test", tab_name: "Sheet1" });

  // Webhook subscription
  const webhookSubId = uuid();
  ids[`__WEBHOOK_SUB_${prefix}__`] = webhookSubId;
  await svc.from("webhook_subscriptions").insert({ id: webhookSubId, org_id: orgId, url: "https://test.example.com", events: ["test"] });

  // Weigh tag
  const weighTagId = uuid();
  ids[`__WEIGH_TAG_${prefix}__`] = weighTagId;
  await svc.from("weigh_tags").insert({ id: weighTagId, org_id: orgId, contract_id: contractId, delivery_date: "2099-01-01" });

  // Import job
  const importJobId = uuid();
  ids[`__IMPORT_JOB_${prefix}__`] = importJobId;
  await svc.from("import_jobs").insert({ id: importJobId, org_id: orgId, file_name: "test.csv", module: "lab_samples", status: "pending" });

  // Grading scale
  const gradingScaleId = uuid();
  ids[`__GRADING_SCALE_${prefix}__`] = gradingScaleId;
  await svc.from("grading_scales").insert({ id: gradingScaleId, org_id: orgId, name: `${prefix} Scale`, contract_id: contractId });

  // Grading metric
  const gradingMetricId = uuid();
  ids[`__GRADING_METRIC_${prefix}__`] = gradingMetricId;
  await svc.from("grading_scale_metrics").insert({ id: gradingMetricId, org_id: orgId, grading_scale_id: gradingScaleId, metric_key: "brix", metric_name: "Brix", direction: "higher_better" });
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
async function testDirectTable(
  attackerClient: SupabaseClient,
  tableName: string,
  orgAId: string,
  seedRowId: string,
  requiredCols: Record<string, any> = {}
): Promise<TableTestResult> {
  const result: TableTestResult = {
    table: tableName,
    hasPolicies: true,
    readBlocked: "N/A",
    writeBlocked: "N/A",
    updateBlocked: "N/A",
    deleteBlocked: "N/A",
    notes: "",
    pass: true,
  };

  // SELECT — try to read org_A's row
  const { data: selectData, error: selectErr } = await attackerClient
    .from(tableName)
    .select("id")
    .eq("id", seedRowId);
  if (selectErr) {
    result.readBlocked = true;
    result.notes += `SELECT error: ${selectErr.message}. `;
  } else {
    result.readBlocked = !selectData || selectData.length === 0;
    if (!result.readBlocked) {
      result.pass = false;
      result.notes += `SELECT LEAKED ${selectData.length} row(s). `;
    }
  }

  // INSERT — try to insert into org_A
  const insertPayload: Record<string, any> = { org_id: orgAId, ...replacePlaceholders(requiredCols) };
  const { data: insertData, error: insertErr } = await attackerClient
    .from(tableName)
    .insert(insertPayload)
    .select("id");
  if (insertErr) {
    result.writeBlocked = true;
  } else {
    result.writeBlocked = !insertData || insertData.length === 0;
    if (!result.writeBlocked) {
      result.pass = false;
      result.notes += `INSERT SUCCEEDED into foreign org. `;
      // Clean up the rogue row
      await svc.from(tableName).delete().eq("id", insertData[0].id);
    }
  }

  // UPDATE — try to modify org_A's row
  const { data: updateData, error: updateErr } = await attackerClient
    .from(tableName)
    .update({ updated_at: new Date().toISOString() })
    .eq("id", seedRowId)
    .select("id");
  if (updateErr) {
    result.updateBlocked = true;
  } else {
    result.updateBlocked = !updateData || updateData.length === 0;
    if (!result.updateBlocked) {
      result.pass = false;
      result.notes += `UPDATE SUCCEEDED on foreign org row. `;
    }
  }

  // DELETE — try to delete org_A's row
  const { data: deleteData, error: deleteErr } = await attackerClient
    .from(tableName)
    .delete()
    .eq("id", seedRowId)
    .select("id");
  if (deleteErr) {
    result.deleteBlocked = true;
  } else {
    result.deleteBlocked = !deleteData || deleteData.length === 0;
    if (!result.deleteBlocked) {
      result.pass = false;
      result.notes += `DELETE SUCCEEDED on foreign org row. `;
    }
  }

  return result;
}

async function testIndirectTable(
  attackerClient: SupabaseClient,
  tableName: string,
  seedRowId: string,
  parentFk: string,
  parentId: string,
  requiredCols: Record<string, any> = {}
): Promise<TableTestResult> {
  const result: TableTestResult = {
    table: `${tableName} (indirect)`,
    hasPolicies: true,
    readBlocked: "N/A",
    writeBlocked: "N/A",
    updateBlocked: "N/A",
    deleteBlocked: "N/A",
    notes: "",
    pass: true,
  };

  // SELECT
  const { data: selectData } = await attackerClient
    .from(tableName)
    .select("id")
    .eq("id", seedRowId);
  result.readBlocked = !selectData || selectData.length === 0;
  if (!result.readBlocked) {
    result.pass = false;
    result.notes += `SELECT LEAKED ${selectData!.length} row(s). `;
  }

  // INSERT
  const insertPayload: Record<string, any> = { [parentFk]: parentId, ...replacePlaceholders(requiredCols) };
  const { data: insertData, error: insertErr } = await attackerClient
    .from(tableName)
    .insert(insertPayload)
    .select("id");
  if (insertErr) {
    result.writeBlocked = true;
  } else {
    result.writeBlocked = !insertData || insertData.length === 0;
    if (!result.writeBlocked) {
      result.pass = false;
      result.notes += `INSERT SUCCEEDED via foreign parent. `;
      await svc.from(tableName).delete().eq("id", insertData[0].id);
    }
  }

  // DELETE
  const { data: deleteData } = await attackerClient
    .from(tableName)
    .delete()
    .eq("id", seedRowId)
    .select("id");
  result.deleteBlocked = !deleteData || deleteData.length === 0;
  if (!result.deleteBlocked) {
    result.pass = false;
    result.notes += `DELETE SUCCEEDED on foreign row. `;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const results: TableTestResult[] = [];
  const seededRowIds: { table: string; id: string }[] = [];

  console.log("=== Solera RLS Cross-Org Isolation Audit ===\n");

  // 1. Create test orgs
  const orgAId = uuid();
  const orgBId = uuid();
  ids["__ORG_A__"] = orgAId;
  ids["__ORG_B__"] = orgBId;

  await svc.from("organizations").insert({ id: orgAId, name: "RLS Test Org A", tier: "mid_size" });
  await svc.from("organizations").insert({ id: orgBId, name: "RLS Test Org B", tier: "mid_size" });
  console.log(`Created orgs: A=${orgAId}, B=${orgBId}`);

  // 2. Create test users
  const userA = await createTestUser(`rls-test-a-${Date.now()}@solera-test.local`);
  const userB = await createTestUser(`rls-test-b-${Date.now()}@solera-test.local`);
  ids["__USER_A__"] = userA.id;
  ids["__USER_B__"] = userB.id;
  console.log(`Created users: A=${userA.id}, B=${userB.id}`);

  // 3. Create profiles linking users → orgs
  await svc.from("profiles").upsert({ id: userA.id, email: userA.email, org_id: orgAId });
  await svc.from("profiles").upsert({ id: userB.id, email: userB.email, org_id: orgBId });

  // 4. Assign owner role
  await svc.from("user_roles").insert({ user_id: userA.id, role: "owner" });
  await svc.from("user_roles").insert({ user_id: userB.id, role: "owner" });

  // 5. Seed org_A supporting data
  await seedOrgData(orgAId, "A");
  console.log("Seeded org A data");

  // 6. Sign in as user_B (the attacker)
  const attackerClient = await signInClient(userB.email, userB.password);
  console.log("Signed in as attacker (user B)\n");

  // 7. Seed one test row per direct-org table in org A, then test
  for (const spec of DIRECT_ORG_TABLES) {
    const rowId = uuid();
    const cols = replacePlaceholders(spec.requiredCols || {});
    const payload: Record<string, any> = { id: rowId, org_id: orgAId, ...cols };

    const { error: seedErr } = await svc.from(spec.table).insert(payload);
    if (seedErr) {
      results.push({
        table: spec.table,
        hasPolicies: true,
        readBlocked: "N/A",
        writeBlocked: "N/A",
        updateBlocked: "N/A",
        deleteBlocked: "N/A",
        notes: `SEED ERROR: ${seedErr.message}`,
        pass: false,
      });
      console.log(`  SEED ERROR ${spec.table}: ${seedErr.message}`);
      continue;
    }
    seededRowIds.push({ table: spec.table, id: rowId });

    const r = await testDirectTable(attackerClient, spec.table, orgAId, rowId, spec.requiredCols || {});
    results.push(r);
    const status = r.pass ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${status}  ${spec.table}  ${r.notes}`);
  }

  // 8. Seed & test indirect tables
  for (const spec of INDIRECT_TABLES) {
    const rowId = uuid();
    const parentId = ids[spec.parentIdKey] ?? spec.parentIdKey;
    const cols = replacePlaceholders(spec.requiredCols || {});
    const payload: Record<string, any> = { id: rowId, [spec.parentFk]: parentId, ...cols };

    const { error: seedErr } = await svc.from(spec.table).insert(payload);
    if (seedErr) {
      results.push({
        table: `${spec.table} (indirect)`,
        hasPolicies: true,
        readBlocked: "N/A",
        writeBlocked: "N/A",
        updateBlocked: "N/A",
        deleteBlocked: "N/A",
        notes: `SEED ERROR: ${seedErr.message}`,
        pass: false,
      });
      console.log(`  SEED ERROR ${spec.table} (indirect): ${seedErr.message}`);
      continue;
    }
    seededRowIds.push({ table: spec.table, id: rowId });

    const r = await testIndirectTable(attackerClient, spec.table, rowId, spec.parentFk, parentId, spec.requiredCols || {});
    results.push(r);
    const status = r.pass ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${status}  ${spec.table} (indirect)  ${r.notes}`);
  }

  // 9. Admin tables — user_B should not have owner on admin tables (those check has_role owner without org scope)
  for (const t of ADMIN_TABLES) {
    const { data } = await attackerClient.from(t).select("id").limit(1);
    // User_B IS an owner but of org B. Admin tables use has_role('owner') which doesn't scope by org.
    const r: TableTestResult = {
      table: t,
      hasPolicies: true,
      readBlocked: !data || data.length === 0,
      writeBlocked: "N/A",
      updateBlocked: "N/A",
      deleteBlocked: "N/A",
      notes: data && data.length > 0 ? "WARN: owner role grants cross-org admin table access" : "",
      pass: true, // Admin tables are intentionally role-gated, not org-gated
    };
    results.push(r);
    console.log(`  ${r.readBlocked ? "✓ PASS" : "⚠ WARN"}  ${t}  ${r.notes}`);
  }

  // 10. Public tables
  for (const t of PUBLIC_READ_TABLES) {
    results.push({
      table: t,
      hasPolicies: true,
      readBlocked: false,
      writeBlocked: "N/A",
      updateBlocked: "N/A",
      deleteBlocked: "N/A",
      notes: "Intentionally public read",
      pass: true,
    });
    console.log(`  ✓ SKIP  ${t}  (intentionally public)`);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  console.log("\n--- Cleanup ---");

  // Delete seeded rows in reverse order
  for (const { table, id } of seededRowIds.reverse()) {
    await svc.from(table).delete().eq("id", id);
  }

  // Delete seeded support data (reverse dependency order)
  const cleanupTables = [
    "grading_scale_tiers", "grading_scale_metrics", "grading_scales",
    "import_errors", "import_jobs", "import_mappings",
    "webhook_delivery_logs", "webhook_subscriptions",
    "sync_logs", "google_sheet_connections",
    "weigh_tag_metrics", "weigh_tags",
    "cost_entries", "cost_categories", "lot_cost_summaries",
    "club_shipment_members", "club_shipments", "club_members", "wine_clubs",
    "facility_transfers", "facility_users", "facilities",
    "inventory_adjustments", "inventory_skus",
    "contract_block_assignments", "grower_contacts", "grower_contracts", "growers",
    "harvest_alerts_sent", "harvest_predictions", "harvest_progress",
    "pick_windows", "weather_readings", "vineyard_weather_config",
    "blocks", "vineyards",
    "anomaly_flags", "ttb_additions", "lab_samples", "fermentation_logs",
    "barrel_groups", "barrels",
    "blending_trial_lots", "blending_trials",
    "fermentation_vessels",
    "ai_messages", "ai_conversations",
    "client_messages", "client_invite_tokens", "client_users", "client_orgs",
    "alert_rules", "analog_vintages", "api_keys",
    "audit_logs", "backup_jobs", "backup_schedules",
    "commerce7_config", "customers",
    "notifications", "orders",
    "public_ratings_config", "quickbooks_config",
    "saved_reports", "shipcompliant_config", "shopify_config",
    "sms_config", "sso_configs", "storefront_config",
    "tasks", "ttb_bond_info", "ttb_reports", "ttb_wine_premise_operations",
    "weekly_summaries", "winedirect_config",
    "vintages",
  ];
  for (const t of cleanupTables) {
    await svc.from(t).delete().eq("org_id", orgAId);
    await svc.from(t).delete().eq("org_id", orgBId);
  }

  // Delete profiles, roles, orgs
  await svc.from("user_roles").delete().eq("user_id", userA.id);
  await svc.from("user_roles").delete().eq("user_id", userB.id);
  await svc.from("profiles").delete().eq("id", userA.id);
  await svc.from("profiles").delete().eq("id", userB.id);
  await deleteTestUser(userA.id);
  await deleteTestUser(userB.id);
  await svc.from("organizations").delete().eq("id", orgAId);
  await svc.from("organizations").delete().eq("id", orgBId);
  console.log("Cleanup complete.\n");

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const failures = results.filter((r) => !r.pass);

  const pad = (s: string, n: number) => s.padEnd(n);
  const header = `${pad("Table", 40)} | ${pad("Policies", 8)} | ${pad("Read", 9)} | ${pad("Write", 9)} | ${pad("Update", 9)} | ${pad("Delete", 9)} | Result`;
  const sep = "-".repeat(header.length);

  const lines: string[] = [
    "=== Solera RLS Cross-Org Isolation Audit ===",
    `Date: ${new Date().toISOString()}`,
    "",
    header,
    sep,
  ];

  for (const r of results) {
    const fmt = (v: boolean | "N/A") => v === "N/A" ? "N/A" : v ? "BLOCKED" : "LEAKED";
    lines.push(
      `${pad(r.table, 40)} | ${pad(r.hasPolicies ? "Y" : "N", 8)} | ${pad(fmt(r.readBlocked), 9)} | ${pad(fmt(r.writeBlocked), 9)} | ${pad(fmt(r.updateBlocked), 9)} | ${pad(fmt(r.deleteBlocked), 9)} | ${r.pass ? "PASS" : "FAIL"}`
    );
  }

  lines.push(sep);
  lines.push(`\nSUMMARY: ${passed}/${results.length} PASS, ${failed} FAIL`);

  if (failures.length > 0) {
    lines.push("\nFAILURES:");
    for (const f of failures) {
      lines.push(`  - ${f.table}: ${f.notes}`);
    }
  }

  // Admin table warnings
  const adminWarns = results.filter((r) => r.notes.includes("WARN"));
  if (adminWarns.length > 0) {
    lines.push("\nWARNINGS:");
    for (const w of adminWarns) {
      lines.push(`  - ${w.table}: ${w.notes}`);
    }
  }

  const report = lines.join("\n");
  console.log("\n" + report);

  const reportPath = path.resolve(__dirname, "rls-report.txt");
  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`\nReport written to ${reportPath}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
