import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const paddleKey = Deno.env.get("PADDLE_API_KEY");
    if (!paddleKey) throw new Error("Paddle not configured");

    const { org_id, line_items, customer_email, customer_name, customer_address, success_url, cancel_url } = body;

    if (!org_id || !Array.isArray(line_items) || line_items.length === 0) {
      throw new Error("Missing checkout line items");
    }

    // Build Paddle transaction items as non-catalog custom items
    const paddleItems = line_items.map((item: any) => ({
      quantity: item.quantity,
      price: {
        description: `${item.label}${item.variety ? ` — ${item.variety}` : ""}${item.vintage_year ? ` ${item.vintage_year}` : ""}`,
        name: item.label,
        unit_price: {
          amount: String(Math.round(item.unit_price * 100)),
          currency_code: "USD",
        },
        product: {
          name: item.label,
          description: `${item.variety || ""} ${item.vintage_year || ""}`.trim() || undefined,
          tax_category: "standard",
        },
      },
    }));

    const transactionPayload: any = {
      items: paddleItems,
      custom_data: {
        org_id,
        customer_name,
        customer_email,
        line_items_json: JSON.stringify(line_items),
        customer_address: customer_address ? JSON.stringify(customer_address) : null,
      },
      checkout: {
        url: success_url || undefined,
      },
    };

    if (customer_email) {
      transactionPayload.customer = { email: customer_email };
    }

    const paddleResp = await fetch("https://api.paddle.com/transactions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paddleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transactionPayload),
    });

    const result = await paddleResp.json();
    if (!paddleResp.ok) {
      console.error("Paddle transaction creation failed:", JSON.stringify(result));
      throw new Error(result.error?.detail || "Paddle transaction creation failed");
    }

    const transactionId = result.data?.id;
    const checkoutUrl = result.data?.checkout?.url;

    return new Response(JSON.stringify({
      transaction_id: transactionId,
      url: checkoutUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Checkout failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
