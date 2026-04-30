import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, new_status, tracking_number } = await req.json();
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe not configured");

    const authHeader = req.headers.get("authorization");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller identity
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch caller's org
    const { data: callerProfile } = await serviceClient
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();
    if (!callerProfile?.org_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerOrgId = callerProfile.org_id;

    // Fetch order and verify ownership
    const { data: orderOwner } = await serviceClient
      .from("orders")
      .select("org_id")
      .eq("id", order_id)
      .single();
    if (!orderOwner) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (callerOrgId !== orderOwner.org_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service client for all subsequent reads (ownership verified)
    const supabase = serviceClient;

    // Get order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Order not found");

    // Handle refund
    if (new_status === "refunded" && order.stripe_payment_intent_id) {
      const params = new URLSearchParams();
      params.append("payment_intent", order.stripe_payment_intent_id);

      const refundResp = await fetch("https://api.stripe.com/v1/refunds", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const refund = await refundResp.json();
      if (!refundResp.ok) throw new Error(refund.error?.message || "Refund failed");
    }

    // Update order
    const updateData: any = { status: new_status };
    if (new_status === "shipped") {
      updateData.shipped_at = new Date().toISOString();
      if (tracking_number) updateData.tracking_number = tracking_number;
    }

    await supabase.from("orders").update(updateData).eq("id", order_id);

    // Send shipping notification
    if (new_status === "shipped") {
      await serviceClient.from("notifications").insert({
        org_id: order.org_id,
        user_id: (await serviceClient.from("profiles").select("id").eq("org_id", order.org_id).limit(1)).data?.[0]?.id,
        message: `Order shipped to ${order.customer_name} — Tracking: ${tracking_number || "N/A"}`,
        type: "system",
        channel: "email",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
