/**
 * Generic admin notification edge function.
 * Called from client-side for events like signup, first lab sample, etc.
 * Body: { event: string, data: Record<string, any> }
 */
import { sendAdminNotification } from "../_shared/admin-notify.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-notify-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: accept either a valid shared secret (server-to-server) or an authenticated user JWT.
    const sharedSecret = Deno.env.get("ADMIN_NOTIFY_SECRET");
    const providedSecret = req.headers.get("x-admin-notify-secret");
    const hasValidSecret =
      !!sharedSecret && !!providedSecret && providedSecret === sharedSecret;

    let authorized = hasValidSecret;
    if (!authorized) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const anon = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: { user } } = await anon.auth.getUser();
        authorized = !!user;
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event, data } = await req.json();

    switch (event) {
      case "user_signup": {
        const { name, email, orgName, tier } = data;
        await sendAdminNotification(
          `New user registered: ${email}`,
          `Name: ${name}\nEmail: ${email}\nOrganization: ${orgName}\nTier: ${tier || "hobbyist"}`,
          email
        );
        break;
      }

      case "first_lab_sample": {
        const { orgName, userEmail } = data;
        await sendAdminNotification(
          `Activation milestone: ${orgName} logged their first lab sample`,
          `Organization "${orgName}" has logged their first lab sample — this is a leading indicator of real product adoption.`,
          userEmail
        );
        break;
      }

      default:
        console.log("[notify-admin] Unknown event:", event);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[notify-admin] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
