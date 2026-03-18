import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RuleMatch {
  ruleId: string;
  parameter: string;
  operator: string;
  threshold: number;
  channel: string;
  actualValue: number;
}

function checkThreshold(op: string, value: number, threshold: number): boolean {
  switch (op) {
    case "gte": return value >= threshold;
    case "lte": return value <= threshold;
    case "eq": return value === threshold;
    default: return false;
  }
}

const OP_SYMBOLS: Record<string, string> = { gte: "≥", lte: "≤", eq: "=" };

const PARAM_LABELS: Record<string, string> = {
  brix: "Brix", ph: "pH", ta: "TA", va: "VA",
  so2_free: "Free SO₂", so2_total: "Total SO₂",
  temp_f: "Temperature", gdd_cumulative: "GDD",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { type, record } = body; // type: "lab_sample" | "fermentation_log"

    if (!type || !record) {
      return new Response(JSON.stringify({ error: "Missing type or record" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine org_id
    let orgId: string;
    if (type === "lab_sample") {
      const { data: vintage } = await supabase
        .from("vintages")
        .select("org_id")
        .eq("id", record.vintage_id)
        .single();
      if (!vintage) throw new Error("Vintage not found");
      orgId = vintage.org_id;
    } else if (type === "fermentation_log") {
      const { data: vessel } = await supabase
        .from("fermentation_vessels")
        .select("org_id")
        .eq("id", record.vessel_id)
        .single();
      if (!vessel) throw new Error("Vessel not found");
      orgId = vessel.org_id;
    } else {
      return new Response(JSON.stringify({ error: "Unknown type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active rules for this org
    const { data: rules } = await supabase
      .from("alert_rules")
      .select("*")
      .eq("org_id", orgId)
      .eq("active", true);

    if (!rules?.length) {
      return new Response(JSON.stringify({ message: "No active rules" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map parameter to record value
    const paramMap: Record<string, string> = {
      brix: "brix", ph: "ph", ta: "ta", va: "va",
      so2_free: "so2_free", so2_total: "so2_total",
      temp_f: "temp_f",
    };

    const matches: RuleMatch[] = [];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const rule of rules) {
      // Check cooldown
      if (rule.last_triggered_at && new Date(rule.last_triggered_at) > twentyFourHoursAgo) {
        continue;
      }

      const fieldName = paramMap[rule.parameter];
      if (!fieldName) continue;

      const value = record[fieldName];
      if (value == null) continue;

      if (checkThreshold(rule.operator, value, rule.threshold)) {
        matches.push({
          ruleId: rule.id,
          parameter: rule.parameter,
          operator: rule.operator,
          threshold: rule.threshold,
          channel: rule.channel,
          actualValue: value,
        });
      }
    }

    if (matches.length === 0) {
      return new Response(JSON.stringify({ message: "No thresholds met" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all users in this org
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, push_subscription")
      .eq("org_id", orgId);

    const userIds = profiles?.map((p: any) => p.id) || [];

    for (const match of matches) {
      const label = PARAM_LABELS[match.parameter] || match.parameter;
      const op = OP_SYMBOLS[match.operator] || match.operator;
      const message = `Alert: ${label} reading of ${match.actualValue} has crossed threshold (${op} ${match.threshold}).`;

      // Write notification for each user
      const notifications = userIds.map((userId: string) => ({
        org_id: orgId,
        user_id: userId,
        message,
        type: "alert",
        channel: match.channel,
        read: false,
      }));

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
      }

      // Update last_triggered_at
      await supabase
        .from("alert_rules")
        .update({ last_triggered_at: now.toISOString() })
        .eq("id", match.ruleId);

      // Push notifications for push/both channels
      if (match.channel === "push" || match.channel === "both") {
        for (const profile of (profiles || [])) {
          const sub = profile.push_subscription as any;
          if (sub?.endpoint) {
            console.log(`Push notification for ${profile.id}: ${message}`);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, alertsFired: matches.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Evaluate alerts error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
