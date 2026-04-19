import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Grape, TrendingUp, Beaker } from "lucide-react";
import { Link } from "react-router-dom";
import { BlockSelectorPanel, type SelectedBlock } from "@/components/ripening/BlockSelectorPanel";
import { RipeningCharts } from "@/components/ripening/RipeningCharts";
import { ComparisonDataTable } from "@/components/ripening/ComparisonDataTable";
import { SEOHead } from "@/components/SEOHead";

const COMPARISON_COLORS = [
  "hsl(348, 58%, 26%)",  // crimson
  "hsl(36, 64%, 47%)",   // gold
  "hsl(160, 50%, 40%)",  // teal
  "hsl(220, 60%, 50%)",  // blue
  "hsl(280, 50%, 50%)",  // purple
  "hsl(20, 70%, 50%)",   // orange
  "hsl(340, 60%, 55%)",  // rose
  "hsl(180, 45%, 40%)",  // cyan
  "hsl(100, 40%, 40%)",  // green
  "hsl(50, 70%, 45%)",   // amber
];

export interface BlockWithMeta {
  id: string;
  name: string;
  variety: string | null;
  clone: string | null;
  rootstock: string | null;
  vineyard_id: string;
  vineyard_name: string;
  vineyard_coordinates: string | null;
}

export interface ChartDataPoint {
  date: string;
  timestamp: number;
  [key: string]: number | string | null;
}

