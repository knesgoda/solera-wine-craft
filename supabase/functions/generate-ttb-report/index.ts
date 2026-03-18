import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Export additions log
    if (body.type === "additions_log") {
      const { from, to } = body;
      const { data: additions } = await supabaseAdmin
        .from("ttb_additions")
        .select("*, vintages(year, blocks(name))")
        .eq("org_id", orgId)
        .gte("added_at", from)
        .lte("added_at", to)
        .order("added_at");

      const html = `<html><body style="font-family:sans-serif;padding:40px;">
        <h1>TTB Additions Log</h1>
        <p><strong>Period:</strong> ${from} to ${to}</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;">
          <tr><th>Date</th><th>Vintage</th><th>Type</th><th>TTB Code</th><th>Amount</th><th>Unit</th><th>Batch (gal)</th><th>Notes</th></tr>
          ${(additions || []).map((a: any) => `<tr>
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
      await supabaseAdmin.storage.from("ttb-reports").upload(`${orgId}/${fileName}`, new TextEncoder().encode(html), { contentType: "text/html", upsert: true });
      const { data: urlData } = supabaseAdmin.storage.from("ttb-reports").getPublicUrl(`${orgId}/${fileName}`);

      return new Response(JSON.stringify({ success: true, pdf_url: urlData.publicUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate OW-1 report PDF
    const { report_id } = body;
    const { data: report } = await supabaseAdmin.from("ttb_reports").select("*").eq("id", report_id).eq("org_id", orgId).single();
    if (!report) throw new Error("Report not found");

    const { data: bondInfo } = await supabaseAdmin.from("ttb_bond_info").select("*").eq("org_id", orgId).maybeSingle();
    const { data: operations } = await supabaseAdmin.from("ttb_wine_premise_operations").select("*").eq("report_id", report_id).order("wine_type");

    const wineTypeLabels: Record<string, string> = {
      still_table_wine: "Still Table Wine",
      sparkling_wine: "Sparkling Wine",
      dessert_wine: "Dessert Wine",
      vermouth: "Vermouth",
      other: "Other",
    };

    const html = `<html><body style="font-family:serif;padding:40px;max-width:900px;margin:0 auto;">
      <div style="text-align:center;border-bottom:3px double #333;padding-bottom:16px;margin-bottom:20px;">
        <h2 style="margin:0;">DEPARTMENT OF THE TREASURY — TTB</h2>
        <h3 style="margin:4px 0;">REPORT OF WINE PREMISES OPERATIONS</h3>
        <p style="margin:2px 0;font-size:13px;">TTB Form 5120.17</p>
      </div>

      <table style="width:100%;margin-bottom:20px;font-size:14px;" cellpadding="4">
        <tr><td><strong>Bonded Winery Number:</strong> ${bondInfo?.bonded_winery_number || "___________"}</td>
            <td><strong>Registry Number:</strong> ${bondInfo?.registry_number || "___________"}</td></tr>
        <tr><td><strong>Proprietor:</strong> ${bondInfo?.proprietor_name || "___________"}</td>
            <td><strong>Bond Number:</strong> ${bondInfo?.bond_number || "___________"}</td></tr>
        <tr><td colspan="2"><strong>Premises:</strong> ${bondInfo?.premises_address || "___________"}</td></tr>
        <tr><td colspan="2"><strong>Report Period:</strong> ${report.report_period_start} to ${report.report_period_end}</td></tr>
      </table>

      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
        <tr style="background:#f0f0f0;">
          <th>Wine Type</th><th>Beginning Inv.</th><th>Produced</th><th>Received</th><th>Bottled</th><th>Shipped</th><th>Dumped</th><th>Ending Inv.</th>
        </tr>
        ${(operations || []).map((op: any) => `<tr>
          <td>${wineTypeLabels[op.wine_type] || op.wine_type}</td>
          <td style="text-align:right;">${op.beginning_inventory_gallons?.toFixed(2)}</td>
          <td style="text-align:right;">${op.produced_gallons?.toFixed(2)}</td>
          <td style="text-align:right;">${op.received_gallons?.toFixed(2)}</td>
          <td style="text-align:right;">${op.bottled_gallons?.toFixed(2)}</td>
          <td style="text-align:right;">${op.shipped_gallons?.toFixed(2)}</td>
          <td style="text-align:right;">${op.dumped_gallons?.toFixed(2)}</td>
          <td style="text-align:right;">${op.ending_inventory_gallons?.toFixed(2)}</td>
        </tr>`).join("")}
      </table>

      <div style="margin-top:40px;font-size:13px;">
        <p><strong>CERTIFICATION:</strong> I certify under penalties of perjury that this report has been examined by me and, to the best of my knowledge and belief, is a true, correct, and complete report.</p>
        <div style="margin-top:30px;display:flex;justify-content:space-between;">
          <div style="border-top:1px solid #333;width:45%;padding-top:4px;">Signature of Proprietor or Authorized Person</div>
          <div style="border-top:1px solid #333;width:30%;padding-top:4px;">Date</div>
        </div>
      </div>

      <p style="color:#888;font-size:11px;margin-top:30px;">Generated by Solera on ${new Date().toISOString().split("T")[0]}</p>
    </body></html>`;

    const fileName = `ow1_${report.report_period_start}_${report.report_period_end}.html`;
    await supabaseAdmin.storage.from("ttb-reports").upload(`${orgId}/${fileName}`, new TextEncoder().encode(html), { contentType: "text/html", upsert: true });
    const { data: urlData } = supabaseAdmin.storage.from("ttb-reports").getPublicUrl(`${orgId}/${fileName}`);

    await supabaseAdmin.from("ttb_reports").update({ pdf_url: urlData.publicUrl, status: "ready" }).eq("id", report_id);

    return new Response(JSON.stringify({ success: true, pdf_url: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
