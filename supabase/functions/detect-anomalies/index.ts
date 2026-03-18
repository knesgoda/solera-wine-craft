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
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { type, record, vintageId, orgId } = await req.json();
    const anomalies: AnomalyResult[] = [];

    if (type === "lab_sample") {
      const vId = record.vintage_id || vintageId;
      if (!vId) throw new Error("vintage_id required");

      // Get org_id from vintage
      const { data: vintage } = await supabase
        .from("vintages")
        .select("org_id, year, blocks(name)")
        .eq("id", vId)
        .single();
      if (!vintage) throw new Error("Vintage not found");
      const org_id = orgId || vintage.org_id;

      // VA spike
      if (record.va != null && record.va > 0.8) {
        anomalies.push({
          parameter: "VA spike",
          value: record.va,
          expected_range_low: 0,
          expected_range_high: 0.8,
          message: `VA at ${record.va} g/L exceeds 0.8 g/L threshold for ${vintage.year} ${(vintage as any).blocks?.name || "vintage"}`,
        });
      }

      // SO2 low
      if (record.so2_free != null && record.so2_free < 25) {
        anomalies.push({
          parameter: "SO2 low",
          value: record.so2_free,
          expected_range_low: 25,
          expected_range_high: null,
          message: `Free SO₂ at ${record.so2_free} ppm is below 25 ppm for ${vintage.year} ${(vintage as any).blocks?.name || "vintage"}`,
        });
      }

      // pH high
      if (record.ph != null && record.ph > 3.8) {
        anomalies.push({
          parameter: "pH high",
          value: record.ph,
          expected_range_low: null,
          expected_range_high: 3.8,
          message: `pH at ${record.ph} exceeds 3.8 for ${vintage.year} ${(vintage as any).blocks?.name || "vintage"}`,
        });
      }

      // Brix checks - need previous samples
      if (record.brix != null) {
        const { data: prevSamples } = await supabase
          .from("lab_samples")
          .select("brix, sampled_at")
          .eq("vintage_id", vId)
          .not("brix", "is", null)
          .order("sampled_at", { ascending: false })
          .limit(4);

        if (prevSamples && prevSamples.length >= 1) {
          // Unexpected Brix drop
          const prevBrix = prevSamples[0].brix as number;
          if (prevBrix - record.brix > 3.0) {
            anomalies.push({
              parameter: "Brix drop",
              value: record.brix,
              expected_range_low: prevBrix - 3.0,
              expected_range_high: null,
              message: `Brix dropped ${(prevBrix - record.brix).toFixed(1)}° (from ${prevBrix} to ${record.brix}) in a single reading`,
            });
          }
        }

        // Brix plateau: last 3 readings within 0.3 of each other over 5+ days
        if (prevSamples && prevSamples.length >= 2) {
          const recentBrix = [record.brix, ...prevSamples.slice(0, 2).map((s: any) => s.brix as number)];
          const minB = Math.min(...recentBrix);
          const maxB = Math.max(...recentBrix);
          if (maxB - minB <= 0.3) {
            const oldestDate = new Date(prevSamples[Math.min(1, prevSamples.length - 1)].sampled_at);
            const daysDiff = (Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff >= 5) {
              anomalies.push({
                parameter: "Brix plateau",
                value: record.brix,
                expected_range_low: null,
                expected_range_high: null,
                message: `Brix has plateaued at ~${record.brix}° for ${Math.round(daysDiff)} days — fermentation may be stuck`,
              });
            }
          }
        }
      }

      // Write anomalies
      for (const a of anomalies) {
        await supabase.from("anomaly_flags").insert({
          org_id: org_id,
          vintage_id: vId,
          parameter: a.parameter,
          value: a.value,
          expected_range_low: a.expected_range_low,
          expected_range_high: a.expected_range_high,
        });

        // Get all org users for notifications
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("org_id", org_id);

        if (profiles) {
          for (const p of profiles) {
            await supabase.from("notifications").insert({
              org_id: org_id,
              user_id: p.id,
              message: `⚠️ Anomaly detected: ${a.message}`,
              type: "alert",
              channel: "both",
            });
          }
        }
      }
    }

    if (type === "fermentation_log") {
      // Temp spike
      if (record.temp_f != null && record.temp_f > 90) {
        const vId = record.vintage_id;
        const org_id = orgId;
        if (vId && org_id) {
          await supabase.from("anomaly_flags").insert({
            org_id,
            vintage_id: vId,
            parameter: "Temp spike",
            value: record.temp_f,
            expected_range_low: null,
            expected_range_high: 90,
          });

          const { data: profiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("org_id", org_id);
          if (profiles) {
            for (const p of profiles) {
              await supabase.from("notifications").insert({
                org_id,
                user_id: p.id,
                message: `⚠️ Fermentation temp spike: ${record.temp_f}°F exceeds 90°F limit`,
                type: "alert",
                channel: "both",
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
