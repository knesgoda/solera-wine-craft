import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  Brush, Area, ComposedChart, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { SelectedBlock } from "@/components/ripening/BlockSelectorPanel";

interface Sample {
  vintage_id: string;
  sampled_at: string;
  brix: number | null;
  ph: number | null;
  ta: number | null;
}

interface GddReading {
  vineyard_id: string;
  recorded_at: string;
  gdd_cumulative: number | null;
}

interface Props {
  selectedBlocks: SelectedBlock[];
  samples: Sample[];
  vintageMap: Record<string, { vintageId: string; year: number }>;
  gddData: GddReading[];
  colors: string[];
}

interface DivergenceInfo {
  level: "green" | "yellow" | "red";
  spread: number;
  fastest: string;
  slowest: string;
}

function buildChartData(
  selectedBlocks: SelectedBlock[],
  samples: Sample[],
  vintageMap: Record<string, { vintageId: string; year: number }>,
  gddData: GddReading[],
  metric: "brix" | "ph" | "ta"
) {
  // Build vintageId -> blockId map
  const vintageToBlock: Record<string, string> = {};
  for (const [blockId, v] of Object.entries(vintageMap)) {
    vintageToBlock[v.vintageId] = blockId;
  }

  // Group samples by date
  const dateMap = new Map<string, Record<string, number | null>>();

  for (const s of samples) {
    const blockId = vintageToBlock[s.vintage_id];
    if (!blockId) continue;
    const dateKey = format(parseISO(s.sampled_at), "yyyy-MM-dd");
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, {});
    const row = dateMap.get(dateKey)!;
    row[`${blockId}_${metric}`] = s[metric];
  }

  // Add GDD data
  const vineyardIds = [...new Set(selectedBlocks.map((b) => b.vineyardId))];
  const sharedVineyard = vineyardIds.length === 1;

  for (const g of gddData) {
    const dateKey = g.recorded_at;
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, {});
    const row = dateMap.get(dateKey)!;
    if (sharedVineyard) {
      row["gdd_shared"] = g.gdd_cumulative;
    } else {
      row[`gdd_${g.vineyard_id}`] = g.gdd_cumulative;
    }
  }

  // Sort by date
  const sortedDates = [...dateMap.keys()].sort();
  return sortedDates.map((date) => ({
    date,
    dateLabel: format(parseISO(date), "MMM d"),
    timestamp: parseISO(date).getTime(),
    ...dateMap.get(date),
  }));
}

function calculateDivergence(
  data: any[],
  selectedBlocks: SelectedBlock[],
  vintageMap: Record<string, { vintageId: string; year: number }>
): DivergenceInfo | null {
  // Find the latest date that has at least 2 block Brix values
  const blockIds = selectedBlocks.map((b) => b.id);
  const blockNameMap = new Map(selectedBlocks.map((b) => [b.id, b.name]));

  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    const values: { blockId: string; brix: number }[] = [];
    for (const bid of blockIds) {
      const val = row[`${bid}_brix`];
      if (val != null) values.push({ blockId: bid, brix: val });
    }
    if (values.length >= 2) {
      values.sort((a, b) => b.brix - a.brix);
      const spread = values[0].brix - values[values.length - 1].brix;
      const level = spread > 4 ? "red" : spread > 2 ? "yellow" : "green";
      return {
        level,
        spread: Math.round(spread * 10) / 10,
        fastest: blockNameMap.get(values[0].blockId) || "",
        slowest: blockNameMap.get(values[values.length - 1].blockId) || "",
      };
    }
  }
  return null;
}

