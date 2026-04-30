import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated caller (function deploys with verify_jwt=false)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: order } = await supabase.from("orders").select("*, inventory_skus:sku_id(label, variety, vintage_year)").eq("id", order_id).single();
    if (!order) throw new Error("Order not found");

    // Caller must belong to the order's org
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile?.org_id || profile.org_id !== order.org_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: config } = await supabase.from("shipcompliant_config").select("*").eq("org_id", order.org_id).single();
    if (!config || !config.active) {
      return new Response(JSON.stringify({ compliant: true, message: "ShipCompliant not configured — skipping" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const address = order.customer_address_json as any;
    const destinationState = address?.state || "CA";

    // Call ShipCompliant CheckCompliance API
    try {
      const shipCompliantUrl = Deno.env.get("SHIPCOMPLIANT_BASE_URL");
      if (!shipCompliantUrl) {
        return new Response(JSON.stringify({ error: "ShipCompliant is not configured." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const resp = await fetch(`${shipCompliantUrl}complianceService.asmx`, {
        method: "POST",
        headers: { "Content-Type": "text/xml", "SOAPAction": "http://ws.shipcompliant.com/CheckComplianceOfSalesOrder" },
        body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://ws.shipcompliant.com/">
  <soap:Body>
    <ns:CheckComplianceOfSalesOrder>
      <ns:Request>
        <ns:Security>
          <ns:Username>${escapeXml(config.username)}</ns:Username>
          <ns:Password>${escapeXml(config.password_hash)}</ns:Password>
        </ns:Security>
        <ns:SalesOrder>
          <ns:ShipTo><ns:State>${escapeXml(destinationState)}</ns:State></ns:ShipTo>
          <ns:OrderItems>
            <ns:OrderItem>
              <ns:ProductKey>${escapeXml(order.inventory_skus?.label || "WINE")}</ns:ProductKey>
              <ns:Quantity>${escapeXml(order.quantity_bottles)}</ns:Quantity>
            </ns:OrderItem>
          </ns:OrderItems>
        </ns:SalesOrder>
      </ns:Request>
    </ns:CheckComplianceOfSalesOrder>
  </soap:Body>
</soap:Envelope>`,
      });

      const responseText = await resp.text();
      const isCompliant = responseText.includes("<IsCompliant>true</IsCompliant>") || responseText.includes("Compliant");

      const complianceDetails = {
        checked_at: new Date().toISOString(),
        destination_state: destinationState,
        compliant: isCompliant,
        raw_response_status: resp.status,
      };

      await supabase.from("orders").update({
        compliance_status: isCompliant ? "passed" : "failed",
        compliance_details: complianceDetails,
      }).eq("id", order_id);

      if (!isCompliant) {
        // Hold order and notify
        await supabase.from("orders").update({ status: "on_hold" as any }).eq("id", order_id);

        // Create notification for org owner
        const { data: profiles } = await supabase.from("profiles").select("id").eq("org_id", order.org_id);
        for (const p of profiles || []) {
          await supabase.from("notifications").insert({
            org_id: order.org_id,
            user_id: p.id,
            message: `Order #${order_id.slice(0, 8)} failed ShipCompliant compliance check for ${destinationState}. Order has been held.`,
            type: "alert",
          });
        }
      }

      await supabase.from("integration_sync_logs").insert({
        org_id: order.org_id,
        integration: "shipcompliant",
        sync_type: "compliance_check",
        records_synced: 1,
        errors: isCompliant ? 0 : 1,
        error_details: isCompliant ? null : `Failed for state ${destinationState}`,
        status: isCompliant ? "success" : "failed",
      });

      return new Response(JSON.stringify({ compliant: isCompliant, details: complianceDetails }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (apiError) {
      // If ShipCompliant API is unreachable, log and allow order to proceed with warning
      await supabase.from("orders").update({
        compliance_status: "error",
        compliance_details: { error: (apiError as Error).message, checked_at: new Date().toISOString() },
      }).eq("id", order_id);

      return new Response(JSON.stringify({ compliant: true, message: "ShipCompliant API unreachable — order proceeding with warning" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
