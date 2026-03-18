import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Building, Lock, MapPin } from "lucide-react";

const FACILITY_TYPES = [
  { value: "winery", label: "Winery" },
  { value: "vineyard", label: "Vineyard" },
  { value: "custom_crush", label: "Custom Crush" },
  { value: "storage", label: "Storage" },
  { value: "tasting_room", label: "Tasting Room" },
] as const;

export default function FacilitySettings() {
  const { profile, organization } = useAuth();
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", region: "", facility_type: "winery" });

  const isEnterprise = organization?.tier === "enterprise";

  const fetchFacilities = async () => {
    if (!profile?.org_id) return;
    const { data } = await supabase
      .from("facilities")
      .select("*")
      .eq("parent_org_id", profile.org_id)
      .order("name");
    setFacilities(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchFacilities(); }, [profile?.org_id]);

  const handleCreate = async () => {
    if (!profile?.org_id || !form.name) return;
    setSaving(true);
    const { error } = await supabase.from("facilities").insert({
      parent_org_id: profile.org_id,
      name: form.name,
      address: form.address || null,
      region: form.region || null,
      facility_type: form.facility_type as any,
    });
    if (error) toast.error(error.message);
    else { toast.success("Facility created"); setDialogOpen(false); setForm({ name: "", address: "", region: "", facility_type: "winery" }); fetchFacilities(); }
    setSaving(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("facilities").update({ active }).eq("id", id);
    fetchFacilities();
  };

  if (!isEnterprise) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Multi-Facility Management</h1>
        <Card className="border-2 border-dashed border-muted">
          <CardContent className="pt-6 text-center space-y-4">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">Enterprise Feature</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Multi-facility support is available on the Enterprise tier. Manage multiple wineries, vineyards, and tasting rooms under one organization.
            </p>
            <Button variant="secondary" size="lg">Contact Sales to Upgrade</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Facilities</h1>
          <p className="text-muted-foreground">Manage your organization's locations and assign users.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Facility</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Facility</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Main Winery" />
              </div>
              <div className="space-y-2">
                <Label>Facility Type</Label>
                <Select value={form.facility_type} onValueChange={(v) => setForm((f) => ({ ...f, facility_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FACILITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Full address" rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Region / AVA</Label>
                <Input value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="Napa Valley" />
              </div>
              <Button onClick={handleCreate} disabled={saving || !form.name} className="w-full">
                {saving ? "Creating…" : "Create Facility"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {facilities.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-8">
            No facilities yet. Add your first facility to enable multi-location management.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {facilities.map((f) => (
            <Card key={f.id} className={!f.active ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{f.name}</CardTitle>
                  </div>
                  <Switch checked={f.active} onCheckedChange={(v) => toggleActive(f.id, v)} />
                </div>
                <CardDescription>
                  <Badge variant="outline" className="text-xs capitalize">{f.facility_type?.replace("_", " ")}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {f.address && (
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{f.address}</span>
                  </div>
                )}
                {f.region && <p>Region: {f.region}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Facility User Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">User Facility Access</CardTitle>
          <CardDescription>Assign users to specific facilities. Org owners see all facilities.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">User assignment is managed per-facility. Navigate to each facility to manage its team members.</p>
        </CardContent>
      </Card>
    </div>
  );
}