const CustomTooltip = ({ active, payload, label, selectedBlocks }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 text-xs shadow-xl">
      <p className="font-medium mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => {
        const block = selectedBlocks.find((b: SelectedBlock) => entry.dataKey?.startsWith(b.id));
        return (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">
              {block ? `${block.name}${block.clone ? ` (${block.clone})` : ""}` : entry.name || entry.dataKey}
            </span>
            <span className="font-mono font-medium ml-auto tabular-nums">
              {entry.value != null ? Number(entry.value).toFixed(1) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export function RipeningCharts({ selectedBlocks, samples, vintageMap, gddData, colors }: Props) {
  const [brushRange, setBrushRange] = useState<{ startIndex?: number; endIndex?: number }>({});

  const brixData = useMemo(
    () => buildChartData(selectedBlocks, samples, vintageMap, gddData, "brix"),
    [selectedBlocks, samples, vintageMap, gddData]
  );

  const phData = useMemo(
    () => buildChartData(selectedBlocks, samples, vintageMap, gddData, "ph"),
    [selectedBlocks, samples, vintageMap, gddData]
  );

  const taData = useMemo(
    () => buildChartData(selectedBlocks, samples, vintageMap, gddData, "ta"),
    [selectedBlocks, samples, vintageMap, gddData]
  );

  const divergence = useMemo(
    () => calculateDivergence(brixData, selectedBlocks, vintageMap),
    [brixData, selectedBlocks, vintageMap]
  );

  const vineyardIds = [...new Set(selectedBlocks.map((b) => b.vineyardId))];
  const sharedVineyard = vineyardIds.length === 1;

  const divergenceBarColor =
    divergence?.level === "red"
      ? "hsl(0, 84%, 60%)"
      : divergence?.level === "yellow"
      ? "hsl(36, 64%, 47%)"
      : "hsl(145, 50%, 45%)";

  return (
    <div className="space-y-4">
      {/* Divergence warning */}
      {divergence?.level === "red" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Significant ripening divergence detected</strong> — {divergence.fastest} is{" "}
            {divergence.spread}° Brix ahead of {divergence.slowest}. Consider staggering pick schedules.
          </AlertDescription>
        </Alert>
      )}

      {/* Divergence bar */}
      {divergence && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Spread:</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min((divergence.spread / 6) * 100, 100)}%`,
                backgroundColor: divergenceBarColor,
              }}
            />
          </div>
          <span className="text-xs font-mono font-medium" style={{ color: divergenceBarColor }}>
            {divergence.spread}° Brix
          </span>
        </div>
      )}

      {/* Main Brix Chart */}
      <Card className="border-none shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">Brix Ripening Curves</CardTitle>
        </CardHeader>
        <CardContent>
          {brixData.length === 0 && selectedBlocks.length > 0 ? (
            <div className="h-[320px] w-full flex flex-col items-center justify-center text-center">
              <p className="text-muted-foreground text-sm font-medium">No lab samples recorded yet for the selected blocks.</p>
              <p className="text-muted-foreground text-xs mt-2 max-w-sm">Add lab samples from the Vintages module to begin tracking ripening progress.</p>
            </div>
          ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={brixData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis
                  yAxisId="brix"
                  orientation="left"
                  tick={{ fontSize: 11 }}
                  label={{ value: "Brix°", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
                />
                <YAxis
                  yAxisId="gdd"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  label={{ value: "GDD", angle: 90, position: "insideRight", style: { fontSize: 11 } }}
                />
                <Tooltip content={(props: any) => <CustomTooltip {...props} selectedBlocks={selectedBlocks} />} />
                {selectedBlocks.map((block, i) => (
                  <Line
                    key={block.id}
                    yAxisId="brix"
                    type="monotone"
                    dataKey={`${block.id}_brix`}
                    name={block.name}
                    stroke={block.color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: block.color }}
                    connectNulls
                  />
                ))}
                {/* GDD overlay */}
                {sharedVineyard ? (
                  <Area
                    yAxisId="gdd"
                    type="monotone"
                    dataKey="gdd_shared"
                    name="GDD"
                    fill="hsl(var(--muted))"
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    fillOpacity={0.15}
                    strokeWidth={1}
                    connectNulls
                  />
                ) : (
                  vineyardIds.map((vid, i) => (
                    <Line
                      key={`gdd-${vid}`}
                      yAxisId="gdd"
                      type="monotone"
                      dataKey={`gdd_${vid}`}
                      name={`GDD`}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                      dot={false}
                      connectNulls
                    />
                  ))
                )}
                <Brush
                  dataKey="dateLabel"
                  height={25}
                  stroke="hsl(var(--border))"
                  onChange={(range: any) => setBrushRange(range)}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          )}
        </CardContent>
      </Card>

      {/* pH Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">pH</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={phData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip content={(props: any) => <CustomTooltip {...props} selectedBlocks={selectedBlocks} />} />
                  {selectedBlocks.map((block) => (
                    <Line
                      key={block.id}
                      type="monotone"
                      dataKey={`${block.id}_ph`}
                      name={block.name}
                      stroke={block.color}
                      strokeWidth={1.5}
                      dot={{ r: 2, fill: block.color }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* TA Chart */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Titratable Acidity (TA)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={taData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip content={(props: any) => <CustomTooltip {...props} selectedBlocks={selectedBlocks} />} />
                  {selectedBlocks.map((block) => (
                    <Line
                      key={block.id}
                      type="monotone"
                      dataKey={`${block.id}_ta`}
                      name={block.name}
                      stroke={block.color}
                      strokeWidth={1.5}
                      dot={{ r: 2, fill: block.color }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
