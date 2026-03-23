import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRICE_TO_TIER: Record<string, string> = {
  'pri_01kmdwyrebec33s3kkrv4akap2': 'hobbyist',
  'pri_01kmdx9xd7y43185qppke728d9': 'small_boutique',
  'pri_01kmdxb9xev9x8823v4ssbvj1m': 'small_boutique',
  'pri_01kmdxcs28byfa4q5ye3kh1xj3': 'mid_size',
  'pri_01kmdxeyq34dvq3mxex2xdyfwm': 'mid_size',
  'pri_01kmdxkejxc2bssknbrm9phj48': 'enterprise',
  'pri_01kmdxmnh6v670ng8dtz5skec8': 'enterprise',
};

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

async function verifyPaddleSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  // Paddle signature format: ts=TIMESTAMP;h1=HASH
  const parts: Record<string, string> = {};
  for (const part of signature.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) parts[k] = v;
  }

  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;

  const signedPayload = `${ts}:${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  const encoder2 = new TextEncoder();
  return timingSafeEqual(encoder2.encode(expectedHex), encoder2.encode(h1));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("PADDLE_NOTIFICATION_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("PADDLE_NOTIFICATION_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signature = req.headers.get("paddle-signature") || "";
  const rawBody = await req.text();

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const valid = await verifyPaddleSignature(rawBody, signature, webhookSecret);
  if (!valid) {
    console.error("Paddle webhook signature verification failed");
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const eventType = event.event_type;
    const data = event.data || {};
    const customData = data.custom_data || {};
    const orgId = customData.org_id;
    const subId = data.id;
    const customerId = data.customer_id;
    const status = data.status;
    const items = data.items || [];
    const priceId = items[0]?.price?.id;
    const tier = priceId ? (PRICE_TO_TIER[priceId] || "small_boutique") : "small_boutique";
    const nextBilledAt = data.next_billed_at || null;
    const scheduledChange = data.scheduled_change || null;
    const currentBillingPeriod = data.current_billing_period || {};

    switch (eventType) {
      case "subscription.created": {
        if (!orgId) {
          console.warn("subscription.created: no org_id in custom_data");
          break;
        }
        await supabase.from("organizations").update({
          paddle_customer_id: customerId,
          paddle_subscription_id: subId,
          tier,
          subscription_status: status,
          next_billed_at: nextBilledAt,
          trial_ends_at: status === "trialing" ? (currentBillingPeriod.ends_at || null) : null,
        } as any).eq("id", orgId);
        break;
      }

      case "subscription.updated": {
        const updateData: any = {
          tier,
          subscription_status: status,
          next_billed_at: nextBilledAt,
          scheduled_change: scheduledChange,
        };
        if (orgId) {
          await supabase.from("organizations").update(updateData).eq("id", orgId);
        } else {
          await supabase.from("organizations").update(updateData).eq("paddle_subscription_id", subId);
        }
        break;
      }

      case "subscription.canceled": {
        await supabase.from("organizations").update({
          tier: "hobbyist",
          subscription_status: "canceled",
          paddle_subscription_id: null,
          next_billed_at: null,
          scheduled_change: null,
        } as any).eq("paddle_subscription_id", subId);
        break;
      }

      case "subscription.paused": {
        await supabase.from("organizations").update({
          subscription_status: "paused",
        } as any).eq("paddle_subscription_id", subId);
        break;
      }

      case "transaction.completed": {
        if (customerId) {
          await supabase.from("organizations").update({
            subscription_status: "active",
          } as any).eq("paddle_customer_id", customerId);
        }
        break;
      }

      case "transaction.payment_failed": {
        if (customerId) {
          await supabase.from("organizations").update({
            subscription_status: "past_due",
          } as any).eq("paddle_customer_id", customerId);
        }
        break;
      }

      default:
        console.log("Unhandled Paddle event:", eventType);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Paddle webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
