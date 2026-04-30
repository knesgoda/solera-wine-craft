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

    const { data: config } = await supabase.from("winedirect_config").select("*").eq("org_id", org_id).single();
    if (!config || !config.active) throw new Error("WineDirect integration not active");

    const since = config.last_synced_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let recordsSynced = 0;
    let errors = 0;
    let errorDetails = "";

    try {
      const resp = await fetch(`https://api.winedirect.com/v2/orders?since=${encodeURIComponent(since)}`, {
        headers: {
          "Authorization": `Bearer ${config.api_key}`,
          "X-Account-Id": config.account_id || "",
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) throw new Error(`WineDirect API error: ${resp.status}`);
      const ordersData = await resp.json();

      for (const wdOrder of ordersData?.orders || []) {
        try {
          const { data: firstSku } = await supabase.from("inventory_skus").select("id").eq("org_id", org_id).limit(1).single();
          if (!firstSku) continue;

          await supabase.from("orders").insert({
            org_id,
            sku_id: firstSku.id,
            customer_name: wdOrder.customerName || "WineDirect Customer",
            customer_email: wdOrder.email || "unknown@winedirect.com",
            quantity_bottles: wdOrder.totalItems || 1,
            unit_price: wdOrder.total || 0,
            subtotal: wdOrder.subtotal || 0,
            total: wdOrder.total || 0,
            status: "paid",
            source: "winedirect",
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

    await supabase.from("winedirect_config").update({ last_synced_at: new Date().toISOString() }).eq("org_id", org_id);

    await supabase.from("integration_sync_logs").insert({
      org_id,
      integration: "winedirect",
      sync_type: "orders",
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
