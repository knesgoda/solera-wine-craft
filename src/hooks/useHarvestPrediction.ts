import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, differenceInDays, format, parseISO } from "date-fns";

export interface HarvestPrediction {
  currentBrix: number | null;
  brixSlope: number | null; // per day
  trajectory: "rising" | "falling" | "stable" | "unknown";
  daysToTarget: number | null;
  predictedDate: Date | null;
  predictedDateRange: [Date, Date] | null;
  currentGdd: number | null;
  confidence: "high" | "medium" | "low";
  sampleCount14d: number;
  vintageId: string | null;
}

const TARGET_BRIX = 24.0;

function linearSlope(points: { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

export function useHarvestPrediction(blockId: string | undefined, vineyardId: string | undefined) {
  return useQuery<HarvestPrediction>({
    queryKey: ["harvest-prediction", blockId, vineyardId],
    queryFn: async (): Promise<HarvestPrediction> => {
      const empty: HarvestPrediction = {
        currentBrix: null, brixSlope: null, trajectory: "unknown",
        daysToTarget: null, predictedDate: null, predictedDateRange: null,
        currentGdd: null, confidence: "low", sampleCount14d: 0, vintageId: null,
      };

      // Find active vintage for this block
      const { data: vintages } = await supabase
        .from("vintages")
        .select("id")
        .eq("block_id", blockId!)
        .eq("status", "in_progress");

      if (!vintages?.length) return empty;
      const vintageId = vintages[0].id;

      // Get lab samples for this vintage, ordered by date
      const { data: samples } = await supabase
        .from("lab_samples")
        .select("brix, sampled_at")
        .eq("vintage_id", vintageId)
        .not("brix", "is", null)
        .order("sampled_at", { ascending: true });

      const brixSamples = (samples || []).filter(s => s.brix != null);

      // Count samples in last 14 days
      const fourteenDaysAgo = addDays(new Date(), -14);
      const recentSamples = brixSamples.filter(s => parseISO(s.sampled_at) >= fourteenDaysAgo);
      const sampleCount14d = recentSamples.length;
      const confidence = sampleCount14d >= 3 ? "high" : sampleCount14d >= 1 ? "medium" : "low";

      const currentBrix = brixSamples.length > 0 ? brixSamples[brixSamples.length - 1].brix : null;

      // Calculate slope from last 3 readings
      const last3 = brixSamples.slice(-3);
      let brixSlope: number | null = null;
      let trajectory: HarvestPrediction["trajectory"] = "unknown";

      if (last3.length >= 2) {
        const baseDate = parseISO(last3[0].sampled_at);
        const points = last3.map(s => ({
          x: differenceInDays(parseISO(s.sampled_at), baseDate),
          y: s.brix!,
        }));
        brixSlope = linearSlope(points);
        trajectory = Math.abs(brixSlope) < 0.05 ? "stable" : brixSlope > 0 ? "rising" : "falling";
      }

      // Predict days to target
      let daysToTarget: number | null = null;
      let predictedDate: Date | null = null;
      let predictedDateRange: [Date, Date] | null = null;

      if (currentBrix != null && brixSlope != null && brixSlope > 0 && currentBrix < TARGET_BRIX) {
        daysToTarget = Math.ceil((TARGET_BRIX - currentBrix) / brixSlope);
        predictedDate = addDays(new Date(), daysToTarget);
        predictedDateRange = [addDays(predictedDate, -3), addDays(predictedDate, 3)];
      } else if (currentBrix != null && currentBrix >= TARGET_BRIX) {
        daysToTarget = 0;
        predictedDate = new Date();
        predictedDateRange = [addDays(new Date(), -3), addDays(new Date(), 3)];
      }

      // Get current GDD
      let currentGdd: number | null = null;
      if (vineyardId) {
        const today = format(new Date(), "yyyy-MM-dd");
        const { data: gddRow } = await supabase
          .from("weather_readings")
          .select("gdd_cumulative")
          .eq("vineyard_id", vineyardId)
          .lte("recorded_at", today)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        currentGdd = gddRow?.gdd_cumulative ?? null;
      }

      return {
        currentBrix, brixSlope, trajectory, daysToTarget,
        predictedDate, predictedDateRange, currentGdd,
        confidence, sampleCount14d, vintageId,
      };
    },
    enabled: !!blockId && !!vineyardId,
    staleTime: 5 * 60 * 1000,
  });
}

export function projectBrix(currentBrix: number | null, slope: number | null, daysFromNow: number): number | null {
  if (currentBrix == null || slope == null) return null;
  return Math.round((currentBrix + slope * daysFromNow) * 10) / 10;
}

export function projectGdd(currentGdd: number | null, dailyGddAvg: number, daysFromNow: number): number | null {
  if (currentGdd == null) return null;
  return Math.round((currentGdd + dailyGddAvg * daysFromNow) * 10) / 10;
}

export function getHarvestRecommendation(projectedBrix: number | null): "too_early" | "prime_window" | "past_peak" | "unknown" {
  if (projectedBrix == null) return "unknown";
  if (projectedBrix < 22) return "too_early";
  if (projectedBrix >= 22 && projectedBrix <= 26) return "prime_window";
  return "past_peak";
}
