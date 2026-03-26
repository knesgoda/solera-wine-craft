import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ArrowUpDown, ExternalLink } from "lucide-react";
import { differenceInDays, parseISO, format, addDays } from "date-fns";
import type { SelectedBlock } from "@/components/ripening/BlockSelectorPanel";

const TARGET_BRIX = 24.0;

interface Sample {
  vintage_id: string;
  sampled_at: string;
  brix: number | null;
  ph: number | null;
  ta: number | null;
}

interface Props {
  selectedBlocks: SelectedBlock[];
  samples: Sample[];
  vintageMap: Record<string, { vintageId: string; year: number }>;
  colors: string[];
}

interface RowData {
  blockId: string;
  blockName: string;
  variety: string | null;
  clone: string | null;
  rootstock: string | null;
  lastSampleDate: string | null;
  brix: number | null;
  ph: number | null;
  ta: number | null;
  daysSinceLastSample: number | null;
  estimatedDaysToTarget: number | null;
  vintageId: string | null;
  color: string;
}

type SortKey = keyof RowData;

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

export function ComparisonDataTable({ selectedBlocks, samples, vintageMap, colors }: Props) {
  const [open, setOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("blockName");
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo(() => {
    const vintageToBlock: Record<string, string> = {};
    for (const [blockId, v] of Object.entries(vintageMap)) {
      vintageToBlock[v.vintageId] = blockId;
    }

    return selectedBlocks.map((block): RowData => {
      const vInfo = vintageMap[block.id];
      const vintageId = vInfo?.vintageId || null;

      // Get samples for this block
      const blockSamples = vintageId
        ? samples
            .filter((s) => s.vintage_id === vintageId)
            .sort((a, b) => a.sampled_at.localeCompare(b.sampled_at))
        : [];

      const lastSample = blockSamples.length > 0 ? blockSamples[blockSamples.length - 1] : null;
      const daysSince = lastSample ? differenceInDays(new Date(), parseISO(lastSample.sampled_at)) : null;

      // Estimate days to target using last 3 Brix readings
      let estimatedDaysToTarget: number | null = null;
      const brixSamples = blockSamples.filter((s) => s.brix != null);
      if (brixSamples.length >= 2 && lastSample?.brix != null && lastSample.brix < TARGET_BRIX) {
        const last3 = brixSamples.slice(-3);
        const baseDate = parseISO(last3[0].sampled_at);
        const points = last3.map((s) => ({
          x: differenceInDays(parseISO(s.sampled_at), baseDate),
          y: s.brix!,
        }));
        const slope = linearSlope(points);
        if (slope > 0) {
          estimatedDaysToTarget = Math.ceil((TARGET_BRIX - lastSample.brix) / slope);
        }
      } else if (lastSample?.brix != null && lastSample.brix >= TARGET_BRIX) {
        estimatedDaysToTarget = 0;
      }

      return {
        blockId: block.id,
        blockName: block.name,
        variety: block.variety,
        clone: block.clone,
        rootstock: block.rootstock,
        lastSampleDate: lastSample?.sampled_at || null,
        brix: lastSample?.brix ?? null,
        ph: lastSample?.ph ?? null,
        ta: lastSample?.ta ?? null,
        daysSinceLastSample: daysSince,
        estimatedDaysToTarget,
        vintageId,
        color: block.color,
      };
    });
  }, [selectedBlocks, samples, vintageMap]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === "string" ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortAsc ? cmp : -cmp;
    });
  }, [rows, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-none shadow-md">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-display">Latest Readings</CardTitle>
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><SortHeader label="Block" field="blockName" /></TableHead>
                    <TableHead><SortHeader label="Variety" field="variety" /></TableHead>
                    <TableHead>Clone</TableHead>
                    <TableHead>Rootstock</TableHead>
                    <TableHead><SortHeader label="Last Sample" field="lastSampleDate" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="Brix" field="brix" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="pH" field="ph" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="TA" field="ta" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="Days Ago" field="daysSinceLastSample" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="Est. Days to 24° Brix" field="estimatedDaysToTarget" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((row) => (
                    <TableRow key={row.blockId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                          <span className="font-medium">{row.blockName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.variety || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{row.clone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{row.rootstock || "—"}</TableCell>
                      <TableCell>
                        {row.lastSampleDate ? (
                          format(parseISO(row.lastSampleDate), "MMM d, yyyy")
                        ) : row.vintageId ? (
                          <Link to={`/vintages/${row.vintageId}`} className="text-primary hover:underline flex items-center gap-1 text-xs">
                            No data — log first sample <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-xs">No vintage</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.brix != null ? row.brix.toFixed(1) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.ph != null ? row.ph.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.ta != null ? row.ta.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.daysSinceLastSample != null ? (
                          <span className={row.daysSinceLastSample > 7 ? "text-destructive" : ""}>
                            {row.daysSinceLastSample}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.estimatedDaysToTarget != null ? (
                          row.estimatedDaysToTarget === 0 ? (
                            <span className="text-primary font-medium">Ready</span>
                          ) : (
                            `~${row.estimatedDaysToTarget}d`
                          )
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
