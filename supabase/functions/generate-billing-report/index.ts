import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_org_id, from, to } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: clientOrg } = await supabase.from("client_orgs").select("*, organizations:parent_org_id(name)").eq("id", client_org_id).single();
    if (!clientOrg) throw new Error("Client org not found");

    // Get vintages for this client
    const { data: vintages } = await supabase.from("vintages").select("*, blocks(name)").eq("client_org_id", client_org_id);

    const vintageIds = (vintages || []).map((v: any) => v.id);

    // Get additions in date range
    const { data: additions } = await supabase.from("ttb_additions").select("*").in("vintage_id", vintageIds).gte("added_at", from).lte("added_at", to).order("added_at");

    // Get lab samples in date range
    const { data: labSamples } = await supabase.from("lab_samples").select("*").in("vintage_id", vintageIds).gte("sampled_at", from).lte("sampled_at", to).order("sampled_at");

    const facilityName = (clientOrg as any).organizations?.name || "Facility";

    const reportHtml = `
      <html><body style="font-family:sans-serif;padding:40px;">
      <h1>Billing Report</h1>
      <p><strong>Client:</strong> ${clientOrg.name}</p>
      <p><strong>Facility:</strong> ${facilityName}</p>
      <p><strong>Period:</strong> ${from} to ${to}</p>
      <hr/>
      <h2>Vintages</h2>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <tr><th>Year</th><th>Block</th><th>Status</th><th>Tons</th></tr>
      ${(vintages || []).map((v: any) => `<tr><td>${v.year}</td><td>${v.blocks?.name || "—"}</td><td>${v.status}</td><td>${v.tons_harvested || "—"}</td></tr>`).join("")}
      </table>

      <h2>Additions (${(additions || []).length})</h2>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <tr><th>Date</th><th>Type</th><th>Amount</th><th>Unit</th></tr>
      ${(additions || []).map((a: any) => `<tr><td>${a.added_at?.split("T")[0]}</td><td>${a.addition_type}</td><td>${a.amount}</td><td>${a.unit}</td></tr>`).join("")}
      </table>

      <h2>Lab Samples (${(labSamples || []).length})</h2>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <tr><th>Date</th><th>Brix</th><th>pH</th><th>TA</th><th>SO₂</th></tr>
      ${(labSamples || []).map((s: any) => `<tr><td>${s.sampled_at?.split("T")[0]}</td><td>${s.brix ?? "—"}</td><td>${s.ph ?? "—"}</td><td>${s.ta ?? "—"}</td><td>${s.so2_free ?? "—"}</td></tr>`).join("")}
      </table>

      <br/><p style="color:#888;font-size:12px;">Generated ${new Date().toISOString().split("T")[0]}</p>
      </body></html>
    `;

    const fileName = `billing_${from}_${to}_${client_org_id.slice(0, 8)}.html`;
    const encoder = new TextEncoder();
    await supabase.storage.from("client-documents").upload(
      `${client_org_id}/${fileName}`,
      encoder.encode(reportHtml),
      { contentType: "text/html", upsert: true }
    );

    const { data: urlData } = supabase.storage.from("client-documents").getPublicUrl(`${client_org_id}/${fileName}`);

    return new Response(JSON.stringify({ success: true, pdf_url: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
