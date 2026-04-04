import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_USER_LIMITS: Record<string, number> = {
  hobbyist: 1,
  small_boutique: 5,
  mid_size: 15,
  enterprise: 999,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Team member invite path
    if (body.type === "team_invite") {
      const { org_id, email, role } = body;
      if (!org_id || !email) throw new Error("org_id and email are required");

      // Server-side user limit check
      const { count: currentUserCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org_id);

      const { data: org } = await supabase
        .from("organizations")
        .select("tier, name")
        .eq("id", org_id)
        .single();

      const userLimit = TIER_USER_LIMITS[org?.tier || "hobbyist"] ?? 1;

      if ((currentUserCount ?? 0) >= userLimit) {
        return new Response(
          JSON.stringify({ error: `User limit reached for your plan (${userLimit} users max)` }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for existing user with this email already in the org
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("org_id", org_id)
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        return new Response(
          JSON.stringify({ error: "A user with this email is already a member of your organization" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send Supabase auth invite; role/org metadata is applied when the user accepts
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: { org_id, role: role || "member" },
        redirectTo: `${Deno.env.get("APP_URL") || "https://solera.vin"}/auth/callback`,
      });

      if (inviteError) throw inviteError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client portal invite path
    const { client_org_id, email } = body;

    // Get client org info
    const { data: clientOrg } = await supabase.from("client_orgs").select("*, organizations:parent_org_id(name)").eq("id", client_org_id).single();
    if (!clientOrg) throw new Error("Client org not found");

    // Check for duplicate pending invite
    const { data: existingInvite } = await supabase
      .from("client_invite_tokens")
      .select("id")
      .eq("client_org_id", client_org_id)
      .eq("email", email)
      .eq("used", false)
      .maybeSingle();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "A pending invitation already exists for this email" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create invite token
    const { data: token, error: tokenErr } = await supabase.from("client_invite_tokens").insert({
      client_org_id,
      email,
    }).select("token").single();
    if (tokenErr) throw tokenErr;

    const facilityName = (clientOrg as any).organizations?.name || "Facility";
    const appUrl = Deno.env.get("APP_URL") || "https://solera.vin";
    const signupUrl = `${appUrl}/client/signup?token=${token.token}`;

    // Send invite email via Resend (if RESEND_API_KEY is set)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${facilityName} <noreply@${Deno.env.get("RESEND_DOMAIN") || "solera.vin"}>`,
          to: [email],
          subject: `You're invited to the ${facilityName} client portal`,
          html: `<h2>Welcome to ${facilityName}</h2>
            <p>You've been invited to access the client portal for ${clientOrg.name}.</p>
            <p><a href="${signupUrl}" style="background:#6B1B2A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Create Your Account</a></p>
            <p style="color:#888;font-size:12px;">This link expires in 48 hours.</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, signup_url: signupUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
