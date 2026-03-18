import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Building2 } from "lucide-react";

export default function ComplianceSettings() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bond_number: "",
    bonded_winery_number: "",
    proprietor_name: "",
    premises_address: "",
    registry_number: "",
  });
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.org_id) return;
    supabase
      .from("ttb_bond_info")
      .select("*")
      .eq("org_id", profile.org_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingId(data.id);
          setForm({
            bond_number: data.bond_number || "",
            bonded_winery_number: data.bonded_winery_number || "",
            proprietor_name: data.proprietor_name || "",
            premises_address: data.premises_address || "",
            registry_number: data.registry_number || "",
          });
        }
        setLoading(false);
      });
  }, [profile?.org_id]);

  const handleSave = async () => {
    if (!profile?.org_id) return;
    setSaving(true);
    const payload = { ...form, org_id: profile.org_id };

    let error;
    if (existingId) {
      ({ error } = await supabase.from("ttb_bond_info").update(payload).eq("id", existingId));
    } else {
      const res = await supabase.from("ttb_bond_info").insert(payload).select().single();
      error = res.error;
      if (res.data) setExistingId(res.data.id);
    }

    if (error) toast.error(error.message);
    else toast.success("Bond information saved");
    setSaving(false);
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">TTB Bond Information</h1>
        <p className="text-muted-foreground">Configure your bonded winery details for TTB reporting.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Winery Bond Details</CardTitle>
          <CardDescription>This information pre-populates all TTB Form 5120.17 reports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bonded Winery Number</Label>
              <Input value={form.bonded_winery_number} onChange={(e) => setForm((f) => ({ ...f, bonded_winery_number: e.target.value }))} placeholder="BW-CA-1234" />
            </div>
            <div className="space-y-2">
              <Label>Bond Number</Label>
              <Input value={form.bond_number} onChange={(e) => setForm((f) => ({ ...f, bond_number: e.target.value }))} placeholder="Bond serial number" />
            </div>
            <div className="space-y-2">
              <Label>Registry Number</Label>
              <Input value={form.registry_number} onChange={(e) => setForm((f) => ({ ...f, registry_number: e.target.value }))} placeholder="Registry/permit number" />
            </div>
            <div className="space-y-2">
              <Label>Proprietor Name</Label>
              <Input value={form.proprietor_name} onChange={(e) => setForm((f) => ({ ...f, proprietor_name: e.target.value }))} placeholder="Legal name of proprietor" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Premises Address</Label>
            <Textarea value={form.premises_address} onChange={(e) => setForm((f) => ({ ...f, premises_address: e.target.value }))} placeholder="Full legal address of bonded premises" rows={3} />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Save Bond Info"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
