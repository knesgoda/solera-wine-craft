import { sendAdminNotification } from "../_shared/admin-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { first_name, email, operation_type, created_at } = await req.json();

    // Send admin notification (fire-and-forget)
    sendAdminNotification(
      `New waitlist signup: ${email}`,
      `Name: ${first_name || "Not provided"}\nEmail: ${email}\nOperation Type: ${operation_type}\nSigned up at: ${created_at}`
    ).catch(() => {});

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("notify-waitlist-signup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
