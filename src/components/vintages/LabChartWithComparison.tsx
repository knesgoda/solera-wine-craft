import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { format, parseISO } from "date-fns";

const OVERLAY_COLORS = [
  "hsl(160, 50%, 40%)",
  "hsl(220, 60%, 50%)",
  "hsl(280, 50%, 50%)",
  "hsl(20, 70%, 50%)",
  "hsl(340, 60%, 55%)",
  "hsl(180, 45%, 40%)",
];

interface Sample {
  sampled_at: string;
  brix: number | null;
  ph: number | null;
}

interface Props {
  vintageId: string;
  blockId: string | null;
  variety: string | null;
  orgId: string;
  currentSamples: Sample[];
}

export function LabChartWithComparison({ vintageId, blockId, variety, orgId, currentSamples }: Props) {
  const [showComparison, setShowComparison] = useState(false);

  // Fetch other blocks of same variety with their latest vintage lab samples
  const { data: comparisonData } = useQuery({
    queryKey: ["lab-comparison", variety, orgId, vintageId],
    queryFn: async () => {
      if (!variety || !blockId) return [];

      // Get other blocks of same variety
      const { data: blocks } = await supabase
        .from("blocks")
        .select("id, name, clone, rootstock, vineyard_id, vineyards!inner(org_id)")
        .eq("vineyards.org_id", orgId)
        .eq("variety", variety)
        .neq("id", blockId)
        .eq("status", "active");

      if (!blocks?.length) return [];

      const blockIds = blocks.map((b: any) => b.id);

      // Get latest vintage per block
      const { data: vintages } = await supabase
        .from("vintages")
        .select("id, block_id, year")
        .in("block_id", blockIds)
        .order("year", { ascending: false });

      if (!vintages?.length) return [];

      const vintageByBlock: Record<string, string> = {};
      for (const v of vintages) {
        if (v.block_id && !vintageByBlock[v.block_id]) {
          vintageByBlock[v.block_id] = v.id;
        }
      }

      const vintageIds = Object.values(vintageByBlock);

      const { data: samples } = await supabase
        .from("lab_samples")
        .select("vintage_id, sampled_at, brix, ph")
        .in("vintage_id", vintageIds)
        .order("sampled_at", { ascending: true });

      return blocks.map((b: any, i: number) => {
        const vId = vintageByBlock[b.id];
        const blockSamples = (samples || []).filter((s) => s.vintage_id === vId);
        return {
          blockId: b.id,
          name: b.name,
          clone: b.clone,
          rootstock: b.rootstock,
          color: OVERLAY_COLORS[i % OVERLAY_COLORS.length],
          samples: blockSamples,
        };
      }).filter((b) => b.samples.length > 0);
    },
    enabled: showComparison && !!variety && !!blockId && !!orgId,
  });

  const hasComparisonBlocks = variety && blockId;

  // Build merged chart data
  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number | null>>();

    // Current block's samples
    for (const s of currentSamples) {
      const dateKey = format(parseISO(s.sampled_at), "yyyy-MM-dd");
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, {});
      const row = dateMap.get(dateKey)!;
      row["current_brix"] = s.brix;
      row["current_ph"] = s.ph;
    }

    // Comparison blocks
    if (showComparison && comparisonData) {
      for (const block of comparisonData) {
        for (const s of block.samples) {
          const dateKey = format(parseISO(s.sampled_at), "yyyy-MM-dd");
          if (!dateMap.has(dateKey)) dateMap.set(dateKey, {});
          const row = dateMap.get(dateKey)!;
          row[`${block.blockId}_brix`] = s.brix;
          row[`${block.blockId}_ph`] = s.ph;
        }
      }
    }

    const sortedDates = [...dateMap.keys()].sort();
    return sortedDates.map((date) => ({
      date: format(parseISO(date), "MMM d"),
      ...dateMap.get(date),
    }));
  }, [currentSamples, showComparison, comparisonData]);

  if (currentSamples.length < 2 && !showComparison) return null;

  return (
    <div className="space-y-3">
      {hasComparisonBlocks && (
        <div className="flex items-center gap-2">
          <Switch
            id="compare-toggle"
            checked={showComparison}
            onCheckedChange={setShowComparison}
          />
          <Label htmlFor="compare-toggle" className="text-sm cursor-pointer">
            Compare with other {variety} blocks
          </Label>
        </div>
      )}

      {showComparison && comparisonData && comparisonData.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" style={{ borderLeft: "3px solid hsl(var(--primary))" }} className="text-xs">
            This block
          </Badge>
          {comparisonData.map((b) => (
            <Badge key={b.blockId} variant="outline" style={{ borderLeft: `3px solid ${b.color}` }} className="text-xs">
              {b.name}{b.clone ? ` (${b.clone})` : ""}
            </Badge>
          ))}
        </div>
      )}

      {showComparison && comparisonData?.length === 0 && (
        <p className="text-xs text-muted-foreground">No other {variety} blocks have lab data to compare.</p>
      )}

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <YAxis
              yAxisId="brix"
              orientation="left"
              tick={{ fontSize: 12 }}
              label={{ value: "Brix°", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
            />
            <YAxis
              yAxisId="ph"
              orientation="right"
              tick={{ fontSize: 12 }}
              domain={[2.5, 4.5]}
              label={{ value: "pH", angle: 90, position: "insideRight", style: { fontSize: 11 } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {/* Current block lines */}
            <Line
              yAxisId="brix"
              type="monotone"
              dataKey="current_brix"
              name="Brix° (this block)"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              yAxisId="ph"
              type="monotone"
              dataKey="current_ph"
              name="pH (this block)"
              stroke="hsl(var(--secondary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            {/* Comparison block lines */}
            {showComparison && comparisonData?.map((block) => (
              <Line
                key={`${block.blockId}_brix`}
                yAxisId="brix"
                type="monotone"
                dataKey={`${block.blockId}_brix`}
                name={`Brix° ${block.name}`}
                stroke={block.color}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={{ r: 2, fill: block.color }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
