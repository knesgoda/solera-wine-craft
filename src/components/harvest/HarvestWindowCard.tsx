import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { format } from "date-fns";
import {
  HarvestPrediction,
  projectBrix,
  projectGdd,
  getHarvestRecommendation,
  useHarvestPrediction,
} from "@/hooks/useHarvestPrediction";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Grape, TrendingUp, TrendingDown, Minus, ThermometerSun, CalendarCheck } from "lucide-react";

const TRAJECTORY_ICON = {
  rising: <TrendingUp className="h-4 w-4 text-green-600" />,
  falling: <TrendingDown className="h-4 w-4 text-destructive" />,
  stable: <Minus className="h-4 w-4 text-muted-foreground" />,
  unknown: <Minus className="h-4 w-4 text-muted-foreground" />,
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
};

const REC_LABELS: Record<string, { label: string; color: string }> = {
  too_early: { label: "Too Early", color: "bg-blue-100 text-blue-800" },
  prime_window: { label: "Prime Window", color: "bg-green-100 text-green-800" },
  past_peak: { label: "Past Peak", color: "bg-red-100 text-red-800" },
  unknown: { label: "Insufficient Data", color: "bg-muted text-muted-foreground" },
};

export const HarvestWindowCard = ({
  blockId,
  vineyardId,
}: {
  blockId: string;
  vineyardId: string;
}) => {
  const { data: prediction, isLoading } = useHarvestPrediction(blockId, vineyardId);
  const [daysFromNow, setDaysFromNow] = useState(0);

  // Get average daily GDD for projection
  const { data: avgDailyGdd = 0 } = useQuery({
    queryKey: ["avg-daily-gdd", vineyardId],
    queryFn: async () => {
      const { data } = await supabase
        .from("weather_readings")
        .select("gdd_daily")
        .eq("vineyard_id", vineyardId)
        .not("gdd_daily", "is", null)
        .order("recorded_at", { ascending: false })
        .limit(14);
      if (!data?.length) return 0;
      return data.reduce((s, r) => s + (r.gdd_daily || 0), 0) / data.length;
    },
    enabled: !!vineyardId,
  });

  if (isLoading) {
    return (
      <Card className="border-none shadow-md">
        <CardContent className="py-8 text-center text-muted-foreground animate-pulse">
          Calculating harvest prediction...
        </CardContent>
      </Card>
    );
  }

  if (!prediction || (prediction.currentBrix == null && prediction.vintageId == null)) {
    return (
      <Card className="border-none shadow-md">
        <CardContent className="py-8 text-center text-muted-foreground">
          No active vintage for this block. Harvest prediction requires an in-progress vintage with lab samples.
        </CardContent>
      </Card>
    );
  }

  const projBrix = projectBrix(prediction.currentBrix, prediction.brixSlope, daysFromNow);
  const projGdd = projectGdd(prediction.currentGdd, avgDailyGdd, daysFromNow);
  const rec = getHarvestRecommendation(projBrix);
  const recInfo = REC_LABELS[rec];

  return (
    <Card className="border-none shadow-md">
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <span className="p-1.5 rounded-md bg-primary/10">
            <Grape className="h-4 w-4 text-primary" />
          </span>
          Harvest Window Prediction
          <Badge variant="secondary" className={CONFIDENCE_COLORS[prediction.confidence]}>
            {prediction.confidence} confidence
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Current Brix</p>
            <p className="text-xl font-bold font-display text-foreground">
              {prediction.currentBrix != null ? prediction.currentBrix.toFixed(1) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trajectory</p>
            <div className="flex items-center gap-1.5 mt-1">
              {TRAJECTORY_ICON[prediction.trajectory]}
              <span className="text-sm font-medium capitalize text-foreground">{prediction.trajectory}</span>
              {prediction.brixSlope != null && (
                <span className="text-xs text-muted-foreground">
                  ({prediction.brixSlope > 0 ? "+" : ""}{prediction.brixSlope.toFixed(2)}/day)
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">GDD Cumulative</p>
            <p className="text-xl font-bold font-display text-foreground">
              {prediction.currentGdd != null ? Math.round(prediction.currentGdd) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Predicted Date</p>
            {prediction.predictedDateRange ? (
              <p className="text-sm font-medium text-foreground">
                {format(prediction.predictedDateRange[0], "MMM d")} – {format(prediction.predictedDateRange[1], "MMM d")}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {/* What-If slider */}
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-secondary" />
            What-If Projections
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Days from now</span>
              <span className="text-sm font-medium text-foreground">{daysFromNow}</span>
            </div>
            <Slider
              value={[daysFromNow]}
              onValueChange={([v]) => setDaysFromNow(v)}
              min={0}
              max={30}
              step={1}
            />
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div>
                <p className="text-xs text-muted-foreground">Projected Brix</p>
                <p className="text-lg font-bold font-display text-foreground">
                  {projBrix != null ? projBrix.toFixed(1) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Projected GDD</p>
                <p className="text-lg font-bold font-display text-foreground">
                  {projGdd != null ? Math.round(projGdd) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recommendation</p>
                <Badge variant="secondary" className={recInfo.color + " mt-1"}>
                  {recInfo.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
