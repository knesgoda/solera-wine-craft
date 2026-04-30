import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
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
        .select("brix, ph, ta, va, so2_free, so2_total, alcohol, rs, sampled_at")
        .eq("vintage_id", v.id)
        .order("sampled_at", { ascending: false })
        .limit(1);
      const lab = latestLab?.[0];
      let line = `${v.year} ${v.blocks?.name || "Unknown block"} (${v.blocks?.variety || "Unknown variety"}) — ${v.status}`;
      if (v.tons_harvested) line += `, ${v.tons_harvested} tons`;
      if (lab) {
        line += ` | Latest lab (${lab.sampled_at?.split("T")[0]}): Brix=${lab.brix ?? "—"}, pH=${lab.ph ?? "—"}, TA=${lab.ta ?? "—"}, VA=${lab.va ?? "—"}, Free SO₂=${lab.so2_free ?? "—"}, Total SO₂=${lab.so2_total ?? "—"}, Alc=${lab.alcohol ?? "—"}%, RS=${lab.rs ?? "—"}`;
      }
      vintageLines.push(line);
    }
    parts.push(`ACTIVE VINTAGES:\n${vintageLines.join("\n")}`);
  }

  // Blocks with GDD and lifecycle
  const { data: vineyards } = await supabase
    .from("vineyards")
    .select("id, name, region")
    .eq("org_id", orgId);

  if (vineyards?.length) {
    const { data: blocks } = await supabase
      .from("blocks")
      .select("name, variety, lifecycle_stage, status, vineyard_id, acres, clone, rootstock")
      .in("vineyard_id", vineyards.map((v: any) => v.id))
      .eq("status", "active");

    if (blocks?.length) {
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
        return `${b.name} (${b.variety || "—"}${b.clone ? `, clone: ${b.clone}` : ""}${b.rootstock ? `, rootstock: ${b.rootstock}` : ""}) at ${vyName} — ${b.lifecycle_stage || "—"}${b.acres ? `, ${b.acres} acres` : ""}${gdd ? `, GDD: ${gdd}` : ""}`;
      });
      parts.push(`VINEYARDS & BLOCKS:\n${blockLines.join("\n")}`);
    }
  }

  // Fermentation vessels with current readings
  const { data: vessels } = await supabase
    .from("fermentation_vessels")
    .select("id, name, material, capacity_liters, temp_controlled, vintage_id, vintages(year, blocks(name, variety))")
    .eq("org_id", orgId)
    .not("vintage_id", "is", null);

  if (vessels?.length) {
    const vesselLines: string[] = [];
    for (const v of vessels) {
      const { data: latestLog } = await supabase
        .from("fermentation_logs")
        .select("brix, temp_f, logged_at")
        .eq("vessel_id", v.id)
        .order("logged_at", { ascending: false })
        .limit(1);
      const log = latestLog?.[0];
      const contents = v.vintages ? `${(v.vintages as any).year} ${(v.vintages as any).blocks?.name || ""}` : "Unknown";
      let line = `${v.name} (${v.material || "—"}, ${v.capacity_liters ? Math.round(v.capacity_liters / 3.785) + " gal" : "—"}): ${contents}`;
      if (log) {
        line += ` | Brix=${log.brix ?? "—"}, Temp=${log.temp_f ?? "—"}°F (${log.logged_at?.split("T")[0]})`;
      }
      vesselLines.push(line);
    }
    parts.push(`FERMENTATION VESSELS:\n${vesselLines.join("\n")}`);
  }

  // Barrel inventory summary
  const { data: barrels } = await supabase
    .from("barrels")
    .select("cooperage, toast, type, status, vintage_id")
    .eq("org_id", orgId)
    .eq("status", "filled");

  if (barrels?.length) {
    const summary: Record<string, number> = {};
    for (const b of barrels) {
      const key = `${b.cooperage || "Unknown"} ${b.toast || "unknown toast"} ${b.type || ""}`.trim();
      summary[key] = (summary[key] || 0) + 1;
    }
    const barrelLines = Object.entries(summary).map(([k, v]) => `${v} × ${k}`);
    parts.push(`BARRELS (${barrels.length} filled total):\n${barrelLines.join("\n")}`);
  }

  // Tasks (last 30 days completed + open/overdue)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: openTasks } = await supabase
    .from("tasks")
    .select("title, status, due_date, assigned_to")
    .eq("org_id", orgId)
    .in("status", ["pending", "in_progress"])
    .order("due_date", { ascending: true })
    .limit(20);

  const { data: completedTasks } = await supabase
    .from("tasks")
    .select("title, due_date")
    .eq("org_id", orgId)
    .eq("status", "complete")
    .gte("updated_at", thirtyDaysAgo)
    .limit(10);

  if (openTasks?.length || completedTasks?.length) {
    const taskLines: string[] = [];
    if (openTasks?.length) {
      const now = new Date().toISOString().split("T")[0];
      taskLines.push("Open/Overdue:");
      for (const t of openTasks) {
        const overdue = t.due_date && t.due_date < now ? " ⚠️ OVERDUE" : "";
        taskLines.push(`- ${t.title} (due ${t.due_date || "no date"})${overdue}`);
      }
    }
    if (completedTasks?.length) {
      taskLines.push(`Recently completed (${completedTasks.length}):`);
      for (const t of completedTasks) {
        taskLines.push(`- ${t.title}`);
      }
    }
    parts.push(`TASKS:\n${taskLines.join("\n")}`);
  }

  // Weather summary (last 30 days)
  const weatherStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: weather } = await supabase
    .from("weather_readings")
    .select("temp_max_f, temp_min_f, precip_inches, gdd_daily, vineyard_id")
    .eq("org_id", orgId)
    .gte("recorded_at", weatherStart);

  if (weather?.length) {
    const avgHigh = (weather.reduce((s: number, w: any) => s + (w.temp_max_f || 0), 0) / weather.length).toFixed(1);
    const avgLow = (weather.reduce((s: number, w: any) => s + (w.temp_min_f || 0), 0) / weather.length).toFixed(1);
    const totalPrecip = weather.reduce((s: number, w: any) => s + (w.precip_inches || 0), 0).toFixed(2);
    const gddAccum = weather.reduce((s: number, w: any) => s + (w.gdd_daily || 0), 0).toFixed(1);
    parts.push(`WEATHER (last 30 days): Avg high ${avgHigh}°F, Avg low ${avgLow}°F, Total precip ${totalPrecip}", GDD accumulated ${gddAccum}`);
  }

  // TTB additions (last 30 days)
  const vintageIds = (vintages || []).map((v: any) => v.id);
  if (vintageIds.length > 0) {
    const { data: additions } = await supabase
      .from("addition_logs")
      .select("addition_type, amount, unit, added_at, vintage_id, vintages(year, blocks(name))")
      .in("vintage_id", vintageIds)
      .gte("added_at", thirtyDaysAgo)
      .order("added_at", { ascending: false })
      .limit(20);

    if (additions?.length) {
      const addLines = additions.map((a: any) =>
        `${a.added_at?.split("T")[0]} ${a.vintages?.year || ""} ${a.vintages?.blocks?.name || ""}: ${a.addition_type} ${a.amount} ${a.unit || ""}`
      );
      parts.push(`TTB ADDITIONS (last 30 days):\n${addLines.join("\n")}`);
    }
  }

  // Recent lab samples
  let recentLabs: any[] = [];
  if (vintageIds.length > 0) {
    const { data } = await supabase
      .from("lab_samples")
      .select("sampled_at, brix, ph, ta, va, so2_free, so2_total, alcohol, rs, vintage_id, vintages(year, blocks(name, variety))")
      .in("vintage_id", vintageIds)
      .order("sampled_at", { ascending: false })
      .limit(10);
    recentLabs = data || [];
  }

  if (recentLabs?.length) {
    const labLines = recentLabs.map((l: any) =>
      `${l.sampled_at?.split("T")[0]} ${l.vintages?.year || ""} ${l.vintages?.blocks?.name || ""}: Brix=${l.brix ?? "—"} pH=${l.ph ?? "—"} TA=${l.ta ?? "—"} VA=${l.va ?? "—"} SO₂f=${l.so2_free ?? "—"} Alc=${l.alcohol ?? "—"}`
    );
    parts.push(`RECENT LAB SAMPLES:\n${labLines.join("\n")}`);
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
    parts.push(`ACTIVE ALERT THRESHOLDS:\n${alertLines.join("\n")}`);
  }

  // Anomaly flags (unresolved)
  const { data: anomalies } = await supabase
    .from("anomaly_flags")
    .select("parameter, value, expected_range_low, expected_range_high, flagged_at, vintages(year, blocks(name))")
    .eq("org_id", orgId)
    .eq("resolved", false)
    .order("flagged_at", { ascending: false })
    .limit(10);

  if (anomalies?.length) {
    const anomalyLines = anomalies.map((a: any) =>
      `${a.flagged_at?.split("T")[0]} ${a.vintages?.year || ""} ${a.vintages?.blocks?.name || ""}: ${a.parameter}=${a.value} (expected ${a.expected_range_low ?? "—"}–${a.expected_range_high ?? "—"})`
    );
    parts.push(`UNRESOLVED ANOMALIES:\n${anomalyLines.join("\n")}`);
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
    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error("Unauthorized");
    }

    // P0: Reject client portal users — Ask Solera is winery-only.
    // This prevents dual-role accounts from reading full winery context via the client session.
    const { data: clientUserRow } = await serviceClient
      .from("client_users")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (clientUserRow) {
      console.warn(`ask-solera blocked: caller ${user.id} is a client portal user`);
      return new Response(
        JSON.stringify({ error: "Ask Solera is not available from the client portal." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user org
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();
    if (!profile?.org_id) throw new Error("User has no organization");

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
      return new Response(JSON.stringify({ error: "Ask Solera requires a Growth or Enterprise plan." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, conversationId } = await req.json();
    const validMessages =
      Array.isArray(messages) &&
      messages.length <= 50 &&
      messages.every((message: any) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.length <= 4000
      );

    if (!validMessages) {
      return new Response(JSON.stringify({ error: "Invalid message format." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`Ask Solera request: org=${profile.org_id}, messages=${messages?.length}, conv=${conversationId}`);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not configured");
      throw new Error("AI is temporarily unavailable. Please try again later or contact support.");
    }

    // Log conversation for training — failures must never block the response
    let loggedConversationId: string | null = null;
    try {
      // If caller supplied a conversationId, validate it belongs to them
      if (conversationId) {
        const { data: existingConvo } = await serviceClient
          .from("ai_conversations")
          .select("id")
          .eq("id", conversationId)
          .eq("org_id", profile.org_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existingConvo) {
          loggedConversationId = existingConvo.id;
        }
        // If not found/not owned, fall through to create a new conversation below
      }

      if (!loggedConversationId) {
        const { data: convoRow } = await serviceClient
          .from("ai_conversations")
          .insert({
            org_id: profile.org_id,
            user_id: user.id,
            started_at: new Date().toISOString(),
            message_count: messages.length + 1,
            model: "claude-sonnet-4-20250514",
          })
          .select("id")
          .single();
        loggedConversationId = convoRow?.id || null;
      }
    } catch (e) {
      console.error("Failed to log ai_conversations row:", e);
    }

    if (loggedConversationId) {
      try {
        const userMessages = messages.map((m: any) => ({
          conversation_id: loggedConversationId,
          org_id: profile.org_id,
          role: m.role,
          content: m.content,
          created_at: new Date().toISOString(),
        }));
        await serviceClient.from("ai_messages").insert(userMessages);
      } catch (e) {
        console.error("Failed to log incoming messages:", e);
      }
    }

    // Build winery context
    let wineryContext = await buildWineryContext(serviceClient, profile.org_id);
    const MAX_CONTEXT_CHARS = 8000;
    if (wineryContext.length > MAX_CONTEXT_CHARS) {
      wineryContext = wineryContext.slice(0, MAX_CONTEXT_CHARS) + "\n\n[context truncated]";
    }
    console.log(`Winery context built: ${wineryContext.length} chars`);

    const systemPrompt = `You are Ask Solera, an expert AI winery assistant built into the Solera winery management platform. You have access to real-time data from this winery.

Answer questions about harvest timing, lab results, vineyard conditions, cellar operations, and winery management. Always cite the specific data you are using in your answer. Be concise and practical — winemakers are busy.

If you don't have enough data to answer confidently, say so clearly and suggest where to log it in Solera.

CURRENT WINERY DATA:
${wineryContext}`;

    console.log("Calling Anthropic API...");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    });

    console.log(`Anthropic response status: ${response.status}`);

    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "AI is temporarily unavailable. Please try again later or contact support." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI is temporarily unavailable. Please try again later or contact support.");
    }

    const streamHeaders = {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      ...(loggedConversationId ? { "x-conversation-id": loggedConversationId } : {}),
    };

    // Stream the response and capture the full text for training logging
    if (!loggedConversationId || !response.body) {
      return new Response(response.body, { headers: streamHeaders });
    }

    // Tee the stream: one branch goes to the client, the other is consumed to capture assistant text
    const [clientStream, captureStream] = response.body.tee();

    // Consume captureStream asynchronously to log the assistant message
    (async () => {
      try {
        const reader = captureStream.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Extract text deltas from SSE stream
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const json = JSON.parse(line.slice(6));
                if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
                  fullText += json.delta.text || "";
                }
              } catch { /* ignore parse errors on non-JSON lines */ }
            }
          }
        }
        if (fullText && loggedConversationId) {
          await serviceClient.from("ai_messages").insert({
            conversation_id: loggedConversationId,
            org_id: profile.org_id,
            role: "assistant",
            content: fullText,
            created_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error("Failed to log assistant message:", e);
      }
    })();

    return new Response(clientStream, { headers: streamHeaders });
  } catch (e) {
    console.error("ask-solera error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
