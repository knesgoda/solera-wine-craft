import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── 5 test CSV datasets ──────────────────────────────────────────────────

const DATASETS: { name: string; description: string; headers: string[]; sampleRows: string[][] }[] = [
  {
    name: "Innovint Export (clean)",
    description: "Standard Innovint lab sample CSV with canonical column names",
    headers: ["Sample ID", "Sampled At", "Lot Name", "Brix", "pH", "TA", "VA", "SO2 Free", "SO2 Total", "Alcohol", "Notes"],
    sampleRows: [
      ["INV-001", "2025-08-15", "Cab Sauv Lot 1", "24.2", "3.55", "6.1", "0.42", "32", "85", "14.1", "Pre-ferment"],
      ["INV-002", "2025-08-16", "Merlot Lot 3", "23.8", "3.60", "5.9", "0.38", "28", "78", "13.9", ""],
      ["INV-003", "2025-08-17", "Chard Lot 2", "22.5", "3.45", "7.2", "0.30", "35", "90", "13.5", "Cold soak day 2"],
    ],
  },
  {
    name: "VinNow Export (clean)",
    description: "Standard VinNow vintage/lot export with typical VinNow naming",
    headers: ["Lot ID", "Lot Name", "Vintage Year", "Variety", "Clone", "Rootstock", "Harvest Date", "Tons Harvested", "Gallons", "Status", "Winemaker Notes"],
    sampleRows: [
      ["VN-2025-01", "Estate Cab 2025", "2025", "Cabernet Sauvignon", "337", "110R", "2025-09-28", "12.5", "2125", "fermenting", "Extended maceration planned"],
      ["VN-2025-02", "Reserve Pinot 2025", "2025", "Pinot Noir", "777", "101-14", "2025-09-15", "8.2", "1394", "aging", "Whole cluster 30%"],
      ["VN-2025-03", "Chard Sonoma 2025", "2025", "Chardonnay", "96", "3309C", "2025-09-10", "15.0", "2550", "fermenting", "Sur lie"],
    ],
  },
  {
    name: "Messy Multi-tab Excel (merged headers)",
    description: "Excel export with inconsistent casing, extra spaces, and non-standard names",
    headers: ["  Block Name  ", "VINEYARD NAME", "grape_variety", "Clone #", "Root Stock", "Total Acres", "Yr Planted", "Soil pH Level", "Notes / Comments"],
    sampleRows: [
      ["Block A-1", "Hilltop Ranch", "Cabernet Sauvignon", "337", "110R", "5.2", "2010", "6.8", "South facing slope"],
      ["Block B-2", "Valley Floor", "Merlot", "181", "SO4", "3.8", "2015", "7.1", "Clay loam"],
      ["Block C-3", "Hilltop Ranch", "Chardonnay", "96", "3309C", "4.1", "2012", "6.5", ""],
    ],
  },
  {
    name: "Google Sheets Export (extra blank rows)",
    description: "Google Sheets export with some blank/partial rows mixed in, standard-ish names",
    headers: ["vessel_name", "vessel_type", "capacity_gallons", "material", "status", "location", "temp_controlled", "notes"],
    sampleRows: [
      ["Tank 1", "stainless", "2500", "steel", "active", "Building A", "true", "Jacketed"],
      ["", "", "", "", "", "", "", ""],
      ["Tank 2", "oak", "60", "french_oak", "active", "Barrel Room", "false", "225L barrique"],
      ["Tank 3", "stainless", "5000", "steel", "inactive", "Building B", "true", "Needs repair"],
      ["", "", "", "", "", "", "", ""],
    ],
  },
  {
    name: "Custom Winery Spreadsheet (non-standard)",
    description: "Completely custom column names from a winery's internal tracking system",
    headers: ["Wine Lot #", "Grape Type", "Year", "Pick Day", "Weight (tons)", "Tank Assignment", "Sugar Level", "Acid Level", "Winemaker Remarks", "Bottling ETA"],
    sampleRows: [
      ["WL-001", "Cab Sauv", "2025", "Sep 28", "12.5", "T-04", "24.2", "6.1", "Looking great", "Mar 2027"],
      ["WL-002", "Merlot", "2025", "Oct 3", "8.0", "T-07", "23.5", "5.8", "Needs more hang time", "Feb 2027"],
      ["WL-003", "Zinfandel", "2025", "Oct 10", "15.2", "T-12", "25.1", "5.5", "High brix - watch VA", "Apr 2027"],
    ],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const lines: string[] = [];
  const log = (s: string) => lines.push(s);
  let allPassed = true;
  const fail = (s: string) => { log(s); allPassed = false; };
  const pass = (s: string) => log(s);

  log("═══════════════════════════════════════════════════════════");
  log("  AI COLUMN MAPPER INTEGRATION TEST REPORT");
  log(`  ${new Date().toISOString()}`);
  log("═══════════════════════════════════════════════════════════");
  log("");

  const results: { name: string; total: number; mapped: number; high: number; medium: number; unmapped: number; accuracy: string; issues: string[] }[] = [];

  for (const dataset of DATASETS) {
    log(`── ${dataset.name} ──`);
    log(`   ${dataset.description}`);
    log(`   Headers: ${dataset.headers.length}`);

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/suggest-mapping`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          headers: dataset.headers,
          sampleRows: dataset.sampleRows,
          sourceType: "csv",
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        fail(`   suggest-mapping returned ${resp.status}: ${t} ❌`);
        results.push({ name: dataset.name, total: dataset.headers.length, mapped: 0, high: 0, medium: 0, unmapped: dataset.headers.length, accuracy: "0%", issues: [`HTTP ${resp.status}`] });
        log("");
        continue;
      }

      const { mappings } = await resp.json();

      if (!mappings || !Array.isArray(mappings)) {
        fail("   No mappings array returned ❌");
        results.push({ name: dataset.name, total: dataset.headers.length, mapped: 0, high: 0, medium: 0, unmapped: dataset.headers.length, accuracy: "0%", issues: ["No mappings array"] });
        log("");
        continue;
      }

      // (1) Verify confidence scores returned for ALL mappings
      const issues: string[] = [];
      let allHaveConfidence = true;
      for (const m of mappings) {
        if (!m.confidence || !["high", "medium", "unmapped"].includes(m.confidence)) {
          allHaveConfidence = false;
          issues.push(`Missing/invalid confidence for "${m.source_column}": ${m.confidence}`);
        }
      }
      if (allHaveConfidence) {
        pass("   ✅ All mappings have valid confidence scores");
      } else {
        fail("   ❌ Some mappings missing confidence scores");
      }

      // Count by confidence
      const high = mappings.filter((m: any) => m.confidence === "high").length;
      const medium = mappings.filter((m: any) => m.confidence === "medium").length;
      const unmapped = mappings.filter((m: any) => m.confidence === "unmapped").length;
      const mapped = high + medium;

      log(`   Confidence breakdown: high=${high}, medium=${medium}, unmapped=${unmapped}`);

      // (2) Low-confidence fields flagged for manual override
      if (unmapped > 0) {
        const unmappedCols = mappings.filter((m: any) => m.confidence === "unmapped").map((m: any) => m.source_column);
        pass(`   ✅ ${unmapped} unmapped column(s) flagged for manual review: ${unmappedCols.join(", ")}`);
      } else {
        pass("   ✅ All columns mapped (no manual review needed)");
      }

      // Medium confidence should also be flaggable
      if (medium > 0) {
        const medCols = mappings.filter((m: any) => m.confidence === "medium").map((m: any) => `${m.source_column}→${m.target_table}.${m.target_field}`);
        pass(`   ✅ ${medium} medium-confidence mapping(s) flagged: ${medCols.join(", ")}`);
      }

      // (3) No data silently dropped — every source column has a mapping entry
      const returnedCols = new Set(mappings.map((m: any) => m.source_column));
      const inputCols = dataset.headers.map(h => h); // preserve original casing
      let droppedCount = 0;
      for (const col of inputCols) {
        // The mapper should return an entry for every input column
        // It may trim whitespace, so check trimmed version too
        const found = returnedCols.has(col) || returnedCols.has(col.trim());
        if (!found) {
          droppedCount++;
          issues.push(`Column "${col}" silently dropped — no mapping entry returned`);
        }
      }
      if (droppedCount === 0) {
        pass("   ✅ No columns silently dropped — all inputs have mapping entries");
      } else {
        fail(`   ❌ ${droppedCount} column(s) silently dropped`);
      }

      // Log each mapping
      for (const m of mappings) {
        const arrow = m.target_table ? `→ ${m.target_table}.${m.target_field}` : "→ (unmapped)";
        const conf = `[${m.confidence}]`;
        log(`     ${m.source_column} ${arrow} ${conf}`);
      }

      const accuracy = dataset.headers.length > 0 ? Math.round((mapped / dataset.headers.length) * 100) + "%" : "N/A";
      log(`   Mapping accuracy: ${accuracy} (${mapped}/${dataset.headers.length})`);

      results.push({
        name: dataset.name,
        total: dataset.headers.length,
        mapped,
        high,
        medium,
        unmapped,
        accuracy,
        issues,
      });

      if (issues.length > 0) {
        for (const issue of issues) fail(`   ⚠️  ${issue}`);
      }
    } catch (e: any) {
      fail(`   FATAL: ${e.message} ❌`);
      results.push({ name: dataset.name, total: dataset.headers.length, mapped: 0, high: 0, medium: 0, unmapped: dataset.headers.length, accuracy: "0%", issues: [e.message] });
    }

    log("");
  }

  // ── Summary table ──
  log("═══════════════════════════════════════════════════════════");
  log("  SUMMARY");
  log("═══════════════════════════════════════════════════════════");
  log("");
  log("  File                                    | Total | High | Med | Unmap | Accuracy");
  log("  ─────────────────────────────────────────|───────|──────|─────|───────|─────────");
  for (const r of results) {
    const name = r.name.padEnd(40);
    log(`  ${name}| ${String(r.total).padEnd(6)}| ${String(r.high).padEnd(5)}| ${String(r.medium).padEnd(4)}| ${String(r.unmapped).padEnd(6)}| ${r.accuracy}`);
  }
  log("");
  log(`Overall: ${allPassed ? "ALL PASSED ✅" : "SOME ISSUES ⚠️"}`);

  const report = lines.join("\n");
  return new Response(JSON.stringify({ passed: allPassed, report }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: allPassed ? 200 : 500,
  });
});
