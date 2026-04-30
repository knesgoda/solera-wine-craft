import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTransactionalEmail } from "../_shared/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
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

    // --- Verify caller belongs to the target client_org_id ---
    const { data: callerClient } = await supabase
      .from("client_users")
      .select("client_org_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!callerClient || callerClient.client_org_id !== client_org_id) {
      // Also allow facility users who own the parent org
      const { data: clientOrg } = await supabase
        .from("client_orgs")
        .select("parent_org_id")
        .eq("id", client_org_id)
        .single();
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!clientOrg || !profile || profile.org_id !== clientOrg.parent_org_id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // --- End ownership check ---

    // Get client org to find org_id
    const { data: clientOrg } = await supabase.from("client_orgs").select("parent_org_id").eq("id", client_org_id).single();
    if (!clientOrg) throw new Error("Client org not found");

    // Determine sender_type
    const senderType = callerClient ? "client" : "facility";

    // Insert message
    const messageId = crypto.randomUUID();
    const { error } = await supabase.from("client_messages").insert({
      id: messageId,
      org_id: clientOrg.parent_org_id,
      client_org_id,
      sender_type: senderType,
      sender_id: user.id,
      message,
    });
    if (error) throw error;

    // Notify org owner via Lovable email queue (only when client writes to facility)
    if (senderType === "client") {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email")
        .eq("org_id", clientOrg.parent_org_id)
        .limit(1);
      const ownerEmail = profiles?.[0]?.email;
      if (ownerEmail) {
        const { data: cOrg } = await supabase
          .from("client_orgs")
          .select("name")
          .eq("id", client_org_id)
          .single();
        const preview = (message || "").toString().slice(0, 280);
        await sendTransactionalEmail(
          ownerEmail,
          "client-message-notify",
          {
            clientName: cOrg?.name || "A client",
            messagePreview: preview,
            ctaUrl: "https://solera.vin/clients",
          },
          `client-msg-${messageId}`,
        );
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg === "Unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
