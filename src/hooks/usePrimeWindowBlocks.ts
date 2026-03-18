import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { addDays, differenceInDays, format, parseISO } from "date-fns";

export interface PrimeWindowBlock {
  blockId: string;
  blockName: string;
  vineyardName: string;
  vineyardId: string;
  predictedDate: Date;
  currentBrix: number;
}

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

export function usePrimeWindowBlocks() {
  const { organization } = useAuth();
  const orgId = organization?.id;

  return useQuery<PrimeWindowBlock[]>({
    queryKey: ["prime-window-blocks", orgId],
    queryFn: async () => {
      // Get all in-progress vintages with block_id
      const { data: vintages } = await supabase
        .from("vintages")
        .select("id, block_id")
        .eq("org_id", orgId!)
        .eq("status", "in_progress")
        .not("block_id", "is", null);

      if (!vintages?.length) return [];

      const results: PrimeWindowBlock[] = [];

      for (const v of vintages) {
        // Get lab samples with brix
        const { data: samples } = await supabase
          .from("lab_samples")
          .select("brix, sampled_at")
          .eq("vintage_id", v.id)
          .not("brix", "is", null)
          .order("sampled_at", { ascending: true });

        const brixSamples = (samples || []).filter(s => s.brix != null);
        if (brixSamples.length < 2) continue;

        const currentBrix = brixSamples[brixSamples.length - 1].brix!;
        const last3 = brixSamples.slice(-3);
        const baseDate = parseISO(last3[0].sampled_at);
        const points = last3.map(s => ({
          x: differenceInDays(parseISO(s.sampled_at), baseDate),
          y: s.brix!,
        }));
        const slope = linearSlope(points);

        let predictedDate: Date | null = null;
        if (currentBrix >= 24) {
          predictedDate = new Date();
        } else if (slope > 0) {
          const days = Math.ceil((24 - currentBrix) / slope);
          if (days <= 7) predictedDate = addDays(new Date(), days);
        }

        if (!predictedDate) continue;

        // Get block and vineyard info
        const { data: block } = await supabase
          .from("blocks")
          .select("name, vineyard_id")
          .eq("id", v.block_id!)
          .single();

        if (!block) continue;

        const { data: vineyard } = await supabase
          .from("vineyards")
          .select("name")
          .eq("id", block.vineyard_id)
          .single();

        results.push({
          blockId: v.block_id!,
          blockName: block.name,
          vineyardName: vineyard?.name || "",
          vineyardId: block.vineyard_id,
          predictedDate,
          currentBrix,
        });
      }

      return results;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}
