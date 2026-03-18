import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wine } from "lucide-react";
import { toast } from "sonner";

const FREQ_LABELS: Record<string, string> = {
  monthly: "Monthly", bimonthly: "Bimonthly", quarterly: "Quarterly",
  twice_yearly: "Twice Yearly", annual: "Annual",
};

const ClubList = () => {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", frequency: "quarterly", price: "", bottles: "2", active: true });

  const { data: clubs = [] } = useQuery({
    queryKey: ["wine-clubs", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wine_clubs").select("*").eq("org_id", orgId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });

  const handleCreate = async () => {
    if (!orgId || !form.name) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("wine_clubs").insert({
        org_id: orgId,
        name: form.name,
        description: form.description || null,
        frequency: form.frequency as any,
        price_per_shipment: parseFloat(form.price) || 0,
        bottles_per_shipment: parseInt(form.bottles) || 2,
        active: form.active,
      });
      if (error) throw error;
      toast.success("Club created");
      qc.invalidateQueries({ queryKey: ["wine-clubs"] });
      setShowNew(false);
      setForm({ name: "", description: "", frequency: "quarterly", price: "", bottles: "2", active: true });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Wine Clubs</h1>
          <p className="text-muted-foreground mt-1">{clubs.length} clubs</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-2" />New Club</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clubs.map((club: any) => (
          <Link to={`/club/${club.id}`} key={club.id}>
            <Card className="border-none shadow-md hover:shadow-lg transition-shadow h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg">{club.name}</CardTitle>
                  <Badge variant={club.active ? "default" : "secondary"}>{club.active ? "Active" : "Inactive"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {club.description && <p className="text-sm text-muted-foreground">{club.description}</p>}
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">{FREQ_LABELS[club.frequency]}</span>
                  <span className="font-medium">${Number(club.price_per_shipment).toFixed(2)}/shipment</span>
                  <span className="text-muted-foreground">{club.bottles_per_shipment} bottles</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {clubs.length === 0 && (
          <Card className="border-none shadow-md col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Wine className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No wine clubs yet. Create one to get started.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">New Wine Club</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Reserve Club" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQ_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Price/Shipment</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Bottles/Shipment</Label><Input type="number" value={form.bottles} onChange={(e) => setForm({ ...form, bottles: e.target.value })} /></div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label>Active</Label>
              </div>
            </div>
            <Button onClick={handleCreate} disabled={saving || !form.name} className="w-full">{saving ? "Creating..." : "Create Club"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClubList;
