import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { vintage_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // --- Authorization check ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: vintage } = await supabase.from("vintages").select("*, blocks(name, vineyards(name))").eq("id", vintage_id).single();
    if (!vintage) throw new Error("Vintage not found");

    // Check caller is facility user for this org OR client user for this vintage's client_org_id
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    const { data: clientUser } = await supabase.from("client_users").select("client_org_id").eq("auth_user_id", user.id).single();

    const isFacilityUser = profile?.org_id === vintage.org_id;
    const isClientOwner = clientUser?.client_org_id != null && vintage.client_org_id === clientUser.client_org_id;

    if (!isFacilityUser && !isClientOwner) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- End authorization check ---

    const { data: labSamples } = await supabase.from("lab_samples").select("*").eq("vintage_id", vintage_id).order("sampled_at", { ascending: false });
    const { data: trials } = await supabase.from("blending_trials").select("*, blending_trial_lots(*)").eq("vintage_id", vintage_id).eq("finalized", true);

    const latestLab = labSamples?.[0];

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
    const msg = (e as Error).message;
    const status = msg === "Unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
