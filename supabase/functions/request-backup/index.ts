/**
 * request-backup: Creates a backup job after rate-limit check.
 * Returns the job ID for the client to poll.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Get user's org
    const { data: profile } = await admin.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile?.org_id) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { format } = await req.json();
    if (!["csv", "xlsx"].includes(format)) {
      return new Response(JSON.stringify({ error: "Invalid format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 1 export per hour per org
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("backup_jobs")
      .select("id, created_at")
      .eq("org_id", profile.org_id)
      .gte("created_at", oneHourAgo)
      .in("status", ["pending", "processing", "completed"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (recent && recent.length > 0) {
      const nextAllowed = new Date(new Date(recent[0].created_at).getTime() + 60 * 60 * 1000);
      const minutesLeft = Math.ceil((nextAllowed.getTime() - Date.now()) / 60000);
      return new Response(JSON.stringify({
        error: "rate_limited",
        minutesLeft,
        message: `You can generate another backup in ${minutesLeft} minutes.`,
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create job
    const { data: job, error: jobErr } = await admin
      .from("backup_jobs")
      .insert({
        org_id: profile.org_id,
        format,
        status: "pending",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (jobErr) throw jobErr;

    // Trigger processing (fire-and-forget via pg_net or direct fetch)
    // We use a direct fetch to the process-backup function
    const processUrl = `${supabaseUrl}/functions/v1/process-backup`;
    fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ job_id: job.id }),
    }).catch((e) => console.error("Failed to trigger process-backup:", e));

    return new Response(JSON.stringify({ jobId: job.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("request-backup error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
