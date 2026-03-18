import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id, line_items, customer_email, customer_name, customer_address, success_url, cancel_url } = await req.json();

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get storefront config for this org
    const { data: config } = await supabase
      .from("storefront_config")
      .select("stripe_account_id")
      .eq("org_id", org_id)
      .single();

    // Build Stripe line items
    const stripeLineItems = line_items.map((item: any) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.label,
          description: `${item.variety || ""} ${item.vintage_year || ""}`.trim() || undefined,
        },
        unit_amount: Math.round(item.unit_price * 100),
      },
      quantity: item.quantity,
    }));

    // Create Stripe Checkout session via API
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", success_url);
    params.append("cancel_url", cancel_url);
    params.append("customer_email", customer_email);
    params.append("shipping_address_collection[allowed_countries][]", "US");

    stripeLineItems.forEach((item: any, i: number) => {
      params.append(`line_items[${i}][price_data][currency]`, item.price_data.currency);
      params.append(`line_items[${i}][price_data][product_data][name]`, item.price_data.product_data.name);
      if (item.price_data.product_data.description) {
        params.append(`line_items[${i}][price_data][product_data][description]`, item.price_data.product_data.description);
      }
      params.append(`line_items[${i}][price_data][unit_amount]`, String(item.price_data.unit_amount));
      params.append(`line_items[${i}][quantity]`, String(item.quantity));
    });

    // Store metadata for webhook
    params.append("metadata[org_id]", org_id);
    params.append("metadata[customer_name]", customer_name);
    params.append("metadata[customer_email]", customer_email);
    params.append("metadata[line_items_json]", JSON.stringify(line_items));
    if (customer_address) {
      params.append("metadata[customer_address]", JSON.stringify(customer_address));
    }

    const stripeResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await stripeResp.json();

    if (!stripeResp.ok) {
      throw new Error(session.error?.message || "Stripe session creation failed");
    }

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
