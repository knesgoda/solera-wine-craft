// Required secrets: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function buildWineryContext(supabase: any, orgId: string): Promise<string> {
  const parts: string[] = [];
  parts.push(`Today's date: ${new Date().toISOString().split("T")[0]}`);

  // Organization info
  const { data: org } = await supabase
    .from("organizations")
    .select("name, type, tier")
    .eq("id", orgId)
    .single();
  if (org) {
    parts.push(`Winery: ${org.name}${org.type ? ` (${org.type})` : ""}${org.tier ? `, tier: ${org.tier}` : ""}`);
  }

  // Active vintages with latest lab data
  const { data: vintages } = await supabase
    .from("vintages")
    .select("id, year, status, harvest_date, tons_harvested, notes, block_id, blocks(name, variety)")
    .eq("org_id", orgId)
    .in("status", ["planned", "in_progress", "harvested", "in_cellar"])
    .order("year", { ascending: false })
    .limit(50);

  if (vintages?.length) {
    const vintageLines: string[] = [];
    for (const v of vintages) {
      const { data: latestLab } = await supabase
        .from("lab_samples")
        .select("brix, ph, ta, va, so2_free, sampled_at")
        .eq("vintage_id", v.id)
        .order("sampled_at", { ascending: false })
        .limit(1);
      const lab = latestLab?.[0];
      let line = `${v.year} ${v.blocks?.name || "Unknown block"} (${v.blocks?.variety || "Unknown variety"}) — ${v.status}`;
      if (lab) {
        line += ` | Latest lab (${lab.sampled_at?.split("T")[0]}): Brix=${lab.brix ?? "—"}, pH=${lab.ph ?? "—"}, TA=${lab.ta ?? "—"}, VA=${lab.va ?? "—"}, Free SO₂=${lab.so2_free ?? "—"}`;
      }
      vintageLines.push(line);
    }
    parts.push(`Active Vintages:\n${vintageLines.join("\n")}`);
  }

  // Blocks with GDD
  const { data: vineyards } = await supabase
    .from("vineyards")
    .select("id, name")
    .eq("org_id", orgId);

  if (vineyards?.length) {
    const { data: blocks } = await supabase
      .from("blocks")
      .select("name, variety, lifecycle_stage, status, vineyard_id, acres")
      .in("vineyard_id", vineyards.map((v: any) => v.id))
      .eq("status", "active");

    if (blocks?.length) {
      // Get latest GDD for each vineyard
      const gddMap: Record<string, number> = {};
      for (const vy of vineyards) {
        const { data: weather } = await supabase
          .from("weather_readings")
          .select("gdd_cumulative")
          .eq("vineyard_id", vy.id)
          .order("recorded_at", { ascending: false })
          .limit(1);
        if (weather?.[0]?.gdd_cumulative) gddMap[vy.id] = weather[0].gdd_cumulative;
      }

      const blockLines = blocks.map((b: any) => {
        const vyName = vineyards.find((v: any) => v.id === b.vineyard_id)?.name || "";
        const gdd = gddMap[b.vineyard_id];
        return `${b.name} (${b.variety || "—"}) at ${vyName} — ${b.lifecycle_stage || "—"}${b.acres ? `, ${b.acres} acres` : ""}${gdd ? `, GDD: ${gdd}` : ""}`;
      });
      parts.push(`Vineyard Blocks:\n${blockLines.join("\n")}`);
    }
  }

  // Weather summary (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: weather } = await supabase
    .from("weather_readings")
    .select("temp_max_f, temp_min_f, precip_inches, gdd_daily, vineyard_id")
    .eq("org_id", orgId)
    .gte("recorded_at", thirtyDaysAgo);

  if (weather?.length) {
    const avgHigh = (weather.reduce((s: number, w: any) => s + (w.temp_max_f || 0), 0) / weather.length).toFixed(1);
    const avgLow = (weather.reduce((s: number, w: any) => s + (w.temp_min_f || 0), 0) / weather.length).toFixed(1);
    const totalPrecip = weather.reduce((s: number, w: any) => s + (w.precip_inches || 0), 0).toFixed(2);
    const gddAccum = weather.reduce((s: number, w: any) => s + (w.gdd_daily || 0), 0).toFixed(1);
    parts.push(`Weather (last 30 days): Avg high ${avgHigh}°F, Avg low ${avgLow}°F, Total precip ${totalPrecip}" , GDD accumulated ${gddAccum}`);
  }

  // Last 10 lab samples
  const { data: recentLabs } = await supabase
    .from("lab_samples")
    .select("sampled_at, brix, ph, ta, va, so2_free, so2_total, alcohol, rs, vintage_id, vintages(year, blocks(name, variety))")
    .eq("vintages.org_id", orgId)
    .order("sampled_at", { ascending: false })
    .limit(10);

  if (recentLabs?.length) {
    const labLines = recentLabs.map((l: any) =>
      `${l.sampled_at?.split("T")[0]} ${l.vintages?.year || ""} ${l.vintages?.blocks?.name || ""}: Brix=${l.brix ?? "—"} pH=${l.ph ?? "—"} TA=${l.ta ?? "—"} VA=${l.va ?? "—"} SO₂f=${l.so2_free ?? "—"} Alc=${l.alcohol ?? "—"}`
    );
    parts.push(`Recent Lab Samples:\n${labLines.join("\n")}`);
  }

  // Alert rules
  const { data: alerts } = await supabase
    .from("alert_rules")
    .select("parameter, operator, threshold, active")
    .eq("org_id", orgId)
    .eq("active", true);

  if (alerts?.length) {
    const opMap: Record<string, string> = { gte: ">=", lte: "<=", eq: "=" };
    const alertLines = alerts.map((a: any) => `${a.parameter} ${opMap[a.operator] || a.operator} ${a.threshold}`);
    parts.push(`Active Alert Thresholds:\n${alertLines.join("\n")}`);
  }

  return parts.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Get user org
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();
    if (!profile?.org_id) throw new Error("User has no organization");

    const { messages, conversationId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build winery context
    const wineryContext = await buildWineryContext(serviceClient, profile.org_id);

    const systemPrompt = `You are Ask Solera, an expert AI winery assistant built into the Solera winery management platform. You have access to real-time data from this winery. Answer questions about harvest timing, lab results, vineyard conditions, cellar operations, and winery management. Always cite the specific data you are using in your answer. Be concise and practical — winemakers are busy. If you don't have enough data to answer confidently, say so and tell them what data would help.

CURRENT WINERY DATA:
${wineryContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits required. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI request failed");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ask-solera error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
