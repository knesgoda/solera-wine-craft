import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── File-type-specific alias maps ──────────────────────────────────────────
// Each key is a detected file type; value maps lowercase header → table.field
const FILE_ALIASES: Record<string, Record<string, string>> = {
  blocks: {
    block_name: "blocks.name",
    block_id: "blocks.external_block_id",
    name: "blocks.name",
    vineyard: "blocks.vineyard_name",
    vineyard_name: "blocks.vineyard_name",
    variety: "blocks.variety",
    clone: "blocks.clone",
    rootstock: "blocks.rootstock",
    acres: "blocks.acres",
    status: "blocks.status",
    lifecycle_stage: "blocks.lifecycle_stage",
    soil_ph: "blocks.soil_ph",
    soil_texture: "blocks.soil_texture",
    soil_organic_matter: "blocks.soil_organic_matter",
    row_spacing_ft: "blocks.row_spacing_ft",
    vine_spacing_ft: "blocks.vine_spacing_ft",
    year_planted: "blocks.year_planted",
    exposure: "blocks.exposure",
    elevation_ft: "blocks.elevation_ft",
    irrigation: "blocks.irrigation",
    drainage: "blocks.drainage",
    notes: "blocks.notes",
    external_block_id: "blocks.external_block_id",
  },
  lab_samples: {
    sample_id: "lab_samples.external_sample_id",
    external_sample_id: "lab_samples.external_sample_id",
    sampled_at: "lab_samples.sampled_at",
    sample_date: "lab_samples.sampled_at",
    sampled_by: "lab_samples.sampled_by",
    vintage_name: "lab_samples.vintage_name",
    lot_name: "lab_samples.lot_name",
    block_name: "lab_samples.block_name",
    block_id: "lab_samples.external_block_id",
    brix: "lab_samples.brix",
    ph: "lab_samples.ph",
    ta: "lab_samples.ta",
    ta_g_l: "lab_samples.ta",
    va: "lab_samples.va",
    va_g_l: "lab_samples.va",
    so2_free: "lab_samples.so2_free",
    so2_free_ppm: "lab_samples.so2_free",
    so2_total: "lab_samples.so2_total",
    alcohol: "lab_samples.alcohol",
    rs: "lab_samples.rs",
    notes: "lab_samples.notes",
    gdd_cumulative: "lab_samples.gdd_cumulative",
    variety: "lab_samples.variety",
    clone: "lab_samples.clone",
    rootstock: "lab_samples.rootstock",
  },
  vintages: {
    lot_name: "vintages.name",
    lot_id: "vintages.external_lot_id",
    vintage_id: "vintages.external_vintage_id",
    external_vintage_id: "vintages.external_vintage_id",
    external_lot_id: "vintages.external_lot_id",
    name: "vintages.name",
    year: "vintages.year",
    vintage_year: "vintages.year",
    status: "vintages.status",
    harvest_date: "vintages.harvest_date",
    tons_harvested: "vintages.tons_harvested",
    notes: "vintages.notes",
    gallons: "vintages.gallons",
    cases_projected: "vintages.cases_projected",
    pick_date: "vintages.pick_date",
    press_date: "vintages.press_date",
    winemaker_notes: "vintages.winemaker_notes",
    variety: "vintages.variety",
    clone: "vintages.clone",
    rootstock: "vintages.rootstock",
    fermentation_start: "vintages.fermentation_start",
    ml_complete: "vintages.ml_complete",
    bottling_target: "vintages.bottling_target",
    block_id: "vintages._block_ref",
    source_block: "vintages._block_ref",
    primary_vessel: "vintages._vessel_ref",
    target_brix_at_pick: "vintages._ignore",
    actual_brix_at_pick: "vintages._ignore",
  },
  grower_contracts: {
    contract_id: "grower_contracts.external_contract_id",
    external_contract_id: "grower_contracts.external_contract_id",
    grower_name: "grower_contracts.grower_name",
    vineyard_name: "grower_contracts.source_vineyard_name",
    source_vineyard_name: "grower_contracts.source_vineyard_name",
    ava: "grower_contracts.ava",
    variety: "grower_contracts.variety",
    clone: "grower_contracts.clone",
    rootstock: "grower_contracts.rootstock",
    contracted_tons: "grower_contracts.contracted_tons",
    price_per_ton: "grower_contracts.price_per_ton",
    contract_value: "grower_contracts.contract_value",
    vintage_year: "grower_contracts.vintage_year",
    contract_year: "grower_contracts.vintage_year",
    status: "grower_contracts.status",
    approval_status: "grower_contracts.approval_status",
    delivery_date: "grower_contracts.delivery_date",
    tons_delivered: "grower_contracts.tons_delivered",
    payment_due_date: "grower_contracts.payment_due_date",
    payment_status: "grower_contracts.payment_status",
    contract_type: "grower_contracts.contract_type",
    notes: "grower_contracts.notes",
    winery_name: "grower_contracts.source_vineyard_name",
  },
  harvest_progress: {
    progress_id: "harvest_progress.external_progress_id",
    external_progress_id: "harvest_progress.external_progress_id",
    block_name: "harvest_progress.block_name",
    block_id: "harvest_progress._block_ref",
    variety: "harvest_progress.variety",
    clone: "harvest_progress.clone",
    rootstock: "harvest_progress.rootstock",
    vintage_year: "harvest_progress.vintage_year",
    acres: "harvest_progress.acres",
    expected_tons: "harvest_progress.expected_tons",
    tons_harvested: "harvest_progress.tons_harvested",
    harvest_complete: "harvest_progress.harvest_complete",
    pick_date: "harvest_progress.pick_date",
    brix_at_pick: "harvest_progress.brix_at_pick",
    notes: "harvest_progress.notes",
  },
  harvest_predictions: {
    prediction_id: "harvest_predictions.external_prediction_id",
    external_prediction_id: "harvest_predictions.external_prediction_id",
    block_name: "harvest_predictions.block_name",
    block_id: "harvest_predictions._block_ref",
    variety: "harvest_predictions.variety",
    clone: "harvest_predictions.clone",
    rootstock: "harvest_predictions.rootstock",
    vintage_year: "harvest_predictions.vintage_year",
    current_brix: "harvest_predictions.current_brix",
    current_ph: "harvest_predictions.current_ph",
    current_ta: "harvest_predictions.current_ta",
    brix_per_day: "harvest_predictions.brix_per_day",
    target_brix: "harvest_predictions.target_brix",
    predicted_pick_date: "harvest_predictions.predicted_pick_date",
    days_to_target: "harvest_predictions.days_to_target",
    gdd_at_prediction: "harvest_predictions.gdd_at_prediction",
    confidence: "harvest_predictions.confidence",
    last_updated: "harvest_predictions.last_updated",
    notes: "harvest_predictions.notes",
  },
  pick_windows: {
    window_id: "pick_windows.external_window_id",
    external_window_id: "pick_windows.external_window_id",
    block_name: "pick_windows.block_name",
    block_id: "pick_windows._block_ref",
    variety: "pick_windows.variety",
    clone: "pick_windows.clone",
    rootstock: "pick_windows.rootstock",
    current_brix: "pick_windows.current_brix",
    target_brix_low: "pick_windows.target_brix_low",
    target_brix_high: "pick_windows.target_brix_high",
    current_ph: "pick_windows.current_ph",
    target_ph_low: "pick_windows.target_ph_low",
    target_ph_high: "pick_windows.target_ph_high",
    current_ta: "pick_windows.current_ta",
    brix_per_day: "pick_windows.brix_per_day",
    days_to_window_open: "pick_windows.days_to_window_open",
    days_to_window_close: "pick_windows.days_to_window_close",
    window_open_date: "pick_windows.window_open_date",
    window_close_date: "pick_windows.window_close_date",
    window_status: "pick_windows.window_status",
    urgency: "pick_windows.urgency",
    notes: "pick_windows.notes",
  },
  fermentation_vessels: {
    vessel_id: "fermentation_vessels.external_vessel_id",
    external_vessel_id: "fermentation_vessels.external_vessel_id",
    name: "fermentation_vessels.name",
    vessel_name: "fermentation_vessels.name",
    vessel_type: "fermentation_vessels.vessel_type",
    capacity_gallons: "fermentation_vessels.capacity_gallons",
    capacity_gal: "fermentation_vessels.capacity_gallons",
    capacity_liters: "fermentation_vessels.capacity_liters",
    current_fill_gal: "fermentation_vessels.current_fill_gal",
    temp_controlled: "fermentation_vessels.temp_controlled",
    material: "fermentation_vessels.material",
    status: "fermentation_vessels.status",
    location: "fermentation_vessels.location",
    notes: "fermentation_vessels.notes",
  },
  tasks: {
    task_id: "tasks.external_task_id",
    external_task_id: "tasks.external_task_id",
    title: "tasks.title",
    due_date: "tasks.due_date",
    status: "tasks.status",
    instructions: "tasks.instructions",
    category: "tasks.category",
    priority: "tasks.priority",
    assigned_to: "tasks.assigned_to_name",
    assigned_to_name: "tasks.assigned_to_name",
    source_reference: "tasks.source_reference",
    notes: "tasks.instructions",
  },
};

