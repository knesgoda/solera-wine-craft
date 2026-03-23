import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paddleKey = Deno.env.get("PADDLE_API_KEY");
    if (!paddleKey) throw new Error("Paddle API key not configured");

    const { action, org_id, new_price_id, billing_mode } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("paddle_subscription_id")
      .eq("id", org_id)
      .single();

    if (orgErr || !org?.paddle_subscription_id) {
      return new Response(
        JSON.stringify({ error: "No active subscription found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subId = org.paddle_subscription_id;

    if (action === "change_plan") {
      // Update subscription to new price
      const prorationMode = billing_mode || "prorated_immediately";
      const paddleResp = await fetch(`https://api.paddle.com/subscriptions/${subId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${paddleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ price_id: new_price_id, quantity: 1 }],
          proration_billing_mode: prorationMode,
        }),
      });

      const result = await paddleResp.json();
      if (!paddleResp.ok) {
        throw new Error(result.error?.detail || "Failed to update subscription");
      }

      return new Response(JSON.stringify({ success: true, data: result.data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel") {
      const paddleResp = await fetch(`https://api.paddle.com/subscriptions/${subId}/cancel`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paddleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          effective_from: "next_billing_period",
        }),
      });

      const result = await paddleResp.json();
      if (!paddleResp.ok) {
        throw new Error(result.error?.detail || "Failed to cancel subscription");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'change_plan' or 'cancel'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
