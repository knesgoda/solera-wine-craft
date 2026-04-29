import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paddleKey = Deno.env.get("PADDLE_API_KEY");
    if (!paddleKey) throw new Error("Paddle API key not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile?.org_id) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: ownerRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();

    if (!ownerRole) {
      return new Response(
        JSON.stringify({ error: "Owner role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const org_id = profile.org_id;

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("paddle_customer_id, paddle_subscription_id")
      .eq("id", org_id)
      .single();

    if (orgErr || !org) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!org.paddle_customer_id || !org.paddle_subscription_id) {
      return new Response(
        JSON.stringify({ error: "No Paddle subscription found. Please upgrade to a paid plan first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a portal session via Paddle API
    const paddleResp = await fetch(
      `https://api.paddle.com/customers/${org.paddle_customer_id}/portal-sessions`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paddleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription_ids: [org.paddle_subscription_id],
        }),
      }
    );

    const session = await paddleResp.json();
    if (!paddleResp.ok) {
      throw new Error(session.error?.detail || "Failed to create billing portal session");
    }

    const portalUrl = session.data?.urls?.general?.overview;
    if (!portalUrl) {
      throw new Error("Portal URL not returned by Paddle");
    }

    return new Response(JSON.stringify({ url: portalUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
