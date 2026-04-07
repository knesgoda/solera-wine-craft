import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Enum normalization ---
function normalizeTaskStatus(v: string): string {
  const s = v.toLowerCase().trim();
  if (["completed", "done", "complete"].includes(s)) return "complete";
  if (["in progress", "active", "in_progress"].includes(s)) return "in_progress";
  if (["scheduled", "pending", "todo", "to do"].includes(s)) return "pending";
  return s;
}

function normalizeVintageStatus(v: string): string {
  // Normalize dashes: em dash, en dash → regular hyphen
  let s = v.replace(/[—–]/g, "-").toLowerCase().trim();
  // Strip "active -" or "active-" prefix
  s = s.replace(/^active\s*-\s*/, "");

  if (["fermenting", "active fermentation", "press & settle", "press and settle", "settling"].includes(s)) return "in_progress";
  if (s.startsWith("barrel aging") || s === "aging" || s.startsWith("aging") || s.includes("concrete egg")) return "in_cellar";
  if (["waiting fruit", "pre-harvest", "pre harvest", "awaiting fruit"].includes(s)) return "planned";
  if (s === "bottled") return "bottled";
  if (s === "released") return "released";
  if (s === "harvested") return "harvested";
  if (s === "in_progress" || s === "in_cellar" || s === "planned") return s;
  return s;
}

// --- Entity resolution caches (per-request) ---
type EntityCache = Record<string, string>;

async function resolveVineyard(
  supabase: any, orgId: string, name: string, cache: EntityCache
): Promise<string> {
  const key = name.toLowerCase().trim();
  if (cache[key]) return cache[key];

  const { data: existing } = await supabase
    .from("vineyards")
    .select("id")
    .eq("org_id", orgId)
    .ilike("name", key)
    .maybeSingle();

  if (existing) {
    cache[key] = existing.id;
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("vineyards")
    .insert({ org_id: orgId, name: name.trim() })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create vineyard "${name}": ${error.message}`);
  cache[key] = created.id;
  return created.id;
}

async function resolveVintage(
  supabase: any, orgId: string, name: string, cache: EntityCache
): Promise<string> {
  const key = name.toLowerCase().trim();
  if (cache[key]) return cache[key];

  const { data: existing } = await supabase
    .from("vintages")
    .select("id")
    .eq("org_id", orgId)
    .ilike("name", key)
    .maybeSingle();

  if (existing) {
    cache[key] = existing.id;
    return existing.id;
  }

  const yearMatch = name.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : null;

  const { data: created, error } = await supabase
    .from("vintages")
    .insert({ org_id: orgId, name: name.trim(), ...(year ? { year } : {}) })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create vintage "${name}": ${error.message}`);
  cache[key] = created.id;
  return created.id;
}

