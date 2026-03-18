import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BILLING_PLANS: Record<string, { amount: number; label: string; description: string }> = {
  small_boutique: {
    amount: 6900,
    label: "Pro",
    description: "Solera Pro plan subscription",
  },
  mid_size: {
    amount: 12900,
    label: "Growth",
    description: "Solera Growth plan subscription",
  },
  enterprise: {
    amount: 39900,
    label: "Enterprise",
    description: "Solera Enterprise plan subscription",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (body.action === "upgrade") {
      return await handleBillingUpgrade({ req, body, stripeKey, supabase });
    }

    return await handleStorefrontCheckout({ body, stripeKey });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Stripe session creation failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleBillingUpgrade({
  req,
  body,
  stripeKey,
  supabase,
}: {
  req: Request;
  body: any;
  stripeKey: string;
  supabase: any;
}) {
  const { org_id, target_tier } = body;

  if (!org_id || !target_tier) {
    throw new Error("Missing org_id or target_tier");
  }

  const plan = BILLING_PLANS[target_tier];
  if (!plan) {
    throw new Error("Invalid billing tier");
  }

  const [{ data: org, error: orgError }, { data: profile, error: profileError }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, stripe_customer_id")
      .eq("id", org_id)
      .single(),
    supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("org_id", org_id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (orgError || !org) {
    throw new Error("Organization not found");
  }

  if (profileError || !profile?.email) {
    throw new Error("No billing contact found for organization");
  }

  const origin = req.headers.get("origin") || "https://solera-wine-craft.lovable.app";
  const successUrl = body.success_url || `${origin}/settings/billing?checkout=success`;
  const cancelUrl = body.cancel_url || `${origin}/settings/billing?checkout=cancelled`;
  const customerName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || org.name;

  const params = new URLSearchParams();
  params.append("mode", "subscription");
  params.append("success_url", successUrl);
  params.append("cancel_url", cancelUrl);
  params.append("line_items[0][price_data][currency]", "usd");
  params.append("line_items[0][price_data][product_data][name]", `Solera ${plan.label}`);
  params.append("line_items[0][price_data][product_data][description]", plan.description);
  params.append("line_items[0][price_data][unit_amount]", String(plan.amount));
  params.append("line_items[0][price_data][recurring][interval]", "month");
  params.append("line_items[0][quantity]", "1");
  params.append("metadata[org_id]", org_id);
  params.append("metadata[target_tier]", target_tier);
  params.append("metadata[customer_email]", profile.email);
  params.append("metadata[customer_name]", customerName);
  params.append("subscription_data[metadata][org_id]", org_id);
  params.append("subscription_data[metadata][target_tier]", target_tier);

  if (org.stripe_customer_id) {
    params.append("customer", org.stripe_customer_id);
  } else {
    params.append("customer_email", profile.email);
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
}

async function handleStorefrontCheckout({ body, stripeKey }: { body: any; stripeKey: string }) {
  const { org_id, line_items, customer_email, customer_name, customer_address, success_url, cancel_url } = body;

  if (!org_id || !Array.isArray(line_items) || line_items.length === 0) {
    throw new Error("Missing checkout line items");
  }

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
}

