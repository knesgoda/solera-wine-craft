import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestResult {
  question: string;
  status: "PASS" | "FAIL" | "GENERIC" | "ERROR";
  latencyMs: number;
  responseLength: number;
  matchedMarkers: string[];
  snippet: string;
  error?: string;
}

const QUESTIONS: { q: string; markers: string[] }[] = [
  {
    q: "When should I pick Block 3?",
    markers: ["Sunset Ridge", "22.1", "Block 3"],
  },
  {
    q: "What's my Brix trend for Pinot Noir this vintage?",
    markers: ["Eagle's Nest", "Sunset Ridge", "23.8", "22.1", "Pinot Noir"],
  },
  {
    q: "Which of my blocks is furthest from target Brix?",
    markers: ["Eagle's Nest", "Riverview", "Sunset Ridge", "23.8", "21.4", "22.1"],
  },
  {
    q: "Show me my lab history for the 2024 vintage",
    markers: ["Eagle's Nest", "23.8", "3.42", "2024"],
  },
  {
    q: "What SO2 additions have I logged this month?",
    markers: ["SO₂", "SO2", "50", "Riverview"],
  },
  {
    q: "Compare my 2024 and 2025 vintages",
    markers: ["2024", "2025", "Eagle's Nest", "Riverview", "Sunset Ridge"],
  },
  {
    q: "Which tank is closest to target pH?",
    markers: ["Tank 7", "3.51"],
  },
  {
    q: "What tasks are overdue?",
    markers: ["Rack Block 1", "Order yeast"],
  },
];

