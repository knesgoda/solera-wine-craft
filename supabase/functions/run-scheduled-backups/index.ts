/**
 * run-scheduled-backups: Cron-triggered function (daily 02:00 UTC).
 * Finds due backup schedules and triggers process-backup for each.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendAdminNotification } from "../_shared/admin-notify.ts";

async function sendEmailViaResend(
  to: string[],
  subject: string,
  html: string,
  replyTo?: string,
): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) { console.error("[scheduled-backups] RESEND_API_KEY not set"); return; }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "Solera Notifications <notifications@solera.vin>",
      to,
      subject,
      html,
      reply_to: replyTo || "support@solera.vin",
    }),
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function calcNextRun(frequency: string): string {
  const now = new Date();
  if (frequency === "daily") {
    // Next day at 02:00 UTC
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + 1);
    next.setUTCHours(2, 0, 0, 0);
    return next.toISOString();
  }
  if (frequency === "weekly") {
    // Next Monday at 02:00 UTC
    const day = now.getUTCDay();
    const daysUntilMonday = day === 0 ? 1 : (8 - day);
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + daysUntilMonday);
    next.setUTCHours(2, 0, 0, 0);
    return next.toISOString();
  }
  if (frequency === "biweekly") {
    // 14 days from now at 02:00 UTC
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + 14);
    next.setUTCHours(2, 0, 0, 0);
    return next.toISOString();
  }
  // Monthly: 1st of next month at 02:00 UTC
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 2, 0, 0));
  return next.toISOString();
}

async function processSchedule(
  supabase: any,
  schedule: any,
  supabaseUrl: string,
  serviceKey: string,
): Promise<void> {
  const orgId = schedule.org_id;

  // Get org info
  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  const orgName = org?.name || "Unknown";

  // Create backup job
  const { data: job, error: jobErr } = await supabase
    .from("backup_jobs")
    .insert({
      org_id: orgId,
      format: schedule.format,
      status: "pending",
      triggered_by: "scheduled",
    })
    .select("id")
    .single();

  if (jobErr) throw new Error(`Failed to create backup job: ${jobErr.message}`);

  // Fire process-backup
  const processUrl = `${supabaseUrl}/functions/v1/process-backup`;
  const res = await fetch(processUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ job_id: job.id }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`process-backup returned ${res.status}: ${errText}`);
  }

  // Update schedule
  await supabase.from("backup_schedules").update({
    last_run_at: new Date().toISOString(),
    next_run_at: calcNextRun(schedule.frequency),
  } as any).eq("id", schedule.id);

  // Wait for job completion (poll up to 5 min)
  let completedJob: any = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data: jd } = await supabase.from("backup_jobs").select("*").eq("id", job.id).single();
    if (jd && (jd.status === "completed" || jd.status === "failed")) {
      completedJob = jd;
      break;
    }
  }

  if (!completedJob || completedJob.status !== "completed") {
    throw new Error(`Backup job did not complete: ${completedJob?.error_message || "timeout"}`);
  }

  // Email all org admins
  const { data: admins } = await supabase
    .from("profiles")
    .select("email, first_name")
    .eq("org_id", orgId);

  if (admins && admins.length > 0) {
    const adminEmails = admins.map((a: any) => a.email).filter(Boolean);
    const firstName = admins[0]?.first_name || "there";
    const freq = schedule.frequency === "weekly" ? "weekly" : "monthly";
    const exportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const html = `
<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A;line-height:1.5;">
  <div style="border-bottom:2px solid #C8902A;padding:20px 0 16px;">
    <span style="font-family:Georgia,serif;font-size:24px;font-weight:bold;color:#6B1B2A;">SOLERA</span>
  </div>
  <div style="padding:24px 0;">
    <p style="font-size:16px;">Hi ${firstName},</p>
    <p style="font-size:16px;">Your ${freq} data backup for <strong>${orgName}</strong> is ready to download.</p>
    <p style="font-size:14px;color:#555;">
      <strong>Format:</strong> ${schedule.format.toUpperCase()}<br>
      <strong>Size:</strong> ${formatBytes(completedJob.file_size_bytes || 0)}<br>
      <strong>Includes:</strong> All vineyard, lab, cellar, compliance, and inventory records as of ${exportDate}.
    </p>
    <div style="margin:24px 0;">
      <a href="${completedJob.file_url}" style="display:inline-block;background:#6B1B2A;color:#fff;font-size:16px;font-weight:600;padding:12px 32px;border-radius:6px;text-decoration:none;">Download Backup</a>
    </div>
    <p style="font-size:14px;color:#555;">This download link expires in 30 days.</p>
    <p style="font-size:14px;color:#555;">Your backups are configured in Settings → Data Backup & Export.</p>
    <p style="font-size:16px;">The Solera Team</p>
  </div>
  <div style="background:#F5F0E8;padding:16px;border-radius:0 0 6px 6px;font-size:12px;color:#888;">
    Solera — From vine to bottle to doorstep<br>
    <a href="https://solera.vin" style="color:#6B1B2A;">Website</a> · <a href="https://solera.vin/privacy" style="color:#6B1B2A;">Privacy Policy</a><br>
    You're receiving this because you have a Solera account at solera.vin.
  </div>
</div>`;

    await sendEmailViaResend(
      adminEmails,
      `[Solera] Your ${freq} backup is ready`,
      html,
    );
  }

  console.log(`Scheduled backup completed for org ${orgName} (${schedule.frequency})`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Find due schedules
    const now = new Date().toISOString();
    const { data: schedules, error } = await supabase
      .from("backup_schedules")
      .select("*")
      .eq("enabled", true)
      .lte("next_run_at", now);

    if (error) throw error;
    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const schedule of schedules) {
      try {
        await processSchedule(supabase, schedule, supabaseUrl, serviceKey);
        processed++;
      } catch (err) {
        console.error(`Scheduled backup failed for org ${schedule.org_id}:`, err);

        // Retry once after 15 seconds (simplified from 15 min for edge function timeout)
        try {
          console.log(`Retrying backup for org ${schedule.org_id}...`);
          await new Promise(r => setTimeout(r, 15000));
          await processSchedule(supabase, schedule, supabaseUrl, serviceKey);
          processed++;
        } catch (retryErr) {
          failed++;
          // Get org name for error notification
          const { data: org } = await supabase.from("organizations").select("name").eq("id", schedule.org_id).single();
          const orgName = org?.name || schedule.org_id;

          // Send error email to org admins
          const { data: admins } = await supabase
            .from("profiles")
            .select("email")
            .eq("org_id", schedule.org_id);

          if (admins && admins.length > 0) {
            const adminEmails = admins.map((a: any) => a.email).filter(Boolean);
            await sendEmailViaResend(
              adminEmails,
              "[Solera] Scheduled backup failed — we're looking into it",
              `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A;">
                <div style="border-bottom:2px solid #C8902A;padding:20px 0 16px;">
                  <span style="font-family:Georgia,serif;font-size:24px;font-weight:bold;color:#6B1B2A;">SOLERA</span>
                </div>
                <div style="padding:24px 0;">
                  <p>Your scheduled backup for <strong>${orgName}</strong> couldn't be completed. Our team has been notified and is looking into it.</p>
                  <p>Your next backup will run as scheduled. No action is needed on your end.</p>
                  <p>The Solera Team</p>
                </div>
              </div>`,
            );
          }

          // Alert admin
          sendAdminNotification(
            `Scheduled backup failed: ${orgName}`,
            `Organization: ${orgName}\nOrg ID: ${schedule.org_id}\nFrequency: ${schedule.frequency}\nError: ${(retryErr as Error).message}`,
          ).catch(() => {});

          // Update next_run_at so it tries again at the next scheduled time
          await supabase.from("backup_schedules").update({
            next_run_at: calcNextRun(schedule.frequency),
          } as any).eq("id", schedule.id);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, failed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("run-scheduled-backups error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
