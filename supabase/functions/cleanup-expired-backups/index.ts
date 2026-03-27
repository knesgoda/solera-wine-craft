/**
 * cleanup-expired-backups: Cron-triggered daily at 03:00 UTC.
 * Deletes expired backup files from Storage and marks jobs as expired.
 * Expiry rules:
 *   - manual: 7 days
 *   - scheduled: 30 days
 *   - cancellation: 90 days
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPIRY_DAYS: Record<string, number> = {
  manual: 7,
  scheduled: 30,
  cancellation: 90,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Get completed jobs
    const { data: jobs, error } = await supabase
      .from("backup_jobs")
      .select("id, org_id, created_at, triggered_by, file_url, status")
      .eq("status", "completed");

    if (error) throw error;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ ok: true, cleaned: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let cleaned = 0;
    const now = Date.now();

    for (const job of jobs) {
      const triggeredBy = job.triggered_by || "manual";
      const expiryDays = EXPIRY_DAYS[triggeredBy] || 7;
      const createdAt = new Date(job.created_at).getTime();
      const ageMs = now - createdAt;

      if (ageMs > expiryDays * 24 * 60 * 60 * 1000) {
        // Try to delete file from storage
        if (job.file_url) {
          // Extract storage path from the signed URL
          // Path format: {org_id}/Solera_Backup_...
          try {
            const pathMatch = job.file_url.match(/\/object\/sign\/backups\/(.+?)\?/);
            if (pathMatch) {
              await supabase.storage.from("backups").remove([decodeURIComponent(pathMatch[1])]);
            }
          } catch (storageErr) {
            console.error(`Failed to delete storage for job ${job.id}:`, storageErr);
          }
        }

        // Mark as expired
        await supabase.from("backup_jobs").update({
          status: "expired",
          file_url: null,
        } as any).eq("id", job.id);

        cleaned++;
      }
    }

    console.log(`Cleaned up ${cleaned} expired backup(s)`);
    return new Response(JSON.stringify({ ok: true, cleaned }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cleanup-expired-backups error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
