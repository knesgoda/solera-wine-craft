import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, action, payload } = await req.json();
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");

    if (!adminPassword || password !== adminPassword) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── Overview Stats ───
    if (action === "overview-stats") {
      const [orgsRes, profilesRes, vintagesRes, labsRes, ordersRes] = await Promise.all([
        supabase.from("organizations").select("id, tier, created_at"),
        supabase.from("profiles").select("id, last_active_at"),
        supabase.from("vintages").select("id"),
        supabase.from("lab_samples").select("id"),
        supabase.from("orders").select("id"),
      ]);

      const orgs = orgsRes.data || [];
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const tierCounts: Record<string, number> = {};
      let newSignupsThisWeek = 0;
      for (const org of orgs) {
        const t = org.tier || "hobbyist";
        tierCounts[t] = (tierCounts[t] || 0) + 1;
        if (new Date(org.created_at) >= weekAgo) newSignupsThisWeek++;
      }

      // MRR calculation based on tier pricing
      const tierPrices: Record<string, number> = {
        hobbyist: 0,
        small_boutique: 99,
        mid_size: 249,
        enterprise: 499,
      };
      let mrr = 0;
      for (const org of orgs) {
        mrr += tierPrices[org.tier || "hobbyist"] || 0;
      }

      return json({
        tierCounts,
        mrr,
        newSignupsThisWeek,
        totalActiveUsers: (profilesRes.data || []).length,
        totalVintages: (vintagesRes.data || []).length,
        totalLabSamples: (labsRes.data || []).length,
        totalOrders: (ordersRes.data || []).length,
      });
    }

    // ─── Customer List ───
    if (action === "customer-list") {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name, tier, created_at, updated_at, needs_onboarding_call")
        .order("created_at", { ascending: false });

      const orgIds = (orgs || []).map((o: any) => o.id);
      
      const [profilesRes, vintagesRes] = await Promise.all([
        supabase.from("profiles").select("id, org_id, last_active_at").in("org_id", orgIds.length ? orgIds : [""]),
        supabase.from("vintages").select("id, org_id").in("org_id", orgIds.length ? orgIds : [""]),
      ]);

      const profiles = profilesRes.data || [];
      const vintages = vintagesRes.data || [];

      const tierPrices: Record<string, number> = {
        hobbyist: 0, small_boutique: 99, mid_size: 249, enterprise: 499,
      };

      const enriched = (orgs || []).map((org: any) => {
        const orgProfiles = profiles.filter((p: any) => p.org_id === org.id);
        const lastActive = orgProfiles.reduce((latest: string | null, p: any) => {
          if (!p.last_active_at) return latest;
          if (!latest) return p.last_active_at;
          return p.last_active_at > latest ? p.last_active_at : latest;
        }, null);

        return {
          ...org,
          userCount: orgProfiles.length,
          vintageCount: vintages.filter((v: any) => v.org_id === org.id).length,
          lastActive,
          mrr: tierPrices[org.tier || "hobbyist"] || 0,
        };
      });

      return json({ customers: enriched });
    }

    // ─── Org Detail ───
    if (action === "org-detail") {
      const orgId = payload?.orgId;
      if (!orgId) return json({ error: "orgId required" }, 400);

      const [orgRes, usersRes, vintagesRes, importsRes, labsRes] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", orgId).single(),
        supabase.from("profiles").select("id, email, first_name, last_name, role, last_active_at, created_at").eq("org_id", orgId),
        supabase.from("vintages").select("id, name, variety, vintage_year, status, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(20),
        supabase.from("import_jobs").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(10),
        supabase.from("lab_samples").select("id, sampled_at, brix, ph, ta, va").order("sampled_at", { ascending: false }).limit(20),
      ]);

      return json({
        org: orgRes.data,
        users: usersRes.data || [],
        vintages: vintagesRes.data || [],
        imports: importsRes.data || [],
        recentLabSamples: labsRes.data || [],
      });
    }

    // ─── Health Alerts ───
    if (action === "health-alerts") {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      const [orgsRes, profilesRes, failedImportsRes] = await Promise.all([
        supabase.from("organizations").select("id, name, tier, needs_onboarding_call"),
        supabase.from("profiles").select("org_id, last_active_at"),
        supabase.from("import_jobs").select("id, org_id, status, created_at").eq("status", "failed"),
      ]);

      const orgs = orgsRes.data || [];
      const profiles = profilesRes.data || [];
      const failedImports = failedImportsRes.data || [];

      const alerts: any[] = [];

      for (const org of orgs) {
        const orgProfiles = profiles.filter((p: any) => p.org_id === org.id);
        const lastActive = orgProfiles.reduce((latest: string | null, p: any) => {
          if (!p.last_active_at) return latest;
          if (!latest) return p.last_active_at;
          return p.last_active_at > latest ? p.last_active_at : latest;
        }, null);

        if (!lastActive || lastActive < fourteenDaysAgo) {
          alerts.push({ type: "churn_risk", orgId: org.id, orgName: org.name, detail: `Last active: ${lastActive || "never"}` });
        }

        if (org.needs_onboarding_call && org.tier === "enterprise") {
          alerts.push({ type: "onboarding_needed", orgId: org.id, orgName: org.name, detail: "Enterprise org needs onboarding call" });
        }

        const orgFailedImports = failedImports.filter((i: any) => i.org_id === org.id);
        if (orgFailedImports.length > 0) {
          alerts.push({ type: "import_failed", orgId: org.id, orgName: org.name, detail: `${orgFailedImports.length} failed import(s)` });
        }
      }

      return json({ alerts });
    }

    // ─── Support Context Builder ───
    if (action === "support-context") {
      const orgId = payload?.orgId;
      if (!orgId) return json({ error: "orgId required" }, 400);

      const [orgRes, usersRes, vintagesRes, labsRes, importsRes, errorsRes] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", orgId).single(),
        supabase.from("profiles").select("email, first_name, last_name, role, last_active_at").eq("org_id", orgId),
        supabase.from("vintages").select("id, name, variety, vintage_year, status").eq("org_id", orgId).order("created_at", { ascending: false }).limit(10),
        supabase.from("lab_samples").select("sampled_at, brix, ph, ta, va, so2_free").order("sampled_at", { ascending: false }).limit(5),
        supabase.from("import_jobs").select("id, source_type, status, total_rows, imported_rows, error_rows, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(5),
        supabase.from("anomaly_flags").select("parameter, value, flagged_at, resolved").eq("org_id", orgId).order("flagged_at", { ascending: false }).limit(5),
      ]);

      const org = orgRes.data;
      const users = usersRes.data || [];
      const vintages = vintagesRes.data || [];
      const labs = labsRes.data || [];
      const imports = importsRes.data || [];
      const anomalies = errorsRes.data || [];

      let ctx = `# Solera Support Context — ${org?.name || "Unknown Org"}\n\n`;
      ctx += `## Organization\n`;
      ctx += `- **Tier:** ${org?.tier || "hobbyist"}\n`;
      ctx += `- **Type:** ${org?.type || "N/A"}\n`;
      ctx += `- **Created:** ${org?.created_at}\n`;
      ctx += `- **Onboarding Completed:** ${org?.onboarding_completed ? "Yes" : "No"}\n`;
      ctx += `- **Needs Onboarding Call:** ${org?.needs_onboarding_call ? "Yes" : "No"}\n\n`;

      ctx += `## Users (${users.length})\n`;
      for (const u of users) {
        ctx += `- ${u.first_name} ${u.last_name} (${u.email}) — ${u.role}, last active: ${u.last_active_at || "never"}\n`;
      }

      ctx += `\n## Active Vintages (${vintages.length})\n`;
      for (const v of vintages) {
        ctx += `- ${v.name} (${v.variety}, ${v.vintage_year}) — ${v.status}\n`;
      }

      ctx += `\n## Recent Lab Samples\n`;
      for (const l of labs) {
        ctx += `- ${l.sampled_at}: Brix=${l.brix ?? "—"}, pH=${l.ph ?? "—"}, TA=${l.ta ?? "—"}, VA=${l.va ?? "—"}, Free SO₂=${l.so2_free ?? "—"}\n`;
      }

      ctx += `\n## Recent Imports\n`;
      for (const i of imports) {
        ctx += `- ${i.created_at}: ${i.source_type} — ${i.status} (${i.imported_rows || 0}/${i.total_rows || 0} rows, ${i.error_rows || 0} errors)\n`;
      }

      ctx += `\n## Recent Anomalies\n`;
      for (const a of anomalies) {
        ctx += `- ${a.flagged_at}: ${a.parameter}=${a.value} (${a.resolved ? "resolved" : "UNRESOLVED"})\n`;
      }

      return json({ context: ctx });
    }

    // ─── Changelog CRUD ───
    if (action === "list-changelogs") {
      const { data } = await supabase.from("changelogs").select("*").order("released_at", { ascending: false });
      return json({ changelogs: data || [] });
    }

    if (action === "create-changelog") {
      const { id, ...insertData } = payload;
      const { data, error } = await supabase.from("changelogs").insert(insertData).select().single();
      if (error) throw error;
      return json({ changelog: data });
    }

    if (action === "update-changelog") {
      const { id, ...updateData } = payload;
      const { error } = await supabase.from("changelogs").update(updateData).eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "delete-changelog") {
      const { error } = await supabase.from("changelogs").delete().eq("id", payload.id);
      if (error) throw error;
      return json({ success: true });
    }

    // ─── Roadmap CRUD ───
    if (action === "list-roadmap") {
      const { data } = await supabase.from("roadmap_items").select("*").order("votes", { ascending: false });
      return json({ items: data || [] });
    }

    if (action === "create-roadmap") {
      const { id, ...insertData } = payload;
      const { data, error } = await supabase.from("roadmap_items").insert(insertData).select().single();
      if (error) throw error;
      return json({ item: data });
    }

    if (action === "update-roadmap") {
      const { id, ...updateData } = payload;
      const { error } = await supabase.from("roadmap_items").update(updateData).eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "delete-roadmap") {
      const { error } = await supabase.from("roadmap_items").delete().eq("id", payload.id);
      if (error) throw error;
      return json({ success: true });
    }

    // ─── Environment Health Check ───
    if (action === "health-check") {
      const checks: Record<string, { status: string; detail?: string }> = {};

      // Supabase
      try {
        const { data, error } = await supabase.from("organizations").select("id").limit(1);
        checks.supabase = error ? { status: "red", detail: error.message } : { status: "green" };
      } catch (e: any) {
        checks.supabase = { status: "red", detail: e.message };
      }

      // Open-Meteo
      try {
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=38.5&longitude=-122.5&current=temperature_2m");
        checks.openMeteo = res.ok ? { status: "green" } : { status: "red", detail: `HTTP ${res.status}` };
      } catch (e: any) {
        checks.openMeteo = { status: "red", detail: e.message };
      }

      // Stripe (check if key exists)
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        try {
          const res = await fetch("https://api.stripe.com/v1/balance", {
            headers: { Authorization: `Bearer ${stripeKey}` },
          });
          const data = await res.json();
          const isTest = stripeKey.startsWith("sk_test_");
          checks.stripe = res.ok
            ? { status: "green", detail: isTest ? "Test mode" : "Live mode" }
            : { status: "red", detail: data.error?.message || `HTTP ${res.status}` };
        } catch (e: any) {
          checks.stripe = { status: "red", detail: e.message };
        }
      } else {
        checks.stripe = { status: "red", detail: "STRIPE_SECRET_KEY not set" };
      }

      // Resend
      const resendKey = Deno.env.get("RESEND_API_KEY");
      checks.resend = resendKey
        ? { status: "green", detail: "API key configured" }
        : { status: "red", detail: "RESEND_API_KEY not set" };

      // Anthropic / Lovable AI
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      checks.ai = lovableKey
        ? { status: "green", detail: "Lovable AI configured" }
        : { status: "red", detail: "LOVABLE_API_KEY not set" };

      return json({ checks, checkedAt: new Date().toISOString() });
    }

    // ─── Create Admin User ───
    if (action === "create-user") {
      const { email, userPassword, firstName, lastName, orgName, tier } = payload;
      
      // Create auth user (auto-confirmed via admin API)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: userPassword,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
      });
      if (authError) throw authError;
      
      const userId = authData.user.id;

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: orgName, tier: tier || "enterprise", onboarding_completed: true })
        .select()
        .single();
      if (orgError) throw orgError;

      // Link profile to org
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ org_id: org.id, first_name: firstName, last_name: lastName })
        .eq("id", userId);
      if (profileError) throw profileError;

      // Assign owner role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "owner" });
      if (roleError) throw roleError;

      return json({ success: true, userId, orgId: org.id });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
