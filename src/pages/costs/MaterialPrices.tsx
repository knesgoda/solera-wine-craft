import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Package, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";

const SEED_MATERIALS = [
  { name: "Tartaric Acid", unit: "g", cost_per_unit: 0.05, category: "Chemicals" },
  { name: "Potassium Metabisulfite (SO2)", unit: "g", cost_per_unit: 0.03, category: "Chemicals" },
  { name: "DAP - Diammonium Phosphate", unit: "g", cost_per_unit: 0.02, category: "Chemicals" },
  { name: "Fermaid O", unit: "g", cost_per_unit: 0.15, category: "Chemicals" },
  { name: "French Oak Barrel", unit: "each", cost_per_unit: 1200, category: "Cooperage" },
  { name: "American Oak Barrel", unit: "each", cost_per_unit: 500, category: "Cooperage" },
  { name: "Hungarian Oak Barrel", unit: "each", cost_per_unit: 800, category: "Cooperage" },
  { name: "Bentonite", unit: "g", cost_per_unit: 0.01, category: "Chemicals" },
  { name: "Pectinase", unit: "mL", cost_per_unit: 0.08, category: "Chemicals" },
  { name: "Copper Sulfate", unit: "g", cost_per_unit: 0.10, category: "Chemicals" },
];

export default function MaterialPrices() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState("");
  const [form, setForm] = useState({ name: "", unit: "", cost_per_unit: "", category_id: "", notes: "" });

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["material-unit-costs", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_unit_costs")
        .select("*, cost_categories(name)")
        .eq("org_id", orgId!)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["cost-categories", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_categories")
        .select("*")
        .eq("org_id", orgId!)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("material_unit_costs").insert({
        org_id: orgId,
        name: form.name,
        unit: form.unit,
        cost_per_unit: parseFloat(form.cost_per_unit),
        category_id: form.category_id || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-unit-costs"] });
      toast.success("Material added");
      setDialogOpen(false);
      setForm({ name: "", unit: "", cost_per_unit: "", category_id: "", notes: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateCostMutation = useMutation({
    mutationFn: async ({ id, cost }: { id: string; cost: number }) => {
      const { error } = await supabase.from("material_unit_costs").update({ cost_per_unit: cost }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-unit-costs"] });
      toast.success("Price updated");
      setEditingId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("material_unit_costs").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-unit-costs"] });
      toast.success("Material updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      for (const mat of SEED_MATERIALS) {
        const cat = categories.find((c: any) => c.name === mat.category);
        await supabase.from("material_unit_costs").insert({
          org_id: orgId,
          name: mat.name,
          unit: mat.unit,
          cost_per_unit: mat.cost_per_unit,
          category_id: cat?.id || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-unit-costs"] });
      toast.success("Common materials loaded");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
      <SEOHead title="Material Prices | Solera" description="Manage material unit costs" />

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Material Prices</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Material</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : materials.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground mb-1">No materials configured.</p>
            <p className="text-sm text-muted-foreground mb-4">Add common winemaking materials and their unit costs for automatic cost tracking.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                <Sparkles className="h-4 w-4 mr-2" /> Load Common Materials
              </Button>
              <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Material</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Cost Per Unit</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((m: any) => (
                <TableRow key={m.id} className={!m.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium text-sm">{m.name}</TableCell>
                  <TableCell className="text-sm">{m.cost_categories?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{m.unit}</TableCell>
                  <TableCell className="text-right">
                    {editingId === m.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          type="number"
                          step="0.0001"
                          value={editCost}
                          onChange={(e) => setEditCost(e.target.value)}
                          className="w-24 h-8 text-right"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") updateCostMutation.mutate({ id: m.id, cost: parseFloat(editCost) });
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => updateCostMutation.mutate({ id: m.id, cost: parseFloat(editCost) })}>✓</Button>
                      </div>
                    ) : (
                      <button
                        className="font-mono text-sm hover:underline cursor-pointer"
                        onClick={() => { setEditingId(m.id); setEditCost(String(m.cost_per_unit)); }}
                      >
                        ${Number(m.cost_per_unit).toFixed(4)}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(parseISO(m.updated_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Switch checked={m.is_active} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: m.id, active: checked })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Material Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Material</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tartaric Acid" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unit *</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="g, kg, mL, each" />
              </div>
              <div className="space-y-1.5">
                <Label>Cost Per Unit *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" step="0.0001" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} className="pl-7" placeholder="0.0500" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!form.name || !form.unit || !form.cost_per_unit || addMutation.isPending}
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
