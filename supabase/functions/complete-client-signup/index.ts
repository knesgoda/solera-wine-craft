import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, auth_user_id, first_name, last_name } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Validate token
    const { data: invite, error: invErr } = await supabase.from("client_invite_tokens").select("*").eq("token", token).single();
    if (invErr || !invite) throw new Error("Invalid token");
    if (invite.used) throw new Error("Token already used");
    if (new Date(invite.expires_at) < new Date()) throw new Error("Token expired");

    // Create client_users record
    const { error: cuErr } = await supabase.from("client_users").insert({
      auth_user_id,
      client_org_id: invite.client_org_id,
      email: invite.email,
      first_name,
      last_name,
      role: "client",
    });
    if (cuErr) throw cuErr;

    // Mark token as used
    await supabase.from("client_invite_tokens").update({ used: true }).eq("id", invite.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
