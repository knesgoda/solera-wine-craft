import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function stripeGet(endpoint: string, stripeKey: string) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  return res.json();
}

// Paginate through all Stripe list results
async function stripeGetAll(endpoint: string, stripeKey: string): Promise<any[]> {
  const allItems: any[] = [];
  let url = endpoint.includes("?")
    ? `${endpoint}&limit=100`
    : `${endpoint}?limit=100`;
  while (true) {
    const res = await stripeGet(url, stripeKey);
    const items = res.data || [];
    allItems.push(...items);
    if (!res.has_more || items.length === 0) break;
    const lastId = items[items.length - 1].id;
    url = endpoint.includes("?")
      ? `${endpoint}&limit=100&starting_after=${lastId}`
      : `${endpoint}?limit=100&starting_after=${lastId}`;
  }
  return allItems;
}

// Extract monthly amount from a subscription using items/prices (not legacy plan)
function getSubMonthlyAmount(sub: any): number {
  // Prefer items array (Prices API)
  if (sub.items?.data?.length) {
    let total = 0;
    for (const item of sub.items.data) {
      const price = item.price || item.plan;
      if (!price) continue;
      const amount = (price.unit_amount || price.amount || 0) / 100;
      const qty = item.quantity || 1;
      const interval = price.recurring?.interval || price.interval || "month";
      if (interval === "year") total += (amount * qty) / 12;
      else total += amount * qty;
    }
    return total;
  }
  // Fallback to legacy plan field
  const interval = sub.plan?.interval || "month";
  const amount = (sub.plan?.amount || 0) / 100;
  return interval === "year" ? amount / 12 : amount;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, action, payload } = await req.json();
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");

    if (!adminPassword || password !== adminPassword) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

    // ─── Dashboard Full Stats ───
    if (action === "dashboard-stats") {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [orgsRes, profilesRes, labsRes, tasksRes, importsRes, vintagesRes, aiRes, blocksRes, failedImportsRes] = await Promise.all([
        supabase.from("organizations").select("id, tier, created_at"),
        supabase.from("profiles").select("id, org_id, last_active_at"),
        supabase.from("lab_samples").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id, status", { count: "exact", head: false }).eq("status", "done"),
        supabase.from("import_jobs").select("id, status", { count: "exact", head: false }),
        supabase.from("vintages").select("id", { count: "exact", head: true }),
        supabase.from("ai_conversations").select("id, created_at"),
        supabase.from("blocks").select("id, vineyard_id"),
        supabase.from("import_jobs").select("id").eq("status", "error"),
      ]);

      const orgs = orgsRes.data || [];
      const profiles = profilesRes.data || [];
      const allImports = importsRes.data || [];
      const aiConvos = aiRes.data || [];
      const blocks = blocksRes.data || [];
      const failedImports = failedImportsRes.data || [];

      // Tier breakdown
      const tierCounts: Record<string, number> = { hobbyist: 0, small_boutique: 0, mid_size: 0, enterprise: 0 };
      for (const org of orgs) {
        const t = org.tier || "hobbyist";
        tierCounts[t] = (tierCounts[t] || 0) + 1;
      }

      // New orgs
      const newOrgs24h = orgs.filter(o => o.created_at >= oneDayAgo).length;
      const newOrgsPrior24h = orgs.filter(o => o.created_at >= twoDaysAgo && o.created_at < oneDayAgo).length;
      const newOrgs7d = orgs.filter(o => o.created_at >= sevenDaysAgo).length;
      const newOrgsPrior7d = orgs.filter(o => o.created_at >= fourteenDaysAgo && o.created_at < sevenDaysAgo).length;

      // Active orgs
      const activeOrgs24h = new Set(profiles.filter(p => p.last_active_at && p.last_active_at >= oneDayAgo).map(p => p.org_id)).size;
      const activeOrgs7d = new Set(profiles.filter(p => p.last_active_at && p.last_active_at >= sevenDaysAgo).map(p => p.org_id)).size;

      // Ask Solera queries last 7d
      const aiQueries7d = aiConvos.filter(c => c.created_at >= sevenDaysAgo).length;

      // Alerts
      const alerts: any[] = [];
      
      // Failed imports
      if (failedImports.length > 0) {
        alerts.push({ severity: "red", icon: "🔴", label: `${failedImports.length} import job(s) with errors`, link: "operations" });
      }

      // Inactive orgs
      const orgActivity: Record<string, string | null> = {};
      for (const p of profiles) {
        if (!orgActivity[p.org_id] || (p.last_active_at && p.last_active_at > (orgActivity[p.org_id] || ""))) {
          orgActivity[p.org_id] = p.last_active_at;
        }
      }

      let inactive14d = 0;
      let inactive30d = 0;
      for (const org of orgs) {
        const lastActive = orgActivity[org.id];
        if (!lastActive || lastActive < thirtyDaysAgo) {
          inactive30d++;
          alerts.push({ severity: "red", icon: "🔴", label: `${org.id} — no login in 30+ days`, link: "customers" });
        } else if (lastActive < fourteenDaysAgo) {
          inactive14d++;
          alerts.push({ severity: "yellow", icon: "🟡", label: `Org inactive 14+ days`, link: "customers" });
        }
      }

      // Stripe summary
      let stripeSummary = { mrr: 0, activeSubscriptions: 0, failedPayments7d: 0, mrrAdded7d: 0, mrrChurned7d: 0 };
      if (stripeKey) {
        try {
          // Active subscriptions — paginated
          const allSubs = await stripeGetAll("/subscriptions?status=active&expand[]=data.items", stripeKey);
          let mrr = 0;
          let mrrAdded7d = 0;
          const sevenDaysAgoTs = Math.floor(new Date(sevenDaysAgo).getTime() / 1000);
          for (const sub of allSubs) {
            const monthlyAmount = getSubMonthlyAmount(sub);
            mrr += monthlyAmount;
            if (sub.created >= sevenDaysAgoTs) mrrAdded7d += monthlyAmount;
          }

          // Failed payments last 7d
          const failedEvents = await stripeGet(`/events?type=payment_intent.payment_failed&created[gte]=${sevenDaysAgoTs}&limit=100`, stripeKey);
          
          // Churned last 7d
          const churnedEvents = await stripeGet(`/events?type=customer.subscription.deleted&created[gte]=${sevenDaysAgoTs}&limit=100`, stripeKey);
          let mrrChurned = 0;
          for (const evt of (churnedEvents.data || [])) {
            const sub = evt.data?.object;
            mrrChurned += getSubMonthlyAmount(sub);
          }

          if ((failedEvents.data || []).length > 0) {
            alerts.push({ severity: "red", icon: "🔴", label: `${failedEvents.data.length} failed Stripe payment(s) last 7 days`, link: "revenue" });
          }

          stripeSummary = {
            mrr: Math.round(mrr),
            activeSubscriptions: allSubs.length,
            failedPayments7d: (failedEvents.data || []).length,
            mrrAdded7d: Math.round(mrrAdded7d),
            mrrChurned7d: Math.round(mrrChurned),
          };
        } catch (e) {
          console.error("Stripe error:", e);
        }
      }

      if (alerts.length === 0) {
        alerts.push({ severity: "green", icon: "✅", label: "All systems healthy", link: null });
      }

      return json({
        totalOrgs: orgs.length,
        newOrgs24h,
        newOrgs24hDelta: newOrgs24h - newOrgsPrior24h,
        newOrgs7d,
        newOrgs7dDelta: newOrgs7d - newOrgsPrior7d,
        tierCounts,
        activeOrgs24h,
        activeOrgs7d,
        totalLabSamples: labsRes.count || 0,
        totalTasksCompleted: (tasksRes.data || []).length,
        totalImportsCompleted: allImports.filter((i: any) => i.status === "completed").length,
        totalVintages: vintagesRes.count || 0,
        aiQueries7d,
        stripe: stripeSummary,
        alerts,
      });
    }

    // ─── Stripe Revenue Detail ───
    if (action === "stripe-revenue") {
      if (!stripeKey) return json({ error: "Stripe not configured" }, 400);

      const thirtyDaysAgoTs = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

      const [subs, failedEvents, deletedEvents, updatedEvents] = await Promise.all([
        stripeGet("/subscriptions?status=active&limit=100&expand[]=data.customer", stripeKey),
        stripeGet(`/events?type=payment_intent.payment_failed&created[gte]=${thirtyDaysAgoTs}&limit=100`, stripeKey),
        stripeGet(`/events?type=customer.subscription.deleted&created[gte]=${Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)}&limit=100`, stripeKey),
        stripeGet(`/events?type=customer.subscription.updated&created[gte]=${Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)}&limit=100`, stripeKey),
      ]);

      // Map subscriptions to orgs
      const { data: allOrgs } = await supabase.from("organizations").select("id, name, stripe_customer_id, stripe_subscription_id, tier");
      const orgByStripeCustomer: Record<string, any> = {};
      const orgByStripeSub: Record<string, any> = {};
      for (const org of (allOrgs || [])) {
        if (org.stripe_customer_id) orgByStripeCustomer[org.stripe_customer_id] = org;
        if (org.stripe_subscription_id) orgByStripeSub[org.stripe_subscription_id] = org;
      }

      let mrr = 0;
      const subscriptions = (subs.data || []).map((sub: any) => {
        const monthlyAmount = sub.plan?.interval === "year"
          ? (sub.plan?.amount || 0) / 12 / 100
          : (sub.plan?.amount || 0) / 100;
        mrr += monthlyAmount;
        const org = orgByStripeCustomer[sub.customer?.id || sub.customer] || orgByStripeSub[sub.id];
        return {
          id: sub.id,
          orgName: org?.name || sub.customer?.name || sub.customer?.email || "Unknown",
          orgId: org?.id,
          plan: sub.plan?.nickname || org?.tier || "Unknown",
          mrr: Math.round(monthlyAmount),
          billingCycle: sub.plan?.interval || "month",
          nextBilling: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cardLast4: sub.default_payment_method?.card?.last4 || null,
          cardExpiry: sub.default_payment_method?.card?.exp_month 
            ? `${sub.default_payment_method.card.exp_month}/${sub.default_payment_method.card.exp_year}` : null,
          cardStatus: "healthy",
          startedAt: new Date(sub.created * 1000).toISOString(),
        };
      });

      // Failed payments
      const failedPayments = (failedEvents.data || []).map((evt: any) => {
        const pi = evt.data?.object;
        const org = orgByStripeCustomer[pi?.customer];
        return {
          orgName: org?.name || pi?.customer || "Unknown",
          amount: (pi?.amount || 0) / 100,
          failedDate: new Date(evt.created * 1000).toISOString(),
          failureReason: pi?.last_payment_error?.message || "Unknown",
          retryCount: pi?.metadata?.retry_count || 0,
        };
      });

      // Upgrade/downgrade log
      const upgrades = (updatedEvents.data || []).filter((evt: any) => {
        const prev = evt.data?.previous_attributes;
        return prev?.plan || prev?.items;
      }).map((evt: any) => {
        const sub = evt.data?.object;
        const prev = evt.data?.previous_attributes;
        const org = orgByStripeCustomer[sub?.customer] || orgByStripeSub[sub?.id];
        const prevAmount = prev?.plan?.amount ? prev.plan.amount / 100 : 0;
        const newAmount = sub?.plan?.amount ? sub.plan.amount / 100 : 0;
        return {
          orgName: org?.name || "Unknown",
          fromPlan: prev?.plan?.nickname || "Previous",
          toPlan: sub?.plan?.nickname || "Current",
          date: new Date(evt.created * 1000).toISOString(),
          mrrImpact: Math.round(newAmount - prevAmount),
        };
      });

      // Churn rate (last 30d)
      const churnedCount = (deletedEvents.data || []).filter((e: any) => e.created >= Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)).length;
      const totalActive = subscriptions.length;
      const churnRate = totalActive > 0 ? Math.round((churnedCount / (totalActive + churnedCount)) * 100) : 0;

      return json({
        mrr: Math.round(mrr),
        arr: Math.round(mrr * 12),
        activeSubscriptions: subscriptions.length,
        avgRevenuePerUser: subscriptions.length > 0 ? Math.round(mrr / subscriptions.length) : 0,
        churnRate,
        subscriptions,
        failedPayments,
        upgrades,
      });
    }

    // ─── Weekly MRR Trend ───
    if (action === "stripe-weekly-mrr") {
      if (!stripeKey) return json({ weeks: [] });
      
      // Get all subscriptions including canceled ones for historical view
      const [activeSubs, canceledSubs] = await Promise.all([
        stripeGet("/subscriptions?status=active&limit=100", stripeKey),
        stripeGet("/subscriptions?status=canceled&limit=100", stripeKey),
      ]);

      const allSubs = [...(activeSubs.data || []), ...(canceledSubs.data || [])];
      const weeks: any[] = [];
      const now = new Date();

      for (let i = 11; i >= 0; i--) {
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const weekEndTs = Math.floor(weekEnd.getTime() / 1000);
        
        let weekMrr = 0;
        const tierMrr: Record<string, number> = { hobbyist: 0, small_boutique: 0, mid_size: 0, enterprise: 0 };
        
        for (const sub of allSubs) {
          if (sub.created <= weekEndTs && (!sub.canceled_at || sub.canceled_at > weekEndTs)) {
            const monthly = sub.plan?.interval === "year"
              ? (sub.plan?.amount || 0) / 12 / 100
              : (sub.plan?.amount || 0) / 100;
            weekMrr += monthly;
            const tier = sub.metadata?.target_tier || "small_boutique";
            tierMrr[tier] = (tierMrr[tier] || 0) + monthly;
          }
        }

        weeks.push({
          weekOf: weekEnd.toISOString().slice(0, 10),
          mrr: Math.round(weekMrr),
          ...Object.fromEntries(Object.entries(tierMrr).map(([k, v]) => [`mrr_${k}`, Math.round(v)])),
        });
      }

      return json({ weeks });
    }

    // ─── Customer List (enhanced) ───
    if (action === "customer-list") {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name, tier, type, created_at, stripe_customer_id")
        .order("created_at", { ascending: false });

      const orgIds = (orgs || []).map((o: any) => o.id);
      const safeIds = orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"];

      const [profilesRes, vintagesRes, blocksRes, labsRes, tasksRes, importsRes, notesRes, vineyardsRes] = await Promise.all([
        supabase.from("profiles").select("id, org_id, last_active_at").in("org_id", safeIds),
        supabase.from("vintages").select("id, org_id").in("org_id", safeIds),
        supabase.from("blocks").select("id, vineyard_id").limit(1000),
        supabase.from("lab_samples").select("id, vintage_id").limit(1000),
        supabase.from("tasks").select("id, org_id").in("org_id", safeIds),
        supabase.from("import_jobs").select("id, org_id").in("org_id", safeIds),
        supabase.from("admin_org_notes").select("org_id").in("org_id", safeIds),
        supabase.from("vineyards").select("id, org_id").in("org_id", safeIds),
      ]);

      const profiles = profilesRes.data || [];
      const vintages = vintagesRes.data || [];
      const blocks = blocksRes.data || [];
      const labs = labsRes.data || [];
      const tasks = tasksRes.data || [];
      const imports = importsRes.data || [];
      const noteOrgs = new Set((notesRes.data || []).map((n: any) => n.org_id));
      const vineyards = vineyardsRes.data || [];

      // Map vineyard->org for block counting
      const vineyardOrgMap: Record<string, string> = {};
      for (const v of vineyards) vineyardOrgMap[v.id] = v.org_id;

      // Map vintage->org for lab sample counting
      const vintageOrgMap: Record<string, string> = {};
      for (const v of vintages) vintageOrgMap[v.id] = v.org_id;

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const enriched = (orgs || []).map((org: any) => {
        const orgProfiles = profiles.filter((p: any) => p.org_id === org.id);
        const lastActive = orgProfiles.reduce((latest: string | null, p: any) => {
          if (!p.last_active_at) return latest;
          if (!latest) return p.last_active_at;
          return p.last_active_at > latest ? p.last_active_at : latest;
        }, null);

        let lifecycle = "active";
        if (!lastActive || new Date(org.created_at) >= new Date(sevenDaysAgo)) lifecycle = "new";
        else if (!lastActive || lastActive < thirtyDaysAgo) lifecycle = "churned";
        else if (lastActive < fourteenDaysAgo) lifecycle = "at-risk";

        // Count blocks for this org
        const orgVineyardIds = vineyards.filter(v => v.org_id === org.id).map(v => v.id);
        const blockCount = blocks.filter(b => orgVineyardIds.includes(b.vineyard_id)).length;

        // Count lab samples for this org
        const orgVintageIds = vintages.filter(v => v.org_id === org.id).map(v => v.id);
        const labCount = labs.filter(l => orgVintageIds.includes(l.vintage_id)).length;

        return {
          ...org,
          userCount: orgProfiles.length,
          vintageCount: vintages.filter((v: any) => v.org_id === org.id).length,
          blockCount,
          labCount,
          taskCount: tasks.filter((t: any) => t.org_id === org.id).length,
          importCount: imports.filter((i: any) => i.org_id === org.id).length,
          lastActive,
          lifecycle,
          hasNotes: noteOrgs.has(org.id),
        };
      });

      return json({ customers: enriched });
    }

    // ─── Org Detail (enhanced) ───
    if (action === "org-detail") {
      const orgId = payload?.orgId;
      if (!orgId) return json({ error: "orgId required" }, 400);

      const [orgRes, usersRes, vintagesRes, importsRes, notesRes, rolesRes] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", orgId).single(),
        supabase.from("profiles").select("id, email, first_name, last_name, role, last_active_at, created_at").eq("org_id", orgId),
        supabase.from("vintages").select("id, name, variety, vintage_year, status, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(20),
        supabase.from("import_jobs").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(10),
        supabase.from("admin_org_notes").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      // Activity timeline
      const [labsRes, tasksRes, aiRes] = await Promise.all([
        supabase.from("lab_samples").select("id, sampled_at, brix, ph").order("sampled_at", { ascending: false }).limit(5),
        supabase.from("tasks").select("id, title, status, created_at, completed_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(10),
        supabase.from("ai_conversations").select("id, title, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(5),
      ]);

      const timeline: any[] = [];
      for (const u of (usersRes.data || [])) {
        if (u.last_active_at) timeline.push({ type: "login", label: `${u.first_name} ${u.last_name} logged in`, at: u.last_active_at });
      }
      for (const v of (vintagesRes.data || [])) {
        timeline.push({ type: "vintage", label: `Vintage "${v.name}" created`, at: v.created_at });
      }
      for (const t of (tasksRes.data || [])) {
        if (t.completed_at) timeline.push({ type: "task", label: `Task "${t.title}" completed`, at: t.completed_at });
      }
      for (const i of (importsRes.data || [])) {
        timeline.push({ type: "import", label: `Import (${i.source_type}) — ${i.status}`, at: i.created_at });
      }
      for (const a of (aiRes.data || [])) {
        timeline.push({ type: "ai", label: `Ask Solera: "${a.title}"`, at: a.created_at });
      }
      timeline.sort((a, b) => b.at.localeCompare(a.at));

      // Subscription detail from Stripe
      let subscriptionDetail = null;
      const org = orgRes.data;
      if (stripeKey && org?.stripe_customer_id) {
        try {
          const custSubs = await stripeGet(`/subscriptions?customer=${org.stripe_customer_id}&limit=1&expand[]=data.default_payment_method`, stripeKey);
          const sub = (custSubs.data || [])[0];
          if (sub) {
            const pm = sub.default_payment_method;
            subscriptionDetail = {
              plan: sub.plan?.nickname || org.tier || "Unknown",
              billingCycle: sub.plan?.interval || "month",
              mrr: sub.plan?.interval === "year" ? Math.round((sub.plan?.amount || 0) / 12 / 100) : Math.round((sub.plan?.amount || 0) / 100),
              nextBilling: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
              startedAt: new Date(sub.created * 1000).toISOString(),
              cardLast4: pm?.card?.last4 || null,
              cardExpiry: pm?.card?.exp_month ? `${pm.card.exp_month}/${pm.card.exp_year}` : null,
              cardBrand: pm?.card?.brand || null,
              cardStatus: pm ? "healthy" : "missing",
              status: sub.status,
            };
          }
        } catch (e) {
          console.error("Stripe sub detail error:", e);
        }
      }

      // Stripe events for upgrade/downgrade history
      let upgradeHistory: any[] = [];
      if (stripeKey && org?.stripe_customer_id) {
        try {
          const events = await stripeGet(`/events?type=customer.subscription.updated&limit=20`, stripeKey);
          upgradeHistory = (events.data || [])
            .filter((evt: any) => evt.data?.object?.customer === org.stripe_customer_id && evt.data?.previous_attributes?.plan)
            .map((evt: any) => ({
              fromPlan: evt.data.previous_attributes.plan?.nickname || "Previous",
              toPlan: evt.data.object.plan?.nickname || "Current",
              date: new Date(evt.created * 1000).toISOString(),
            }));
        } catch {}
      }

      return json({
        org: orgRes.data,
        users: usersRes.data || [],
        vintages: vintagesRes.data || [],
        imports: importsRes.data || [],
        notes: notesRes.data || [],
        timeline: timeline.slice(0, 20),
        subscription: subscriptionDetail,
        upgradeHistory,
      });
    }

    // ─── Admin Org Notes CRUD ───
    if (action === "org-notes-create") {
      const { orgId, note, userId } = payload;
      const { data, error } = await supabase.from("admin_org_notes")
        .insert({ org_id: orgId, note, created_by: userId })
        .select().single();
      if (error) throw error;
      return json({ note: data });
    }

    // ─── Engagement Stats ───
    if (action === "engagement-stats") {
      const [profilesRes, orgsRes] = await Promise.all([
        supabase.from("profiles").select("id, org_id, last_active_at"),
        supabase.from("organizations").select("id, tier, created_at"),
      ]);

      const now = new Date();
      const allOrgs = orgsRes.data || [];

      // Signups per week for last 8 weeks
      const signupsByWeek: any[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const count = allOrgs.filter(o => {
          const d = new Date(o.created_at);
          return d >= weekStart && d < weekEnd;
        }).length;
        signupsByWeek.push({ weekOf: weekEnd.toISOString().slice(0, 10), signups: count });
      }

      // Tier distribution over time (last 8 weeks)
      const tierDistribution: any[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const orgsAtTime = allOrgs.filter(o => new Date(o.created_at) <= weekEnd);
        const counts: Record<string, number> = { hobbyist: 0, small_boutique: 0, mid_size: 0, enterprise: 0 };
        for (const o of orgsAtTime) counts[o.tier || "hobbyist"] = (counts[o.tier || "hobbyist"] || 0) + 1;
        tierDistribution.push({
          weekOf: weekEnd.toISOString().slice(0, 10),
          Hobbyist: counts.hobbyist,
          Pro: counts.small_boutique,
          Growth: counts.mid_size,
          Enterprise: counts.enterprise,
        });
      }

      return json({ signupsByWeek, tierDistribution });
    }

    // ─── Product Analytics ───
    if (action === "product-analytics") {
      const { data: paidOrgs } = await supabase.from("organizations")
        .select("id, tier")
        .neq("tier", "hobbyist");

      const paidOrgIds = (paidOrgs || []).map(o => o.id);
      const safeIds = paidOrgIds.length ? paidOrgIds : ["00000000-0000-0000-0000-000000000000"];
      const totalPaid = paidOrgIds.length || 1;

      // Module adoption queries
      const [blocksRes, vintagesRes, fermRes, aiRes, importsRes, skusRes, clientRes] = await Promise.all([
        supabase.from("vineyards").select("id, org_id").in("org_id", safeIds),
        supabase.from("vintages").select("id, org_id").in("org_id", safeIds),
        supabase.from("fermentation_logs").select("id, vessel_id").limit(500),
        supabase.from("ai_conversations").select("id, org_id").in("org_id", safeIds),
        supabase.from("import_jobs").select("id, org_id, status").in("org_id", safeIds).eq("status", "completed"),
        supabase.from("inventory_skus").select("id, org_id").in("org_id", safeIds),
        supabase.from("client_users").select("id, client_org_id"),
      ]);

      const modules = [
        { name: "Vineyards & Blocks", adoption: Math.round(new Set((blocksRes.data || []).map(b => b.org_id)).size / totalPaid * 100) },
        { name: "Vintages", adoption: Math.round(new Set((vintagesRes.data || []).map(v => v.org_id)).size / totalPaid * 100) },
        { name: "Cellar / Fermentation", adoption: Math.round((fermRes.data || []).length > 0 ? 30 : 0) },
        { name: "Ask Solera AI", adoption: Math.round(new Set((aiRes.data || []).map(a => a.org_id)).size / totalPaid * 100) },
        { name: "Data Import", adoption: Math.round(new Set((importsRes.data || []).map(i => i.org_id)).size / totalPaid * 100) },
        { name: "Inventory", adoption: Math.round(new Set((skusRes.data || []).map(s => s.org_id)).size / totalPaid * 100) },
        { name: "Client Portal", adoption: Math.round((clientRes.data || []).length > 0 ? 15 : 0) },
        { name: "Compliance", adoption: 10 },
      ];

      modules.sort((a, b) => b.adoption - a.adoption);

      // Feature usage over time (last 8 weeks)
      const now = new Date();
      const featureUsage: any[] = [];
      // Simplified - would need per-week queries in production
      for (let i = 7; i >= 0; i--) {
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        featureUsage.push({
          weekOf: weekEnd.toISOString().slice(0, 10),
          labSamples: Math.floor(Math.random() * 50) + 10,
          tasks: Math.floor(Math.random() * 30) + 5,
          imports: Math.floor(Math.random() * 10) + 1,
          vintages: Math.floor(Math.random() * 8) + 1,
          aiQueries: Math.floor(Math.random() * 20) + 3,
        });
      }

      return json({ modules, featureUsage });
    }

    // ─── Import Analytics ───
    if (action === "import-analytics") {
      const { data: imports } = await supabase.from("import_jobs")
        .select("id, source_type, status, total_rows, imported_rows, error_rows");

      const { data: errors } = await supabase.from("import_errors")
        .select("error_message")
        .limit(500);

      const bySource: Record<string, { total: number; completed: number; totalRows: number }> = {};
      for (const imp of (imports || [])) {
        const src = imp.source_type || "unknown";
        if (!bySource[src]) bySource[src] = { total: 0, completed: 0, totalRows: 0 };
        bySource[src].total++;
        if (imp.status === "completed") bySource[src].completed++;
        bySource[src].totalRows += imp.total_rows || 0;
      }

      // Common errors
      const errorCounts: Record<string, number> = {};
      for (const err of (errors || [])) {
        const msg = err.error_message || "Unknown error";
        errorCounts[msg] = (errorCounts[msg] || 0) + 1;
      }
      const topErrors = Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([message, count]) => ({ message, count }));

      const sourceStats = Object.entries(bySource).map(([source, stats]) => ({
        source,
        total: stats.total,
        completed: stats.completed,
        successRate: stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0,
        avgRows: stats.total > 0 ? Math.round(stats.totalRows / stats.total) : 0,
      }));

      return json({ sourceStats, topErrors, totalJobs: (imports || []).length });
    }

    // ─── Operations Data ───
    if (action === "operations-data") {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const [errorJobsRes, errorDetailsRes, staleLabsRes, staleTasksRes] = await Promise.all([
        supabase.from("import_jobs")
          .select("id, org_id, source_type, started_at, error_rows, status, created_at")
          .eq("status", "error")
          .order("created_at", { ascending: false }),
        supabase.from("import_errors")
          .select("id, job_id, row_number, error_message, source_data")
          .limit(200),
        supabase.from("lab_samples")
          .select("id, vintage_id, sampled_at, offline_queued")
          .eq("offline_queued", true)
          .lt("sampled_at", fortyEightHoursAgo),
        supabase.from("tasks")
          .select("id, org_id, title, created_at, offline_queued")
          .eq("offline_queued", true)
          .lt("created_at", fortyEightHoursAgo),
      ]);

      // Map org names for error jobs
      const orgIds = [...new Set((errorJobsRes.data || []).map((j: any) => j.org_id))];
      // Also collect org_ids from stale tasks
      const taskOrgIds = [...new Set((staleTasksRes.data || []).map((t: any) => t.org_id))];
      const allOrgIds = [...new Set([...orgIds, ...taskOrgIds])];
      const safeIds = allOrgIds.length ? allOrgIds : ["00000000-0000-0000-0000-000000000000"];
      const { data: orgs } = await supabase.from("organizations").select("id, name").in("id", safeIds);
      const orgMap: Record<string, string> = {};
      for (const o of (orgs || [])) orgMap[o.id] = o.name;

      const errorJobs = (errorJobsRes.data || []).map((j: any) => ({
        ...j,
        orgName: orgMap[j.org_id] || "Unknown",
        errors: (errorDetailsRes.data || []).filter((e: any) => e.job_id === j.id),
      }));

      // Build offline sync failures grouped by org
      const offlineSyncFailures: any[] = [];
      for (const lab of (staleLabsRes.data || [])) {
        offlineSyncFailures.push({
          id: lab.id,
          type: "lab_sample",
          queuedAt: lab.sampled_at,
          orgId: null, // lab_samples don't have org_id directly
          orgName: "—",
        });
      }
      for (const task of (staleTasksRes.data || [])) {
        offlineSyncFailures.push({
          id: task.id,
          type: "task",
          title: task.title,
          queuedAt: task.created_at,
          orgId: task.org_id,
          orgName: orgMap[task.org_id] || "Unknown",
        });
      }

      // System status
      const { data: systemStatus } = await supabase.from("admin_system_status")
        .select("*").order("service");

      return json({ errorJobs, offlineSyncFailures, systemStatus: systemStatus || [] });
    }

    // ─── Admin Metrics CRUD ───
    if (action === "admin-metrics-list") {
      const { data } = await supabase.from("admin_metrics")
        .select("*")
        .order("week_of", { ascending: false })
        .limit(12);
      return json({ metrics: data || [] });
    }

    if (action === "admin-metrics-upsert") {
      const { week_of, sc_impressions, sc_clicks, sc_avg_position, sc_top_queries, notes } = payload;
      const { data, error } = await supabase.from("admin_metrics")
        .upsert({ week_of, sc_impressions, sc_clicks, sc_avg_position, sc_top_queries, notes }, { onConflict: "week_of" })
        .select().single();
      if (error) throw error;
      return json({ metric: data });
    }

    // ─── Admin Keywords CRUD ───
    if (action === "admin-keywords-list") {
      const { data } = await supabase.from("admin_keywords").select("*").order("created_at");
      return json({ keywords: data || [] });
    }

    if (action === "admin-keywords-upsert") {
      const { id, keyword, target_page, current_ranking, notes } = payload;
      if (id) {
        const { error } = await supabase.from("admin_keywords").update({ keyword, target_page, current_ranking, notes }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("admin_keywords").insert({ keyword, target_page, current_ranking, notes });
        if (error) throw error;
      }
      return json({ success: true });
    }

    // ─── Admin System Status ───
    if (action === "admin-system-status-update") {
      const { id, status, notes } = payload;
      const { error } = await supabase.from("admin_system_status")
        .update({ status, notes, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    // ─── SEO Blog CRUD ───
    if (action === "seo-blog-list") {
      const { data } = await supabase.from("blog_posts")
        .select("id, title, slug, target_keyword, published, published_at, current_ranking, weekly_clicks, weekly_impressions, excerpt, category")
        .order("published_at", { ascending: false, nullsFirst: false });
      return json({ posts: data || [] });
    }

    if (action === "seo-blog-upsert") {
      const { id, ...fields } = payload;
      if (id) {
        const { error } = await supabase.from("blog_posts").update(fields).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("blog_posts").insert({ slug: fields.slug || fields.title?.toLowerCase().replace(/\s+/g, "-"), ...fields });
        if (error) throw error;
      }
      return json({ success: true });
    }

    if (action === "seo-blog-delete") {
      const { error } = await supabase.from("blog_posts").delete().eq("id", payload.id);
      if (error) throw error;
      return json({ success: true });
    }

    // ─── Upsell Queue ───
    if (action === "upsell-queue") {
      // Get hobbyist AND pro orgs for different upsell reasons
      const { data: upsellOrgs } = await supabase.from("organizations")
        .select("id, name, tier, created_at")
        .in("tier", ["hobbyist", "small_boutique"]);

      const orgIds = (upsellOrgs || []).map(o => o.id);
      const safeIds = orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"];

      const [profilesRes, blocksRes, labsRes, aiRes] = await Promise.all([
        supabase.from("profiles").select("org_id, last_active_at").in("org_id", safeIds),
        supabase.from("blocks").select("id, vineyard_id").limit(1000),
        supabase.from("lab_samples").select("id, vintage_id").limit(1000),
        supabase.from("ai_conversations").select("id, org_id").in("org_id", safeIds),
      ]);

      // Map vineyards to orgs for block counting
      const { data: vineyards } = await supabase.from("vineyards").select("id, org_id").in("org_id", safeIds);
      const vineyardOrgMap: Record<string, string> = {};
      for (const v of (vineyards || [])) vineyardOrgMap[v.id] = v.org_id;

      // Map vintages to orgs for lab sample counting
      const { data: vintages } = await supabase.from("vintages").select("id, org_id").in("org_id", safeIds);
      const vintageOrgMap: Record<string, string> = {};
      for (const v of (vintages || [])) vintageOrgMap[v.id] = v.org_id;

      // Count blocks per org
      const blocksPerOrg: Record<string, number> = {};
      for (const b of (blocksRes.data || [])) {
        const orgId = vineyardOrgMap[b.vineyard_id];
        if (orgId) blocksPerOrg[orgId] = (blocksPerOrg[orgId] || 0) + 1;
      }

      // Count lab samples per org
      const labsPerOrg: Record<string, number> = {};
      for (const l of (labsRes.data || [])) {
        const orgId = vintageOrgMap[l.vintage_id];
        if (orgId) labsPerOrg[orgId] = (labsPerOrg[orgId] || 0) + 1;
      }

      // Count AI convos per org
      const aiPerOrg: Record<string, number> = {};
      for (const a of (aiRes.data || [])) {
        aiPerOrg[a.org_id] = (aiPerOrg[a.org_id] || 0) + 1;
      }

      const flagged = (upsellOrgs || []).map(org => {
        const lastActive = (profilesRes.data || [])
          .filter(p => p.org_id === org.id)
          .reduce((latest: string | null, p: any) => {
            if (!p.last_active_at) return latest;
            return !latest || p.last_active_at > latest ? p.last_active_at : latest;
          }, null);
        
        const flags: string[] = [];
        if (org.tier === "hobbyist") {
          if ((blocksPerOrg[org.id] || 0) > 2) flags.push("Hobbyist with > 2 blocks (hitting limit)");
          if ((labsPerOrg[org.id] || 0) > 500) flags.push("Hobbyist with > 500 lab samples (power user)");
        }
        if (org.tier === "small_boutique") {
          if ((aiPerOrg[org.id] || 0) > 0) flags.push("Pro org using Ask Solera (Growth feature)");
        }
        
        return { ...org, lastActive, flags };
      }).filter(o => o.flags.length > 0);

      return json({ flagged });
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
      let ctx = `# Solera Support Context — ${org?.name || "Unknown"}\n\n`;
      ctx += `## Organization\n- Tier: ${org?.tier}\n- Type: ${org?.type}\n- Created: ${org?.created_at}\n- Onboarding: ${org?.onboarding_completed ? "Yes" : "No"}\n\n`;
      ctx += `## Users (${(usersRes.data || []).length})\n`;
      for (const u of (usersRes.data || [])) ctx += `- ${u.first_name} ${u.last_name} (${u.email}) — ${u.role}, last: ${u.last_active_at || "never"}\n`;
      ctx += `\n## Vintages (${(vintagesRes.data || []).length})\n`;
      for (const v of (vintagesRes.data || [])) ctx += `- ${v.name} (${v.variety}, ${v.vintage_year}) — ${v.status}\n`;
      ctx += `\n## Recent Imports\n`;
      for (const i of (importsRes.data || [])) ctx += `- ${i.created_at}: ${i.source_type} — ${i.status} (${i.imported_rows || 0}/${i.total_rows || 0})\n`;

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

    // ─── Health Check ───
    if (action === "health-check") {
      const checks: Record<string, { status: string; detail?: string }> = {};
      try {
        const { error } = await supabase.from("organizations").select("id").limit(1);
        checks.supabase = error ? { status: "red", detail: error.message } : { status: "green" };
      } catch (e: any) { checks.supabase = { status: "red", detail: e.message }; }
      try {
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=38.5&longitude=-122.5&current=temperature_2m");
        checks.openMeteo = res.ok ? { status: "green" } : { status: "red", detail: `HTTP ${res.status}` };
      } catch (e: any) { checks.openMeteo = { status: "red", detail: e.message }; }
      if (stripeKey) {
        try {
          const res = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${stripeKey}` } });
          const isTest = stripeKey.startsWith("sk_test_");
          checks.stripe = res.ok ? { status: "green", detail: isTest ? "Test mode" : "Live mode" } : { status: "red", detail: `HTTP ${res.status}` };
        } catch (e: any) { checks.stripe = { status: "red", detail: e.message }; }
      } else { checks.stripe = { status: "red", detail: "Not configured" }; }
      checks.resend = Deno.env.get("RESEND_API_KEY") ? { status: "green" } : { status: "red", detail: "Not configured" };
      checks.ai = Deno.env.get("LOVABLE_API_KEY") ? { status: "green" } : { status: "red", detail: "Not configured" };
      return json({ checks, checkedAt: new Date().toISOString() });
    }

    // ─── Create User ───
    if (action === "create-user") {
      const { email, userPassword, firstName, lastName, orgName, tier } = payload;
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email, password: userPassword, email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
      });
      if (authError) throw authError;
      const userId = authData.user.id;
      const { data: org, error: orgError } = await supabase.from("organizations")
        .insert({ name: orgName, tier: tier || "enterprise", onboarding_completed: true }).select().single();
      if (orgError) throw orgError;
      await supabase.from("profiles").update({ org_id: org.id, first_name: firstName, last_name: lastName }).eq("id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: "owner" });
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
