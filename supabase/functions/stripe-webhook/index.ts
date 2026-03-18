import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const elements = sigHeader.split(",");
  const timestamp = elements.find(e => e.startsWith("t="))?.split("=")[1];
  const signatures = elements.filter(e => e.startsWith("v1=")).map(e => e.split("=")[1]);

  if (!timestamp || signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  return signatures.some(s => timingSafeEqual(s, expectedSig));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const valid = await verifyStripeSignature(body, signature, webhookSecret);
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(body);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const metadata = session.metadata || {};
      const orgId = metadata.org_id;
      const customerName = metadata.customer_name || "";
      const customerEmail = metadata.customer_email || session.customer_email || "";
      const lineItems = JSON.parse(metadata.line_items_json || "[]");
      const customerAddress = metadata.customer_address ? JSON.parse(metadata.customer_address) : null;

      // Upsert customer
      const { data: customer } = await supabase
        .from("customers")
        .upsert(
          {
            org_id: orgId,
            email: customerEmail,
            first_name: customerName.split(" ")[0] || "",
            last_name: customerName.split(" ").slice(1).join(" ") || "",
            address_json: customerAddress,
          },
          { onConflict: "org_id,email" }
        )
        .select("id")
        .single();

      // Create orders and decrement inventory for each line item
      for (const item of lineItems) {
        const total = item.unit_price * item.quantity;

        await supabase.from("orders").insert({
          org_id: orgId,
          sku_id: item.sku_id,
          customer_id: customer?.id || null,
          customer_email: customerEmail,
          customer_name: customerName,
          customer_address_json: customerAddress,
          quantity_bottles: item.quantity,
          unit_price: item.unit_price,
          subtotal: total,
          total: total,
          status: "paid",
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
        });

        // Decrement inventory
        const { data: sku } = await supabase.from("inventory_skus").select("cases, loose_bottles, bottles_per_case, label").eq("id", item.sku_id).single();
        if (sku) {
          let bottlesToRemove = item.quantity;
          let looseBottles = Number(sku.loose_bottles) || 0;
          let cases = Number(sku.cases) || 0;
          const bpc = Number(sku.bottles_per_case) || 12;

          if (looseBottles >= bottlesToRemove) {
            looseBottles -= bottlesToRemove;
          } else {
            bottlesToRemove -= looseBottles;
            looseBottles = 0;
            const casesNeeded = Math.ceil(bottlesToRemove / bpc);
            cases = Math.max(0, cases - casesNeeded);
            looseBottles = Math.max(0, casesNeeded * bpc - bottlesToRemove);
          }

          await supabase.from("inventory_skus").update({ cases, loose_bottles: looseBottles } as any).eq("id", item.sku_id);
          await supabase.from("inventory_adjustments").insert({
            org_id: orgId,
            sku_id: item.sku_id,
            cases_delta: (Number(sku.cases) || 0) - cases > 0 ? -((Number(sku.cases) || 0) - cases) : 0,
            bottles_delta: -item.quantity,
            reason: "sale",
            notes: `Stripe order ${session.id}`,
          });
        }
      }

      // Update customer totals
      if (customer?.id) {
        const { data: orderTotals } = await supabase
          .from("orders")
          .select("total")
          .eq("customer_id", customer.id);
        const totalSpent = (orderTotals || []).reduce((s: number, o: any) => s + Number(o.total), 0);
        await supabase.from("customers").update({
          total_orders: orderTotals?.length || 0,
          total_spent: totalSpent,
        }).eq("id", customer.id);
      }

      // Send notification to org owner
      const { data: profiles } = await supabase.from("profiles").select("id").eq("org_id", orgId).limit(1);
      if (profiles?.[0]) {
        await supabase.from("notifications").insert({
          org_id: orgId,
          user_id: profiles[0].id,
          message: `New order from ${customerName} (${customerEmail}) — $${lineItems.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0).toFixed(2)}`,
          type: "system",
          channel: "email",
        });
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object;
      // Mark any pending orders with this payment intent as failed
      await supabase.from("orders")
        .update({ status: "payment_failed" })
        .eq("stripe_payment_intent_id", pi.id);
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object;
      await supabase.from("orders")
        .update({ status: "refunded" })
        .eq("stripe_payment_intent_id", charge.payment_intent);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
