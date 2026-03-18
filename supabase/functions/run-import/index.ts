import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { jobId, rows, mappings, orgId, duplicateStrategy } = await req.json();

    // Update job status
    await supabase.from("import_jobs").update({ status: "importing", started_at: new Date().toISOString() }).eq("id", jobId);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

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
          const tablesWithOrg = ["vintages", "blocks", "barrels", "fermentation_vessels", "ttb_additions", "inventory_skus"];
          if (tablesWithOrg.includes(table)) {
            data.org_id = orgId;
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
              // merge: update only non-null fields
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
            "amount", "batch_size", "cases", "bottles", "price", "vintage_year"];
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

    await supabase.from("import_jobs").update({
      status: "completed",
      imported_rows: imported,
      skipped_rows: skipped,
      error_rows: errors,
      total_rows: rows.length,
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
