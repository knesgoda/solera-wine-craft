import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTransactionalEmail } from "../_shared/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_CLIENT_LIMITS: Record<string, number> = {
  hobbyist: 2,
  small_boutique: 5,
  mid_size: 20,
  enterprise: Infinity,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_org_id, email } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get client org info
    const { data: clientOrg } = await supabase.from("client_orgs").select("*, organizations:parent_org_id(name, tier)").eq("id", client_org_id).single();
    if (!clientOrg) throw new Error("Client org not found");

    // Server-side tier limit enforcement
    const parentOrg = (clientOrg as any).organizations;
    const tier = parentOrg?.tier || "hobbyist";
    const maxClients = TIER_CLIENT_LIMITS[tier] ?? 2;

    if (maxClients !== Infinity) {
      // Count existing active client orgs under this parent
      const { count: clientOrgCount } = await supabase
        .from("client_orgs")
        .select("id", { count: "exact", head: true })
        .eq("parent_org_id", clientOrg.parent_org_id)
        .eq("active", true);

      if ((clientOrgCount ?? 0) >= maxClients) {
        return new Response(JSON.stringify({
          error: `Your plan (${tier}) allows up to ${maxClients} client organizations. Please upgrade to add more.`,
        }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check for duplicate pending invite
    const { data: existingInvite } = await supabase
      .from("client_invite_tokens")
      .select("id")
      .eq("client_org_id", client_org_id)
      .eq("email", email)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (existingInvite && existingInvite.length > 0) {
      return new Response(JSON.stringify({
        error: "A pending invite already exists for this email address.",
      }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create invite token
    const { data: token, error: tokenErr } = await supabase.from("client_invite_tokens").insert({
      client_org_id,
      email,
    }).select("token").single();
    if (tokenErr) throw tokenErr;

    const facilityName = parentOrg?.name || "Facility";
    const appUrl = Deno.env.get("APP_URL") || "https://solera.vin";
    const signupUrl = `${appUrl}/client/signup?token=${token.token}`;

    // Send invite email via Lovable email queue (branded React Email template)
    await sendTransactionalEmail(
      email,
      "client-invite",
      {
        facilityName,
        inviteUrl: signupUrl,
        expiryHours: 48,
      },
      `client-invite-${token.token}`
    );

    return new Response(JSON.stringify({ success: true, signup_url: signupUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
