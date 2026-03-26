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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

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
        const { data: org } = await supabase
          .from("organizations").select("name, type").eq("id", orgId).single();
        if (!org) continue;

        const { data: anomalies } = await supabase
          .from("anomaly_flags")
          .select("parameter, value, expected_range_low, expected_range_high, flagged_at, resolved, vintages(year, blocks(name))")
          .eq("org_id", orgId)
          .gte("flagged_at", sevenDaysAgo.toISOString());

        const { data: labs } = await supabase
          .from("lab_samples")
          .select("sampled_at, brix, ph, ta, va, so2_free, alcohol, vintages!inner(org_id, year, blocks(name))")
          .eq("vintages.org_id", orgId)
          .gte("sampled_at", sevenDaysAgo.toISOString())
          .order("sampled_at", { ascending: false })
          .limit(20);

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

        const prompt = `Generate a concise weekly winery operations summary for ${org.name}. Include: (1) Any lab anomalies detected this week with brief explanation, (2) Harvest window status — which blocks are approaching or in prime window based on Brix trajectory and GDD, (3) Lab data highlights, (4) Weather summary, (5) Tasks completed and overdue, (6) One actionable recommendation based on the data. Format as a clean report with section headers. Keep it under 300 words. Be specific — cite actual numbers from the data.`;

        let aiContent = "";
        let retries = 0;
        while (retries < 2) {
          try {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-6",
                max_tokens: 1500,
                system: `You are a winery operations analyst. Here is this week's data:\n${context}`,
                messages: [{ role: "user", content: prompt }],
              }),
            });

            if (!response.ok) {
              const t = await response.text();
              console.error(`AI error (attempt ${retries + 1}):`, response.status, t);
              if (retries === 0) { retries++; await new Promise(r => setTimeout(r, 3000)); continue; }
              throw new Error(`AI failed after retry: ${response.status}`);
            }

            const data = await response.json();
            aiContent = data.content?.[0]?.text || "";
            break;
          } catch (e) {
            if (retries === 0) { retries++; await new Promise(r => setTimeout(r, 3000)); continue; }
            console.error(`Weekly summary AI failed for org ${orgId}:`, e);
            break;
          }
        }

        if (!aiContent) {
          console.error(`Skipping weekly summary for org ${orgId} — AI generation failed`);
          continue;
        }

        const { error: insertError } = await supabase.from("weekly_summaries").insert({
          org_id: orgId,
          week_starting: weekStart,
          content: aiContent,
        });
        if (insertError) console.error("Failed to store summary:", insertError);

        // Send email via Resend
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("org_id", orgId);

        if (profiles) {
          // Check alert preferences - notify all users
          for (const p of profiles) {
            await supabase.from("notifications").insert({
              org_id: orgId,
              user_id: p.id,
              message: `📊 Your weekly winery summary for the week of ${weekStart} is ready. View it in Ask Solera > Summaries.`,
              type: "system",
              channel: "both",
            });

            // Send email if Resend is configured
            if (RESEND_API_KEY && p.email) {
              try {
                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    from: `Solera <notifications@solera.vin>`,
                    to: [p.email],
                    subject: `Weekly Winery Summary — ${weekStart}`,
                    html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px">
                      <div style="background:#6B1B2A;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
                        <h1 style="margin:0;font-size:18px">📊 Weekly Summary</h1>
                        <p style="margin:4px 0 0;font-size:13px;opacity:0.8">Week of ${weekStart}</p>
                      </div>
                      <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
                        <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#374151">${aiContent}</pre>
                        <div style="margin-top:24px;text-align:center">
                          <a href="https://solera.vin/ask-solera" style="display:inline-block;padding:10px 24px;background:#6B1B2A;color:white;text-decoration:none;border-radius:6px;font-size:14px">View in Solera</a>
                        </div>
                      </div>
                    </div>`,
                  }),
                });
              } catch (emailErr) {
                console.error(`Failed to send email to ${p.email}:`, emailErr);
              }
            }
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
