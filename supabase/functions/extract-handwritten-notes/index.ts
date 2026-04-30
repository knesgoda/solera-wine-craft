import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a winemaking lab data extraction specialist. You will receive a photograph of handwritten lab notebook pages from a winery.

Your task is to extract structured data from these notes. Look for:
- Sample dates
- Block or vineyard names
- Grape varieties
- Vintage years
- Brix readings
- pH measurements
- Titratable acidity (TA)
- Temperature readings
- Vessel or tank identifiers
- Free/total SO2
- Any other winemaking-relevant notes

Return a JSON array of row objects. Each row represents one sample entry found on the page. For each field, return both the value and a confidence score (0.0 to 1.0):

{
  "rows": [
    {
      "date": { "value": "2025-09-15", "confidence": 0.95 },
      "block": { "value": "Block A", "confidence": 0.85 },
      "variety": { "value": "Pinot Noir", "confidence": 0.90 },
      "vintage_year": { "value": 2025, "confidence": 0.95 },
      "brix": { "value": 24.5, "confidence": 0.92 },
      "ph": { "value": 3.45, "confidence": 0.88 },
      "ta": { "value": 6.2, "confidence": 0.80 },
      "temperature": { "value": 72, "confidence": 0.75 },
      "vessel": { "value": "T3", "confidence": 0.70 },
      "so2_free": { "value": 28, "confidence": 0.85 },
      "so2_total": { "value": 65, "confidence": 0.80 },
      "notes": { "value": "Slight VA detected", "confidence": 0.60 }
    }
  ]
}

Rules:
- If a field is not present in the handwritten notes, omit it from the row entirely.
- Dates should be in ISO 8601 format (YYYY-MM-DD) when possible.
- Confidence reflects how legible and unambiguous the handwritten value is.
- If the page contains no extractable winemaking data, return {"rows": []}.
- Return ONLY the JSON object, no additional text.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { imageBase64, mimeType, orgId, sessionId } = body;

    if (!imageBase64 || !mimeType || !orgId) {
      return new Response(JSON.stringify({ error: "Missing imageBase64, mimeType, or orgId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: "Extract all winemaking lab data from this handwritten notebook page.",
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", errText);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicData = await anthropicRes.json();
    let rawText = anthropicData.content?.[0]?.text || "{}";

    // Strip markdown code fences if present
    rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse AI response:", rawText);
      return new Response(JSON.stringify({ error: "Failed to parse extraction results", raw: rawText }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("extract-handwritten-notes error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
