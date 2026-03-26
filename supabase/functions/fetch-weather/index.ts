import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function celsiusToFahrenheit(c: number): number {
  return c * 9 / 5 + 32;
}

function mmToInches(mm: number): number {
  return mm * 0.0393701;
}

function kmhToMph(kmh: number): number {
  return kmh * 0.621371;
}

function getApril1(year: number): string {
  return `${year}-04-01`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional params: vineyard_id for single backfill, backfill flag
    let targetVineyardId: string | null = null;
    let isBackfill = false;
    try {
      const body = await req.json();
      targetVineyardId = body.vineyard_id || null;
      isBackfill = body.backfill === true;
    } catch {
      // No body = scheduled daily run
    }

    // Get active configs
    let query = supabase
      .from("vineyard_weather_config")
      .select("*, vineyards(org_id)")
      .eq("active", true);

    if (targetVineyardId) {
      query = query.eq("vineyard_id", targetVineyardId);
    }

    const { data: configs, error: configErr } = await query;
    if (configErr) throw configErr;
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: "No active configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentYear = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear(); // Before April = previous season
    const april1 = getApril1(currentYear);

    const results: any[] = [];

    // Look up org timezone for this config's org, to pass to Open-Meteo
    // This ensures daily aggregations align with local day boundaries
    const orgTimezones: Record<string, string> = {};

    for (const config of configs) {
      if (!config.latitude || !config.longitude) continue;

      const orgId = (config as any).vineyards?.org_id || config.org_id;
      const startDate = isBackfill ? april1 : today;
      const endDate = today;

      // Resolve org timezone for proper daily boundaries
      if (orgId && !orgTimezones[orgId]) {
        const { data: orgRow } = await supabase
          .from("organizations")
          .select("timezone")
          .eq("id", orgId)
          .single();
        orgTimezones[orgId] = orgRow?.timezone || "auto";
      }
      const tzParam = orgTimezones[orgId] || "auto";

      // Choose API based on backfill vs daily
      // Pass org timezone so daily aggregations align with local day boundaries, not UTC
      let apiUrl: string;
      if (isBackfill && startDate < today) {
        apiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${config.latitude}&longitude=${config.longitude}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&temperature_unit=celsius&timezone=${encodeURIComponent(tzParam)}`;
      } else {
        apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${config.latitude}&longitude=${config.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&temperature_unit=celsius&timezone=${encodeURIComponent(tzParam)}&past_days=1&forecast_days=4`;
      }

      const weatherRes = await fetch(apiUrl);
      if (!weatherRes.ok) {
        console.error(`Open-Meteo error for vineyard ${config.vineyard_id}: ${weatherRes.status}`);
        continue;
      }

      const weatherData = await weatherRes.json();
      const daily = weatherData.daily;
      if (!daily || !daily.time) continue;

      // Get existing GDD cumulative for this season
      const { data: existingReadings } = await supabase
        .from("weather_readings")
        .select("recorded_at, gdd_cumulative")
        .eq("vineyard_id", config.vineyard_id)
        .gte("recorded_at", april1)
        .order("recorded_at", { ascending: false })
        .limit(1);

      let cumulativeGdd = existingReadings?.[0]?.gdd_cumulative || 0;

      // If backfill, start cumulative from 0
      if (isBackfill) cumulativeGdd = 0;

      const readings: any[] = [];

      for (let i = 0; i < daily.time.length; i++) {
        const date = daily.time[i];
        const tempMaxC = daily.temperature_2m_max[i];
        const tempMinC = daily.temperature_2m_min[i];
        const precipMm = daily.precipitation_sum[i];
        const windKmh = daily.wind_speed_10m_max[i];

        if (tempMaxC == null || tempMinC == null) continue;

        const tempMaxF = celsiusToFahrenheit(tempMaxC);
        const tempMinF = celsiusToFahrenheit(tempMinC);
        const tempAvgF = (tempMaxF + tempMinF) / 2;
        const gddDaily = Math.max(tempAvgF - (config.gdd_base_temp_f || 50), 0);

        // Only accumulate if date >= April 1
        if (date >= april1) {
          cumulativeGdd += gddDaily;
        }

        readings.push({
          org_id: orgId,
          vineyard_id: config.vineyard_id,
          recorded_at: date,
          temp_f: Math.round(tempAvgF * 10) / 10,
          temp_min_f: Math.round(tempMinF * 10) / 10,
          temp_max_f: Math.round(tempMaxF * 10) / 10,
          precip_inches: precipMm != null ? Math.round(mmToInches(precipMm) * 100) / 100 : null,
          wind_mph: windKmh != null ? Math.round(kmhToMph(windKmh) * 10) / 10 : null,
          gdd_daily: Math.round(gddDaily * 10) / 10,
          gdd_cumulative: Math.round(cumulativeGdd * 10) / 10,
          source: "open_meteo",
        });
      }

      if (readings.length > 0) {
        // Upsert to handle re-runs
        const { error: insertErr } = await supabase
          .from("weather_readings")
          .upsert(readings, { onConflict: "vineyard_id,recorded_at,source" });

        if (insertErr) {
          console.error(`Insert error for vineyard ${config.vineyard_id}:`, insertErr);
        } else {
          results.push({ vineyard_id: config.vineyard_id, days: readings.length });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Weather ingestion error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
