import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MapPin, Grape, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const VineyardList = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", region: "", coordinates: "", acres: "" });

  const { data: vineyards, isLoading } = useQuery({
    queryKey: ["vineyards", profile?.org_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vineyards").select("*, blocks(id)").eq("org_id", profile!.org_id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.org_id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.org_id) throw new Error("No organization");
      const { error } = await supabase.from("vineyards").insert({
        org_id: profile.org_id,
        name: form.name,
        region: form.region || null,
        coordinates: form.coordinates || null,
        acres: form.acres ? parseFloat(form.acres) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vineyards"] });
      setOpen(false);
      setForm({ name: "", region: "", coordinates: "", acres: "" });
      toast.success("Vineyard added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Vineyard Operations</h1>
          <p className="text-muted-foreground mt-1">Manage your vineyards and blocks</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Vineyard</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Add Vineyard</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="v-name">Name *</Label>
                <Input id="v-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-region">Region</Label>
                <Input id="v-region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. Napa Valley" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-coords">Coordinates</Label>
                <Input id="v-coords" value={form.coordinates} onChange={(e) => setForm({ ...form, coordinates: e.target.value })} placeholder="38.2975, -122.2869" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-acres">Acres</Label>
                <Input id="v-acres" type="number" step="0.01" value={form.acres} onChange={(e) => setForm({ ...form, acres: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={!form.name.trim() || createMutation.isPending}>
                {createMutation.isPending ? "Adding..." : "Add Vineyard"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse border-none shadow-md">
              <CardHeader><div className="h-6 bg-muted rounded w-2/3" /></CardHeader>
              <CardContent><div className="h-4 bg-muted rounded w-1/2" /></CardContent>
            </Card>
          ))}
        </div>
      ) : vineyards?.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Grape className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold mb-2">No vineyards yet</h3>
            <p className="text-muted-foreground mb-4">Add your first vineyard to get started</p>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Vineyard</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vineyards?.map((v) => (
            <Link to={`/operations/${v.id}`} key={v.id}>
              <Card className="hover:shadow-lg transition-shadow border-none shadow-md cursor-pointer group">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg font-display">{v.name}</CardTitle>
                    {v.region && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3.5 w-3.5" />{v.region}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    {v.acres && <span>{v.acres} acres</span>}
                    <span>{(v.blocks as any[])?.length || 0} blocks</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default VineyardList;