// ── File-type detection via header signatures ──────────────────────────────
// Each entry: [fileType, requiredHeaders (need ≥ matchThreshold), matchThreshold]
const FILE_SIGNATURES: [string, string[], number][] = [
  // Pick windows BEFORE harvest_predictions (both share current_brix, brix_per_day)
  ["pick_windows", ["window_open_date", "window_close_date", "target_brix_low", "target_brix_high", "window_id", "window_status", "days_to_window_open", "days_to_window_close"], 2],
  ["harvest_predictions", ["predicted_pick_date", "days_to_target", "brix_per_day", "current_brix", "prediction_id", "gdd_at_prediction"], 2],
  ["harvest_progress", ["harvest_complete", "brix_at_pick", "expected_tons", "progress_id"], 2],
  // Core operational tables
  ["grower_contracts", ["grower_name", "price_per_ton", "contracted_tons", "contract_id", "contract_value", "contract_type", "contract_year"], 2],
  ["lab_samples", ["brix", "ph", "ta", "sampled_at", "sample_id", "so2_free", "va", "sample_date", "ta_g_l", "va_g_l", "so2_free_ppm"], 3],
  ["fermentation_vessels", ["vessel_type", "capacity_gallons", "capacity_gal", "vessel_id", "vessel_name", "current_fill_gal", "temp_controlled"], 2],
  ["tasks", ["due_date", "assigned_to", "priority", "task_id", "instructions"], 2],
  ["blocks", ["vineyard", "vineyard_name", "acres", "year_planted", "soil_ph", "elevation_ft", "block_id", "block_name"], 2],
  ["vintages", ["harvest_date", "tons_harvested", "winemaker_notes", "vintage_id", "lot_id", "press_date", "fermentation_start", "bottling_target"], 2],
];

