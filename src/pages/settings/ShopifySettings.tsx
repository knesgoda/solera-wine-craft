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

const ShopifySettings = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const orgId = profile?.org_id;
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({ shop_domain: "", access_token: "", sync_inventory: false, active: false });

  const { data: config, isLoading } = useQuery({
    queryKey: ["shopify-config", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("shopify_config").select("*").eq("org_id", orgId!).maybeSingle();
      if (data) setForm({ shop_domain: data.shop_domain || "", access_token: data.access_token || "", sync_inventory: data.sync_inventory, active: data.active });
      return data;
    },
    enabled: !!orgId,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config) {
        const { error } = await supabase.from("shopify_config").update({ ...form, updated_at: new Date().toISOString() }).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shopify_config").insert({ org_id: orgId!, ...form });
        if (error) throw error;
      }
      toast.success("Shopify settings saved");
      qc.invalidateQueries({ queryKey: ["shopify-config"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("sync-shopify", { body: { org_id: orgId } });
      if (error) throw error;
      toast.success("Shopify product sync started");
      qc.invalidateQueries({ queryKey: ["sync-logs", "shopify"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSyncing(false); }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings/integrations")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-display font-bold text-foreground">Shopify</h1>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">Connection Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Shop Domain</Label><Input value={form.shop_domain} onChange={(e) => setForm({ ...form, shop_domain: e.target.value })} placeholder="your-store.myshopify.com" /></div>
            <div><Label>Access Token</Label><Input type="password" value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} placeholder="Shopify Admin API Access Token" /></div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2"><Switch checked={form.sync_inventory} onCheckedChange={(c) => setForm({ ...form, sync_inventory: c })} /><Label>Sync Inventory</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} /><Label>Active</Label></div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}Save Settings</Button>
            {config?.active && <Button variant="outline" onClick={handleSync} disabled={syncing}><RefreshCcw className="h-4 w-4 mr-2" />Sync Products Now</Button>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">Sync History</CardTitle></CardHeader>
        <CardContent><SyncLogsTable integration="shopify" /></CardContent>
      </Card>
    </div>
  );
};

export default ShopifySettings;
