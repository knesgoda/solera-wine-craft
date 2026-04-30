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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { HarvestWindowCard } from "@/components/harvest/HarvestWindowCard";
import { RipeningHistorySection } from "@/components/ripening/RipeningHistorySection";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { useHarvestPrediction } from "@/hooks/useHarvestPrediction";
import { format } from "date-fns";
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

const InfoRow = ({ label, value, tooltip }: { label: string; value: string | number | null | undefined; tooltip?: string }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground inline-flex items-center">
        {label}
        {tooltip && <HelpTooltip content={tooltip} />}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
};

const emptyEditForm = {
  name: "", variety: "", clone: "", rootstock: "", acres: "",
  lifecycle_stage: "" as string, soil_ph: "", soil_texture: "", soil_organic_matter: "", drainage: "",
  row_orientation: "", vine_spacing_ft: "", row_spacing_ft: "", year_planted: "",
};

const BlockDetail = () => {
  const { vineyardId, blockId } = useParams<{ vineyardId: string; blockId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [deleteBlockOpen, setDeleteBlockOpen] = useState(false);

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

  const { data: prediction } = useHarvestPrediction(blockId, vineyardId);

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
        row_orientation: editForm.row_orientation || null,
        vine_spacing_ft: editForm.vine_spacing_ft ? parseFloat(editForm.vine_spacing_ft) : null,
        row_spacing_ft: editForm.row_spacing_ft ? parseFloat(editForm.row_spacing_ft) : null,
        year_planted: editForm.year_planted ? parseInt(editForm.year_planted) : null,
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
      row_orientation: (block as any).row_orientation || "",
      vine_spacing_ft: (block as any).vine_spacing_ft != null ? String((block as any).vine_spacing_ft) : "",
      row_spacing_ft: (block as any).row_spacing_ft != null ? String((block as any).row_spacing_ft) : "",
      year_planted: (block as any).year_planted != null ? String((block as any).year_planted) : "",
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
          <Button variant="ghost" size="icon" onClick={() => setDeleteBlockOpen(true)}>
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
          <InfoRow label="Variety" value={block.variety} tooltip="The grape variety planted in this block. Used to group blocks for ripening comparison and harvest scheduling." />
          <InfoRow label="Clone" value={block.clone} tooltip="A specific genetic selection of the variety. Different clones of the same variety can ripen days apart, which matters for multi-clone estates." />
          <InfoRow label="Rootstock" value={block.rootstock} tooltip="The root system the variety is grafted onto. Affects vigor, water uptake, and ripening speed. Common examples: 101-14, 3309C, 1103P." />
          <InfoRow label="Acres" value={block.acres} tooltip="Total planted area of this block. Used in yield calculations and harvest crew scheduling." />
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
            <InfoRow label="Row Orientation" value={(block as any).row_orientation} tooltip="Compass direction the rows run (e.g. N-S, E-W). Affects sun exposure throughout the day, ripening uniformity, and canopy management decisions." />
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
                <Label className="inline-flex items-center">Variety<HelpTooltip content="The grape variety planted in this block. Used to group blocks for ripening comparison and harvest scheduling." /></Label>
                <Input value={editForm.variety} onChange={(e) => setEditForm({ ...editForm, variety: e.target.value })} placeholder="e.g. Cabernet Sauvignon" />
              </div>
              <div className="space-y-2">
                <Label className="inline-flex items-center">Clone<HelpTooltip content="A specific genetic selection of the variety. Different clones of the same variety can ripen days apart, which matters for multi-clone estates." /></Label>
                <Input value={editForm.clone} onChange={(e) => setEditForm({ ...editForm, clone: e.target.value })} placeholder="e.g. 337" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="inline-flex items-center">Rootstock<HelpTooltip content="The root system the variety is grafted onto. Affects vigor, water uptake, and ripening speed. Common examples: 101-14, 3309C, 1103P." /></Label>
                <Input value={editForm.rootstock} onChange={(e) => setEditForm({ ...editForm, rootstock: e.target.value })} placeholder="e.g. 110R" />
              </div>
              <div className="space-y-2">
                <Label className="inline-flex items-center">Acres<HelpTooltip content="Total planted area of this block. Used in yield calculations and harvest crew scheduling." /></Label>
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
            <div className="space-y-2">
              <Label className="inline-flex items-center">Row Orientation<HelpTooltip content="Compass direction the rows run (e.g. N-S, E-W, NE-SW). Affects sun exposure throughout the day, ripening uniformity, and canopy management decisions." /></Label>
              <Input value={editForm.row_orientation} onChange={(e) => setEditForm({ ...editForm, row_orientation: e.target.value })} placeholder="e.g. N-S" />
            </div>
            <Button type="submit" className="w-full" disabled={!editForm.name || updateBlock.isPending}>
              {updateBlock.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteBlockOpen} onOpenChange={setDeleteBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this block?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{block.name}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBlock.isPending}
              onClick={() => deleteBlock.mutate()}
            >
              Delete Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BlockDetail;