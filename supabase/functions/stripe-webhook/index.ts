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

// Fetch a Stripe resource by ID
async function stripeGet(path: string, stripeKey: string) {
  const resp = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { "Authorization": `Bearer ${stripeKey}` },
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(`Stripe GET /${path} failed: ${err.error?.message || resp.status}`);
  }
  return resp.json();
}

// Look up org by stripe_customer_id, falling back to email match on profiles
async function findOrgByStripeCustomer(
  supabase: any,
  stripeCustomerId: string | null,
  customerEmail: string | null
): Promise<{ orgId: string | null }> {
  // Try stripe_customer_id first
  if (stripeCustomerId) {
    const { data } = await supabase
      .from("organizations")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .limit(1)
      .single();
    if (data) return { orgId: data.id };
  }
  // Fallback: match via profile email
  if (customerEmail) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("email", customerEmail)
      .limit(1)
      .single();
    if (profile?.org_id) return { orgId: profile.org_id };
  }
  return { orgId: null };
}

// Map Stripe subscription status to our status values
function mapSubscriptionStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "past_due",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
    trialing: "trialing",
    paused: "paused",
  };
  return statusMap[stripeStatus] || stripeStatus;
}

async function resolveSubscriptionTier(sub: any, stripeKey: string, fallbackTier?: string): Promise<string> {
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (priceId) {
    const price = await stripeGet(`prices/${priceId}`, stripeKey);
    if (price.metadata?.tier) return price.metadata.tier;
  }

  return sub.metadata?.target_tier || fallbackTier || "pro";
}
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return new Response("Stripe key not configured", { status: 500 });
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const metadata = session.metadata || {};
        const customerEmail = metadata.customer_email || session.customer_email || "";
        const stripeCustomerId = session.customer || null;

        // PART 4: Upsert stripe_customer_id on org regardless of mode
        if (stripeCustomerId) {
          const { orgId } = await findOrgByStripeCustomer(supabase, stripeCustomerId, customerEmail);
          if (orgId) {
            await supabase
              .from("organizations")
              .update({ stripe_customer_id: stripeCustomerId } as any)
              .eq("id", orgId)
              .is("stripe_customer_id", null);
          }
        }

        if (session.mode === "subscription") {
          // PART 2: Subscription checkout (club or platform subscription)
          await handleSubscriptionCheckout(session, metadata, stripeKey, supabase);
        } else {
          // PART 1: One-time payment checkout (existing logic)
          await handlePaymentCheckout(session, metadata, supabase);
        }
        break;
      }

      case "customer.subscription.updated": {
        // PART 3: Subscription updated
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;
        const { orgId } = await findOrgByStripeCustomer(supabase, stripeCustomerId, null);
        if (!orgId) {
          console.warn("subscription.updated: org not found for customer", stripeCustomerId);
          break;
        }

        // Re-fetch subscription from Stripe to confirm details
        const sub = await stripeGet(`subscriptions/${subscription.id}`, stripeKey);
        const tier = await resolveSubscriptionTier(sub, stripeKey);


        await supabase.from("organizations").update({
          tier,
          subscription_status: mapSubscriptionStatus(sub.status),
          stripe_subscription_id: sub.id,
        } as any).eq("id", orgId);
        break;
      }

      case "customer.subscription.deleted": {
        // PART 3: Subscription canceled
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;
        const { orgId } = await findOrgByStripeCustomer(supabase, stripeCustomerId, null);
        if (!orgId) {
          console.warn("subscription.deleted: org not found for customer", stripeCustomerId);
          break;
        }

        await supabase.from("organizations").update({
          tier: "hobbyist",
          subscription_status: "canceled",
        } as any).eq("id", orgId);

        // Cancel any active club memberships for this org
        await supabase.from("club_members")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() } as any)
          .eq("org_id", orgId)
          .eq("status", "active");
        break;
      }

      case "invoice.payment_failed": {
        // PART 3: Payment failed on subscription invoice
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer;
        const { orgId } = await findOrgByStripeCustomer(supabase, stripeCustomerId, null);
        if (orgId) {
          await supabase.from("organizations").update({
            subscription_status: "past_due",
          } as any).eq("id", orgId);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        await supabase.from("orders")
          .update({ status: "payment_failed" })
          .eq("stripe_payment_intent_id", pi.id);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        await supabase.from("orders")
          .update({ status: "refunded" })
          .eq("stripe_payment_intent_id", charge.payment_intent);
        break;
      }
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

// ─── Subscription checkout handler ──────────────────────────────────────────

async function handleSubscriptionCheckout(
  session: any,
  metadata: any,
  stripeKey: string,
  supabase: any
) {
  const customerEmail = metadata.customer_email || session.customer_email || "";
  const customerName = metadata.customer_name || "";
  const stripeCustomerId = session.customer;
  const subscriptionId = session.subscription;

  // Re-fetch subscription from Stripe (never trust client data)
  const sub = await stripeGet(`subscriptions/${subscriptionId}`, stripeKey);
  const priceId = sub.items?.data?.[0]?.price?.id;
  let tier = "pro";
  if (priceId) {
    const price = await stripeGet(`prices/${priceId}`, stripeKey);
    tier = price.metadata?.tier || "pro";
  }

  // Find org
  const { orgId } = await findOrgByStripeCustomer(supabase, stripeCustomerId, customerEmail);
  if (!orgId) {
    console.error("subscription checkout: could not find org for", customerEmail, stripeCustomerId);
    return;
  }

  // Update org with subscription info
  await supabase.from("organizations").update({
    tier,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: "active",
  } as any).eq("id", orgId);

  // If this is a wine club subscription (club_id in metadata), create club membership
  const clubId = metadata.club_id;
  if (clubId) {
    // Upsert customer
    const { data: customer } = await supabase
      .from("customers")
      .upsert(
        {
          org_id: orgId,
          email: customerEmail,
          first_name: customerName.split(" ")[0] || "",
          last_name: customerName.split(" ").slice(1).join(" ") || "",
        },
        { onConflict: "org_id,email" }
      )
      .select("id")
      .single();

    if (customer?.id) {
      const shippingAddress = metadata.shipping_address
        ? JSON.parse(metadata.shipping_address)
        : null;

      await supabase.from("club_members").upsert(
        {
          org_id: orgId,
          club_id: clubId,
          customer_id: customer.id,
          status: "active",
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: stripeCustomerId,
          shipping_address_json: shippingAddress,
          joined_at: new Date().toISOString(),
        } as any,
        { onConflict: "club_id,customer_id" }
      );
    }

    // Notify org owner
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("org_id", orgId)
      .limit(1);
    if (profiles?.[0]) {
      await supabase.from("notifications").insert({
        org_id: orgId,
        user_id: profiles[0].id,
        message: `New wine club member: ${customerName} (${customerEmail}) joined via Stripe`,
        type: "system",
        channel: "email",
      });
    }
  }
}

// ─── One-time payment checkout handler ──────────────────────────────────────

async function handlePaymentCheckout(
  session: any,
  metadata: any,
  supabase: any
) {
  const orgId = metadata.org_id;
  const customerName = metadata.customer_name || "";
  const customerEmail = metadata.customer_email || session.customer_email || "";
  const lineItems = JSON.parse(metadata.line_items_json || "[]");
  const customerAddress = metadata.customer_address
    ? JSON.parse(metadata.customer_address)
    : null;

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

  // Create orders and decrement inventory
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
    const { data: sku } = await supabase
      .from("inventory_skus")
      .select("cases, loose_bottles, bottles_per_case, label")
      .eq("id", item.sku_id)
      .single();
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

      await supabase
        .from("inventory_skus")
        .update({ cases, loose_bottles: looseBottles } as any)
        .eq("id", item.sku_id);
      await supabase.from("inventory_adjustments").insert({
        org_id: orgId,
        sku_id: item.sku_id,
        cases_delta:
          (Number(sku.cases) || 0) - cases > 0
            ? -((Number(sku.cases) || 0) - cases)
            : 0,
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
    const totalSpent = (orderTotals || []).reduce(
      (s: number, o: any) => s + Number(o.total),
      0
    );
    await supabase
      .from("customers")
      .update({
        total_orders: orderTotals?.length || 0,
        total_spent: totalSpent,
      })
      .eq("id", customer.id);
  }

  // Notify org owner
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("org_id", orgId)
    .limit(1);
  if (profiles?.[0]) {
    await supabase.from("notifications").insert({
      org_id: orgId,
      user_id: profiles[0].id,
      message: `New order from ${customerName} (${customerEmail}) — $${lineItems
        .reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
        .toFixed(2)}`,
      type: "system",
      channel: "email",
    });
  }
}
