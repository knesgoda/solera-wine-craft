import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, GripVertical, Lock } from "lucide-react";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";

export default function CostCategorySettings() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#6B1B2A");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["cost-categories-all", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_categories")
        .select("*")
        .eq("org_id", orgId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const maxOrder = categories.reduce((m: number, c: any) => Math.max(m, c.sort_order), 0);
      const { error } = await supabase.from("cost_categories").insert({
        org_id: orgId,
        name: newName,
        description: newDesc || null,
        color: newColor,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-categories"] });
      queryClient.invalidateQueries({ queryKey: ["cost-categories-all"] });
      toast.success("Category added");
      setNewName("");
      setNewDesc("");
      setNewColor("#6B1B2A");
      setShowAddForm(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from("cost_categories").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-categories"] });
      queryClient.invalidateQueries({ queryKey: ["cost-categories-all"] });
      toast.success("Category updated");
      setEditingId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleActive = (id: string, active: boolean) => {
    updateMutation.mutate({ id, updates: { is_active: active } });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6 max-w-2xl">
      <SEOHead title="Cost Categories | Solera" description="Manage production cost categories" />

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Cost Categories</h1>
        <Button onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4 mr-2" /> Add Category</Button>
      </div>

      {showAddForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Category name" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-9 w-9 border rounded cursor-pointer" />
                <Input value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-28" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addMutation.mutate()} disabled={!newName.trim() || addMutation.isPending}>
                {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat: any) => (
            <Card key={cat.id} className={!cat.is_active ? "opacity-50" : ""}>
              <CardContent className="p-4">
                {editingId === cat.id ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input
                        value={editValues.name || ""}
                        onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                        disabled={cat.is_system}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Textarea
                        value={editValues.description || ""}
                        onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label>Color</Label>
                      <input type="color" value={editValues.color || "#000"} onChange={(e) => setEditValues({ ...editValues, color: e.target.value })} className="h-8 w-8 border rounded cursor-pointer" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>QuickBooks Account</Label>
                      <Input
                        value={editValues.qb_account_name || ""}
                        onChange={(e) => setEditValues({ ...editValues, qb_account_name: e.target.value })}
                        placeholder="e.g. 5100 - Cost of Goods Sold"
                      />
                      <p className="text-xs text-muted-foreground">Maps to this QuickBooks account when exporting costs</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => {
                        const updates: any = { description: editValues.description || null, color: editValues.color, qb_account_name: editValues.qb_account_name || null };
                        if (!cat.is_system) updates.name = editValues.name;
                        updateMutation.mutate({ id: cat.id, updates });
                      }} disabled={updateMutation.isPending}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="h-4 w-4 rounded-full shrink-0" style={{ background: cat.color || "#999" }} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground text-sm">{cat.name}</span>
                          {cat.is_system && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Lock className="h-2.5 w-2.5" /> System
                            </Badge>
                          )}
                        </div>
                        {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={cat.is_active} onCheckedChange={(checked) => toggleActive(cat.id, checked)} disabled={cat.is_system} />
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditingId(cat.id);
                        setEditValues({ name: cat.name, description: cat.description || "", color: cat.color || "#999", qb_account_name: (cat as any).qb_account_name || "" });
                      }}>Edit</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
