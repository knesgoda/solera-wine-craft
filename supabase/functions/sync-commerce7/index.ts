import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { org_id, sync_type } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: config } = await supabase.from("commerce7_config").select("*").eq("org_id", org_id).single();
    if (!config || !config.active) throw new Error("Commerce7 integration not active");

    const c7Headers = {
      "Content-Type": "application/json",
      "Authorization": "Basic " + btoa(`${config.app_id}:${config.app_secret}`),
      "tenant": config.tenant_id,
    };
    const baseUrl = `https://api.commerce7.com/v1`;

    let recordsSynced = 0;
    let errors = 0;
    let errorDetails = "";

    if (sync_type === "inventory") {
      const { data: skus } = await supabase.from("inventory_skus").select("*").eq("org_id", org_id).eq("active", true);

      for (const sku of skus || []) {
        try {
          const totalBottles = ((Number(sku.cases) || 0) * sku.bottles_per_case) + (sku.loose_bottles || 0);
          const productPayload = {
            title: sku.label || "Untitled",
            type: [sku.variety, sku.vintage_year].filter(Boolean).join(" "),
            price: Number(sku.price) || 0,
            inventory: totalBottles,
          };

          const resp = await fetch(`${baseUrl}/product`, { method: "POST", headers: c7Headers, body: JSON.stringify(productPayload) });
          if (!resp.ok) {
            const errBody = await resp.text();
            // If product exists, try update
            if (resp.status === 409) {
              recordsSynced++;
              continue;
            }
            throw new Error(`C7 API error ${resp.status}: ${errBody}`);
          }
          recordsSynced++;
        } catch (e) {
          errors++;
          errorDetails += `SKU ${sku.id}: ${(e as Error).message}\n`;
        }
      }
    } else if (sync_type === "orders") {
      const since = config.last_synced_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      try {
        const resp = await fetch(`${baseUrl}/order?createdAtMin=${since}`, { headers: c7Headers });
        if (!resp.ok) throw new Error(`C7 Orders API error: ${resp.status}`);
        const ordersData = await resp.json();

        for (const c7Order of ordersData?.orders || []) {
          try {
            // Find or skip SKU mapping — create order with first available SKU
            const { data: firstSku } = await supabase.from("inventory_skus").select("id").eq("org_id", org_id).limit(1).single();
            if (!firstSku) continue;

            await supabase.from("orders").insert({
              org_id,
              sku_id: firstSku.id,
              customer_name: c7Order.customer?.firstName + " " + c7Order.customer?.lastName || "Commerce7 Customer",
              customer_email: c7Order.customer?.email || "unknown@commerce7.com",
              quantity_bottles: c7Order.orderItems?.[0]?.quantity || 1,
              unit_price: c7Order.total || 0,
              subtotal: c7Order.subTotal || 0,
              total: c7Order.total || 0,
              status: "paid",
              source: "commerce7",
            });
            recordsSynced++;
          } catch (e) {
            errors++;
            errorDetails += `Order: ${(e as Error).message}\n`;
          }
        }
      } catch (e) {
        errors++;
        errorDetails = (e as Error).message;
      }

      await supabase.from("commerce7_config").update({ last_synced_at: new Date().toISOString() }).eq("org_id", org_id);
    }

    await supabase.from("integration_sync_logs").insert({
      org_id,
      integration: "commerce7",
      sync_type,
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
