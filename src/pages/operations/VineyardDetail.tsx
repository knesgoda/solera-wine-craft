import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, ChevronRight, MapPin, Trash2, CloudSun, Grid3x3, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { WeatherTab } from "@/components/weather/WeatherTab";

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

const emptyBlock = {
  name: "", variety: "", clone: "", rootstock: "", acres: "",
  lifecycle_stage: "" as string, soil_ph: "", soil_texture: "", soil_organic_matter: "", drainage: "",
};

const VineyardDetail = () => {
  const { vineyardId } = useParams<{ vineyardId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyBlock);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", region: "", coordinates: "", acres: "" });

  const { data: vineyard, isLoading: loadingVineyard } = useQuery({
    queryKey: ["vineyard", vineyardId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vineyards").select("*").eq("id", vineyardId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!vineyardId,
  });

  const { data: blocks, isLoading: loadingBlocks } = useQuery({
    queryKey: ["blocks", vineyardId],
    queryFn: async () => {
      const { data, error } = await supabase.from("blocks").select("*").eq("vineyard_id", vineyardId!).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!vineyardId,
  });

  const createBlock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("blocks").insert({
        vineyard_id: vineyardId!,
        name: form.name,
        variety: form.variety || null,
        clone: form.clone || null,
        rootstock: form.rootstock || null,
        acres: form.acres ? parseFloat(form.acres) : null,
        lifecycle_stage: (form.lifecycle_stage as LifecycleStage) || null,
        soil_ph: form.soil_ph ? parseFloat(form.soil_ph) : null,
        soil_texture: form.soil_texture || null,
        soil_organic_matter: form.soil_organic_matter ? parseFloat(form.soil_organic_matter) : null,
        drainage: form.drainage || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocks", vineyardId] });
      setOpen(false);
      setForm(emptyBlock);
      toast.success("Block added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteVineyard = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vineyards").delete().eq("id", vineyardId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vineyard deleted");
      navigate("/operations");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateVineyard = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vineyards").update({
        name: editForm.name,
        region: editForm.region || null,
        coordinates: editForm.coordinates || null,
        acres: editForm.acres ? parseFloat(editForm.acres) : null,
      } as any).eq("id", vineyardId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vineyard", vineyardId] });
      queryClient.invalidateQueries({ queryKey: ["vineyards"] });
      toast.success("Vineyard updated");
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEditVineyard = () => {
    if (!vineyard) return;
    setEditForm({
      name: vineyard.name || "",
      region: vineyard.region || "",
      coordinates: vineyard.coordinates || "",
      acres: vineyard.acres != null ? String(vineyard.acres) : "",
    });
    setEditOpen(true);
  };

  if (loadingVineyard) {
    return <div className="animate-pulse text-muted-foreground py-8 text-center">Loading vineyard...</div>;
  }

  if (!vineyard) {
    return <div className="text-center py-8 text-muted-foreground">Vineyard not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/operations")} className="mt-1 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{vineyard.name}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
              {vineyard.region && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{vineyard.region}</span>}
              {vineyard.acres && <span>{vineyard.acres} acres</span>}
              {vineyard.coordinates && <span>{vineyard.coordinates}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Block</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">Add Block</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createBlock.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Variety</Label>
                    <Input value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} placeholder="e.g. Cabernet Sauvignon" />
                  </div>
                  <div className="space-y-2">
                    <Label>Clone</Label>
                    <Input value={form.clone} onChange={(e) => setForm({ ...form, clone: e.target.value })} placeholder="e.g. 337" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rootstock</Label>
                    <Input value={form.rootstock} onChange={(e) => setForm({ ...form, rootstock: e.target.value })} placeholder="e.g. 110R" />
                  </div>
                  <div className="space-y-2">
                    <Label>Acres</Label>
                    <Input type="number" step="0.01" value={form.acres} onChange={(e) => setForm({ ...form, acres: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Lifecycle Stage</Label>
                  <Select value={form.lifecycle_stage} onValueChange={(v) => setForm({ ...form, lifecycle_stage: v })}>
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
                    <Input type="number" step="0.1" value={form.soil_ph} onChange={(e) => setForm({ ...form, soil_ph: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Soil Texture</Label>
                    <Input value={form.soil_texture} onChange={(e) => setForm({ ...form, soil_texture: e.target.value })} placeholder="e.g. Sandy loam" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Organic Matter %</Label>
                    <Input type="number" step="0.1" value={form.soil_organic_matter} onChange={(e) => setForm({ ...form, soil_organic_matter: e.target.value })} placeholder="% organic matter" />
                  </div>
                  <div className="space-y-2">
                    <Label>Drainage</Label>
                    <Input value={form.drainage} onChange={(e) => setForm({ ...form, drainage: e.target.value })} placeholder="e.g. Well-drained" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createBlock.isPending}>
                  {createBlock.isPending ? "Adding..." : "Add Block"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this vineyard and all its blocks?")) deleteVineyard.mutate(); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Tabs: Blocks + Weather */}
      <Tabs defaultValue="blocks" className="space-y-4">
        <TabsList className="w-full">
          <TabsTrigger value="blocks" className="flex-1 gap-2">
            <Grid3x3 className="h-4 w-4" /> Blocks
          </TabsTrigger>
          <TabsTrigger value="weather" className="flex-1 gap-2">
            <CloudSun className="h-4 w-4" /> Weather
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blocks">
          {loadingBlocks ? (
            <div className="animate-pulse text-muted-foreground">Loading blocks...</div>
          ) : blocks?.length === 0 ? (
            <Card className="border-dashed border-2 border-border">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <h3 className="font-display text-lg font-semibold mb-2">No blocks yet</h3>
                <p className="text-muted-foreground mb-4">Add blocks to track individual vineyard sections</p>
                <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Block</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {blocks?.map((block) => (
                <Link to={`/operations/${vineyardId}/blocks/${block.id}`} key={block.id}>
                  <Card className="hover:shadow-lg transition-shadow border-none shadow-md cursor-pointer group">
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                      <div>
                        <CardTitle className="text-lg font-display">{block.name}</CardTitle>
                        {block.variety && <p className="text-sm text-muted-foreground mt-1">{block.variety}</p>}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {block.lifecycle_stage && (
                          <Badge variant="secondary" className={LIFECYCLE_COLORS[block.lifecycle_stage]}>
                            {LIFECYCLE_LABELS[block.lifecycle_stage]}
                          </Badge>
                        )}
                        {block.acres && <span className="text-sm text-muted-foreground">{block.acres} acres</span>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="weather">
          <WeatherTab vineyardId={vineyardId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VineyardDetail;
