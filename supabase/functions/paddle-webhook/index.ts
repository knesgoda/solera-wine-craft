import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendAdminNotification } from "../_shared/admin-notify.ts";

const PRICE_TO_TIER: Record<string, string> = {
  'pri_01kmdwyrebec33s3kkrv4akap2': 'hobbyist',
  'pri_01kmdx9xd7y43185qppke728d9': 'small_boutique',
  'pri_01kmdxb9xev9x8823v4ssbvj1m': 'small_boutique',
  'pri_01kmdxcs28byfa4q5ye3kh1xj3': 'mid_size',
  'pri_01kmdxeyq34dvq3mxex2xdyfwm': 'mid_size',
  'pri_01kmdxkejxc2bssknbrm9phj48': 'enterprise',
  'pri_01kmdxmnh6v670ng8dtz5skec8': 'enterprise',
};

const TIER_LABELS: Record<string, string> = {
  hobbyist: "Hobbyist",
  small_boutique: "Pro",
  mid_size: "Growth",
  enterprise: "Enterprise",
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

async function getOrgInfo(supabase: any, orgId?: string, subId?: string, customerId?: string) {
  let query;
  if (orgId) {
    query = supabase.from("organizations").select("name, tier").eq("id", orgId).single();
  } else if (subId) {
    query = supabase.from("organizations").select("name, tier").eq("paddle_subscription_id", subId).single();
  } else if (customerId) {
    query = supabase.from("organizations").select("name, tier").eq("paddle_customer_id", customerId).single();
  }
  if (!query) return { name: "Unknown", tier: "unknown" };
  const { data } = await query;
  return data || { name: "Unknown", tier: "unknown" };
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
          cancelled_at: null, // Clear cancelled_at on reactivation
        } as any).eq("id", orgId);

        // Admin notification
        const orgInfo = await getOrgInfo(supabase, orgId);
        sendAdminNotification(
          `New subscription: ${orgInfo.name} → ${TIER_LABELS[tier] || tier}`,
          `Organization: ${orgInfo.name}\nNew Tier: ${TIER_LABELS[tier] || tier}\nStatus: ${status}`
        ).catch(() => {});
        break;
      }

      case "subscription.updated": {
        // Get old tier before update
        const oldOrg = await getOrgInfo(supabase, orgId, subId);
        const oldTier = oldOrg.tier;

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

        // Admin notification if tier changed
        if (oldTier !== tier) {
          sendAdminNotification(
            `Subscription updated: ${oldOrg.name} changed from ${TIER_LABELS[oldTier] || oldTier} to ${TIER_LABELS[tier] || tier}`,
            `Organization: ${oldOrg.name}\nPrevious Tier: ${TIER_LABELS[oldTier] || oldTier}\nNew Tier: ${TIER_LABELS[tier] || tier}\nStatus: ${status}`
          ).catch(() => {});
        }
        break;
      }

      case "subscription.canceled": {
        const cancelOrg = await getOrgInfo(supabase, undefined, subId);

        // Get the org ID before clearing subscription
        const { data: cancelOrgRow } = await supabase
          .from("organizations")
          .select("id, name, created_at")
          .eq("paddle_subscription_id", subId)
          .single();

        await supabase.from("organizations").update({
          tier: "hobbyist",
          subscription_status: "canceled",
          paddle_subscription_id: null,
          next_billed_at: null,
          scheduled_change: null,
          cancelled_at: new Date().toISOString(),
        } as any).eq("id", cancelOrgRow?.id);

        // Trigger cancellation auto-export (fire-and-forget)
        if (cancelOrgRow?.id) {
          try {
            const { data: cancelJob, error: cancelJobErr } = await supabase
              .from("backup_jobs")
              .insert({
                org_id: cancelOrgRow.id,
                format: "csv",
                status: "pending",
                triggered_by: "cancellation",
              })
              .select("id")
              .single();

            if (!cancelJobErr && cancelJob) {
              // Fire process-backup — it will handle email sending on completion
              fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-backup`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ job_id: cancelJob.id }),
              }).catch((err) => {
                console.error("Fire process-backup error:", err);
              });
            }
          } catch (backupErr) {
            console.error("Cancellation backup error:", backupErr);
            sendAdminNotification(
              `Cancellation backup failed: ${cancelOrgRow.name}`,
              `Org: ${cancelOrgRow.name}\nOrg ID: ${cancelOrgRow.id}\nError: ${(backupErr as Error).message}`,
            ).catch(() => {});
          }
        }

        // Calculate tenure for admin notification
        const customerSince = cancelOrgRow?.created_at
          ? new Date(cancelOrgRow.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
          : "Unknown";
        const tenureDays = cancelOrgRow?.created_at
          ? Math.floor((Date.now() - new Date(cancelOrgRow.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        sendAdminNotification(
          `Org cancelled — auto-backup generated: ${cancelOrg.name}`,
          `Organization: ${cancelOrg.name}\nPrevious Tier: ${TIER_LABELS[cancelOrg.tier] || cancelOrg.tier}\nReason: ${data.cancellation_reason || "Not provided"}\nCustomer since: ${customerSince} (${tenureDays} days)`,
        ).catch(() => {});
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

        // Admin notification for payment failure
        const failOrg = await getOrgInfo(supabase, undefined, undefined, customerId);
        const errorDetail = data.payments?.[0]?.error_code || data.status || "Unknown error";
        sendAdminNotification(
          `Payment failed: ${failOrg.name}`,
          `Organization: ${failOrg.name}\nError: ${errorDetail}\nCustomer ID: ${customerId}`
        ).catch(() => {});
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
