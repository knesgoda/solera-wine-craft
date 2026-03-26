import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_org_id, message } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader! } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Get client org to find org_id
    const { data: clientOrg } = await supabase.from("client_orgs").select("parent_org_id").eq("id", client_org_id).single();
    if (!clientOrg) throw new Error("Client org not found");

    // Insert message
    const { error } = await supabase.from("client_messages").insert({
      org_id: clientOrg.parent_org_id,
      client_org_id,
      sender_type: "client",
      sender_id: user.id,
      message,
    });
    if (error) throw error;

    // Notify org owner via email (if Resend is configured)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const { data: profiles } = await supabase.from("profiles").select("email").eq("org_id", clientOrg.parent_org_id).limit(1);
      const ownerEmail = profiles?.[0]?.email;
      if (ownerEmail) {
        const { data: cOrg } = await supabase.from("client_orgs").select("name").eq("id", client_org_id).single();
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `Solera <noreply@${Deno.env.get("RESEND_DOMAIN") || "solera.vin"}>`,
            to: [ownerEmail],
            subject: `New message from ${cOrg?.name || "client"}`,
            html: `<p>${cOrg?.name || "A client"} sent you a message:</p><blockquote>${message}</blockquote>`,
          }),
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
