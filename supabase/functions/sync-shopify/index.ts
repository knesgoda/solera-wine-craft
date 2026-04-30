import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { org_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: config } = await supabase.from("shopify_config").select("*").eq("org_id", org_id).single();
    if (!config || !config.active) throw new Error("Shopify integration not active");

    const shopifyHeaders = {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": config.access_token || "",
    };
    const baseUrl = `https://${config.shop_domain}/admin/api/2024-01`;

    const { data: skus } = await supabase.from("inventory_skus").select("*").eq("org_id", org_id).eq("active", true).eq("allocation_type", "dtc");

    let recordsSynced = 0;
    let errors = 0;
    let errorDetails = "";

    for (const sku of skus || []) {
      try {
        const totalBottles = ((Number(sku.cases) || 0) * sku.bottles_per_case) + (sku.loose_bottles || 0);
        const productPayload = {
          product: {
            title: sku.label || "Untitled Wine",
            product_type: [sku.variety, sku.vintage_year].filter(Boolean).join(" "),
            body_html: sku.notes || "",
            variants: [{
              price: String(Number(sku.price) || 0),
              inventory_quantity: totalBottles,
              inventory_management: config.sync_inventory ? "shopify" : null,
            }],
          },
        };

        const resp = await fetch(`${baseUrl}/products.json`, {
          method: "POST",
          headers: shopifyHeaders,
          body: JSON.stringify(productPayload),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          if (resp.status === 422) {
            // Product may already exist — count as synced
            recordsSynced++;
            continue;
          }
          throw new Error(`Shopify API ${resp.status}: ${errText}`);
        }
        recordsSynced++;
      } catch (e) {
        errors++;
        errorDetails += `SKU ${sku.id}: ${(e as Error).message}\n`;
      }
    }

    await supabase.from("shopify_config").update({ last_synced_at: new Date().toISOString() }).eq("org_id", org_id);

    await supabase.from("integration_sync_logs").insert({
      org_id,
      integration: "shopify",
      sync_type: "products",
      records_synced: recordsSynced,
      errors,
      error_details: errorDetails || null,
      status: errors > 0 ? "partial" : "success",
    });

    return new Response(JSON.stringify({ success: true, records_synced: recordsSynced, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
