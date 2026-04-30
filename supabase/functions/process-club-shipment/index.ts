import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { shipment_id } = await req.json();

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe not configured");

    const authHeader = req.headers.get("authorization");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );
    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

    // Fetch shipment and verify ownership
    const { data: shipmentOwner } = await serviceClient
      .from("club_shipments")
      .select("org_id")
      .eq("id", shipment_id)
      .single();
    if (!shipmentOwner) {
      return new Response(JSON.stringify({ error: "Shipment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (callerOrgId !== shipmentOwner.org_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service client for all subsequent reads (ownership verified)
    const supabase = serviceClient;

    // Get shipment with club details
    const { data: shipment, error: shipErr } = await supabase
      .from("club_shipments")
      .select("*, wine_clubs:club_id(name, price_per_shipment, bottles_per_shipment)")
      .eq("id", shipment_id)
      .single();
    if (shipErr || !shipment) throw new Error("Shipment not found");

    // Get active members for this club
    const { data: members, error: memErr } = await supabase
      .from("club_members")
      .select("*, customers:customer_id(email, first_name, last_name)")
      .eq("club_id", (shipment as any).club_id)
      .eq("status", "active");
    if (memErr) throw memErr;

    const club = (shipment as any).wine_clubs;
    const results = { billed: 0, failed: 0, total_revenue: 0 };

    // Update shipment to processing
    await supabase.from("club_shipments").update({ status: "processing" as any }).eq("id", shipment_id);

    for (const member of (members || [])) {
      try {
        let paymentIntentId: string | null = null;

        if ((member as any).stripe_customer_id) {
          // Charge using Stripe customer's default payment method
          const params = new URLSearchParams();
          params.append("amount", String(Math.round(club.price_per_shipment * 100)));
          params.append("currency", "usd");
          params.append("customer", (member as any).stripe_customer_id);
          params.append("off_session", "true");
          params.append("confirm", "true");
          params.append("description", `${club.name} Wine Club Shipment`);

          // Get customer's default payment method
          const custResp = await fetch(`https://api.stripe.com/v1/customers/${(member as any).stripe_customer_id}`, {
            headers: { "Authorization": `Bearer ${stripeKey}` },
          });
          const custData = await custResp.json();
          
          if (custData.invoice_settings?.default_payment_method) {
            params.append("payment_method", custData.invoice_settings.default_payment_method);
          } else if (custData.default_source) {
            params.append("source", custData.default_source);
          }

          const piResp = await fetch("https://api.stripe.com/v1/payment_intents", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${stripeKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          });
          const pi = await piResp.json();

          if (piResp.ok && pi.status === "succeeded") {
            paymentIntentId = pi.id;
            results.billed++;
            results.total_revenue += club.price_per_shipment;
          } else {
            throw new Error(pi.error?.message || "Payment failed");
          }
        } else {
          // No Stripe customer — mark as failed
          throw new Error("No payment method on file");
        }

        // Create shipment member record
        await serviceClient.from("club_shipment_members").insert({
          shipment_id,
          member_id: member.id,
          status: "billed",
          stripe_payment_intent_id: paymentIntentId,
        });
      } catch (e: any) {
        results.failed++;
        // Create failed record
        await serviceClient.from("club_shipment_members").insert({
          shipment_id,
          member_id: member.id,
          status: "payment_failed",
        });
        // Update member status
        await serviceClient.from("club_members").update({ status: "payment_failed" as any }).eq("id", member.id);
      }
    }

    // Decrement inventory for SKU allocations
    const allocations = (shipment as any).sku_allocations_json || [];
    for (const alloc of allocations) {
      if (alloc.sku_id && alloc.qty_per_member) {
        const totalBottles = alloc.qty_per_member * results.billed;
        const { data: sku } = await serviceClient.from("inventory_skus").select("cases, loose_bottles, bottles_per_case").eq("id", alloc.sku_id).single();
        if (sku) {
          let loose = Number(sku.loose_bottles) || 0;
          let cases = Number(sku.cases) || 0;
          const bpc = Number(sku.bottles_per_case) || 12;
          let remaining = totalBottles;

          if (loose >= remaining) {
            loose -= remaining;
          } else {
            remaining -= loose;
            loose = 0;
            const casesNeeded = Math.ceil(remaining / bpc);
            cases = Math.max(0, cases - casesNeeded);
            loose = Math.max(0, casesNeeded * bpc - remaining);
          }

          await serviceClient.from("inventory_skus").update({ cases, loose_bottles: loose } as any).eq("id", alloc.sku_id);
          await serviceClient.from("inventory_adjustments").insert({
            org_id: (shipment as any).org_id,
            sku_id: alloc.sku_id,
            bottles_delta: -totalBottles,
            reason: "sale",
            notes: `Club shipment: ${club.name}`,
          });
        }
      }
    }

    // Update shipment totals
    await supabase.from("club_shipments").update({
      status: "billed" as any,
      total_members_billed: results.billed,
    }).eq("id", shipment_id);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
