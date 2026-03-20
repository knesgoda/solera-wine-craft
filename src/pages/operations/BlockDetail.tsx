import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { HarvestWindowCard } from "@/components/harvest/HarvestWindowCard";

type LifecycleStage = Database["public"]["Enums"]["block_lifecycle_stage"];

const LIFECYCLE_LABELS: Record<LifecycleStage, string> = {
  planting: "Planting",
  establishment: "Establishment",
  bearing: "Bearing",
  mature: "Mature",
  replanting: "Replanting",
};

const LIFECYCLE_COLORS: Record<LifecycleStage, string> = {
  planting: "bg-blue-100 text-blue-800",
  establishment: "bg-amber-100 text-amber-800",
  bearing: "bg-green-100 text-green-800",
  mature: "bg-purple-100 text-purple-800",
  replanting: "bg-red-100 text-red-800",
};

const InfoRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
};

const BlockDetail = () => {
  const { vineyardId, blockId } = useParams<{ vineyardId: string; blockId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: block, isLoading } = useQuery({
    queryKey: ["block", blockId],
    queryFn: async () => {
      const { data, error } = await supabase.from("blocks").select("*").eq("id", blockId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!blockId,
  });

  const { data: vineyard } = useQuery({
    queryKey: ["vineyard", vineyardId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vineyards").select("name").eq("id", vineyardId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!vineyardId,
  });

  const deleteBlock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("blocks").delete().eq("id", blockId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocks", vineyardId] });
      toast.success("Block deleted");
      navigate(`/operations/${vineyardId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="animate-pulse text-muted-foreground py-8 text-center">Loading block...</div>;
  if (!block) return <div className="text-center py-8 text-muted-foreground">Block not found</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/operations/${vineyardId}`)} className="mt-1 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">{vineyard?.name}</p>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{block.name}</h1>
            <div className="flex gap-2 mt-2">
              {block.lifecycle_stage && (
                <Badge variant="secondary" className={LIFECYCLE_COLORS[block.lifecycle_stage]}>
                  {LIFECYCLE_LABELS[block.lifecycle_stage]}
                </Badge>
              )}
              <Badge variant="outline" className="capitalize">{block.status}</Badge>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this block?")) deleteBlock.mutate(); }}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Viticulture Info */}
      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-display">Viticulture</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <InfoRow label="Variety" value={block.variety} />
          <InfoRow label="Clone" value={block.clone} />
          <InfoRow label="Rootstock" value={block.rootstock} />
          <InfoRow label="Acres" value={block.acres} />
        </CardContent>
      </Card>

      {/* Harvest Window Prediction */}
      <HarvestWindowCard blockId={blockId!} vineyardId={vineyardId!} />

      {/* Soil Profile */}
      {(block.soil_ph || block.soil_texture || block.soil_organic_matter || (block as any).drainage) && (
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-display">Soil Profile</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <InfoRow label="pH" value={block.soil_ph} />
            <InfoRow label="Texture" value={block.soil_texture} />
            <InfoRow label="Organic Matter" value={block.soil_organic_matter ? `${block.soil_organic_matter}%` : null} />
            <InfoRow label="Drainage" value={(block as any).drainage} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BlockDetail;
