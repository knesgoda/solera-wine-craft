import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { headers, sampleRows, sourceType } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const soleraFields = {
      vintages: ["year", "status", "harvest_date", "tons_harvested", "notes", "gallons", "cases_projected", "pick_date", "press_date", "winemaker_notes"],
      lab_samples: ["sampled_at", "brix", "ph", "ta", "va", "so2_free", "so2_total", "alcohol", "rs", "notes"],
      blocks: ["name", "variety", "clone", "rootstock", "acres", "status", "lifecycle_stage", "soil_ph", "soil_texture", "soil_organic_matter", "row_spacing_ft", "vine_spacing_ft", "year_planted", "exposure", "elevation_ft", "irrigation", "drainage", "notes"],
      barrels: ["barrel_id", "type", "cooperage", "toast", "size_liters", "variety", "status"],
      fermentation_vessels: ["name", "capacity_liters", "material", "vessel_type", "status", "location", "capacity_gallons", "notes", "temp_controlled"],
      ttb_additions: ["added_at", "addition_type", "ttb_code", "amount", "unit", "batch_size", "added_by"],
      inventory_skus: ["label", "variety", "vintage_year", "cases", "bottles", "price"],
      vineyards: ["name", "region", "acres", "notes"],
      tasks: ["title", "due_date", "status", "instructions"],
    };

    const systemPrompt = `You are a data mapping assistant for a winery management system called Solera.
Given CSV/data headers and sample rows, suggest mappings to Solera database fields.

Available target tables and fields:
${JSON.stringify(soleraFields, null, 2)}

Source type: ${sourceType || "csv"}

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

    // Strip markdown code fences if present
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
