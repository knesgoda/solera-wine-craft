import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RuleMatch {
  ruleId: string;
  parameter: string;
  operator: string;
  threshold: number;
  channel: string;
  actualValue: number;
  message: string;
  linkUrl?: string;
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
  ripening_divergence: "Ripening Divergence",
};

async function checkDivergenceRules(
  supabase: any,
  orgId: string,
  rules: any[],
  record: any,
  now: Date,
  twentyFourHoursAgo: Date,
): Promise<RuleMatch[]> {
  const matches: RuleMatch[] = [];

  // Get the vintage for this lab sample to find its block
  const { data: vintage } = await supabase
    .from("vintages")
    .select("id, block_id, year, org_id")
    .eq("id", record.vintage_id)
    .single();

  if (!vintage?.block_id) return matches;

  // Get the block to find its variety
  const { data: block } = await supabase
    .from("blocks")
    .select("id, variety, name, clone, rootstock, vineyard_id")
    .eq("id", vintage.block_id)
    .single();

  if (!block?.variety) return matches;

  // Check each ripening_divergence rule
  for (const rule of rules) {
    // 24-hour cooldown: last_triggered_at and twentyFourHoursAgo are both UTC — this is intentional.
    // UTC comparison is correct here because we're measuring elapsed time, not local calendar dates.
    if (rule.last_triggered_at && new Date(rule.last_triggered_at) > twentyFourHoursAgo) continue;
    if (rule.variety_filter && rule.variety_filter !== block.variety) continue;

    const threshold = rule.brix_spread_threshold ?? 4.0;

    // Get all blocks of this variety in this org
    const { data: varietyBlocks } = await supabase
      .from("blocks")
      .select("id, name, clone, rootstock, vineyard_id, vineyards!inner(org_id)")
      .eq("vineyards.org_id", orgId)
      .eq("variety", block.variety)
      .eq("status", "active");

    if (!varietyBlocks || varietyBlocks.length < 2) continue;

    const blockIds = varietyBlocks.map((b: any) => b.id);

    // Get active vintages for these blocks
    const { data: vintages } = await supabase
      .from("vintages")
      .select("id, block_id")
      .in("block_id", blockIds)
      .order("year", { ascending: false });

    if (!vintages?.length) continue;

    // Latest vintage per block
    const vintageByBlock: Record<string, string> = {};
    for (const v of vintages) {
      if (v.block_id && !vintageByBlock[v.block_id]) {
        vintageByBlock[v.block_id] = v.id;
      }
    }

    const vintageIds = Object.values(vintageByBlock);

    // Get latest Brix reading for each vintage
    const blockBrix: { blockId: string; name: string; clone: string | null; rootstock: string | null; brix: number }[] = [];

    for (const [bId, vId] of Object.entries(vintageByBlock)) {
      const { data: latestSample } = await supabase
        .from("lab_samples")
        .select("brix")
        .eq("vintage_id", vId)
        .not("brix", "is", null)
        .order("sampled_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSample?.brix != null) {
        const bInfo = varietyBlocks.find((b: any) => b.id === bId);
        blockBrix.push({
          blockId: bId,
          name: bInfo?.name || bId,
          clone: bInfo?.clone,
          rootstock: bInfo?.rootstock,
          brix: latestSample.brix,
        });
      }
    }

    if (blockBrix.length < 2) continue;

    blockBrix.sort((a, b) => b.brix - a.brix);
    const fastest = blockBrix[0];
    const slowest = blockBrix[blockBrix.length - 1];
    const spread = Math.round((fastest.brix - slowest.brix) * 10) / 10;

    if (spread >= threshold) {
      const fastDesc = `${fastest.name} (Clone ${fastest.clone || "—"} / Rootstock ${fastest.rootstock || "—"})`;
      const slowDesc = `${slowest.name} (Clone ${slowest.clone || "—"} / Rootstock ${slowest.rootstock || "—"})`;
      const message = `Ripening divergence alert: ${block.variety} blocks show ${spread}° Brix spread. ${fastDesc} at ${fastest.brix}° vs ${slowDesc} at ${slowest.brix}°. Review ripening tracker for details.`;

      matches.push({
        ruleId: rule.id,
        parameter: "ripening_divergence",
        operator: "gte",
        threshold,
        channel: rule.channel,
        actualValue: spread,
        message,
        linkUrl: "https://solera.vin/ripening-comparison",
      });
    }
  }

  return matches;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { type, record } = body;

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

    // Separate standard rules and divergence rules
    const standardRules = rules.filter((r: any) => r.parameter !== "ripening_divergence");
    const divergenceRules = rules.filter((r: any) => r.parameter === "ripening_divergence");

    // Map parameter to record value
    const paramMap: Record<string, string> = {
      brix: "brix", ph: "ph", ta: "ta", va: "va",
      so2_free: "so2_free", so2_total: "so2_total",
      temp_f: "temp_f",
    };

    const matches: RuleMatch[] = [];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Standard threshold rules
    for (const rule of standardRules) {
      if (rule.last_triggered_at && new Date(rule.last_triggered_at) > twentyFourHoursAgo) continue;

      const fieldName = paramMap[rule.parameter];
      if (!fieldName) continue;

      const value = record[fieldName];
      if (value == null) continue;

      if (checkThreshold(rule.operator, value, rule.threshold)) {
        const label = PARAM_LABELS[rule.parameter] || rule.parameter;
        const op = OP_SYMBOLS[rule.operator] || rule.operator;
        matches.push({
          ruleId: rule.id,
          parameter: rule.parameter,
          operator: rule.operator,
          threshold: rule.threshold,
          channel: rule.channel,
          actualValue: value,
          message: `Alert: ${label} reading of ${value} has crossed threshold (${op} ${rule.threshold}).`,
        });
      }
    }

    // Divergence rules (only for lab_sample type, Pro+ tier only)
    if (type === "lab_sample" && divergenceRules.length > 0) {
      const TIER_ORDER = ["hobbyist", "small_boutique", "mid_size", "enterprise"];
      const { data: org } = await supabase
        .from("organizations")
        .select("tier")
        .eq("id", orgId)
        .single();
      const orgTier = org?.tier || "hobbyist";
      const tierIdx = TIER_ORDER.indexOf(orgTier);
      if (tierIdx < 1) {
        // Hobbyist tier — skip divergence alerts
      } else {
      const divergenceMatches = await checkDivergenceRules(
        supabase, orgId, divergenceRules, record, now, twentyFourHoursAgo
      );
        matches.push(...divergenceMatches);
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
      .select("id, email, push_subscription")
      .eq("org_id", orgId);

    const orgUsers = (profiles || []).filter((p: any) => p.email);
    const userIds = profiles?.map((p: any) => p.id) || [];
    const resendKey = Deno.env.get("RESEND_API_KEY");

    for (const match of matches) {
      // Write notification for each user
      const notifications = userIds.map((userId: string) => ({
        org_id: orgId,
        user_id: userId,
        message: match.message,
        type: "alert",
        channel: match.channel,
        read: false,
        link_url: match.linkUrl || null,
      }));

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
      }

      // Update last_triggered_at
      await supabase
        .from("alert_rules")
        .update({ last_triggered_at: now.toISOString() })
        .eq("id", match.ruleId);

      // Send emails for email/both channels
      if (match.channel === "email" || match.channel === "both") {
        if (resendKey) {
          const label = PARAM_LABELS[match.parameter] || match.parameter;
          const linkButton = match.linkUrl
            ? `<a href="${match.linkUrl}" style="display: inline-block; background: #6B1B2A; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600;">View Ripening Tracker</a>`
            : `<a href="https://solera.vin/dashboard" style="display: inline-block; background: #6B1B2A; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600;">View in Solera</a>`;

          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
              <h2 style="color: #6B1B2A; font-size: 20px; margin: 0 0 16px;">⚠️ ${label} Alert</h2>
              <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px; color: #333;">${match.message}</p>
              ${linkButton}
              <p style="font-size: 12px; color: #999; margin: 32px 0 0;">Solera — Alert Notifications</p>
            </div>
          `;

          for (const p of orgUsers) {
            try {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "Solera Alerts <notifications@solera.vin>",
                  to: [p.email],
                  subject: `⚠️ ${label} Alert`,
                  html: emailHtml,
                }),
              });
            } catch (e) {
              console.error(`Email error for ${p.id}:`, e);
            }
          }
        } else {
          console.warn("RESEND_API_KEY not configured — skipping alert emails");
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