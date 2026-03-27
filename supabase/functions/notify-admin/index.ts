/**
 * Generic admin notification edge function.
 * Called from client-side for events like signup, first lab sample, etc.
 * Body: { event: string, data: Record<string, any> }
 */
import { sendAdminNotification } from "../_shared/admin-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
