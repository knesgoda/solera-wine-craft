/**
 * delete-organization: Self-serve account deletion (right to erasure).
 *
 * Performs:
 *  1. Caller verification (must be owner of target org)
 *  2. Confirmation check (typed org name must match exactly)
 *  3. Final auto-export via process-backup (best-effort, fire-and-forget)
 *  4. Logs request to data_deletion_requests audit table
 *  5. Cleans up NO-ACTION constraint tables in dependency order
 *  6. Deletes the organization (cascades remaining FKs)
 *  7. Deletes auth.users rows for all profiles previously in the org
 *  8. Marks the audit row completed
 *
 * On failure, audit row status is set to 'failed' with error_message.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables with ON DELETE NO ACTION (per mem://database/deletion-constraints).
// Order: child rows that reference these tables can cascade once these are cleared.
const NO_ACTION_TABLES = [
  "alert_rules",
  "notifications",
  "club_shipments",
  "club_members",
  "wine_clubs",
  "orders",
  "customers",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let auditId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: "Invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const confirmationName: string = (body.confirmationName ?? "").trim();
    const skipExport: boolean = !!body.skipExport;
    if (!confirmationName) {
      return jsonResponse({ error: "Missing confirmationName" }, 400);
    }

    // Resolve org + verify ownership
    const { data: profile } = await admin
      .from("profiles")
      .select("org_id, email")
      .eq("id", user.id)
      .single();
    if (!profile?.org_id) return jsonResponse({ error: "No organization" }, 404);

    const { data: ownerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();
    if (!ownerRole) return jsonResponse({ error: "Only the organization owner can delete the account." }, 403);

    const { data: org } = await admin
      .from("organizations")
      .select("id, name, tier")
      .eq("id", profile.org_id)
      .single();
    if (!org) return jsonResponse({ error: "Organization not found" }, 404);

    if (confirmationName !== org.name) {
      return jsonResponse({
        error: "Confirmation does not match organization name.",
      }, 400);
    }

    // Audit row
    const { data: audit, error: auditErr } = await admin
      .from("data_deletion_requests")
      .insert({
        org_id: org.id,
        org_name_snapshot: org.name,
        org_tier_snapshot: org.tier,
        requested_by_user_id: user.id,
        requested_by_email: profile.email ?? user.email ?? "unknown",
        status: "processing",
        metadata_json: { skip_export: skipExport },
      })
      .select("id")
      .single();
    if (auditErr) throw auditErr;
    auditId = audit.id;

    // Final auto-export (best-effort, fire-and-forget)
    if (!skipExport) {
      const { data: job } = await admin
        .from("backup_jobs")
        .insert({
          org_id: org.id,
          format: "xlsx",
          status: "pending",
          created_by: user.id,
          triggered_by: "deletion",
        })
        .select("id")
        .single();
      if (job?.id) {
        fetch(`${supabaseUrl}/functions/v1/process-backup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ job_id: job.id }),
        }).catch((e) => console.error("Final export trigger failed:", e));
      }
    }

    // Collect auth user IDs to remove after org deletion
    const { data: orgProfiles } = await admin
      .from("profiles")
      .select("id")
      .eq("org_id", org.id);
    const authUserIds = (orgProfiles ?? []).map((p) => p.id);

    // Cleanup NO-ACTION tables
    for (const table of NO_ACTION_TABLES) {
      const { error: delErr } = await admin.from(table).delete().eq("org_id", org.id);
      if (delErr) {
        console.warn(`Cleanup warning on ${table}:`, delErr.message);
      }
    }

    // Delete organization (cascades remaining FKs)
    const { error: orgDelErr } = await admin.from("organizations").delete().eq("id", org.id);
    if (orgDelErr) throw new Error(`Failed to delete organization: ${orgDelErr.message}`);

    // Delete auth users
    for (const uid of authUserIds) {
      const { error: authDelErr } = await admin.auth.admin.deleteUser(uid);
      if (authDelErr) {
        console.warn(`Failed to delete auth user ${uid}:`, authDelErr.message);
      }
    }

    // Mark audit completed (org_id will dangle since org row gone — that's fine, snapshot is preserved)
    await admin
      .from("data_deletion_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", auditId);

    return jsonResponse({ success: true, deletedOrgId: org.id, deletedUsers: authUserIds.length });
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error("delete-organization error:", msg);
    if (auditId) {
      await admin
        .from("data_deletion_requests")
        .update({ status: "failed", error_message: msg, completed_at: new Date().toISOString() })
        .eq("id", auditId)
        .then(() => {});
    }
    return jsonResponse({ error: msg }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}