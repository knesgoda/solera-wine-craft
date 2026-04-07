import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Deterministic header alias map: source header → table.field
const HEADER_ALIASES: Record<string, string> = {
  // blocks
  vineyard: "blocks.vineyard_name",
  vineyard_name: "blocks.vineyard_name",
  block_name: "blocks.name",
  block_id: "blocks.external_block_id",
  // vintages
  lot_name: "vintages.name",
  lot_id: "vintages.external_lot_id",
  vintage_id: "vintages.external_vintage_id",
  winemaker_notes: "vintages.winemaker_notes",
  // lab_samples
  sample_id: "lab_samples.external_sample_id",
  sampled_at: "lab_samples.sampled_at",
  sampled_by: "lab_samples.sampled_by",
  vintage_name: "lab_samples.vintage_name",
  // vessels
  vessel_id: "fermentation_vessels.external_vessel_id",
  vessel_type: "fermentation_vessels.vessel_type",
  capacity_gallons: "fermentation_vessels.capacity_gallons",
  current_fill_gal: "fermentation_vessels.current_fill_gal",
  temp_controlled: "fermentation_vessels.temp_controlled",
  // tasks
  task_id: "tasks.external_task_id",
  assigned_to: "tasks.assigned_to_name",
  assigned_to_name: "tasks.assigned_to_name",
  // grower contracts
  contract_id: "grower_contracts.external_contract_id",
  grower_name: "grower_contracts.grower_name",
  price_per_ton: "grower_contracts.price_per_ton",
  contract_value: "grower_contracts.contract_value",
  contracted_tons: "grower_contracts.contracted_tons",
  contract_year: "grower_contracts.vintage_year",
  tons_delivered: "grower_contracts.tons_delivered",
  approval_status: "grower_contracts.approval_status",
  payment_status: "grower_contracts.payment_status",
  payment_due_date: "grower_contracts.payment_due_date",
  contract_type: "grower_contracts.contract_type",
  delivery_date: "grower_contracts.delivery_date",
  // harvest progress
  progress_id: "harvest_progress.external_progress_id",
  expected_tons: "harvest_progress.expected_tons",
  harvest_complete: "harvest_progress.harvest_complete",
  brix_at_pick: "harvest_progress.brix_at_pick",
  // harvest predictions
  prediction_id: "harvest_predictions.external_prediction_id",
  current_brix: "harvest_predictions.current_brix",
  current_ph: "harvest_predictions.current_ph",
  current_ta: "harvest_predictions.current_ta",
  brix_per_day: "harvest_predictions.brix_per_day",
  target_brix: "harvest_predictions.target_brix",
  predicted_pick_date: "harvest_predictions.predicted_pick_date",
  days_to_target: "harvest_predictions.days_to_target",
  gdd_at_prediction: "harvest_predictions.gdd_at_prediction",
  confidence: "harvest_predictions.confidence",
  // pick windows
  window_id: "pick_windows.external_window_id",
  target_brix_low: "pick_windows.target_brix_low",
  target_brix_high: "pick_windows.target_brix_high",
  target_ph_low: "pick_windows.target_ph_low",
  target_ph_high: "pick_windows.target_ph_high",
  days_to_window_open: "pick_windows.days_to_window_open",
  days_to_window_close: "pick_windows.days_to_window_close",
  window_open_date: "pick_windows.window_open_date",
  window_close_date: "pick_windows.window_close_date",
  window_status: "pick_windows.window_status",
  urgency: "pick_windows.urgency",
};

// Signature headers that identify a file type definitively
const FILE_TYPE_SIGNATURES: Record<string, string[]> = {
  harvest_progress: ["progress_id", "harvest_complete", "brix_at_pick"],
  harvest_predictions: ["prediction_id", "predicted_pick_date", "days_to_target"],
  pick_windows: ["window_id", "window_open_date", "window_close_date"],
  grower_contracts: ["contract_id", "grower_name", "price_per_ton"],
};