function detectFileType(headers: string[]): string | null {
  const lowerHeaders = new Set(headers.map(h => h.toLowerCase().trim()));
  for (const [fileType, signatures, threshold] of FILE_SIGNATURES) {
    const matches = signatures.filter(s => lowerHeaders.has(s));
    if (matches.length >= threshold) return fileType;
  }
  return null;
}

// ── Global fallback alias (only used when file type is unknown) ────────────
const GLOBAL_ALIASES: Record<string, string> = {
  vineyard: "blocks.vineyard_name",
  vineyard_name: "blocks.vineyard_name",
  block_name: "blocks.name",
  block_id: "blocks.external_block_id",
  lot_name: "vintages.name",
  lot_id: "vintages.external_lot_id",
  vintage_id: "vintages.external_vintage_id",
  sample_id: "lab_samples.external_sample_id",
  vessel_id: "fermentation_vessels.external_vessel_id",
  task_id: "tasks.external_task_id",
  contract_id: "grower_contracts.external_contract_id",
  grower_name: "grower_contracts.grower_name",
  price_per_ton: "grower_contracts.price_per_ton",
  assigned_to: "tasks.assigned_to_name",
  assigned_to_name: "tasks.assigned_to_name",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { headers, sampleRows, sourceType } = await req.json();
    const lowerHeaders = headers.map((h: string) => h.toLowerCase().trim());

    // Step 1: Detect file type
    const detectedType = detectFileType(lowerHeaders);
    console.log("Detected file type:", detectedType, "from headers:", lowerHeaders.join(", "));

    // Step 2: Build mappings using file-type-specific aliases first
    const aliasMap = detectedType ? FILE_ALIASES[detectedType] || {} : {};
    const deterministicMappings: any[] = [];
    let deterministicCount = 0;

    for (const originalHeader of headers) {
      const lower = originalHeader.toLowerCase().trim();

      // Try file-type-specific alias first
      let alias = aliasMap[lower];

      // Fall back to global alias ONLY if no file type was detected
      // This prevents headers like block_id from leaking into unrelated tables
      if (!alias && !detectedType) alias = GLOBAL_ALIASES[lower];

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

    // --- Post-processing: remap accidental blocks.* when detected type is a harvest table ---
    const HARVEST_FILE_TYPES = ["pick_windows", "harvest_predictions", "harvest_progress"];
    if (detectedType && HARVEST_FILE_TYPES.includes(detectedType)) {
      for (const m of deterministicMappings) {
        if (m.target_table === "blocks") {
          if (m.target_field === "external_block_id" || m.target_field === "name") {
            // Rewrite to harvest table's _block_ref or block_name
            m.target_table = detectedType;
            m.target_field = m.target_field === "external_block_id" ? "_block_ref" : "block_name";
            console.log(`Remapped ${m.source_column} from blocks to ${detectedType}.${m.target_field}`);
          }
        }
      }
    }

    // Log final mapping summary
    const finalTables = [...new Set(deterministicMappings.filter(m => m.target_table).map(m => m.target_table))];
    console.log("Final mapping target tables:", finalTables.join(", "));

    // If we matched at least 40% of headers deterministically, use that
    // (lowered from 60% since file-type-aware aliases are more precise)
    if (deterministicCount / headers.length >= 0.4) {
      // For remaining unmapped columns in a detected file type, try common field names
      if (detectedType) {
        const commonFields: Record<string, string> = {
          variety: "variety", clone: "clone", rootstock: "rootstock",
          notes: "notes", vintage_year: "vintage_year", acres: "acres",
          pick_date: "pick_date", winery_name: "winery_name",
          tons_harvested: "tons_harvested", last_updated: "last_updated",
          name: "name", status: "status",
        };
        for (const m of deterministicMappings) {
          if (m.target_table === null) {
            const lower = m.source_column.toLowerCase().trim();
            if (commonFields[lower]) {
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

    // Step 3: Fall back to AI mapping for unknown formats
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      // No API key — return whatever deterministic mappings we have
      return new Response(JSON.stringify({ mappings: deterministicMappings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      // Return deterministic mappings as fallback
      return new Response(JSON.stringify({ mappings: deterministicMappings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    let content = result.content?.[0]?.text || "[]";
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const aiMappings = JSON.parse(content);

    // Merge: keep deterministic mappings, fill in AI suggestions for unmapped only
    const finalMappings = deterministicMappings.map((dm: any) => {
      if (dm.target_table !== null) return dm; // already mapped deterministically
      const aiMatch = aiMappings.find((ai: any) => ai.source_column === dm.source_column);
      if (aiMatch && aiMatch.target_table) return aiMatch;
      return dm;
    });

    return new Response(JSON.stringify({ mappings: finalMappings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-mapping error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
