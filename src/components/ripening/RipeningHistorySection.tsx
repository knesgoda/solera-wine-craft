import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ResponsiveContainer, LineChart, Line, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { Info } from "lucide-react";

interface Props {
  blockId: string;
  vineyardId: string;
}

interface VintageWithPeak {
  year: number;
  peakBrix: number | null;
  peakDate: string | null;
  gddAtPeak: number | null;
}

export function RipeningHistorySection({ blockId, vineyardId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["ripening-history", blockId],
    queryFn: async () => {
      // Get all vintages for this block
      const { data: vintages } = await supabase
        .from("vintages")
        .select("id, year")
        .eq("block_id", blockId)
        .order("year", { ascending: true });

      if (!vintages?.length) return { sparklineData: [], peaks: [] };

      const vintageIds = vintages.map((v) => v.id);

      // Get all lab samples for all vintages of this block
      const { data: samples } = await supabase
        .from("lab_samples")
        .select("vintage_id, sampled_at, brix")
        .in("vintage_id", vintageIds)
        .not("brix", "is", null)
        .order("sampled_at", { ascending: true });

      if (!samples?.length) return { sparklineData: [], peaks: [] };

      // Get GDD data for vineyard
      const { data: gddData } = await supabase
        .from("weather_readings")
        .select("recorded_at, gdd_cumulative")
        .eq("vineyard_id", vineyardId)
        .not("gdd_cumulative", "is", null)
        .order("recorded_at", { ascending: true });

      const gddMap = new Map((gddData || []).map((g) => [g.recorded_at, g.gdd_cumulative]));

      // Build sparkline data (all Brix readings across all vintages)
      const sparklineData = samples.map((s) => ({
        date: s.sampled_at,
        brix: s.brix,
      }));

      // Calculate peak per vintage
      const peaks: VintageWithPeak[] = vintages.map((v) => {
        const vSamples = samples.filter((s) => s.vintage_id === v.id);
        if (vSamples.length === 0) return { year: v.year, peakBrix: null, peakDate: null, gddAtPeak: null };

        const peak = vSamples.reduce((best, s) => (s.brix! > (best.brix || 0) ? s : best), vSamples[0]);
        const peakDateStr = format(parseISO(peak.sampled_at), "yyyy-MM-dd");
        const gddAtPeak = gddMap.get(peakDateStr) ?? null;

        return {
          year: v.year,
          peakBrix: peak.brix,
          peakDate: peak.sampled_at,
          gddAtPeak,
        };
      });

      return { sparklineData, peaks };
    },
    enabled: !!blockId && !!vineyardId,
  });

  if (isLoading || !data) return null;
  if (data.sparklineData.length === 0) return null;

  return (
    <Card className="border-none shadow-md">
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          Ripening History
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[220px]">
              Brix readings across all vintages for this block, showing clone/rootstock performance over time.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sparkline */}
        <div className="h-[60px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.sparklineData}>
              <YAxis hide domain={["auto", "auto"]} />
              <Line
                type="monotone"
                dataKey="brix"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                dot={data.sparklineData.length === 1 ? { r: 3, fill: "hsl(var(--primary))" } : false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Peak table */}
        {data.peaks.some((p) => p.peakBrix != null) && (
          <div className="overflow-x-auto -mx-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Year</TableHead>
                  <TableHead className="text-xs text-right">Peak Brix</TableHead>
                  <TableHead className="text-xs">Date Reached</TableHead>
                  <TableHead className="text-xs text-right">
                    <span className="flex items-center gap-1 justify-end">
                      GDD
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px]">
                          Growing Degree Days — a measure of heat accumulation that predicts vine development
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.peaks.map((p) => (
                  <TableRow key={p.year}>
                    <TableCell className="text-sm font-medium">{p.year}</TableCell>
                    <TableCell className="text-sm text-right font-mono tabular-nums">
                      {p.peakBrix != null ? `${p.peakBrix.toFixed(1)}°` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.peakDate ? format(parseISO(p.peakDate), "MMM d") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono tabular-nums">
                      {p.gddAtPeak != null ? Math.round(p.gddAtPeak) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