function detectFileType(headers: string[]): string | null {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  for (const [fileType, signatures] of Object.entries(FILE_TYPE_SIGNATURES)) {
    const matches = signatures.filter(s => lowerHeaders.includes(s));
    if (matches.length >= 2) return fileType;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { headers, sampleRows, sourceType } = await req.json();

    // Step 1: Try deterministic mapping first
    const lowerHeaders = headers.map((h: string) => h.toLowerCase().trim());
    const detectedType = detectFileType(lowerHeaders);

    // Build deterministic mappings from aliases
    const deterministicMappings: any[] = [];
    let deterministicCount = 0;

    for (const originalHeader of headers) {
      const lower = originalHeader.toLowerCase().trim();
      const alias = HEADER_ALIASES[lower];
      if (alias) {
        const [table, field] = alias.split(".");
        deterministicMappings.push({
          source_column: originalHeader,
          target_table: table,
          target_field: field,
          confidence: "high",
        });
        deterministicCount++;
      } else {
        deterministicMappings.push({
          source_column: originalHeader,
          target_table: null,
          target_field: null,
          confidence: "unmapped",
        });
      }
    }

    // If we mapped most headers deterministically (>=60%), use that directly
    if (deterministicCount / headers.length >= 0.6) {
      // For remaining unmapped, try to infer from detected file type
      if (detectedType) {
        for (const m of deterministicMappings) {
          if (m.target_table === null) {
            const lower = m.source_column.toLowerCase().trim();
            // Common fields that exist on many tables
            const commonFields: Record<string, string> = {
              variety: "variety", clone: "clone", rootstock: "rootstock",
              notes: "notes", vintage_year: "vintage_year", acres: "acres",
              pick_date: "pick_date", winery_name: "winery_name",
              tons_harvested: "tons_harvested", last_updated: "last_updated",
            };
            if (commonFields[lower]) {
              // Check if the detected table actually has this field
              m.target_table = detectedType;
              m.target_field = commonFields[lower];
              m.confidence = "medium";
            }
          }
        }
      }
      return new Response(JSON.stringify({ mappings: deterministicMappings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Fall back to AI mapping for unknown formats
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const soleraFields = {
      vintages: ["year", "name", "status", "harvest_date", "tons_harvested", "notes", "gallons", "cases_projected", "pick_date", "press_date", "winemaker_notes", "variety", "clone", "rootstock", "fermentation_start", "ml_complete", "bottling_target", "external_vintage_id", "external_lot_id"],
      lab_samples: ["vintage_name", "lot_name", "sampled_at", "brix", "ph", "ta", "va", "so2_free", "so2_total", "alcohol", "rs", "notes", "sampled_by", "gdd_cumulative", "block_name", "external_sample_id"],
      blocks: ["name", "vineyard_name", "variety", "clone", "rootstock", "acres", "status", "lifecycle_stage", "soil_ph", "soil_texture", "soil_organic_matter", "row_spacing_ft", "vine_spacing_ft", "year_planted", "exposure", "elevation_ft", "irrigation", "drainage", "notes", "external_block_id"],
      barrels: ["barrel_id", "type", "cooperage", "toast", "size_liters", "variety", "status"],
      fermentation_vessels: ["name", "capacity_liters", "material", "vessel_type", "status", "location", "capacity_gallons", "notes", "temp_controlled", "current_fill_gal", "external_vessel_id"],
      ttb_additions: ["added_at", "addition_type", "ttb_code", "amount", "unit", "batch_size", "added_by"],
      inventory_skus: ["label", "variety", "vintage_year", "cases", "bottles", "price"],
      vineyards: ["name", "region", "acres", "notes"],
      tasks: ["title", "due_date", "status", "instructions", "category", "priority", "assigned_to_name", "external_task_id", "source_reference"],
      grower_contracts: ["external_contract_id", "grower_name", "source_vineyard_name", "ava", "variety", "clone", "rootstock", "contracted_tons", "price_per_ton", "contract_value", "vintage_year", "status", "approval_status", "delivery_date", "tons_delivered", "payment_due_date", "payment_status", "contract_type", "notes"],
      harvest_progress: ["external_progress_id", "block_name", "variety", "clone", "rootstock", "vintage_year", "acres", "expected_tons", "tons_harvested", "harvest_complete", "pick_date", "brix_at_pick", "notes"],
      harvest_predictions: ["external_prediction_id", "block_name", "variety", "clone", "rootstock", "vintage_year", "current_brix", "current_ph", "current_ta", "brix_per_day", "target_brix", "predicted_pick_date", "days_to_target", "gdd_at_prediction", "confidence", "last_updated", "notes"],
      pick_windows: ["external_window_id", "block_name", "variety", "clone", "rootstock", "current_brix", "target_brix_low", "target_brix_high", "current_ph", "target_ph_low", "target_ph_high", "current_ta", "brix_per_day", "days_to_window_open", "days_to_window_close", "window_open_date", "window_close_date", "window_status", "urgency", "notes"],
    };

    const systemPrompt = `You are a data mapping assistant for a winery management system called Solera.
Given CSV/data headers and sample rows, suggest mappings to Solera database fields.

Available target tables and fields:
${JSON.stringify(soleraFields, null, 2)}

Source type: ${sourceType || "csv"}

IMPORTANT RULES:
- If the file has "progress_id" or "harvest_complete", map to harvest_progress table
- If the file has "prediction_id" or "predicted_pick_date", map to harvest_predictions table  
- If the file has "window_id" or "window_open_date", map to pick_windows table
- If the file has "contract_id" and "grower_name", map to grower_contracts table
- "vineyard" or "vineyard_name" in a blocks file should map to blocks.vineyard_name
- "block_id" as a source header should map to the external_block_id of the target table, NOT to a UUID

For each source column, return:
- source_column: the original header name
- target_table: which Solera table it maps to (or null if unmapped)
- target_field: which field in that table (or null if unmapped)  
- confidence: "high", "medium", or "unmapped"

Return ONLY a JSON array of mapping objects. No markdown, no explanation.`;

    const userPrompt = `Headers: ${JSON.stringify(headers)}
Sample rows (first 5): ${JSON.stringify(sampleRows)}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      throw new Error("AI mapping suggestion failed");
    }

    const result = await response.json();
    let content = result.content?.[0]?.text || "[]";
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const mappings = JSON.parse(content);

    return new Response(JSON.stringify({ mappings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-mapping error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
