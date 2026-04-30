import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Resolve org_id server-side from profiles
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();
    if (!profile?.org_id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    // Verify caller has owner role in that org
    const { data: ownerRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();
    if (!ownerRole) {
      return jsonResponse({ error: "Only the organization owner can manage billing." }, 403);
    }

    const { priceId } = await req.json();
    if (!priceId) {
      return jsonResponse({ error: "priceId is required" }, 400);
    }

    // Validate priceId against allowlist
    const allowedPriceIdsRaw = Deno.env.get("PADDLE_ALLOWED_PRICE_IDS") || "";
    const allowedPriceIds = allowedPriceIdsRaw.split(",").map((p) => p.trim()).filter(Boolean);
    if (allowedPriceIds.length > 0 && !allowedPriceIds.includes(priceId)) {
      return jsonResponse({ error: "Invalid price ID" }, 400);
    }

    const paddleApiKey = Deno.env.get("PADDLE_API_KEY");
    if (!paddleApiKey) {
      return jsonResponse({ error: "Paddle is not configured" }, 500);
    }

    const paddleEnv = Deno.env.get("PADDLE_ENV") || "production";
    const paddleBaseUrl = paddleEnv === "sandbox"
      ? "https://sandbox-api.paddle.com"
      : "https://api.paddle.com";

    // Fetch caller's email for pre-filling checkout
    const { data: { user: fullUser } } = await serviceClient.auth.admin.getUserById(user.id);
    const customerEmail = fullUser?.email;

    // Create Paddle checkout session with org_id bound server-side
    const checkoutPayload: any = {
      items: [{ price_id: priceId, quantity: 1 }],
      custom_data: { org_id: profile.org_id },
    };
    if (customerEmail) {
      checkoutPayload.customer = { email: customerEmail };
    }

    const paddleResp = await fetch(`${paddleBaseUrl}/transactions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paddleApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(checkoutPayload),
    });

    if (!paddleResp.ok) {
      const errText = await paddleResp.text();
      console.error("Paddle create transaction error:", paddleResp.status, errText);
      return jsonResponse({ error: "Failed to create checkout session" }, 500);
    }

    const paddleData = await paddleResp.json();
    const checkoutUrl = paddleData?.data?.checkout?.url || null;
    const transactionId = paddleData?.data?.id || null;

    return jsonResponse({ checkoutUrl, transactionId });
  } catch (e) {
    console.error("create-checkout error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
