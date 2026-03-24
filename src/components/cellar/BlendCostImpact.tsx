import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ArrowRight } from "lucide-react";
import { previewBlendCosts } from "@/lib/blendCostPropagation";

interface BlendCostImpactProps {
  trialId: string;
}

export function BlendCostImpact({ trialId }: BlendCostImpactProps) {
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  const { data: preview } = useQuery({
    queryKey: ["blend-cost-preview", trialId, orgId],
    queryFn: () => previewBlendCosts(trialId, orgId!),
    enabled: !!orgId && !!trialId,
  });

  if (!preview || preview.sources.length === 0) return null;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const hasCosts = preview.grandTotal > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5" /> Cost Impact
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasCosts ? (
          <p className="text-sm text-muted-foreground">
            No production costs recorded on source lots. Costs will need to be added manually after blending.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              When this blend is finalized, the following costs will transfer to the target lot:
            </p>
            {preview.sources.map((s) => (
              <div key={s.vintageId} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{s.percentage}%</Badge>
                  <span className="text-foreground">{s.vintageName || "Unknown Lot"}</span>
                  <span className="text-muted-foreground">({s.costEntryCount} entries, {fmt(s.totalCost)} total)</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono font-medium text-foreground">{fmt(s.transferAmount)}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 font-semibold text-sm">
              <span>Total Cost Transfer</span>
              <span className="font-mono">{fmt(preview.grandTotal)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