async function resolveGrower(
  supabase: any, orgId: string, name: string, cache: EntityCache
): Promise<string> {
  const key = name.toLowerCase().trim();
  if (cache[key]) return cache[key];

  const { data: existing } = await supabase
    .from("growers")
    .select("id")
    .eq("org_id", orgId)
    .ilike("name", key)
    .maybeSingle();

  if (existing) {
    cache[key] = existing.id;
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("growers")
    .insert({ org_id: orgId, name: name.trim() })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create grower "${name}": ${error.message}`);
  cache[key] = created.id;
  return created.id;
}

async function resolveBlock(
  supabase: any, orgId: string, name: string, vineyardCache: EntityCache, blockCache: EntityCache
): Promise<string | null> {
  const key = name.toLowerCase().trim();
  if (blockCache[key]) return blockCache[key];

  const { data: existing } = await supabase
    .from("blocks")
    .select("id")
    .ilike("name", key)
    .maybeSingle();

  if (existing) {
    blockCache[key] = existing.id;
    return existing.id;
  }
  return null;
}

// Tables that need org_id
const TABLES_WITH_ORG = [
  "vintages", "barrels", "fermentation_vessels", "ttb_additions",
  "inventory_skus", "vineyards", "tasks", "grower_contracts",
  "harvest_progress", "harvest_predictions", "pick_windows",
];

// All numeric fields across tables
const NUMERIC_FIELDS = [
  "year", "tons_harvested", "brix", "ph", "ta", "va", "so2_free", "so2_total",
  "alcohol", "rs", "acres", "soil_ph", "soil_organic_matter", "size_liters",
  "capacity_liters", "amount", "batch_size", "cases", "bottles", "price",
  "vintage_year", "row_spacing_ft", "vine_spacing_ft", "year_planted",
  "elevation_ft", "capacity_gallons", "gallons", "cases_projected",
  "gdd_cumulative", "current_fill_gal", "expected_tons", "brix_at_pick",
  "current_brix", "current_ph", "current_ta", "brix_per_day", "target_brix",
  "days_to_target", "gdd_at_prediction", "target_brix_low", "target_brix_high",
  "target_ph_low", "target_ph_high", "days_to_window_open", "days_to_window_close",
  "contracted_tons", "price_per_ton", "contract_value", "tons_delivered",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { jobId, rows, mappings, orgId, duplicateStrategy } = await req.json();

    await supabase.from("import_jobs").update({ status: "importing", started_at: new Date().toISOString() }).eq("id", jobId);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    const vineyardCache: EntityCache = {};
    const vintageCache: EntityCache = {};
    const growerCache: EntityCache = {};
    const blockCache: EntityCache = {};

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Group mappings by target table
        const tableData: Record<string, Record<string, any>> = {};
        for (const mapping of mappings) {
          if (!mapping.target_table || !mapping.target_field) continue;
          if (!tableData[mapping.target_table]) tableData[mapping.target_table] = {};
          const val = row[mapping.source_column];
          if (val !== undefined && val !== null && val !== "") {
            tableData[mapping.target_table][mapping.target_field] = val;
          }
        }

        let rowImported = false;
        for (const [table, data] of Object.entries(tableData)) {
          if (Object.keys(data).length === 0) continue;

          // Add org_id
          if (TABLES_WITH_ORG.includes(table)) {
            data.org_id = orgId;
          }

          // --- Enum normalization ---
          if (table === "tasks" && data.status) data.status = normalizeTaskStatus(data.status);
          if (table === "tasks" && data.priority) data.priority = data.priority.toLowerCase().trim();
          if (table === "vintages" && data.status) data.status = normalizeVintageStatus(data.status);

          // --- Entity resolution: blocks need vineyard_id ---
          if (table === "blocks") {
            // Accept both "vineyard_name" and "vineyard" as alias
            const vineyardName = data.vineyard_name || data.vineyard;
            if (vineyardName && !data.vineyard_id) {
              data.vineyard_id = await resolveVineyard(supabase, orgId, vineyardName, vineyardCache);
              delete data.vineyard_name;
              delete data.vineyard;
            }
            if (!data.vineyard_id) {
              throw new Error("blocks: vineyard_id is required — provide a vineyard name or ID");
            }
          }

          // --- Entity resolution: lab_samples need vintage_id ---
          if (table === "lab_samples") {
            if (data.vintage_name && !data.vintage_id) {
              data.vintage_id = await resolveVintage(supabase, orgId, data.vintage_name, vintageCache);
              delete data.vintage_name;
            }
            if (data.lot_name && !data.vintage_id) {
              data.vintage_id = await resolveVintage(supabase, orgId, data.lot_name, vintageCache);
              delete data.lot_name;
            }
            if (data.block_name) {
              const blockId = await resolveBlock(supabase, orgId, data.block_name, vineyardCache, blockCache);
              if (blockId) data.block_id = blockId;
              delete data.block_name;
            }
            if (!data.vintage_id) {
              throw new Error("lab_samples: vintage_id is required — provide a vintage/lot name or ID");
            }
          }

          // --- Entity resolution: grower_contracts need grower_id ---
          if (table === "grower_contracts") {
            if (data.grower_name && !data.grower_id) {
              data.grower_id = await resolveGrower(supabase, orgId, data.grower_name, growerCache);
              delete data.grower_name;
            }
            // Map price_per_ton → base_price_per_unit
            if (data.price_per_ton !== undefined) {
              data.base_price_per_unit = data.price_per_ton;
              data.pricing_unit = "per_ton";
              delete data.price_per_ton;
            }
            // Map contracted_tons → estimated_tons
            if (data.contracted_tons !== undefined) {
              data.estimated_tons = data.contracted_tons;
              delete data.contracted_tons;
            }
            // Map contract_value → total_contract_value
            if (data.contract_value !== undefined) {
              data.total_contract_value = data.contract_value;
              delete data.contract_value;
            }
            // Map tons_delivered → total_delivered_tons
            if (data.tons_delivered !== undefined) {
              data.total_delivered_tons = data.tons_delivered;
              delete data.tons_delivered;
            }
            // Map delivery_date → delivery_start_date
            if (data.delivery_date !== undefined && !data.delivery_start_date) {
              data.delivery_start_date = data.delivery_date;
              delete data.delivery_date;
            }
            // Normalize contract status
            if (data.status) {
              const s = data.status.toLowerCase().trim();
              if (s === "active") data.status = "active";
              else if (s === "completed" || s === "fulfilled") data.status = "completed";
              else if (s === "expired") data.status = "expired";
              else if (s === "cancelled" || s === "canceled") data.status = "cancelled";
            }
            // Map source_vineyard_name from vineyard_name if present
            if (data.vineyard_name) {
              data.source_vineyard_name = data.vineyard_name;
              delete data.vineyard_name;
            }
            // Remove winery_name (not a real column)
            delete data.winery_name;
          }

          // --- harvest tables: resolve block, remove pseudo-fields ---
          if (["harvest_progress", "harvest_predictions", "pick_windows"].includes(table)) {
            if (data.block_id && typeof data.block_id === "string" && !data.block_id.match(/^[0-9a-f-]{36}$/)) {
              // It's an external block ID like "BLK-001", store as external ref, try to resolve
              const externalId = data.block_id;
              delete data.block_id;
              // Try to find by external_block_id
              const { data: block } = await supabase
                .from("blocks")
                .select("id")
                .eq("external_block_id", externalId)
                .maybeSingle();
              if (block) data.block_id = block.id;
            }
            // Map external IDs
            if (table === "harvest_progress" && data.external_progress_id === undefined && row.progress_id) {
              data.external_progress_id = row.progress_id;
            }
            if (table === "harvest_predictions" && data.external_prediction_id === undefined && row.prediction_id) {
              data.external_prediction_id = row.prediction_id;
            }
            if (table === "pick_windows" && data.external_window_id === undefined && row.window_id) {
              data.external_window_id = row.window_id;
            }
            // Remove winery_name (not a real column)
            delete data.winery_name;
            // last_updated is a date field for harvest_predictions
            if (table === "harvest_predictions" && data.last_updated) {
              // keep as-is, it's a date column
            }
          }

          // --- Duplicate detection for vintages (improved) ---
          if (table === "vintages") {
            // Remove winery_name pseudo-field
            delete data.winery_name;
            
            let existingId: string | null = null;

            // First try: external IDs
            if (data.external_vintage_id) {
              const { data: ext } = await supabase
                .from("vintages").select("id").eq("org_id", orgId)
                .eq("external_vintage_id", data.external_vintage_id).maybeSingle();
              if (ext) existingId = ext.id;
            }
            if (!existingId && data.external_lot_id) {
              const { data: ext } = await supabase
                .from("vintages").select("id").eq("org_id", orgId)
                .eq("external_lot_id", data.external_lot_id).maybeSingle();
              if (ext) existingId = ext.id;
            }
            // Second try: year + name
            if (!existingId && data.year && data.name) {
              const { data: ext } = await supabase
                .from("vintages").select("id").eq("org_id", orgId)
                .eq("year", parseInt(data.year))
                .ilike("name", data.name.toLowerCase().trim()).maybeSingle();
              if (ext) existingId = ext.id;
            }
            // Third try: year only (only if no name)
            if (!existingId && data.year && !data.name) {
              const { data: ext } = await supabase
                .from("vintages").select("id").eq("org_id", orgId)
                .eq("year", parseInt(data.year)).maybeSingle();
              if (ext) existingId = ext.id;
            }

            if (existingId) {
              if (duplicateStrategy === "skip") { skipped++; rowImported = false; continue; }
              if (duplicateStrategy === "replace" || duplicateStrategy === "merge") {
                await supabase.from("vintages").update(data).eq("id", existingId);
                rowImported = true;
                continue;
              }
            }
          }

          // Cast numeric fields
          for (const f of NUMERIC_FIELDS) {
            if (data[f] !== undefined) {
              const n = parseFloat(data[f]);
              data[f] = isNaN(n) ? null : n;
            }
          }

          // Cast boolean fields
          if (data.harvest_complete !== undefined) {
            const v = String(data.harvest_complete).toLowerCase().trim();
            data.harvest_complete = v === "true" || v === "1" || v === "yes";
          }
          if (data.temp_controlled !== undefined) {
            const v = String(data.temp_controlled).toLowerCase().trim();
            data.temp_controlled = v === "true" || v === "1" || v === "yes";
          }

          const { error: insertError } = await supabase.from(table).insert(data);
          if (insertError) {
            throw new Error(`${table}: ${insertError.message}`);
          }
          rowImported = true;
        }

        if (rowImported) imported++;
        else if (!rowImported && errors === 0) skipped++;
      } catch (rowErr: any) {
        errors++;
        await supabase.from("import_errors").insert({
          job_id: jobId,
          row_number: i + 1,
          source_data: row,
          error_message: rowErr.message,
        });
      }
    }

    // Accumulate across batches
    const { data: currentJob } = await supabase.from("import_jobs").select("imported_rows, skipped_rows, error_rows").eq("id", jobId).single();
    const prevImported = currentJob?.imported_rows || 0;
    const prevSkipped = currentJob?.skipped_rows || 0;
    const prevErrors = currentJob?.error_rows || 0;

    await supabase.from("import_jobs").update({
      status: "completed",
      imported_rows: prevImported + imported,
      skipped_rows: prevSkipped + skipped,
      error_rows: prevErrors + errors,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return new Response(JSON.stringify({ imported, skipped, errors, total: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("run-import error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