const RipeningComparison = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);
  const [comparing, setComparing] = useState(false);
  const [autoSelected, setAutoSelected] = useState(false);

  // Fetch all blocks with vineyard info
  const { data: allBlocks, isLoading: blocksLoading } = useQuery({
    queryKey: ["ripening-blocks", profile?.org_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocks")
        .select("id, name, variety, clone, rootstock, vineyard_id, vineyards!inner(name, coordinates, org_id)")
        .eq("vineyards.org_id", profile!.org_id)
        .eq("status", "active");
      if (error) throw error;
      return (data || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        variety: b.variety,
        clone: b.clone,
        rootstock: b.rootstock,
        vineyard_id: b.vineyard_id,
        vineyard_name: b.vineyards.name,
        vineyard_coordinates: b.vineyards.coordinates,
      })) as BlockWithMeta[];
    },
    enabled: !!profile?.org_id,
  });

  // Pre-select blocks from ?blocks=id1,id2 query param (e.g. divergence alert deep links)
  useEffect(() => {
    if (autoSelected || !allBlocks?.length) return;
    const param = searchParams.get("blocks");
    if (!param) return;
    const ids = param.split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return;
    const matched = ids
      .map((id, i) => {
        const b = allBlocks.find((x) => x.id === id);
        if (!b) return null;
        return {
          id: b.id,
          name: b.name,
          variety: b.variety,
          clone: b.clone,
          rootstock: b.rootstock,
          vineyardId: b.vineyard_id,
          vineyardName: b.vineyard_name,
          vineyardCoordinates: b.vineyard_coordinates,
          color: COMPARISON_COLORS[i % COMPARISON_COLORS.length],
        } as SelectedBlock;
      })
      .filter(Boolean) as SelectedBlock[];
    if (matched.length >= 2) {
      setSelectedBlocks(matched);
      setComparing(true);
    } else if (matched.length > 0) {
      setSelectedBlocks(matched);
    }
    setAutoSelected(true);
  }, [allBlocks, searchParams, autoSelected]);
  const blockIds = selectedBlocks.map((b) => b.id);
  const { data: comparisonData, isLoading: dataLoading } = useQuery({
    queryKey: ["ripening-comparison-data", blockIds],
    queryFn: async () => {
      // Get active vintages for selected blocks
      const { data: vintages } = await supabase
        .from("vintages")
        .select("id, block_id, year")
        .in("block_id", blockIds)
        .order("year", { ascending: false });

      if (!vintages?.length) return { samples: [], vintageMap: {}, gddData: [] };

      // Pick latest vintage per block
      const vintageMap: Record<string, { vintageId: string; year: number }> = {};
      for (const v of vintages) {
        if (v.block_id && !vintageMap[v.block_id]) {
          vintageMap[v.block_id] = { vintageId: v.id, year: v.year };
        }
      }

      const vintageIds = Object.values(vintageMap).map((v) => v.vintageId);

      // Fetch lab samples
      const { data: samples } = await supabase
        .from("lab_samples")
        .select("vintage_id, sampled_at, brix, ph, ta")
        .in("vintage_id", vintageIds)
        .order("sampled_at", { ascending: true });

      // Fetch GDD data for vineyards
      const vineyardIds = [...new Set(selectedBlocks.map((b) => b.vineyardId))];
      const { data: gddData } = await supabase
        .from("weather_readings")
        .select("vineyard_id, recorded_at, gdd_cumulative")
        .in("vineyard_id", vineyardIds)
        .not("gdd_cumulative", "is", null)
        .order("recorded_at", { ascending: true });

      return {
        samples: samples || [],
        vintageMap,
        gddData: gddData || [],
      };
    },
    enabled: comparing && blockIds.length >= 2,
  });

  const handleCompare = () => {
    if (selectedBlocks.length >= 2) {
      setComparing(true);
    }
  };

  const handleSelectionChange = (blocks: SelectedBlock[]) => {
    setSelectedBlocks(blocks);
    if (comparing && blocks.length < 2) {
      setComparing(false);
    }
  };

  // Determine empty state
  const hasBlocks = (allBlocks?.length || 0) > 0;
  const hasLabSamples = comparisonData?.samples && comparisonData.samples.length > 0;

  return (
    <div className="space-y-6">
      <SEOHead title="Ripening Tracker | Solera" description="Compare ripening curves across clones and rootstocks" />
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Ripening Tracker</h1>
        <p className="text-muted-foreground mt-1">Compare ripening curves across clones and rootstocks</p>
      </div>

      {blocksLoading ? (
        <Card className="border-none shadow-md">
          <CardContent className="py-16">
            <div className="flex items-center justify-center text-muted-foreground">Loading blocks...</div>
          </CardContent>
        </Card>
      ) : !hasBlocks ? (
        <EmptyState
          icon={Grape}
          title="No vineyard blocks yet"
          description="Add your first vineyard block to start tracking ripening."
          actionLabel="Add Block"
          onAction={() => window.location.href = "/operations"}
        />
      ) : (
        <>
          <BlockSelectorPanel
            allBlocks={allBlocks || []}
            selectedBlocks={selectedBlocks}
            onSelectionChange={handleSelectionChange}
            onCompare={handleCompare}
            colors={COMPARISON_COLORS}
          />

          {!comparing && selectedBlocks.length < 2 && (
            <Card className="border-dashed border-2 border-border">
              <CardContent className="py-12 text-center">
                <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Select at least 2 blocks above to compare ripening curves across clones and rootstocks.
                </p>
              </CardContent>
            </Card>
          )}

          {comparing && dataLoading && (
            <Card className="border-none shadow-md">
              <CardContent className="py-16">
                <div className="flex items-center justify-center text-muted-foreground">Loading comparison data...</div>
              </CardContent>
            </Card>
          )}

          {comparing && !dataLoading && !hasLabSamples && (
            <EmptyState
              icon={Beaker}
              title="No lab samples found"
              description="Log your first lab sample to see ripening curves."
              actionLabel="Go to Vintages"
              onAction={() => window.location.href = "/vintages"}
            />
          )}

          {comparing && !dataLoading && hasLabSamples && comparisonData && (
            <>
              <RipeningCharts
                selectedBlocks={selectedBlocks}
                samples={comparisonData.samples}
                vintageMap={comparisonData.vintageMap}
                gddData={comparisonData.gddData}
                colors={COMPARISON_COLORS}
              />
              <ComparisonDataTable
                selectedBlocks={selectedBlocks}
                samples={comparisonData.samples}
                vintageMap={comparisonData.vintageMap}
                colors={COMPARISON_COLORS}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default RipeningComparison;
