import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, Plug, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SyncLogsTable } from "@/components/integrations/SyncLogsTable";

const ShipCompliantSettings = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const orgId = profile?.org_id;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", active: false });

  const { data: config, isLoading } = useQuery({
    queryKey: ["shipcompliant-config", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("shipcompliant_config").select("*").eq("org_id", orgId!).maybeSingle();
      if (data) setForm({ username: data.username || "", password: "", active: data.active });
      return data;
    },
    enabled: !!orgId,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      // Hash password client-side before storing (in production use server-side hashing)
      const encoder = new TextEncoder();
      const data = encoder.encode(form.password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = form.password ? hashArray.map(b => b.toString(16).padStart(2, "0")).join("") : undefined;

      const payload: any = { username: form.username, active: form.active };
      if (passwordHash) payload.password_hash = passwordHash;

      if (config) {
        const { error } = await supabase.from("shipcompliant_config").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", config.id);
        if (error) throw error;
      } else {
        if (!passwordHash) { toast.error("Password is required"); setSaving(false); return; }
        const { error } = await supabase.from("shipcompliant_config").insert({ org_id: orgId!, ...payload, password_hash: passwordHash });
        if (error) throw error;
      }
      toast.success("ShipCompliant settings saved");
      qc.invalidateQueries({ queryKey: ["shipcompliant-config"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings/integrations")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-display font-bold text-foreground">ShipCompliant</h1>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="font-display">Credentials</CardTitle>
          <CardDescription>Your ShipCompliant password is hashed before storage — never stored in plain text.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="ShipCompliant username" /></div>
            <div><Label>Password {config ? "(leave blank to keep current)" : ""}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="ShipCompliant password" /></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} /><Label>Active</Label></div>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}Save Settings</Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2"><ShieldCheck className="h-5 w-5" />How It Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>When active, Solera checks ShipCompliant before every DTC order ships:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Validates destination state compliance</li>
            <li>Checks product eligibility and customer age verification</li>
            <li>If compliance fails, the order is held and the org owner is notified</li>
            <li>If compliance passes, the shipment proceeds normally</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">Compliance Check Log</CardTitle></CardHeader>
        <CardContent><SyncLogsTable integration="shipcompliant" /></CardContent>
      </Card>
    </div>
  );
};

export default ShipCompliantSettings;
