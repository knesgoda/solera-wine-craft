import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Trash2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { HarvestWindowCard } from "@/components/harvest/HarvestWindowCard";
import { RipeningHistorySection } from "@/components/ripening/RipeningHistorySection";
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

const emptyEditForm = {
  name: "", variety: "", clone: "", rootstock: "", acres: "",
  lifecycle_stage: "" as string, soil_ph: "", soil_texture: "", soil_organic_matter: "", drainage: "",
};

const BlockDetail = () => {
  const { vineyardId, blockId } = useParams<{ vineyardId: string; blockId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);

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

  const updateBlock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("blocks").update({
        name: editForm.name,
        variety: editForm.variety || null,
        clone: editForm.clone || null,
        rootstock: editForm.rootstock || null,
        acres: editForm.acres ? parseFloat(editForm.acres) : null,
        lifecycle_stage: (editForm.lifecycle_stage as LifecycleStage) || null,
        soil_ph: editForm.soil_ph ? parseFloat(editForm.soil_ph) : null,
        soil_texture: editForm.soil_texture || null,
        soil_organic_matter: editForm.soil_organic_matter ? parseFloat(editForm.soil_organic_matter) : null,
        drainage: editForm.drainage || null,
      }).eq("id", blockId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block", blockId] });
      queryClient.invalidateQueries({ queryKey: ["blocks", vineyardId] });
      toast.success("Block updated");
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = () => {
    if (!block) return;
    setEditForm({
      name: block.name || "",
      variety: block.variety || "",
      clone: block.clone || "",
      rootstock: block.rootstock || "",
      acres: block.acres != null ? String(block.acres) : "",
      lifecycle_stage: block.lifecycle_stage || "",
      soil_ph: block.soil_ph != null ? String(block.soil_ph) : "",
      soil_texture: block.soil_texture || "",
      soil_organic_matter: block.soil_organic_matter != null ? String(block.soil_organic_matter) : "",
      drainage: (block as any).drainage || "",
    });
    setEditOpen(true);
  };

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
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={startEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this block?")) deleteBlock.mutate(); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
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

      {/* Ripening History */}
      <RipeningHistorySection blockId={blockId!} vineyardId={vineyardId!} />

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

      {/* Edit Block Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Block</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateBlock.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Variety</Label>
                <Input value={editForm.variety} onChange={(e) => setEditForm({ ...editForm, variety: e.target.value })} placeholder="e.g. Cabernet Sauvignon" />
              </div>
              <div className="space-y-2">
                <Label>Clone</Label>
                <Input value={editForm.clone} onChange={(e) => setEditForm({ ...editForm, clone: e.target.value })} placeholder="e.g. 337" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rootstock</Label>
                <Input value={editForm.rootstock} onChange={(e) => setEditForm({ ...editForm, rootstock: e.target.value })} placeholder="e.g. 110R" />
              </div>
              <div className="space-y-2">
                <Label>Acres</Label>
                <Input type="number" step="0.01" value={editForm.acres} onChange={(e) => setEditForm({ ...editForm, acres: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lifecycle Stage</Label>
              <Select value={editForm.lifecycle_stage} onValueChange={(v) => setEditForm({ ...editForm, lifecycle_stage: v })}>
                <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LIFECYCLE_LABELS) as LifecycleStage[]).map((s) => (
                    <SelectItem key={s} value={s}>{LIFECYCLE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Soil pH</Label>
                <Input type="number" step="0.1" value={editForm.soil_ph} onChange={(e) => setEditForm({ ...editForm, soil_ph: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Soil Texture</Label>
                <Input value={editForm.soil_texture} onChange={(e) => setEditForm({ ...editForm, soil_texture: e.target.value })} placeholder="e.g. Sandy loam" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Organic Matter %</Label>
                <Input type="number" step="0.1" value={editForm.soil_organic_matter} onChange={(e) => setEditForm({ ...editForm, soil_organic_matter: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Drainage</Label>
                <Input value={editForm.drainage} onChange={(e) => setEditForm({ ...editForm, drainage: e.target.value })} placeholder="e.g. Well-drained" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={!editForm.name || updateBlock.isPending}>
              {updateBlock.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BlockDetail;