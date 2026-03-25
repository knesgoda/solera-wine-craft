import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const StorefrontSettings = () => {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["storefront-config", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("storefront_config")
        .select("*")
        .eq("org_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!orgId,
  });

  const [form, setForm] = useState<any>(null);

  // Initialize form when config loads
  const currentForm = form || config || {
    enabled: false,
    store_name: "",
    store_description: "",
    age_gate_enabled: true,
    custom_domain: "",
    store_logo_url: null,
    stripe_account_id: "",
  };

  const updateForm = (key: string, value: any) => {
    setForm({ ...currentForm, [key]: value });
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const payload = {
        org_id: orgId,
        enabled: currentForm.enabled,
        store_name: currentForm.store_name || null,
        store_description: currentForm.store_description || null,
        age_gate_enabled: currentForm.age_gate_enabled,
        custom_domain: currentForm.custom_domain || null,
        store_logo_url: currentForm.store_logo_url,
        stripe_account_id: currentForm.stripe_account_id || null,
      };

      if (config?.id) {
        const { error } = await supabase.from("storefront_config").update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("storefront_config").insert(payload);
        if (error) throw error;
      }

      toast.success("Storefront settings saved");
      qc.invalidateQueries({ queryKey: ["storefront-config"] });
      setForm(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    setUploading(true);
    try {
      const path = `${orgId}/store-logo.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("store-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("store-assets").getPublicUrl(path);
      updateForm("store_logo_url", publicUrl);
      toast.success("Logo uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Storefront Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your DTC online store</p>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">Store Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Enable Storefront</Label>
              <p className="text-sm text-muted-foreground">Make your store accessible at /store</p>
            </div>
            <Switch checked={currentForm.enabled} onCheckedChange={(v) => updateForm("enabled", v)} />
          </div>

          <div>
            <Label>Store Name</Label>
            <Input value={currentForm.store_name || ""} onChange={(e) => updateForm("store_name", e.target.value)} placeholder="My Winery Store" />
          </div>

          <div>
            <Label>Store Description</Label>
            <Textarea value={currentForm.store_description || ""} onChange={(e) => updateForm("store_description", e.target.value)} rows={2} placeholder="Welcome to our wine shop..." />
          </div>

          <div>
            <Label>Store Logo</Label>
            <div className="flex items-center gap-4 mt-2">
              {currentForm.store_logo_url && (
                <img src={currentForm.store_logo_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
              )}
              <Label className="cursor-pointer">
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span><Upload className="h-4 w-4 mr-2" />{uploading ? "Uploading..." : "Upload Logo"}</span>
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </Label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Age Gate</Label>
              <p className="text-sm text-muted-foreground">Require age verification before browsing</p>
            </div>
            <Switch checked={currentForm.age_gate_enabled} onCheckedChange={(v) => updateForm("age_gate_enabled", v)} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">Payment Processing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Managed by Paddle. Your DTC transactions are processed through your Paddle account.</p>
          <div>
            <Label>Payment Account ID</Label>
            <Input value={currentForm.stripe_account_id || ""} onChange={(e) => updateForm("stripe_account_id", e.target.value)} placeholder="acct_..." />
            <p className="text-xs text-muted-foreground mt-1">Managed by Paddle. Your DTC transactions are processed through your Paddle account.</p>
          </div>
          <Button variant="outline" onClick={() => window.open("https://vendors.paddle.com", "_blank")}>
            <ExternalLink className="h-4 w-4 mr-2" />Open Paddle Dashboard
          </Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">Custom Domain</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div>
            <Label>Domain</Label>
            <Input value={currentForm.custom_domain || ""} onChange={(e) => updateForm("custom_domain", e.target.value)} placeholder="shop.mywinery.com" />
            <p className="text-xs text-muted-foreground mt-1">DNS setup is manual — point your domain's CNAME to your Lovable preview URL.</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg">{saving ? "Saving..." : "Save Settings"}</Button>
    </div>
  );
};

export default StorefrontSettings;
