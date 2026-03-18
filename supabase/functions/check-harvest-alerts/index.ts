import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function linearSlope(points: { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all in-progress vintages with block_id
    const { data: vintages, error: vErr } = await supabase
      .from("vintages")
      .select("id, block_id, org_id")
      .eq("status", "in_progress")
      .not("block_id", "is", null);

    if (vErr) throw vErr;
    if (!vintages?.length) {
      return new Response(JSON.stringify({ message: "No active vintages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const alerts: any[] = [];
    const weekStart = getWeekStart(new Date());

    for (const v of vintages) {
      // Check if alert already sent this week
      const { data: existing } = await supabase
        .from("harvest_alerts_sent")
        .select("id")
        .eq("block_id", v.block_id!)
        .eq("vintage_id", v.id)
        .eq("week_start", weekStart)
        .limit(1);

      if (existing?.length) continue;

      // Get brix samples
      const { data: samples } = await supabase
        .from("lab_samples")
        .select("brix, sampled_at")
        .eq("vintage_id", v.id)
        .not("brix", "is", null)
        .order("sampled_at", { ascending: true });

      const brixSamples = (samples || []).filter((s: any) => s.brix != null);
      if (brixSamples.length < 2) continue;

      const currentBrix = brixSamples[brixSamples.length - 1].brix;
      const last3 = brixSamples.slice(-3);
      const baseDate = new Date(last3[0].sampled_at);
      const points = last3.map((s: any) => ({
        x: Math.round((new Date(s.sampled_at).getTime() - baseDate.getTime()) / 86400000),
        y: s.brix,
      }));
      const slope = linearSlope(points);

      let predictedDays: number | null = null;
      if (currentBrix >= 24) {
        predictedDays = 0;
      } else if (slope > 0) {
        predictedDays = Math.ceil((24 - currentBrix) / slope);
      }

      if (predictedDays == null || predictedDays > 7) continue;

      // Get block and vineyard info
      const { data: block } = await supabase
        .from("blocks")
        .select("name, vineyard_id")
        .eq("id", v.block_id!)
        .single();

      if (!block) continue;

      const { data: vineyard } = await supabase
        .from("vineyards")
        .select("name")
        .eq("id", block.vineyard_id)
        .single();

      const predictedDate = new Date();
      predictedDate.setDate(predictedDate.getDate() + predictedDays);
      const dateStr = predictedDate.toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });

      const alertText = `Block ${block.name} at ${vineyard?.name || "vineyard"} is projected to enter its prime harvest window on ${dateStr}. Current Brix: ${currentBrix.toFixed(1)}.`;

      // Record the alert
      await supabase.from("harvest_alerts_sent").insert({
        org_id: v.org_id,
        block_id: v.block_id!,
        vintage_id: v.id,
        week_start: weekStart,
      });

      // Send push notifications to org members
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, push_subscription")
        .eq("org_id", v.org_id)
        .not("push_subscription", "is", null);

      if (profiles?.length) {
        for (const profile of profiles) {
          try {
            const sub = profile.push_subscription as any;
            if (sub?.endpoint) {
              // Web Push would be sent here via web-push library
              // For now we log it
              console.log(`Push alert for user ${profile.id}: ${alertText}`);
            }
          } catch (e) {
            console.error("Push error:", e);
          }
        }
      }

      alerts.push({
        block: block.name,
        vineyard: vineyard?.name,
        predictedDate: dateStr,
        currentBrix,
      });
    }

    return new Response(JSON.stringify({ success: true, alertsSent: alerts.length, alerts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Harvest alert error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