async function parseSSE(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "content_block_delta" && data.delta?.type === "text_delta") {
            text += data.delta.text;
          }
        } catch {
          // skip non-JSON lines
        }
      }
    }
  }
  return text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  const results: TestResult[] = [];
  let orgId: string | null = null;
  let userId: string | null = null;
  let accessToken: string | null = null;

  try {
    // ── SEED ──────────────────────────────────────────────
    console.log("Seeding test org...");

    // Create org
    const { data: org } = await svc.from("organizations").insert({ name: "Ridgecrest Cellars" }).select("id").single();
    orgId = org!.id;

    // Create test user
    const email = `ask-solera-test-${Date.now()}@test.solera.dev`;
    const { data: authUser, error: authErr } = await svc.auth.admin.createUser({
      email,
      password: "TestPass123!",
      email_confirm: true,
      user_metadata: { first_name: "Test", last_name: "Solera", winery_name: "Ridgecrest Cellars" },
    });
    if (authErr) throw new Error(`Auth create failed: ${authErr.message}`);
    userId = authUser.user.id;

    // Point profile to our org
    await svc.from("profiles").update({ org_id: orgId }).eq("id", userId);

    // Create vineyard
    const { data: vy } = await svc.from("vineyards").insert({ org_id: orgId, name: "Dundee Hills Estate", region: "Willamette Valley" }).select("id").single();
    const vyId = vy!.id;

    // Create 3 blocks
    const blockDefs = [
      { name: "Eagle's Nest", variety: "Pinot Noir", clone: "667", rootstock: "101-14", acres: 8 },
      { name: "Riverview", variety: "Chardonnay", clone: "76", rootstock: "3309C", acres: 6 },
      { name: "Sunset Ridge", variety: "Pinot Noir", clone: "777", rootstock: "101-14", acres: 10 },
    ];
    const blockIds: string[] = [];
    for (const bd of blockDefs) {
      const { data: blk } = await svc.from("blocks").insert({ vineyard_id: vyId, ...bd }).select("id").single();
      blockIds.push(blk!.id);
    }

    // Create vintages
    const vintageDefs = [
      { year: 2024, block_id: blockIds[0], status: "in_cellar", tons_harvested: 4.2, harvest_date: "2024-09-20" },
      { year: 2025, block_id: blockIds[1], status: "in_progress", tons_harvested: 3.1, harvest_date: "2025-09-15" },
      { year: 2025, block_id: blockIds[2], status: "harvested", tons_harvested: 5.0, harvest_date: "2025-09-18" },
    ];
    const vintageIds: string[] = [];
    for (const vd of vintageDefs) {
      const { data: vint } = await svc.from("vintages").insert({ org_id: orgId, ...vd }).select("id").single();
      vintageIds.push(vint!.id);
    }

    // Lab samples
    const labDefs = [
      { vintage_id: vintageIds[0], brix: 23.8, ph: 3.42, ta: 6.8, sampled_at: "2024-09-18T10:00:00Z" },
      { vintage_id: vintageIds[1], brix: 21.4, ph: 3.51, ta: 7.1, sampled_at: "2025-09-10T10:00:00Z" },
      { vintage_id: vintageIds[2], brix: 22.1, ph: 3.38, ta: 7.4, sampled_at: "2025-09-12T10:00:00Z" },
    ];
    for (const lab of labDefs) {
      await svc.from("lab_samples").insert(lab);
    }

    // Fermentation vessel
    await svc.from("fermentation_vessels").insert({
      org_id: orgId, name: "Tank 7", material: "stainless", capacity_liters: 2000,
      temp_controlled: true, vintage_id: vintageIds[1],
    });

    // Fermentation log for Tank 7
    const { data: vesselRow } = await svc.from("fermentation_vessels").select("id").eq("org_id", orgId).eq("name", "Tank 7").single();
    if (vesselRow) {
      await svc.from("fermentation_logs").insert({
        vessel_id: vesselRow.id, brix: 21.4, temp_f: 58, logged_at: new Date().toISOString(), vintage_id: vintageIds[1],
      });
    }

    // SO2 addition this month
    const now = new Date();
    const additionDate = new Date(now.getFullYear(), now.getMonth(), 5).toISOString();
    await svc.from("addition_logs").insert({
      vintage_id: vintageIds[1], addition_type: "SO₂", amount: 50, unit: "mL", added_at: additionDate,
    });

    // Tasks — 2 overdue, 1 pending
    const overdueDateStr = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const futureDateStr = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    await svc.from("tasks").insert([
      { org_id: orgId, title: "Rack Block 1 barrels", status: "pending", due_date: overdueDateStr },
      { org_id: orgId, title: "Order yeast", status: "in_progress", due_date: overdueDateStr },
      { org_id: orgId, title: "Schedule bottling line", status: "pending", due_date: futureDateStr },
    ]);

    console.log("Seed complete.");

    // ── SIGN IN ───────────────────────────────────────────
    const { data: session, error: signInErr } = await svc.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    // Use direct sign-in instead
    const signInClient = createClient(supabaseUrl, anonKey);
    const { data: signInData, error: siErr } = await signInClient.auth.signInWithPassword({
      email,
      password: "TestPass123!",
    });
    if (siErr) throw new Error(`Sign-in failed: ${siErr.message}`);
    accessToken = signInData.session!.access_token;
    console.log("Signed in as test user.");

    // ── RUN 8 QUESTIONS ───────────────────────────────────
    const askSoleraUrl = `${supabaseUrl}/functions/v1/ask-solera`;

    for (let i = 0; i < QUESTIONS.length; i++) {
      const { q, markers } = QUESTIONS[i];
      console.log(`Q${i + 1}: "${q}"`);
      const start = Date.now();

      try {
        const resp = await fetch(askSoleraUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: q }],
          }),
        });

        const latencyMs = Date.now() - start;

        if (!resp.ok) {
          const errBody = await resp.text();
          results.push({
            question: q,
            status: "ERROR",
            latencyMs,
            responseLength: 0,
            matchedMarkers: [],
            snippet: "",
            error: `HTTP ${resp.status}: ${errBody.slice(0, 200)}`,
          });
          continue;
        }

        const contentType = resp.headers.get("content-type") || "";
        let responseText: string;

        if (contentType.includes("text/event-stream")) {
          responseText = await parseSSE(resp);
        } else {
          const body = await resp.text();
          // Check if it's a JSON error
          try {
            const j = JSON.parse(body);
            if (j.error) {
              results.push({
                question: q, status: "ERROR", latencyMs,
                responseLength: 0, matchedMarkers: [], snippet: "",
                error: j.error,
              });
              continue;
            }
          } catch { /* not JSON */ }
          responseText = body;
        }

        const totalLatency = Date.now() - start;
        const matched = markers.filter((m) => responseText.toLowerCase().includes(m.toLowerCase()));

        let status: TestResult["status"];
        if (responseText.length < 50) {
          status = "FAIL";
        } else if (matched.length === 0) {
          status = "GENERIC";
        } else {
          status = "PASS";
        }

        if (totalLatency > 30000) {
          // Allow generous timeout for AI streaming but flag extreme slowness
          status = "FAIL";
        }

        results.push({
          question: q,
          status,
          latencyMs: totalLatency,
          responseLength: responseText.length,
          matchedMarkers: matched,
          snippet: responseText.slice(0, 300),
        });
        console.log(`  → ${status} (${totalLatency}ms, ${matched.length} markers, ${responseText.length} chars)`);
      } catch (e) {
        results.push({
          question: q, status: "ERROR", latencyMs: Date.now() - start,
          responseLength: 0, matchedMarkers: [], snippet: "",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } finally {
    // ── CLEANUP ─────────────────────────────────────────
    console.log("Cleaning up...");
    if (orgId) {
      // Delete in dependency order
      const tables = [
        "tasks", "addition_logs", "fermentation_logs", "fermentation_vessels",
        "lab_samples", "vintages", "blocks", "vineyards",
        "cost_categories", "alert_rules", "profiles", "user_roles",
      ];
      for (const t of tables) {
        await svc.from(t).delete().eq("org_id", orgId).then(() => {});
      }
      // Some tables use different FK names
      await svc.from("profiles").delete().eq("id", userId!).then(() => {});
      await svc.from("organizations").delete().eq("id", orgId).then(() => {});
    }
    if (userId) {
      await svc.auth.admin.deleteUser(userId).catch(() => {});
    }
    console.log("Cleanup done.");
  }

  // ── BUILD REPORT ────────────────────────────────────
  const passCount = results.filter((r) => r.status === "PASS").length;
  const genericCount = results.filter((r) => r.status === "GENERIC").length;
  const errorCount = results.filter((r) => r.status === "ERROR").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const overallPass = errorCount === 0 && failCount === 0 && genericCount < 3;

  const lines: string[] = [
    "═══════════════════════════════════════════════════════════",
    "  ASK SOLERA — CONTEXT-AWARENESS TEST REPORT",
    `  ${new Date().toISOString()}`,
    "═══════════════════════════════════════════════════════════",
    "",
    `Overall: ${overallPass ? "✅ PASS" : "❌ FAIL"}`,
    `Results: ${passCount} PASS, ${genericCount} GENERIC, ${failCount} FAIL, ${errorCount} ERROR`,
    "",
    "───────────────────────────────────────────────────────────",
  ];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const icon = r.status === "PASS" ? "✅" : r.status === "GENERIC" ? "⚠️" : "❌";
    lines.push(`\nQ${i + 1}: "${r.question}"`);
    lines.push(`  ${icon} ${r.status} | ${r.latencyMs}ms | ${r.responseLength} chars | Markers: [${r.matchedMarkers.join(", ")}]`);
    if (r.error) lines.push(`  ERROR: ${r.error}`);
    if (r.status === "GENERIC") lines.push(`  ⚠️  GENERIC — no org-specific data found in response`);
    lines.push(`  Snippet: ${r.snippet.replace(/\n/g, " ").slice(0, 200)}...`);
  }

  lines.push("\n═══════════════════════════════════════════════════════════");
  if (!overallPass) {
    lines.push("❌ CRITICAL: Context injection may be failing. Review ask-solera buildWineryContext.");
  }

  const report = lines.join("\n");
  return new Response(JSON.stringify({ report, overall: overallPass ? "PASS" : "FAIL", results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: overallPass ? 200 : 500,
  });
});
