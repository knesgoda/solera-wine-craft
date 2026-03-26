import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnomalyResult {
  parameter: string;
  value: number;
  expected_range_low: number | null;
  expected_range_high: number | null;
  message: string;
  severity: "warning" | "critical";
}

/**
 * This function handles both:
 * 1. Reactive mode: called with {type, record} when a lab sample or fermentation log is saved
 * 2. Scheduled mode: called with {scheduled: true} for daily batch scanning across all orgs
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body for scheduled */ }

    // SCHEDULED DAILY SCAN MODE
    if (body.scheduled === true || (!body.type && !body.record)) {
      console.log("Running scheduled daily anomaly scan...");
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

      const { data: orgs } = await supabase.from("organizations").select("id, name");
      const results: any[] = [];

      for (const org of (orgs || [])) {
        try {
          const anomalies: AnomalyResult[] = [];
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

          // Get org vintages
          const { data: vintages } = await supabase
            .from("vintages")
            .select("id, year, status, blocks(name, variety)")
            .eq("org_id", org.id)
            .in("status", ["in_progress", "harvested", "in_cellar"]);

          if (!vintages?.length) continue;
          const vintageIds = vintages.map((v: any) => v.id);

          // Get lab samples from last 7 days
          const { data: labs } = await supabase
            .from("lab_samples")
            .select("id, vintage_id, brix, ph, ta, va, so2_free, sampled_at")
            .in("vintage_id", vintageIds)
            .gte("sampled_at", sevenDaysAgo)
            .order("sampled_at", { ascending: false });

          // Group labs by vintage
          const labsByVintage: Record<string, any[]> = {};
          for (const l of (labs || [])) {
            if (!labsByVintage[l.vintage_id]) labsByVintage[l.vintage_id] = [];
            labsByVintage[l.vintage_id].push(l);
          }

          for (const v of vintages) {
            const vLabs = labsByVintage[v.id] || [];
            if (!vLabs.length) continue;
            const latest = vLabs[0];
            const vLabel = `${v.year} ${(v as any).blocks?.name || ""}`;

            // VA above 0.6 or rising >0.1 in 48 hours
            if (latest.va != null && latest.va > 0.6) {
              anomalies.push({
                parameter: "va_spike",
                value: latest.va,
                expected_range_low: 0,
                expected_range_high: 0.6,
                severity: latest.va > 0.8 ? "critical" : "warning",
                message: `VA at ${latest.va} g/L exceeds 0.6 g/L threshold on ${vLabel}`,
              });
            }
            if (vLabs.length >= 2 && latest.va != null && vLabs[1].va != null) {
              const vaDiff = latest.va - vLabs[1].va;
              const hoursDiff = (new Date(latest.sampled_at).getTime() - new Date(vLabs[1].sampled_at).getTime()) / 3600000;
              if (vaDiff > 0.1 && hoursDiff <= 48) {
                anomalies.push({
                  parameter: "va_spike",
                  value: latest.va,
                  expected_range_low: null,
                  expected_range_high: null,
                  severity: "critical",
                  message: `VA rose ${vaDiff.toFixed(2)} g/L in ${Math.round(hoursDiff)} hours on ${vLabel}`,
                });
              }
            }

            // Brix plateau (no change >0.5 over 72 hours during active fermentation)
            if (v.status === "in_progress" && vLabs.length >= 2) {
              const recent = vLabs.filter((l: any) => l.brix != null).slice(0, 4);
              if (recent.length >= 2) {
                const brixValues = recent.map((l: any) => l.brix);
                const range = Math.max(...brixValues) - Math.min(...brixValues);
                const hourSpan = (new Date(recent[0].sampled_at).getTime() - new Date(recent[recent.length - 1].sampled_at).getTime()) / 3600000;
                if (range <= 0.5 && hourSpan >= 72) {
                  anomalies.push({
                    parameter: "brix_plateau",
                    value: latest.brix,
                    expected_range_low: null,
                    expected_range_high: null,
                    severity: "warning",
                    message: `Brix has plateaued at ~${latest.brix}° for ${Math.round(hourSpan / 24)} days on ${vLabel} — fermentation may be stuck`,
                  });
                }
              }
            }

            // Free SO2 below 20 ppm on aging/bottled wine
            if (["harvested", "in_cellar"].includes(v.status) && latest.so2_free != null && latest.so2_free < 20) {
              anomalies.push({
                parameter: "low_so2",
                value: latest.so2_free,
                expected_range_low: 20,
                expected_range_high: null,
                severity: latest.so2_free < 10 ? "critical" : "warning",
                message: `Free SO₂ at ${latest.so2_free} ppm is below 20 ppm on ${vLabel}`,
              });
            }

            // pH above 3.8
            if (latest.ph != null && latest.ph > 3.8) {
              anomalies.push({
                parameter: "high_ph",
                value: latest.ph,
                expected_range_low: null,
                expected_range_high: 3.8,
                severity: "warning",
                message: `pH at ${latest.ph} exceeds 3.8 on ${vLabel}`,
              });
            }
          }

          // Check fermentation vessel temps
          const { data: vessels } = await supabase
            .from("fermentation_vessels")
            .select("id, name, vintage_id")
            .eq("org_id", org.id)
            .not("vintage_id", "is", null);

          if (vessels?.length) {
            for (const vessel of vessels) {
              const { data: latestLog } = await supabase
                .from("fermentation_logs")
                .select("temp_f, logged_at")
                .eq("vessel_id", vessel.id)
                .gte("logged_at", sevenDaysAgo)
                .order("logged_at", { ascending: false })
                .limit(1);

              if (latestLog?.[0]?.temp_f && latestLog[0].temp_f > 85) {
                const vInfo = vintages.find((v: any) => v.id === vessel.vintage_id);
                anomalies.push({
                  parameter: "high_temp",
                  value: latestLog[0].temp_f,
                  expected_range_low: null,
                  expected_range_high: 85,
                  severity: latestLog[0].temp_f > 90 ? "critical" : "warning",
                  message: `Vessel ${vessel.name} at ${latestLog[0].temp_f}°F exceeds 85°F${vInfo ? ` (${vInfo.year} ${(vInfo as any).blocks?.name || ""})` : ""}`,
                });
              }
            }
          }

          // Store anomalies and notify
          if (anomalies.length > 0) {
            for (const a of anomalies) {
              // Check for duplicate: same parameter, same value, same org in last 24 hours
              const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
              const { data: existing } = await supabase
                .from("anomaly_flags")
                .select("id")
                .eq("org_id", org.id)
                .eq("parameter", a.parameter)
                .gte("flagged_at", oneDayAgo)
                .limit(1);

              if (existing?.length) continue; // Skip duplicate

              await supabase.from("anomaly_flags").insert({
                org_id: org.id,
                vintage_id: vintageIds[0], // Best effort
                parameter: a.parameter,
                value: a.value,
                expected_range_low: a.expected_range_low,
                expected_range_high: a.expected_range_high,
              });
            }

            // Notify all org users
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, email")
              .eq("org_id", org.id);

            if (profiles) {
              const criticals = anomalies.filter(a => a.severity === "critical");
              const warnings = anomalies.filter(a => a.severity === "warning");

              for (const p of profiles) {
                await supabase.from("notifications").insert({
                  org_id: org.id,
                  user_id: p.id,
                  message: `⚠️ ${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"} detected: ${anomalies.map(a => a.message).join("; ")}`,
                  type: "alert",
                  channel: criticals.length > 0 ? "both" : "in_app",
                });
              }

              // Send email digest
              if (RESEND_API_KEY) {
                const emailRecipients = profiles.filter(p => p.email).map(p => p.email);
                if (emailRecipients.length > 0) {
                  const anomalyHtml = anomalies.map(a =>
                    `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;background:${a.severity === "critical" ? "#dc2626" : "#f59e0b"};color:white">${a.severity}</span></td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:14px">${a.message}</td></tr>`
                  ).join("");

                  try {
                    await fetch("https://api.resend.com/emails", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
                      body: JSON.stringify({
                        from: `Solera Alerts <alerts@solera.vin>`,
                        to: emailRecipients,
                        subject: `⚠️ ${criticals.length > 0 ? "CRITICAL: " : ""}${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"} detected — ${org.name}`,
                        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px">
                          <div style="background:${criticals.length > 0 ? "#dc2626" : "#f59e0b"};color:white;padding:16px 24px;border-radius:8px 8px 0 0">
                            <h1 style="margin:0;font-size:18px">⚠️ Anomaly Alert</h1>
                            <p style="margin:4px 0 0;font-size:13px;opacity:0.8">${org.name} — ${new Date().toISOString().split("T")[0]}</p>
                          </div>
                          <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
                            <table style="width:100%;border-collapse:collapse">${anomalyHtml}</table>
                            <div style="margin-top:24px;text-align:center">
                              <a href="https://solera.vin/dashboard" style="display:inline-block;padding:10px 24px;background:#6B1B2A;color:white;text-decoration:none;border-radius:6px;font-size:14px">View in Solera</a>
                            </div>
                          </div>
                        </div>`,
                      }),
                    });
                  } catch (emailErr) {
                    console.error("Failed to send anomaly email:", emailErr);
                  }
                }
              }
            }
          }

          results.push({ orgId: org.id, anomalies: anomalies.length, status: "success" });
        } catch (orgError) {
          console.error(`Anomaly scan failed for org ${org.id}:`, orgError);
          results.push({ orgId: org.id, status: "failed", error: String(orgError) });
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REACTIVE MODE (existing behavior)
    const { type, record, vintageId, orgId } = body;
    const anomalies: AnomalyResult[] = [];

    if (type === "lab_sample") {
      const vId = record.vintage_id || vintageId;
      if (!vId) throw new Error("vintage_id required");

      const { data: vintage } = await supabase
        .from("vintages")
        .select("org_id, year, blocks(name)")
        .eq("id", vId)
        .single();
      if (!vintage) throw new Error("Vintage not found");
      const org_id = orgId || vintage.org_id;

      if (record.va != null && record.va > 0.8) {
        anomalies.push({
          parameter: "VA spike", value: record.va,
          expected_range_low: 0, expected_range_high: 0.8, severity: "critical",
          message: `VA at ${record.va} g/L exceeds 0.8 g/L threshold for ${vintage.year} ${(vintage as any).blocks?.name || "vintage"}`,
        });
      }
      if (record.so2_free != null && record.so2_free < 25) {
        anomalies.push({
          parameter: "SO2 low", value: record.so2_free,
          expected_range_low: 25, expected_range_high: null, severity: "warning",
          message: `Free SO₂ at ${record.so2_free} ppm is below 25 ppm for ${vintage.year} ${(vintage as any).blocks?.name || "vintage"}`,
        });
      }
      if (record.ph != null && record.ph > 3.8) {
        anomalies.push({
          parameter: "pH high", value: record.ph,
          expected_range_low: null, expected_range_high: 3.8, severity: "warning",
          message: `pH at ${record.ph} exceeds 3.8 for ${vintage.year} ${(vintage as any).blocks?.name || "vintage"}`,
        });
      }

      if (record.brix != null) {
        const { data: prevSamples } = await supabase
          .from("lab_samples")
          .select("brix, sampled_at")
          .eq("vintage_id", vId)
          .not("brix", "is", null)
          .order("sampled_at", { ascending: false })
          .limit(4);

        if (prevSamples && prevSamples.length >= 1) {
          const prevBrix = prevSamples[0].brix as number;
          if (prevBrix - record.brix > 3.0) {
            anomalies.push({
              parameter: "Brix drop", value: record.brix,
              expected_range_low: prevBrix - 3.0, expected_range_high: null, severity: "warning",
              message: `Brix dropped ${(prevBrix - record.brix).toFixed(1)}° (from ${prevBrix} to ${record.brix}) in a single reading`,
            });
          }
        }

        if (prevSamples && prevSamples.length >= 2) {
          const recentBrix = [record.brix, ...prevSamples.slice(0, 2).map((s: any) => s.brix as number)];
          const minB = Math.min(...recentBrix);
          const maxB = Math.max(...recentBrix);
          if (maxB - minB <= 0.3) {
            const oldestDate = new Date(prevSamples[Math.min(1, prevSamples.length - 1)].sampled_at);
            const daysDiff = (Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff >= 5) {
              anomalies.push({
                parameter: "Brix plateau", value: record.brix,
                expected_range_low: null, expected_range_high: null, severity: "warning",
                message: `Brix has plateaued at ~${record.brix}° for ${Math.round(daysDiff)} days — fermentation may be stuck`,
              });
            }
          }
        }
      }

      for (const a of anomalies) {
        await supabase.from("anomaly_flags").insert({
          org_id: org_id, vintage_id: vId,
          parameter: a.parameter, value: a.value,
          expected_range_low: a.expected_range_low, expected_range_high: a.expected_range_high,
        });

        const { data: profiles } = await supabase
          .from("profiles").select("id").eq("org_id", org_id);
        if (profiles) {
          for (const p of profiles) {
            await supabase.from("notifications").insert({
              org_id: org_id, user_id: p.id,
              message: `⚠️ Anomaly detected: ${a.message}`,
              type: "alert", channel: a.severity === "critical" ? "both" : "in_app",
            });
          }
        }
      }
    }

    if (type === "fermentation_log") {
      if (record.temp_f != null && record.temp_f > 90) {
        const vId = record.vintage_id;
        const org_id = orgId;
        if (vId && org_id) {
          await supabase.from("anomaly_flags").insert({
            org_id, vintage_id: vId,
            parameter: "Temp spike", value: record.temp_f,
            expected_range_low: null, expected_range_high: 90,
          });
          const { data: profiles } = await supabase
            .from("profiles").select("id").eq("org_id", org_id);
          if (profiles) {
            for (const p of profiles) {
              await supabase.from("notifications").insert({
                org_id, user_id: p.id,
                message: `⚠️ Fermentation temp spike: ${record.temp_f}°F exceeds 90°F limit`,
                type: "alert", channel: "both",
              });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ anomalies: anomalies.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-anomalies error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
