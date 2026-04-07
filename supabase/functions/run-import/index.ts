import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Enum normalization maps ---
function normalizeTaskStatus(v: string): string {
  const s = v.toLowerCase().trim();
  if (["completed", "done", "complete"].includes(s)) return "complete";
  if (["in progress", "active", "in_progress"].includes(s)) return "in_progress";
  if (["scheduled", "pending", "todo", "to do"].includes(s)) return "pending";
  return s; // pass through if already valid
}

function normalizeVintageStatus(v: string): string {
  const s = v.toLowerCase().trim();
  if (["active fermentation", "fermenting", "press & settle", "press and settle"].includes(s)) return "in_progress";
  if (s.startsWith("barrel aging") || s.startsWith("aging")) return "in_cellar";
  if (["waiting fruit", "pre-harvest", "pre harvest"].includes(s)) return "planned";
  if (s === "bottled") return "bottled";
  if (s === "released") return "released";
  if (s === "harvested") return "harvested";
  return s;
}

// --- Entity resolution caches (per-request) ---
type EntityCache = Record<string, string>; // name → id

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

  // Try to extract year from the name
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

    // Update job status
    await supabase.from("import_jobs").update({ status: "importing", started_at: new Date().toISOString() }).eq("id", jobId);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Per-request entity resolution caches
    const vineyardCache: EntityCache = {};
    const vintageCache: EntityCache = {};

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

          // Add org_id for tables that need it
          const tablesWithOrg = ["vintages", "barrels", "fermentation_vessels", "ttb_additions", "inventory_skus", "vineyards", "tasks"];
          if (tablesWithOrg.includes(table)) {
            data.org_id = orgId;
          }

          // --- Enum normalization ---
          if (table === "tasks" && data.status) {
            data.status = normalizeTaskStatus(data.status);
          }
          if (table === "tasks" && data.priority) {
            data.priority = data.priority.toLowerCase().trim();
          }
          if (table === "vintages" && data.status) {
            data.status = normalizeVintageStatus(data.status);
          }

          // --- Entity resolution: blocks need vineyard_id ---
          if (table === "blocks") {
            if (data.vineyard_name && !data.vineyard_id) {
              data.vineyard_id = await resolveVineyard(supabase, orgId, data.vineyard_name, vineyardCache);
              delete data.vineyard_name;
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
            // block_name pseudo-field: resolve block to find its vineyard, not used for vintage_id
            if (data.block_name) {
              delete data.block_name; // informational only, not a real column
            }
            if (!data.vintage_id) {
              throw new Error("lab_samples: vintage_id is required — provide a vintage/lot name or ID");
            }
          }

          // Duplicate detection for vintages
          if (table === "vintages" && data.year) {
            const { data: existing } = await supabase
              .from("vintages")
              .select("id")
              .eq("org_id", orgId)
              .eq("year", parseInt(data.year))
              .maybeSingle();

            if (existing) {
              if (duplicateStrategy === "skip") { skipped++; continue; }
              if (duplicateStrategy === "replace") {
                await supabase.from("vintages").update(data).eq("id", existing.id);
                rowImported = true;
                continue;
              }
              if (duplicateStrategy === "merge") {
                await supabase.from("vintages").update(data).eq("id", existing.id);
                rowImported = true;
                continue;
              }
            }
          }

          // Cast numeric fields
          const numericFields = ["year", "tons_harvested", "brix", "ph", "ta", "va", "so2_free", "so2_total",
            "alcohol", "rs", "acres", "soil_ph", "soil_organic_matter", "size_liters", "capacity_liters",
            "amount", "batch_size", "cases", "bottles", "price", "vintage_year",
            "row_spacing_ft", "vine_spacing_ft", "year_planted", "elevation_ft", "capacity_gallons", "gallons", "cases_projected",
            "gdd_cumulative", "current_fill_gal"];
          for (const f of numericFields) {
            if (data[f] !== undefined) {
              const n = parseFloat(data[f]);
              data[f] = isNaN(n) ? null : n;
            }
          }

          const { error: insertError } = await supabase.from(table).insert(data);
          if (insertError) {
            throw new Error(`${table}: ${insertError.message}`);
          }
          rowImported = true;
        }

        if (rowImported) imported++;
        else skipped++;
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

    // Fetch current totals to accumulate across batches
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
