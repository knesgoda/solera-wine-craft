import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { addMonths, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculatePeakWindow, type PeakInput, type OakProgram } from "@/lib/peakPrediction";

interface Props {
  vintage: any;
  labSamples: any[];
}

const TIMELINE_YEARS = 20;

export function PeakPredictionTab({ vintage, labSamples }: Props) {
  const navigate = useNavigate();
  const variety: string | null = vintage?.variety ?? vintage?.blocks?.variety ?? null;
  const vintageYear: number = vintage?.year ?? new Date().getFullYear();

  // Bottle date fallback chain: bottling_target -> harvest_date + 18mo -> today
  const bottleDate: Date = vintage?.bottling_target
    ? parseISO(vintage.bottling_target)
    : vintage?.harvest_date
      ? addMonths(parseISO(vintage.harvest_date), 18)
      : new Date();

  // Initial Brix: earliest sample with Brix data
  const initialBrix: number | null =
    labSamples.find((s) => s.brix != null)?.brix ?? vintage?.target_brix ?? null;

  // Latest pH and TA close to bottling: scan samples reverse-chrono
  const latestPh: number | null =
    [...labSamples].reverse().find((s) => s.ph != null)?.ph ?? null;
  const latestTa: number | null =
    [...labSamples].reverse().find((s) => s.ta != null)?.ta ?? null;

  // Oak program from fermentation_vessels for this vintage
  const { data: vessels = [] } = useQuery({
    queryKey: ["peak-vessels", vintage?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("fermentation_vessels")
        .select("oak_type, barrel_age_fills, vessel_type")
        .eq("vintage_id", vintage.id);
      return data || [];
    },
    enabled: !!vintage?.id,
  });

  const oakProgram: OakProgram = (() => {
    if (!vessels.length) return null;
    const hasBarrel = vessels.some((v: any) => v.vessel_type === "barrel");
    if (!hasBarrel) return "stainless";
    const newFrench = vessels.some(
      (v: any) => v.vessel_type === "barrel" && v.oak_type === "french" && (v.barrel_age_fills ?? 0) <= 1,
    );
    if (newFrench) return "new_french";
    return "neutral";
  })();

  // Cumulative GDD for vintage year and vineyard
  const vineyardId = vintage?.blocks?.vineyard_id ?? null;
  const { data: cumulativeGdd = null } = useQuery({
    queryKey: ["peak-gdd", vineyardId, vintageYear],
    queryFn: async () => {
      if (!vineyardId) return null;
      const { data } = await supabase
        .from("weather_readings")
        .select("gdd_cumulative")
        .eq("vineyard_id", vineyardId)
        .gte("recorded_at", `${vintageYear}-04-01`)
        .lte("recorded_at", `${vintageYear}-10-31`)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.gdd_cumulative ?? null;
    },
    enabled: !!vineyardId,
  });

  const input: PeakInput = {
    variety,
    bottleDate,
    initialBrix,
    bottlingPh: latestPh,
    bottlingTa: latestTa,
    cumulativeGdd: cumulativeGdd as number | null,
    oakProgram,
  };

  const result = calculatePeakWindow(input);

  // Timeline: bottle year -> bottle year + TIMELINE_YEARS
  const timelineStart = result.bottleDate.getFullYear();
  const timelineEnd = timelineStart + TIMELINE_YEARS;
  const span = timelineEnd - timelineStart;
  const peakLeftPct = clamp(((result.peakStartYear - timelineStart) / span) * 100, 0, 100);
  const peakRightPct = clamp(((result.peakEndYear - timelineStart) / span) * 100, 0, 100);
  const todayPct = clamp(((new Date().getFullYear() - timelineStart) / span) * 100, 0, 100);

  // Confidence badge styling
  const confidenceColors: Record<string, string> = {
    high: "bg-green-100 text-green-900 border-green-300",
    medium: "bg-amber-100 text-amber-900 border-amber-300",
    low: "bg-red-100 text-red-900 border-red-300",
  };

  const missingFactors = result.factors.filter((f) => !f.hasData).map((f) => f.name);
  const confidenceTooltip =
    result.peakConfidence === "high"
      ? "All six prediction inputs are present in your records."
      : `Missing inputs: ${missingFactors.join(", ")}. Add this data to improve confidence.`;

  const askPrompt = `Analyze the aging potential of my ${vintageYear} ${variety || "vintage"} and tell me how it compares to similar vintages in our records.`;

  const handleAskSolera = () => {
    navigate(`/ask-solera?prompt=${encodeURIComponent(askPrompt)}`);
  };

  return (
    <div className="space-y-6">
      {/* Section 1 — Drinking Window Banner */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-cream/40 to-background">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="font-display text-2xl text-primary">
              {vintageYear} {variety || "Vintage"}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className={`capitalize ${confidenceColors[result.peakConfidence]}`}>
                {result.peakConfidence} confidence
              </Badge>
              <HelpTooltip content={confidenceTooltip} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="font-display text-3xl md:text-4xl text-foreground">
            Optimal drinking window: <span className="text-primary">{result.peakStartYear} – {result.peakEndYear}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Based on {result.factors.filter((f) => f.hasData).length} of 6 prediction inputs.
          </p>

          {/* Timeline */}
          <div className="relative pt-6 pb-8">
            <div className="relative h-8 rounded-full bg-gradient-to-r from-cream via-secondary/30 to-cream overflow-hidden">
              {/* Peak window band */}
              <div
                className="absolute top-0 h-full bg-primary/35 border-l-2 border-r-2 border-primary"
                style={{ left: `${peakLeftPct}%`, width: `${Math.max(2, peakRightPct - peakLeftPct)}%` }}
              />
              {/* Today marker */}
              {todayPct >= 0 && todayPct <= 100 && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-foreground"
                  style={{ left: `${todayPct}%` }}
                  aria-label="Today"
                />
              )}
            </div>
            {/* Year labels */}
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{timelineStart}</span>
              <span>{Math.round(timelineStart + span / 2)}</span>
              <span>{timelineEnd}</span>
            </div>
            {todayPct >= 0 && todayPct <= 100 && (
              <div
                className="absolute -top-1 text-[10px] font-medium text-foreground -translate-x-1/2"
                style={{ left: `${todayPct}%` }}
              >
                Today
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Factor Breakdown */}
      <Card>
        <Accordion type="single" collapsible defaultValue="factors">
          <AccordionItem value="factors" className="border-none">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <CardTitle className="text-lg font-display">Factor Breakdown</CardTitle>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-2">
                {result.factors.map((f) => (
                  <div key={f.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm font-medium text-foreground">{f.name}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm ${f.hasData ? "text-foreground" : "text-muted-foreground italic"}`}>
                        {f.hasData ? f.value : "No data, using default"}
                      </span>
                      {f.impact === "later" && <TrendingUp className="h-4 w-4 text-green-600" aria-label="Pushes peak later" />}
                      {f.impact === "earlier" && <TrendingDown className="h-4 w-4 text-amber-600" aria-label="Pushes peak earlier" />}
                      {f.impact === "neutral" && <Minus className="h-4 w-4 text-muted-foreground" aria-label="Neutral" />}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Section 3 — Ask Solera */}
      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium text-foreground">Want a deeper analysis?</p>
            <p className="text-sm text-muted-foreground">
              Ask Solera AI to compare this vintage's aging potential against similar vintages in your records.
            </p>
          </div>
          <Button onClick={handleAskSolera} className="shrink-0">
            <Sparkles className="h-4 w-4 mr-2" />
            Ask Solera
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}