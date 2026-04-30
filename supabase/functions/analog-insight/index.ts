// Required secrets: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch profile to get org_id
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();
    if (!profile?.org_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tier check
    const { data: org } = await serviceClient
      .from("organizations")
      .select("tier, subscription_status")
      .eq("id", profile.org_id)
      .single();
    if (
      !org ||
      !["mid_size", "enterprise"].includes(org.tier) ||
      !["active", "trialing"].includes(org.subscription_status)
    ) {
      return new Response(JSON.stringify({ error: "This feature requires a Growth or Enterprise plan." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { analogYear, analogRegion, analogGdd, analogRating, currentVintageYear, currentGdd, similarityScore, varietyName } = body;

    // Input validation
    const isValidYear = (v: unknown) => Number.isInteger(v) && (v as number) >= 1900 && (v as number) <= 2100;
    const isValidRating = (v: unknown) => typeof v === "number" && v >= 0 && v <= 100;
    const isValidGdd = (v: unknown) => typeof v === "number" && v >= 0 && v <= 10000;
    const varietyRe = /^[a-zA-Z0-9\s\-']{1,60}$/;
    const regionRe = /^[a-zA-Z0-9\s\-,.']{1,100}$/;

    if (
      !isValidYear(analogYear) ||
      !isValidYear(currentVintageYear) ||
      !isValidRating(analogRating) ||
      !isValidRating(similarityScore) ||
      !isValidGdd(currentGdd) ||
      !isValidGdd(analogGdd) ||
      (varietyName !== undefined && !varietyRe.test(varietyName)) ||
      (analogRegion !== undefined && !regionRe.test(analogRegion))
    ) {
      return new Response(JSON.stringify({ error: "Invalid input." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const prompt = `Based on vintage analog data, the current ${currentVintageYear} vintage (${varietyName || "wine"}) with ${currentGdd} GDD accumulated so far most closely matches the ${analogYear} vintage in ${analogRegion} (${similarityScore}% similarity, ${analogGdd} GDD total${analogRating ? `, rated ${analogRating}/100` : ""}). What does the match to ${analogYear} suggest about this vintage's potential quality and optimal harvest timing? Give a 2-3 sentence practical interpretation for a winemaker.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: "You are Ask Solera, an expert AI winery assistant. Provide concise, practical vintage analysis based on analog year comparisons. Always reference specific data points.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      throw new Error("AI request failed");
    }

    const result = await response.json();
    const insight = result.content?.[0]?.text || "Unable to generate insight.";

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analog-insight error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
