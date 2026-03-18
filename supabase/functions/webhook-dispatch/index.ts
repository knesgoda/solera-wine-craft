import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hmacSign(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { event_type, org_id, payload } = body;

    if (!event_type || !org_id) {
      return new Response(JSON.stringify({ error: "event_type and org_id required" }), { status: 400, headers: corsHeaders });
    }

    // Find matching active subscriptions
    const { data: subs } = await supabase
      .from("webhook_subscriptions")
      .select("*")
      .eq("org_id", org_id)
      .eq("event_type", event_type)
      .eq("active", true);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ dispatched: 0 }), { headers: corsHeaders });
    }

    const results = [];
    const timestamp = new Date().toISOString();

    for (const sub of subs) {
      const eventPayload = JSON.stringify({
        event: event_type,
        data: payload,
        timestamp,
        subscription_id: sub.id,
      });

      const signature = await hmacSign(sub.secret_hash, eventPayload);

      let responseCode = 0;
      let responseBody = "";
      let success = false;

      try {
        const res = await fetch(sub.endpoint_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Solera-Event": event_type,
            "X-Solera-Signature": signature,
            "X-Solera-Timestamp": timestamp,
          },
          body: eventPayload,
        });
        responseCode = res.status;
        responseBody = await res.text();
        success = res.ok;
      } catch (err) {
        responseBody = String(err);
      }

      // Log delivery
      await supabase.from("webhook_delivery_logs").insert({
        subscription_id: sub.id,
        response_code: responseCode,
        response_body: responseBody.substring(0, 1000),
        success,
      });

      // Update subscription
      if (success) {
        await supabase.from("webhook_subscriptions").update({
          last_triggered_at: timestamp,
          failure_count: 0,
        }).eq("id", sub.id);
      } else {
        const newFailCount = (sub.failure_count || 0) + 1;
        const updates: Record<string, unknown> = {
          failure_count: newFailCount,
          last_triggered_at: timestamp,
        };
        if (newFailCount >= 10) {
          updates.active = false;
        }
        await supabase.from("webhook_subscriptions").update(updates).eq("id", sub.id);
      }

      results.push({ subscription_id: sub.id, success, response_code: responseCode });
    }

    return new Response(JSON.stringify({ dispatched: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
