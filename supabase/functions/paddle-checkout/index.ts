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

    const { line_items, customer_email, customer_name, customer_address, success_url } = body;

    if (!Array.isArray(line_items) || line_items.length === 0) {
      throw new Error("Missing checkout line items");
    }

    const allowedLineItemKeys = new Set(["sku_id", "quantity"]);
    const requestedItems = line_items.map((item: any) => {
      const keys = Object.keys(item || {});
      const hasRejectedFields = keys.some((key) => !allowedLineItemKeys.has(key));
      if (hasRejectedFields || "unit_price" in item || "label" in item || "product" in item) {
        throw new Error("Line items may only include sku_id and quantity");
      }
      if (typeof item.sku_id !== "string" || !item.sku_id) {
        throw new Error("Invalid SKU");
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error("Quantity must be a positive integer");
      }
      return { sku_id: item.sku_id, quantity: item.quantity };
    });

    const quantitiesBySku = new Map<string, number>();
    for (const item of requestedItems) {
      quantitiesBySku.set(item.sku_id, (quantitiesBySku.get(item.sku_id) || 0) + item.quantity);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const skuIds = [...quantitiesBySku.keys()];
    const { data: skus, error: skuError } = await supabase
      .from("inventory_skus")
      .select("id, org_id, label, variety, vintage_year, price, active, cases, loose_bottles, bottles_per_case")
      .in("id", skuIds);

    if (skuError || !skus || skus.length !== skuIds.length) {
      throw new Error("Invalid SKU");
    }

    const orgId = skus[0].org_id;
    if (!skus.every((sku: any) => sku.org_id === orgId)) {
      throw new Error("All SKUs must belong to the same organization");
    }

    const { data: storefront } = await supabase
      .from("storefront_config")
      .select("enabled")
      .eq("org_id", orgId)
      .maybeSingle();

    if (storefront?.enabled !== true) {
      throw new Error("Storefront is not enabled");
    }

    for (const sku of skus as any[]) {
      const quantity = quantitiesBySku.get(sku.id) || 0;
      const available = (Number(sku.cases) || 0) * (Number(sku.bottles_per_case) || 0) + (Number(sku.loose_bottles) || 0);
      if (sku.active !== true) {
        throw new Error("SKU is not active");
      }
      if (!sku.price || Number(sku.price) <= 0) {
        throw new Error("SKU price is unavailable");
      }
      if (quantity > available) {
        throw new Error("Requested quantity exceeds available stock");
      }
    }

    const skuById = new Map((skus as any[]).map((sku) => [sku.id, sku]));
    const trustedLineItems = requestedItems.map((item) => {
      const sku = skuById.get(item.sku_id);
      return {
        sku_id: sku.id,
        label: sku.label || "Wine",
        variety: sku.variety,
        vintage_year: sku.vintage_year,
        unit_price: Number(sku.price),
        quantity: item.quantity,
      };
    });

    const paddleItems = trustedLineItems.map((item) => ({
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
        org_id: orgId,
        customer_name,
        customer_email,
        line_items_json: JSON.stringify(trustedLineItems),
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
