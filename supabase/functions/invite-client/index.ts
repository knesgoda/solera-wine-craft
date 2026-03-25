import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_org_id, email } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get client org info
    const { data: clientOrg } = await supabase.from("client_orgs").select("*, organizations:parent_org_id(name)").eq("id", client_org_id).single();
    if (!clientOrg) throw new Error("Client org not found");

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
