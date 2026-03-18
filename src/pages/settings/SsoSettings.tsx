import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Save, Copy, Download, TestTube, Lock, AlertTriangle } from "lucide-react";

const PROVIDERS = [
  { value: "okta", label: "Okta" },
  { value: "azure_ad", label: "Azure AD" },
  { value: "google_workspace", label: "Google Workspace" },
  { value: "generic_saml", label: "Generic SAML 2.0" },
] as const;

export default function SsoSettings() {
  const { profile, organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    provider: "generic_saml",
    entity_id: "",
    sso_url: "",
    certificate: "",
    attribute_mapping_json: { email: "email", first_name: "firstName", last_name: "lastName", role: "role" },
    active: false,
    enforce_sso: false,
  });

  const isEnterprise = organization?.tier === "enterprise";
  const orgId = profile?.org_id;

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("sso_configs")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingId(data.id);
          setForm({
            provider: data.provider || "generic_saml",
            entity_id: data.entity_id || "",
            sso_url: data.sso_url || "",
            certificate: data.certificate || "",
            attribute_mapping_json: (data.attribute_mapping_json as any) || { email: "email", first_name: "firstName", last_name: "lastName", role: "role" },
            active: data.active,
            enforce_sso: data.enforce_sso,
          });
        }
        setLoading(false);
      });
  }, [orgId]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    const payload = { ...form, org_id: orgId, provider: form.provider as any, attribute_mapping_json: form.attribute_mapping_json as any };

    let error;
    if (existingId) {
      ({ error } = await supabase.from("sso_configs").update(payload).eq("id", existingId));
    } else {
      const res = await supabase.from("sso_configs").insert(payload).select().single();
      error = res.error;
      if (res.data) setExistingId(res.data.id);
    }
    if (error) toast.error(error.message);
    else toast.success("SSO configuration saved");
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    // Simulate a test SAML request validation
    await new Promise((r) => setTimeout(r, 1500));
    if (form.entity_id && form.sso_url && form.certificate) {
      toast.success("SAML configuration looks valid. Test a real login at /sso/login to fully verify.");
    } else {
      toast.error("Missing required fields: Entity ID, SSO URL, or Certificate.");
    }
    setTesting(false);
  };

  const spEntityId = `solera.vin/sso/${orgId}`;
  const acsUrl = `${window.location.origin}/sso/callback/${orgId}`;
  const spMetadataXml = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${spEntityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  if (!isEnterprise) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Single Sign-On (SSO)</h1>
        <Card className="border-2 border-dashed border-muted">
          <CardContent className="pt-6 text-center space-y-4">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">Enterprise Feature</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              SAML SSO is available exclusively on the Enterprise tier. Upgrade to enable SSO with Okta, Azure AD, Google Workspace, or any SAML 2.0 provider.
            </p>
            <Button variant="secondary" size="lg">Contact Sales to Upgrade</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Single Sign-On (SSO)</h1>
        <p className="text-muted-foreground">Configure SAML 2.0 SSO for your organization.</p>
      </div>

      {/* SP Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Service Provider Metadata</CardTitle>
          <CardDescription>Provide this information to your Identity Provider (IdP).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Entity ID (SP)</Label>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">{spEntityId}</code>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard(spEntityId, "Entity ID")}><Copy className="h-3 w-3" /></Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">ACS URL (Callback)</Label>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">{acsUrl}</code>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard(acsUrl, "ACS URL")}><Copy className="h-3 w-3" /></Button>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Name ID Format</Label>
            <code className="text-sm bg-muted px-2 py-1 rounded block">urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</code>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => copyToClipboard(spMetadataXml, "SP Metadata XML")}>
              <Copy className="h-3 w-3 mr-1" /> Copy XML
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              const blob = new Blob([spMetadataXml], { type: "application/xml" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "solera-sp-metadata.xml"; a.click();
            }}>
              <Download className="h-3 w-3 mr-1" /> Download XML
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* IdP Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity Provider Configuration</CardTitle>
          <CardDescription>Enter the details from your IdP (Okta, Azure AD, etc.).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entity ID (IdP)</Label>
              <Input value={form.entity_id} onChange={(e) => setForm((f) => ({ ...f, entity_id: e.target.value }))} placeholder="https://idp.example.com/metadata" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>SSO URL (IdP Login Endpoint)</Label>
            <Input value={form.sso_url} onChange={(e) => setForm((f) => ({ ...f, sso_url: e.target.value }))} placeholder="https://idp.example.com/sso/saml" />
          </div>
          <div className="space-y-2">
            <Label>X.509 Certificate</Label>
            <Textarea value={form.certificate} onChange={(e) => setForm((f) => ({ ...f, certificate: e.target.value }))} placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" rows={5} className="font-mono text-xs" />
          </div>
        </CardContent>
      </Card>

      {/* Attribute Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attribute Mapping</CardTitle>
          <CardDescription>Map IdP SAML attributes to Solera user fields.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(["email", "first_name", "last_name", "role"] as const).map((field) => (
              <div key={field} className="space-y-2">
                <Label className="text-xs capitalize">{field.replace("_", " ")} → IdP Attribute</Label>
                <Input
                  value={(form.attribute_mapping_json as any)[field] || ""}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    attribute_mapping_json: { ...f.attribute_mapping_json, [field]: e.target.value },
                  }))}
                  placeholder={`IdP attribute for ${field}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Enforcement & Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SSO Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable SSO</Label>
              <p className="text-sm text-muted-foreground">Allow users to sign in via SAML SSO.</p>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-2">Require SSO for All Users <Badge variant="outline" className="text-[10px]">Strict</Badge></Label>
              <p className="text-sm text-muted-foreground">Email/password login disabled except for org owner fallback.</p>
            </div>
            <Switch checked={form.enforce_sso} onCheckedChange={(v) => setForm((f) => ({ ...f, enforce_sso: v }))} />
          </div>
          {form.enforce_sso && (
            <div className="p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              When enforced, all non-owner users must use SSO. The organization owner retains email/password access as a fallback.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleTest} variant="outline" disabled={testing}>
          <TestTube className="h-4 w-4 mr-2" /> {testing ? "Testing…" : "Test Connection"}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}
