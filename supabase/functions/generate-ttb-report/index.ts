// DEPRECATED: TTB report now exports as true PDF client-side via jsPDF.
// This function is no longer called. Retained for reference only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    const { data: claimsData } = await supabaseUser.auth.getUser();
    const userId = claimsData?.user?.id;
    if (!userId) throw new Error("Unauthorized");

    const { data: userProfile } = await supabaseAdmin.from("profiles").select("org_id").eq("id", userId).single();
    if (!userProfile?.org_id) throw new Error("No organization");
    const orgId = userProfile.org_id;

    const body = await req.json();

    // Signed URL TTL = 7 days (was 1h, persisted URLs went stale)
    const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

    // On-demand refresh of an existing report's signed URL using stored pdf_path
    if (body.type === "refresh_url" && body.report_id) {
      const { data: rep } = await supabaseAdmin
        .from("ttb_reports")
        .select("pdf_path, org_id")
        .eq("id", body.report_id)
        .eq("org_id", orgId)
        .maybeSingle();
      if (!rep?.pdf_path) throw new Error("No stored report file to refresh");
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("ttb-reports")
        .createSignedUrl(rep.pdf_path, SIGNED_URL_TTL_SECONDS);
      if (signErr || !signed?.signedUrl) throw new Error(`Failed to sign URL: ${signErr?.message || "unknown"}`);
      await supabaseAdmin.from("ttb_reports").update({ pdf_url: signed.signedUrl }).eq("id", body.report_id);
      return new Response(JSON.stringify({ success: true, pdf_url: signed.signedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Export additions log
    if (body.type === "additions_log") {
      const { from, to } = body;
      if (!from || !to) throw new Error("Missing 'from' or 'to' date");
      const { data: additions } = await supabaseAdmin
        .from("ttb_additions")
        .select("*, vintages(year, blocks(name))")
        .eq("org_id", orgId)
        .gte("added_at", from)
        .lte("added_at", to)
        .order("added_at");

      // P0: Empty-state validation — refuse to generate empty reports
      if (!additions || additions.length === 0) {
        return new Response(JSON.stringify({
          error: "No TTB additions found in the selected period. Log additions in Vintage Detail before exporting.",
        }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const html = `<html><body style="font-family:sans-serif;padding:40px;">
        <h1>TTB Additions Log</h1>
        <p><strong>Period:</strong> ${from} to ${to}</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;">
          <tr><th>Date</th><th>Vintage</th><th>Type</th><th>TTB Code</th><th>Amount</th><th>Unit</th><th>Batch (gal)</th><th>Notes</th></tr>
          ${additions.map((a: any) => `<tr>
            <td>${a.added_at?.split("T")[0]}</td>
            <td>${a.vintages?.year || "—"} ${a.vintages?.blocks?.name || ""}</td>
            <td>${a.addition_type}</td>
            <td>${a.ttb_code || "—"}</td>
            <td>${a.amount}</td>
            <td>${a.unit}</td>
            <td>${a.batch_size_gallons || "—"}</td>
            <td>${a.notes || ""}</td>
          </tr>`).join("")}
        </table>
        <p style="color:#888;font-size:12px;margin-top:20px;">Generated ${new Date().toISOString().split("T")[0]}</p>
      </body></html>`;

      const fileName = `additions_log_${from}_${to}.html`;
      const storagePath = `${orgId}/${fileName}`;
      await supabaseAdmin.storage.from("ttb-reports").upload(storagePath, new TextEncoder().encode(html), { contentType: "text/html", upsert: true });
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("ttb-reports")
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
      if (signErr || !signed?.signedUrl) throw new Error(`Failed to sign URL: ${signErr?.message || "unknown"}`);

      // P2: Audit row for additions log exports
      await supabaseAdmin.from("ttb_export_log").insert({
        org_id: orgId,
        exported_by: userId,
        export_type: "additions_log",
        period_start: from,
        period_end: to,
        row_count: additions.length,
        storage_path: storagePath,
      });

      return new Response(JSON.stringify({ success: true, pdf_url: signed.signedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate OW-1 report PDF
    const { report_id } = body;
    const { data: report } = await supabaseAdmin.from("ttb_reports").select("*").eq("id", report_id).eq("org_id", orgId).single();
    if (!report) throw new Error("Report not found");

    const { data: bondInfo } = await supabaseAdmin.from("ttb_bond_info").select("*").eq("org_id", orgId).maybeSingle();
    const { data: operations } = await supabaseAdmin.from("ttb_wine_premise_operations").select("*").eq("report_id", report_id).order("wine_type");

    // P0: Preflight validation — refuse to render OW-1 with missing compliance data
    const missing: string[] = [];
    if (!bondInfo) {
      missing.push("Bond information (BWN, Proprietor, Registry, Premises, Bond Number) — configure in Compliance Settings");
    } else {
      if (!bondInfo.bonded_winery_number) missing.push("Bonded Wine Premises Number (BWN)");
      if (!bondInfo.proprietor_name) missing.push("Proprietor Name");
      if (!bondInfo.bond_number) missing.push("Bond Number");
    }
    if (!operations || operations.length === 0) {
      missing.push("Wine premise operations (no rows for this report)");
    }
    if (missing.length > 0) {
      return new Response(JSON.stringify({
        error: "Cannot generate OW-1: required compliance data is missing.",
        missing,
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const wineTypeLabels: Record<string, string> = {
      still_table_wine: "Still Table Wine",
      sparkling_wine: "Sparkling Wine",
      dessert_wine: "Dessert Wine",
      vermouth: "Vermouth",
      other: "Other",
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TTB Form 5120.17 — Report of Wine Premises Operations</title>
<style>
  @page {
    size: letter;
    margin: 0.6in 0.5in;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    color: #000;
    line-height: 1.35;
    max-width: 8in;
    margin: 0 auto;
    padding: 0.6in 0.5in;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }

  .form-header {
    text-align: center;
    border-bottom: 3px double #000;
    padding-bottom: 10pt;
    margin-bottom: 12pt;
  }
  .form-header h1 {
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 1.5pt;
    font-weight: normal;
    margin-bottom: 2pt;
  }
  .form-header h2 {
    font-size: 13pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    margin-bottom: 2pt;
  }
  .form-header .form-number {
    font-size: 9pt;
    color: #444;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1pt 24pt;
    border: 1px solid #000;
    padding: 8pt;
    margin-bottom: 14pt;
    font-size: 10pt;
  }
  .info-grid .field { padding: 3pt 0; }
  .info-grid .field-label { font-weight: bold; font-size: 8pt; text-transform: uppercase; color: #333; display: block; margin-bottom: 1pt; }
  .info-grid .field-value { font-size: 11pt; min-height: 14pt; border-bottom: 1px solid #999; padding-bottom: 1pt; }
  .info-grid .full-width { grid-column: 1 / -1; }

  .section-label {
    font-size: 9pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    background: #000;
    color: #fff;
    padding: 3pt 6pt;
    margin-bottom: 0;
  }

  table.operations {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    margin-bottom: 16pt;
  }
  table.operations th {
    background: #e8e8e8;
    border: 1px solid #000;
    padding: 4pt 3pt;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.3pt;
    text-align: center;
    font-weight: bold;
    vertical-align: bottom;
  }
  table.operations td {
    border: 1px solid #000;
    padding: 4pt 5pt;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-family: "Courier New", monospace;
    font-size: 10pt;
  }
  table.operations td:first-child {
    text-align: left;
    font-family: "Times New Roman", Times, serif;
    font-size: 10pt;
  }
  table.operations tr.totals-row td {
    font-weight: bold;
    border-top: 2px solid #000;
    background: #f5f5f5;
  }

  .certification {
    border: 1px solid #000;
    padding: 12pt;
    margin-top: 20pt;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  .certification h3 {
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    margin-bottom: 6pt;
  }
  .sig-line {
    display: flex;
    gap: 24pt;
    margin-top: 28pt;
  }
  .sig-field {
    flex: 1;
    border-top: 1px solid #000;
    padding-top: 3pt;
    font-size: 8pt;
    text-transform: uppercase;
    color: #444;
  }

  .footer {
    margin-top: 16pt;
    font-size: 8pt;
    color: #888;
    text-align: center;
    border-top: 1px solid #ccc;
    padding-top: 6pt;
  }

  .print-banner {
    background: #6B1B2A;
    color: #fff;
    padding: 12pt 16pt;
    border-radius: 6px;
    margin-bottom: 20pt;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13pt;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .print-banner button {
    background: #fff;
    color: #6B1B2A;
    border: none;
    padding: 8pt 20pt;
    border-radius: 4px;
    font-weight: 600;
    font-size: 12pt;
    cursor: pointer;
  }
  .print-banner button:hover { opacity: 0.9; }
</style>
</head>
<body>
  <div class="print-banner no-print">
    <span>TTB Form 5120.17 — Use <strong>⌘P</strong> or <strong>Ctrl+P</strong> to save as PDF</span>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>

  <div class="form-header">
    <h1>Department of the Treasury — Alcohol and Tobacco Tax and Trade Bureau</h1>
    <h2>Report of Wine Premises Operations</h2>
    <div class="form-number">TTB F 5120.17 (OW-1)</div>
  </div>

  <div class="info-grid">
    <div class="field">
      <span class="field-label">1. Serial Number</span>
      <div class="field-value">${report.id?.slice(0, 8).toUpperCase() || ""}</div>
    </div>
    <div class="field">
      <span class="field-label">2. Bonded Wine Premises Number (BWN)</span>
      <div class="field-value">${bondInfo?.bonded_winery_number || ""}</div>
    </div>
    <div class="field">
      <span class="field-label">3. Proprietor Name</span>
      <div class="field-value">${bondInfo?.proprietor_name || ""}</div>
    </div>
    <div class="field">
      <span class="field-label">4. Registry / Permit Number</span>
      <div class="field-value">${bondInfo?.registry_number || ""}</div>
    </div>
    <div class="field full-width">
      <span class="field-label">5. Premises Location</span>
      <div class="field-value">${bondInfo?.premises_address || ""}</div>
    </div>
    <div class="field">
      <span class="field-label">6. Report Period — From</span>
      <div class="field-value">${report.report_period_start}</div>
    </div>
    <div class="field">
      <span class="field-label">6. Report Period — To</span>
      <div class="field-value">${report.report_period_end}</div>
    </div>
    <div class="field">
      <span class="field-label">7. Bond Number</span>
      <div class="field-value">${bondInfo?.bond_number || ""}</div>
    </div>
    <div class="field">
      <span class="field-label">8. Date Prepared</span>
      <div class="field-value">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
    </div>
  </div>

  <div class="section-label">Part I — Wine Operations (Wine Gallons)</div>
  <table class="operations">
    <thead>
      <tr>
        <th style="width:18%;">Wine Type</th>
        <th>Line</th>
        <th>Beginning<br>Inventory</th>
        <th>Produced</th>
        <th>Received</th>
        <th>Bottled /<br>Packed</th>
        <th>Shipped /<br>Removed</th>
        <th>Dumped /<br>Lost</th>
        <th>Ending<br>Inventory</th>
      </tr>
    </thead>
    <tbody>
      ${(operations || []).map((op: any, i: number) => {
        const label = wineTypeLabels[op.wine_type] || op.wine_type;
        return `<tr>
          <td>${label}</td>
          <td style="text-align:center;font-family:serif;">${i + 1}</td>
          <td>${op.beginning_inventory_gallons?.toFixed(2) ?? "—"}</td>
          <td>${op.produced_gallons?.toFixed(2) ?? "—"}</td>
          <td>${op.received_gallons?.toFixed(2) ?? "—"}</td>
          <td>${op.bottled_gallons?.toFixed(2) ?? "—"}</td>
          <td>${op.shipped_gallons?.toFixed(2) ?? "—"}</td>
          <td>${op.dumped_gallons?.toFixed(2) ?? "—"}</td>
          <td>${op.ending_inventory_gallons?.toFixed(2) ?? "—"}</td>
        </tr>`;
      }).join("")}
      ${(() => {
        const ops = operations || [];
        if (ops.length < 2) return "";
        const sum = (key: string) => ops.reduce((s: number, o: any) => s + (o[key] || 0), 0);
        return `<tr class="totals-row">
          <td>TOTALS</td>
          <td style="text-align:center;font-family:serif;"></td>
          <td>${sum("beginning_inventory_gallons").toFixed(2)}</td>
          <td>${sum("produced_gallons").toFixed(2)}</td>
          <td>${sum("received_gallons").toFixed(2)}</td>
          <td>${sum("bottled_gallons").toFixed(2)}</td>
          <td>${sum("shipped_gallons").toFixed(2)}</td>
          <td>${sum("dumped_gallons").toFixed(2)}</td>
          <td>${sum("ending_inventory_gallons").toFixed(2)}</td>
        </tr>`;
      })()}
    </tbody>
  </table>

  <div class="certification">
    <h3>Certification</h3>
    <p>Under penalties of perjury, I declare that I have examined this report, including any accompanying schedules and statements, and to the best of my knowledge and belief, it is true, correct, and complete.</p>
    <div class="sig-line">
      <div class="sig-field" style="flex:2;">Signature of Proprietor or Authorized Person</div>
      <div class="sig-field">Title</div>
      <div class="sig-field">Date</div>
    </div>
  </div>

  <div class="footer">
    Generated by Solera on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} •
    This is a computer-generated reproduction of TTB F 5120.17 for reference purposes.
  </div>
</body>
</html>`;

    const fileName = `ow1_${report.report_period_start}_${report.report_period_end}.html`;
    const storagePath = `${orgId}/${fileName}`;
    await supabaseAdmin.storage.from("ttb-reports").upload(storagePath, new TextEncoder().encode(html), { contentType: "text/html", upsert: true });
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("ttb-reports")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed?.signedUrl) throw new Error(`Failed to sign URL: ${signErr?.message || "unknown"}`);

    await supabaseAdmin.from("ttb_reports")
      .update({ pdf_url: signed.signedUrl, pdf_path: storagePath, status: "ready" })
      .eq("id", report_id);

    return new Response(JSON.stringify({ success: true, pdf_url: signed.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
