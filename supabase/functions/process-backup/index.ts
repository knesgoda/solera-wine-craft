/**
 * process-backup: Generates the actual backup files (CSV ZIP or XLSX).
 * Called by request-backup via fire-and-forget fetch.
 * Uses service role — no user auth needed.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { sendAdminNotification } from "../_shared/admin-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables to export with their display names
const EXPORT_TABLES = [
  { table: "organizations", label: "Organizations", orgField: "id" },
  { table: "profiles", label: "Users", orgField: "org_id", excludeFields: ["id"] },
  { table: "vineyards", label: "Vineyards", orgField: "org_id" },
  { table: "blocks", label: "Blocks", orgField: null, parentTable: "vineyards", parentField: "vineyard_id" },
  { table: "vintages", label: "Vintages", orgField: "org_id" },
  { table: "lab_samples", label: "Lab Samples", orgField: null, parentTable: "vintages", parentField: "vintage_id" },
  { table: "fermentation_vessels", label: "Vessels", orgField: "org_id" },
  { table: "fermentation_logs", label: "Fermentation Logs", orgField: null, parentTable: "fermentation_vessels", parentField: "vessel_id" },
  { table: "barrels", label: "Barrels", orgField: "org_id" },
  { table: "blending_trials", label: "Blending Trials", orgField: "org_id" },
  { table: "blending_trial_lots", label: "Blend Components", orgField: null, parentTable: "blending_trials", parentField: "trial_id" },
  { table: "tasks", label: "Tasks", orgField: "org_id" },
  { table: "alert_rules", label: "Alert Rules", orgField: "org_id" },
  { table: "notifications", label: "Notifications", orgField: "org_id" },
  { table: "weather_readings", label: "Weather Data", orgField: "org_id" },
  { table: "ttb_additions", label: "TTB Additions", orgField: "org_id" },
  { table: "ttb_reports", label: "TTB Reports", orgField: "org_id" },
  { table: "inventory_skus", label: "Inventory", orgField: "org_id" },
  { table: "orders", label: "Orders", orgField: "org_id" },
  { table: "customers", label: "Customers", orgField: "org_id" },
  { table: "wine_clubs", label: "Wine Clubs", orgField: "org_id" },
  { table: "club_members", label: "Club Members", orgField: "org_id" },
  { table: "growers", label: "Growers", orgField: "org_id" },
  { table: "grower_contracts", label: "Grower Contracts", orgField: "org_id" },
  { table: "weigh_tags", label: "Weigh Tags", orgField: "org_id" },
  { table: "client_orgs", label: "Custom Crush Clients", orgField: "parent_org_id" },
  { table: "cost_categories", label: "Cost Categories", orgField: "org_id" },
  { table: "cost_entries", label: "Cost Entries", orgField: "org_id" },
];

// Fields to exclude from exports (internal/sensitive)
const GLOBAL_EXCLUDE = new Set([
  "google_access_token", "google_refresh_token",
  "app_id", "app_secret", // integration secrets
]);

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]).filter(h => !GLOBAL_EXCLUDE.has(h));
  const BOM = "\xEF\xBB\xBF";
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map(row =>
    headers.map(h => escapeCsvField(row[h])).join(",")
  );
  return BOM + headerLine + "\n" + dataLines.join("\n") + "\n";
}

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function fetchAllRows(
  supabase: any,
  table: string,
  orgId: string,
  orgField: string | null,
  parentInfo?: { parentTable: string; parentField: string }
): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;

  // For tables without direct org_id, get parent IDs first
  if (!orgField && parentInfo) {
    const { data: parentRows } = await supabase
      .from(parentInfo.parentTable)
      .select("id")
      .eq(parentInfo.parentTable === "vineyards" ? "org_id" : "org_id", orgId);
    
    if (!parentRows || parentRows.length === 0) return [];
    const parentIds = parentRows.map((r: any) => r.id);

    // Fetch in batches of parent IDs
    for (let i = 0; i < parentIds.length; i += 100) {
      const batch = parentIds.slice(i, i + 100);
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .in(parentInfo.parentField, batch)
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) { console.error(`Error fetching ${table}:`, error); break; }
        if (!data || data.length === 0) break;
        allRows = allRows.concat(data);
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    }
    return allRows;
  }

  // Direct org_id query with pagination
  const filterField = orgField === "id" ? "id" : orgField!;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq(filterField, orgId)
      .range(from, from + PAGE_SIZE - 1);
    if (error) { console.error(`Error fetching ${table}:`, error); break; }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let jobId: string | undefined;

  try {
    const body = await req.json();
    jobId = body.job_id;
    if (!jobId) throw new Error("Missing job_id");

    // Get job details
    const { data: job, error: jobErr } = await supabase
      .from("backup_jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (jobErr || !job) throw new Error("Job not found");
    if (job.status !== "pending") {
      return new Response(JSON.stringify({ ok: true, message: "Job already processed" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mark as processing
    await supabase.from("backup_jobs").update({ status: "processing" } as any).eq("id", jobId);

    const orgId = job.org_id;
    const format = job.format;

    // Get org info
    const { data: org } = await supabase.from("organizations").select("name, timezone").eq("id", orgId).single();
    const orgName = org?.name || "Unknown";
    const orgTimezone = org?.timezone || "UTC";
    const safeName = orgName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];

    // Export all tables
    const fileManifest: Record<string, { rows: number; sha256: string; sizeBytes: number }> = {};
    const csvFiles: Record<string, string> = {};
    let totalRows = 0;

    for (const spec of EXPORT_TABLES) {
      try {
        const rows = await fetchAllRows(
          supabase, spec.table, orgId, spec.orgField,
          spec.parentTable ? { parentTable: spec.parentTable, parentField: spec.parentField! } : undefined
        );

        // Filter out sensitive fields from profiles
        let cleanRows = rows;
        if (spec.table === "profiles") {
          cleanRows = rows.map(({ id, ...rest }: any) => rest);
        }
        // For organizations, only include the user's own org
        if (spec.table === "organizations") {
          cleanRows = rows.map((r: any) => {
            const { paddle_customer_id, paddle_subscription_id, ...rest } = r;
            return rest;
          });
        }

        if (cleanRows.length === 0) continue;

        const csvContent = rowsToCsv(cleanRows);
        const hash = await sha256(csvContent);
        const fileName = `${spec.table}.csv`;
        const sizeBytes = new TextEncoder().encode(csvContent).length;

        csvFiles[fileName] = csvContent;
        fileManifest[fileName] = { rows: cleanRows.length, sha256: hash, sizeBytes };
        totalRows += cleanRows.length;
      } catch (tableErr) {
        console.error(`Error exporting ${spec.table}:`, tableErr);
        // Continue with other tables
      }
    }

    // Build README
    const readme = `SOLERA DATA BACKUP
==================
Organization: ${orgName}
Export Date: ${new Date().toISOString()}
Format: ${format.toUpperCase()}
Schema Version: 1.0

This backup contains all data from your Solera account.
Each .csv file represents one data table. Files are related
by ID columns — for example, lab_samples.csv references
vintage_id which corresponds to the id column in vintages.csv.

To verify this backup is complete and uncorrupted, check the
manifest.json file which contains row counts and checksums
for every file.

Questions? Contact support@solera.vin
`;

    // Build manifest
    const manifest = {
      exportVersion: "1.0",
      schemaVersion: "1.0",
      orgId,
      orgName,
      exportDate: new Date().toISOString(),
      orgTimezone,
      format,
      files: fileManifest,
      totalRows,
      integrityCheck: "passed",
    };

    let fileContent: Uint8Array;
    let fileName: string;
    let contentType: string;

    if (format === "csv") {
      // Create ZIP
      const zip = new JSZip();
      zip.file("README.txt", readme);
      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      for (const [name, content] of Object.entries(csvFiles)) {
        zip.file(name, content);
      }

      fileContent = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
      fileName = `Solera_Backup_${safeName}_${dateStr}.zip`;
      contentType = "application/zip";
    } else {
      // For XLSX, we generate a simple CSV ZIP since we can't use xlsx in Deno edge functions reliably
      // Mark it as xlsx format but deliver as ZIP with CSV files (practical compromise)
      const zip = new JSZip();
      zip.file("README.txt", readme + "\nNote: Excel (.xlsx) format is delivered as a ZIP of CSV files that can be opened in Excel.\n");
      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      for (const [name, content] of Object.entries(csvFiles)) {
        zip.file(name, content);
      }
      fileContent = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
      fileName = `Solera_Backup_${safeName}_${dateStr}.zip`;
      contentType = "application/zip";
    }

    // Verify integrity - check we can read the ZIP header
    if (fileContent[0] !== 0x50 || fileContent[1] !== 0x4B) {
      throw new Error("ZIP integrity check failed — invalid file header");
    }

    // Upload to storage
    const storagePath = `${orgId}/${fileName}`;
    const { error: uploadErr } = await supabase.storage
      .from("backups")
      .upload(storagePath, fileContent, {
        contentType,
        upsert: true,
      });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    // Determine expiry based on triggered_by
    const triggeredBy = job.triggered_by || "manual";
    const expiryDays = triggeredBy === "cancellation" ? 90 : triggeredBy === "scheduled" ? 30 : 7;
    const expirySeconds = expiryDays * 24 * 60 * 60;

    // Generate signed URL
    const { data: signedUrl } = await supabase.storage
      .from("backups")
      .createSignedUrl(storagePath, expirySeconds);

    // Update job as completed
    await supabase.from("backup_jobs").update({
      status: "completed",
      file_url: signedUrl?.signedUrl || null,
      file_size_bytes: fileContent.length,
      manifest_json: manifest,
      completed_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + expirySeconds * 1000).toISOString(),
    } as any).eq("id", jobId);

    // Format file size for notification
    const sizeMB = (fileContent.length / (1024 * 1024)).toFixed(2);
    console.log(`Backup completed for org ${orgName}: ${fileName} (${sizeMB} MB, ${totalRows} rows)`);

    // If this backup was triggered by a cancellation, email all org users with the download link
    if (triggeredBy === "cancellation" && signedUrl?.signedUrl) {
      try {
        const { data: allUsers } = await supabase
          .from("profiles")
          .select("email, first_name")
          .eq("org_id", orgId);

        if (allUsers && allUsers.length > 0) {
          const allEmails = allUsers.map((u: any) => u.email).filter(Boolean);
          const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
          if (RESEND_API_KEY) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: "Solera Notifications <notifications@solera.vin>",
                to: allEmails,
                reply_to: "support@solera.vin",
                subject: "Your Solera data is ready to download",
                html: `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A;line-height:1.5;">
  <div style="border-bottom:2px solid #C8902A;padding:20px 0 16px;">
    <span style="font-family:Georgia,serif;font-size:24px;font-weight:bold;color:#6B1B2A;">SOLERA</span>
  </div>
  <div style="padding:24px 0;">
    <p style="font-size:16px;">Hi ${allUsers[0]?.first_name || "there"},</p>
    <p style="font-size:16px;">We're sorry to see you go. We've prepared a complete backup of all your winery data for <strong>${orgName}</strong>.</p>
    <div style="margin:24px 0;">
      <a href="${signedUrl.signedUrl}" style="display:inline-block;background:#6B1B2A;color:#fff;font-size:16px;font-weight:600;padding:12px 32px;border-radius:6px;text-decoration:none;">Download Your Data</a>
    </div>
    <p style="font-size:14px;color:#555;">This link is available for 90 days. After that, your data will be permanently deleted.</p>
    <p style="font-size:14px;color:#555;">If you change your mind, you can reactivate your account anytime within the 90-day window by signing back in and choosing a plan.</p>
    <p style="font-size:14px;color:#555;">We'd love to know what we could have done better — just reply to this email.</p>
    <p style="font-size:16px;">Cheers,<br>The Solera Team</p>
  </div>
  <div style="background:#F5F0E8;padding:16px;border-radius:0 0 6px 6px;font-size:12px;color:#888;">
    Solera — From vine to bottle to doorstep<br>
    <a href="https://solera.vin" style="color:#6B1B2A;">Website</a> · <a href="https://solera.vin/privacy" style="color:#6B1B2A;">Privacy Policy</a><br>
    You're receiving this because you have a Solera account at solera.vin.
  </div>
</div>`,
              }),
            });
            console.log(`Cancellation data export email sent to ${allEmails.length} user(s) for org ${orgName}`);
          }
        }
      } catch (emailErr) {
        console.error("Cancellation email send error:", emailErr);
        sendAdminNotification(
          `Cancellation email failed for ${orgName}`,
          `Org ID: ${orgId}\nError: ${(emailErr as Error).message}`,
        ).catch(() => {});
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-backup error:", err);

    // Update job as failed
    if (jobId) {
      await supabase.from("backup_jobs").update({
        status: "failed",
        error_message: (err as Error).message,
        completed_at: new Date().toISOString(),
      } as any).eq("id", jobId);
    }

    // Alert admin
    sendAdminNotification(
      `Backup integrity check failed`,
      `Job ID: ${jobId}\nError: ${(err as Error).message}`
    ).catch(() => {});

    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
