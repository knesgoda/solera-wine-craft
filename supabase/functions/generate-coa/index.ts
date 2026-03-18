import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { vintage_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: vintage } = await supabase.from("vintages").select("*, blocks(name, vineyards(name))").eq("id", vintage_id).single();
    if (!vintage) throw new Error("Vintage not found");

    const { data: labSamples } = await supabase.from("lab_samples").select("*").eq("vintage_id", vintage_id).order("sampled_at", { ascending: false });
    const { data: trials } = await supabase.from("blending_trials").select("*, blending_trial_lots(*)").eq("vintage_id", vintage_id).eq("finalized", true);

    const latestLab = labSamples?.[0];

    // Build a simple HTML-based COA (in production, use jsPDF)
    const coaHtml = `
      <html><body style="font-family:sans-serif;padding:40px;">
      <h1>Certificate of Analysis</h1>
      <hr/>
      <h2>${vintage.year} Vintage — ${(vintage as any).blocks?.name || ""}</h2>
      <p>Vineyard: ${(vintage as any).blocks?.vineyards?.name || "N/A"}</p>
      <p>Status: ${vintage.status}</p>
      ${vintage.harvest_date ? `<p>Harvest Date: ${vintage.harvest_date}</p>` : ""}
      <h3>Final Lab Values</h3>
      ${latestLab ? `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr><th>Parameter</th><th>Value</th></tr>
        ${latestLab.brix != null ? `<tr><td>Brix</td><td>${latestLab.brix}°</td></tr>` : ""}
        ${latestLab.ph != null ? `<tr><td>pH</td><td>${latestLab.ph}</td></tr>` : ""}
        ${latestLab.ta != null ? `<tr><td>TA</td><td>${latestLab.ta}</td></tr>` : ""}
        ${latestLab.va != null ? `<tr><td>VA</td><td>${latestLab.va}</td></tr>` : ""}
        ${latestLab.alcohol != null ? `<tr><td>Alcohol</td><td>${latestLab.alcohol}%</td></tr>` : ""}
        ${latestLab.so2_free != null ? `<tr><td>Free SO₂</td><td>${latestLab.so2_free}</td></tr>` : ""}
        ${latestLab.so2_total != null ? `<tr><td>Total SO₂</td><td>${latestLab.so2_total}</td></tr>` : ""}
        ${latestLab.rs != null ? `<tr><td>RS</td><td>${latestLab.rs}</td></tr>` : ""}
        </table>
      ` : "<p>No lab data available.</p>"}
      ${trials && trials.length > 0 ? `
        <h3>Blend Composition</h3>
        ${trials.map((t: any) => `<p><strong>${t.name}</strong>${t.notes ? ` — ${t.notes}` : ""}</p>`).join("")}
      ` : ""}
      <br/><br/>
      <p>_________________________</p>
      <p>Facility Signature</p>
      <p style="color:#888;font-size:12px;">Generated ${new Date().toISOString().split("T")[0]}</p>
      </body></html>
    `;

    // Store as HTML document (clients can print to PDF)
    const fileName = `coa_${vintage.year}_${vintage_id.slice(0, 8)}.html`;
    const clientOrgId = vintage.client_org_id || "facility";

    const encoder = new TextEncoder();
    const fileBytes = encoder.encode(coaHtml);

    await supabase.storage.from("client-documents").upload(
      `${clientOrgId}/${fileName}`,
      fileBytes,
      { contentType: "text/html", upsert: true }
    );

    const { data: urlData } = supabase.storage.from("client-documents").getPublicUrl(`${clientOrgId}/${fileName}`);

    return new Response(JSON.stringify({ success: true, pdf_url: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
