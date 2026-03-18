import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Determine if this is a manual trigger for specific org or scheduled for all
    let targetOrgIds: string[] = [];
    try {
      const body = await req.json();
      if (body?.orgId) targetOrgIds = [body.orgId];
    } catch { /* scheduled call with no body */ }

    if (targetOrgIds.length === 0) {
      const { data: orgs } = await supabase.from("organizations").select("id");
      targetOrgIds = (orgs || []).map((o: any) => o.id);
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekStart = sevenDaysAgo.toISOString().split("T")[0];
    const results: any[] = [];

    for (const orgId of targetOrgIds) {
      try {
        // Get org info
        const { data: org } = await supabase
          .from("organizations").select("name, type").eq("id", orgId).single();
        if (!org) continue;

        // Anomalies from past 7 days
        const { data: anomalies } = await supabase
          .from("anomaly_flags")
          .select("parameter, value, expected_range_low, expected_range_high, flagged_at, resolved, vintages(year, blocks(name))")
          .eq("org_id", orgId)
          .gte("flagged_at", sevenDaysAgo.toISOString());

        // Lab samples from past 7 days
        const { data: labs } = await supabase
          .from("lab_samples")
          .select("sampled_at, brix, ph, ta, va, so2_free, alcohol, vintages!inner(org_id, year, blocks(name))")
          .eq("vintages.org_id", orgId)
          .gte("sampled_at", sevenDaysAgo.toISOString())
          .order("sampled_at", { ascending: false })
          .limit(20);

        // Tasks completed and overdue
        const { data: tasksCompleted } = await supabase
          .from("tasks")
          .select("title, status, due_date")
          .eq("org_id", orgId)
          .eq("status", "complete")
          .gte("updated_at", sevenDaysAgo.toISOString());

        const { data: tasksOverdue } = await supabase
          .from("tasks")
          .select("title, status, due_date")
          .eq("org_id", orgId)
          .eq("status", "pending")
          .lt("due_date", now.toISOString().split("T")[0]);

        // Weather summary
        const { data: weather } = await supabase
          .from("weather_readings")
          .select("temp_max_f, temp_min_f, precip_inches, gdd_daily")
          .eq("org_id", orgId)
          .gte("recorded_at", weekStart);

        let weatherSummary = "No weather data available.";
        if (weather && weather.length > 0) {
          const avgHigh = (weather.reduce((s, w) => s + (w.temp_max_f || 0), 0) / weather.length).toFixed(1);
          const avgLow = (weather.reduce((s, w) => s + (w.temp_min_f || 0), 0) / weather.length).toFixed(1);
          const totalPrecip = weather.reduce((s, w) => s + (w.precip_inches || 0), 0).toFixed(2);
          const gdd = weather.reduce((s, w) => s + (w.gdd_daily || 0), 0).toFixed(1);
          weatherSummary = `Avg high: ${avgHigh}°F, Avg low: ${avgLow}°F, Total precip: ${totalPrecip}", GDD accumulated: ${gdd}`;
        }

        // Build context for AI
        const context = `
Winery: ${org.name}
Week: ${weekStart} to ${now.toISOString().split("T")[0]}

Anomalies detected (${anomalies?.length || 0}):
${anomalies?.map(a => `- ${a.parameter}: ${a.value} (expected ${a.expected_range_low ?? "—"} – ${a.expected_range_high ?? "—"}) on ${(a as any).vintages?.year} ${(a as any).vintages?.blocks?.name || ""} [${a.resolved ? "resolved" : "unresolved"}]`).join("\n") || "None"}

Lab samples (${labs?.length || 0}):
${labs?.map(l => `- ${l.sampled_at?.split("T")[0]} ${(l as any).vintages?.year} ${(l as any).vintages?.blocks?.name || ""}: Brix=${l.brix ?? "—"} pH=${l.ph ?? "—"} TA=${l.ta ?? "—"} VA=${l.va ?? "—"}`).join("\n") || "None"}

Tasks completed: ${tasksCompleted?.length || 0}
${tasksCompleted?.map(t => `- ${t.title}`).join("\n") || "None"}

Tasks overdue: ${tasksOverdue?.length || 0}
${tasksOverdue?.map(t => `- ${t.title} (due ${t.due_date})`).join("\n") || "None"}

Weather: ${weatherSummary}`;

        const prompt = `Generate a concise weekly winery operations summary for ${org.name}. Include: (1) Harvest window status for each active block, (2) Any anomalies detected this week with brief explanation, (3) Lab data highlights, (4) Weather summary, (5) Tasks completed and overdue. Format as a clean report with section headers. Keep each section to 2–3 sentences. End with 3 recommended actions for this week.`;

        // Call AI with retry
        let aiContent = "";
        let retries = 0;
        while (retries < 2) {
          try {
            const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: `You are a winery operations analyst. Here is this week's data:\n${context}` },
                  { role: "user", content: prompt },
                ],
                max_tokens: 1500,
              }),
            });

            if (!response.ok) {
              const t = await response.text();
              console.error(`AI error (attempt ${retries + 1}):`, response.status, t);
              if (retries === 0) {
                retries++;
                await new Promise(r => setTimeout(r, 5 * 60 * 1000)); // Wait 5 min
                continue;
              }
              throw new Error(`AI failed after retry: ${response.status}`);
            }

            const data = await response.json();
            aiContent = data.choices?.[0]?.message?.content || "";
            break;
          } catch (e) {
            if (retries === 0) {
              retries++;
              await new Promise(r => setTimeout(r, 5 * 60 * 1000));
              continue;
            }
            console.error(`Weekly summary AI failed for org ${orgId}:`, e);
            break;
          }
        }

        if (!aiContent) {
          console.error(`Skipping weekly summary for org ${orgId} — AI generation failed`);
          continue;
        }

        // Store summary
        const { error: insertError } = await supabase.from("weekly_summaries").insert({
          org_id: orgId,
          week_starting: weekStart,
          content: aiContent,
        });
        if (insertError) console.error("Failed to store summary:", insertError);

        // Notify org users
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("org_id", orgId);

        if (profiles) {
          for (const p of profiles) {
            await supabase.from("notifications").insert({
              org_id: orgId,
              user_id: p.id,
              message: `📊 Your weekly winery summary for the week of ${weekStart} is ready. View it in Reports.`,
              type: "system",
              channel: "both",
            });
          }
        }

        results.push({ orgId, status: "success" });
      } catch (orgError) {
        console.error(`Weekly summary failed for org ${orgId}:`, orgError);
        results.push({ orgId, status: "failed", error: String(orgError) });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
