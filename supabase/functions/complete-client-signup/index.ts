import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Derive auth_user_id from verified JWT — never trust the body
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const auth_user_id = user.id;

    const { token, first_name, last_name } = await req.json();

    if (!token || typeof token !== "string") throw new Error("Invalid token");
    const fn = String(first_name ?? "").trim();
    const ln = String(last_name ?? "").trim();
    if (fn.length < 1 || fn.length > 100 || ln.length < 1 || ln.length > 100) {
      throw new Error("First and last name must be 1-100 characters");
    }

    // Validate token
    const { data: invite, error: invErr } = await supabase.from("client_invite_tokens").select("*").eq("token", token).single();
    if (invErr || !invite) throw new Error("Invalid token");
    if (invite.used) throw new Error("Token already used");
    if (new Date(invite.expires_at) < new Date()) throw new Error("Token expired");

    // Verify the invited email matches the authenticated user's email
    if (invite.email && user.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Invite email does not match authenticated user" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client_users record
    const { error: cuErr } = await supabase.from("client_users").insert({
      auth_user_id,
      client_org_id: invite.client_org_id,
      email: invite.email,
      first_name: fn,
      last_name: ln,
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
