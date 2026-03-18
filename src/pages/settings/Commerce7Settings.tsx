import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, RefreshCcw, Plug } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SyncLogsTable } from "@/components/integrations/SyncLogsTable";

const Commerce7Settings = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const orgId = profile?.org_id;
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({ app_id: "", app_secret: "", tenant_id: "", sync_inventory: false, sync_orders: false, active: false });

  const { data: config, isLoading } = useQuery({
    queryKey: ["commerce7-config", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("commerce7_config").select("*").eq("org_id", orgId!).maybeSingle();
      if (data) setForm({ app_id: data.app_id || "", app_secret: data.app_secret || "", tenant_id: data.tenant_id || "", sync_inventory: data.sync_inventory, sync_orders: data.sync_orders, active: data.active });
      return data;
    },
    enabled: !!orgId,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config) {
        const { error } = await supabase.from("commerce7_config").update({ ...form, updated_at: new Date().toISOString() }).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("commerce7_config").insert({ org_id: orgId!, ...form });
        if (error) throw error;
      }
      toast.success("Commerce7 settings saved");
      qc.invalidateQueries({ queryKey: ["commerce7-config"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleSync = async (type: "inventory" | "orders") => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("sync-commerce7", { body: { org_id: orgId, sync_type: type } });
      if (error) throw error;
      toast.success(`Commerce7 ${type} sync started`);
      qc.invalidateQueries({ queryKey: ["sync-logs", "commerce7"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSyncing(false); }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings/integrations")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-display font-bold text-foreground">Commerce7</h1>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">Connection Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>App ID</Label><Input value={form.app_id} onChange={(e) => setForm({ ...form, app_id: e.target.value })} placeholder="Your Commerce7 App ID" /></div>
            <div><Label>App Secret</Label><Input type="password" value={form.app_secret} onChange={(e) => setForm({ ...form, app_secret: e.target.value })} placeholder="Your App Secret" /></div>
            <div><Label>Tenant ID</Label><Input value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} placeholder="Your Tenant ID" /></div>
          </div>
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2"><Switch checked={form.sync_inventory} onCheckedChange={(c) => setForm({ ...form, sync_inventory: c })} /><Label>Sync Inventory</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.sync_orders} onCheckedChange={(c) => setForm({ ...form, sync_orders: c })} /><Label>Sync Orders</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} /><Label>Active</Label></div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}Save Settings</Button>
            {config?.active && (
              <>
                <Button variant="outline" onClick={() => handleSync("inventory")} disabled={syncing}><RefreshCcw className="h-4 w-4 mr-2" />Sync Inventory Now</Button>
                <Button variant="outline" onClick={() => handleSync("orders")} disabled={syncing}><RefreshCcw className="h-4 w-4 mr-2" />Sync Orders Now</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">Sync History</CardTitle></CardHeader>
        <CardContent><SyncLogsTable integration="commerce7" /></CardContent>
      </Card>
    </div>
  );
};

export default Commerce7Settings;
