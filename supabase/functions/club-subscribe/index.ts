import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { org_id, club_id, customer_email, customer_name, shipping_address, success_url, cancel_url } = await req.json();

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get club details
    const { data: club, error: clubErr } = await supabase
      .from("wine_clubs")
      .select("*")
      .eq("id", club_id)
      .single();
    if (clubErr || !club) throw new Error("Club not found");

    // Map frequency to Stripe interval
    const intervalMap: Record<string, { interval: string; interval_count: number }> = {
      monthly: { interval: "month", interval_count: 1 },
      bimonthly: { interval: "month", interval_count: 2 },
      quarterly: { interval: "month", interval_count: 3 },
      twice_yearly: { interval: "month", interval_count: 6 },
      annual: { interval: "year", interval_count: 1 },
    };
    const freq = intervalMap[club.frequency] || { interval: "month", interval_count: 3 };

    // Create Stripe Checkout session for subscription
    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("success_url", success_url);
    params.append("cancel_url", cancel_url);
    params.append("customer_email", customer_email);
    params.append("line_items[0][price_data][currency]", "usd");
    params.append("line_items[0][price_data][product_data][name]", `${club.name} Wine Club`);
    params.append("line_items[0][price_data][product_data][description]", club.description || `${club.bottles_per_shipment} bottles per shipment`);
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(club.price_per_shipment * 100)));
    params.append("line_items[0][price_data][recurring][interval]", freq.interval);
    params.append("line_items[0][price_data][recurring][interval_count]", String(freq.interval_count));
    params.append("line_items[0][quantity]", "1");
    params.append("metadata[org_id]", org_id);
    params.append("metadata[club_id]", club_id);
    params.append("metadata[customer_name]", customer_name);
    params.append("metadata[customer_email]", customer_email);
    if (shipping_address) params.append("metadata[shipping_address]", JSON.stringify(shipping_address));

    const stripeResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await stripeResp.json();
    if (!stripeResp.ok) throw new Error(session.error?.message || "Stripe session creation failed");

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
