import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Key, Webhook, Copy, Plus, Trash2, Send, AlertTriangle, Lock } from "lucide-react";
import { format } from "date-fns";

const ALL_SCOPES = [
  "read:vintages", "write:vintages",
  "read:lab_samples", "write:lab_samples",
  "read:inventory", "write:inventory",
  "read:orders", "read:tasks", "write:tasks",
  "read:analytics",
] as const;

const ALL_EVENT_TYPES = [
  "vintage.created", "vintage.updated",
  "lab_sample.created", "harvest_window.entered",
  "task.completed", "order.created", "order.shipped",
  "anomaly.detected", "weekly_summary.generated",
] as const;

function generateSecureKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function ApiSettings() {
  const { organization } = useAuth();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [showKeyRevealDialog, setShowKeyRevealDialog] = useState(false);
  const [revealedKey, setRevealedKey] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [showNewWebhookDialog, setShowNewWebhookDialog] = useState(false);
  const [showWebhookSecretDialog, setShowWebhookSecretDialog] = useState(false);
  const [revealedWebhookSecret, setRevealedWebhookSecret] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvent, setNewWebhookEvent] = useState("");
  const [loading, setLoading] = useState(false);

  const isEnterprise = organization?.tier === "enterprise";

  useEffect(() => {
    if (organization?.id && isEnterprise) {
      loadData();
    }
  }, [organization?.id, isEnterprise]);

  const loadData = async () => {
    const [keysRes, webhooksRes] = await Promise.all([
      supabase.from("api_keys").select("*").eq("org_id", organization!.id).order("created_at", { ascending: false }),
      supabase.from("webhook_subscriptions").select("*").eq("org_id", organization!.id).order("created_at", { ascending: false }),
    ]);
    if (keysRes.data) setApiKeys(keysRes.data);
    if (webhooksRes.data) setWebhooks(webhooksRes.data);
  };

  const createApiKey = async () => {
    if (!newKeyLabel || newKeyScopes.length === 0) {
      toast({ title: "Missing fields", description: "Provide a label and at least one scope.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const rawKey = generateSecureKey();
    const hash = await hashKey(rawKey);
    const prefix = rawKey.substring(0, 8);

    const { error } = await supabase.from("api_keys").insert({
      org_id: organization!.id,
      key_hash: hash,
      key_prefix: prefix,
      label: newKeyLabel,
      scopes: newKeyScopes as any,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRevealedKey(rawKey);
      setShowNewKeyDialog(false);
      setShowKeyRevealDialog(true);
      setNewKeyLabel("");
      setNewKeyScopes([]);
      loadData();
    }
    setLoading(false);
  };

  const revokeKey = async (id: string) => {
    await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    loadData();
    toast({ title: "API key revoked" });
  };

  const createWebhook = async () => {
    if (!newWebhookUrl.startsWith("https://") || !newWebhookEvent) {
      toast({ title: "Invalid input", description: "URL must be https:// and event type is required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const rawSecret = generateSecureKey();
    const hash = await hashKey(rawSecret);

    const { error } = await supabase.from("webhook_subscriptions").insert({
      org_id: organization!.id,
      event_type: newWebhookEvent as any,
      endpoint_url: newWebhookUrl,
      secret_hash: hash,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRevealedWebhookSecret(rawSecret);
      setShowNewWebhookDialog(false);
      setShowWebhookSecretDialog(true);
      setNewWebhookUrl("");
      setNewWebhookEvent("");
      loadData();
    }
    setLoading(false);
  };

  const toggleWebhook = async (id: string, active: boolean) => {
    await supabase.from("webhook_subscriptions").update({ active }).eq("id", id);
    loadData();
  };

  const testWebhook = async (webhook: any) => {
    toast({ title: "Sending test...", description: `POST to ${webhook.endpoint_url}` });
    try {
      const res = await fetch(webhook.endpoint_url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Solera-Event": "test", "X-Solera-Timestamp": new Date().toISOString() },
        body: JSON.stringify({ event: "test", data: { message: "Test webhook from Solera" }, timestamp: new Date().toISOString() }),
        mode: "no-cors",
      });
      toast({ title: "Test sent", description: "Check your endpoint for the test payload." });
    } catch {
      toast({ title: "Test sent", description: "Request dispatched (CORS may prevent reading response)." });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  if (!isEnterprise) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <Lock className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-2xl font-display font-bold text-foreground">Enterprise Feature</h2>
            <p className="text-muted-foreground max-w-md">API Keys & Webhooks are available on the Enterprise plan. Upgrade to enable programmatic access and real-time event notifications.</p>
            <Button>Contact Sales to Upgrade</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">API Keys & Webhooks</h1>
        <p className="text-muted-foreground">Manage programmatic access and event notifications.</p>
      </div>

      <Tabs defaultValue="api-keys">
        <TabsList>
          <TabsTrigger value="api-keys"><Key className="h-4 w-4 mr-1.5" />API Keys</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-1.5" />Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Authenticate API requests with Bearer tokens.</CardDescription>
              </div>
              <Button onClick={() => setShowNewKeyDialog(true)}><Plus className="h-4 w-4 mr-1.5" />New API Key</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Key Prefix</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Rate Limit</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No API keys yet.</TableCell></TableRow>
                  )}
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.label}</TableCell>
                      <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{key.key_prefix}...</code></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(key.scopes || []).slice(0, 3).map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                          {(key.scopes || []).length > 3 && <Badge variant="outline" className="text-xs">+{key.scopes.length - 3}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{key.rate_limit_per_hour}/hr</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{key.last_used_at ? format(new Date(key.last_used_at), "MMM d, yyyy") : "Never"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(key.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        {key.revoked_at
                          ? <Badge variant="destructive">Revoked</Badge>
                          : <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Active</Badge>
                        }
                      </TableCell>
                      <TableCell>
                        {!key.revoked_at && (
                          <Button variant="ghost" size="sm" onClick={() => revokeKey(key.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 p-3 rounded-md bg-muted/50 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">Default rate limit is <strong>1,000 requests/hour</strong> per key. Contact support for higher limits.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Webhook Subscriptions</CardTitle>
                <CardDescription>Receive real-time event notifications via HTTP POST.</CardDescription>
              </div>
              <Button onClick={() => setShowNewWebhookDialog(true)}><Plus className="h-4 w-4 mr-1.5" />New Webhook</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint URL</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Last Triggered</TableHead>
                    <TableHead>Failures</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No webhooks configured.</TableCell></TableRow>
                  )}
                  {webhooks.map((wh) => (
                    <TableRow key={wh.id}>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">{wh.endpoint_url}</TableCell>
                      <TableCell><Badge variant="outline">{wh.event_type}</Badge></TableCell>
                      <TableCell>
                        <Switch checked={wh.active} onCheckedChange={(v) => toggleWebhook(wh.id, v)} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{wh.last_triggered_at ? format(new Date(wh.last_triggered_at), "MMM d HH:mm") : "Never"}</TableCell>
                      <TableCell>
                        {wh.failure_count > 0
                          ? <Badge variant="destructive">{wh.failure_count}</Badge>
                          : <span className="text-muted-foreground">0</span>
                        }
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => testWebhook(wh)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New API Key Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>Select a label and the scopes this key can access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label</Label>
              <Input value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} placeholder="e.g. Production Integration" />
            </div>
            <div>
              <Label>Scopes</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ALL_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newKeyScopes.includes(scope)}
                      onCheckedChange={(checked) => {
                        setNewKeyScopes(prev => checked ? [...prev, scope] : prev.filter(s => s !== scope));
                      }}
                    />
                    {scope}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewKeyDialog(false)}>Cancel</Button>
            <Button onClick={createApiKey} disabled={loading}>Create Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Key Reveal Dialog */}
      <Dialog open={showKeyRevealDialog} onOpenChange={setShowKeyRevealDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your API Key</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-amber-600">
              <AlertTriangle className="h-4 w-4" /> This key will never be shown again. Copy it now.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-3 rounded-md font-mono text-sm break-all">{revealedKey}</div>
          <DialogFooter>
            <Button onClick={() => copyToClipboard(revealedKey)}><Copy className="h-4 w-4 mr-1.5" />Copy Key</Button>
            <Button variant="outline" onClick={() => setShowKeyRevealDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Webhook Dialog */}
      <Dialog open={showNewWebhookDialog} onOpenChange={setShowNewWebhookDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>Subscribe to an event type and receive HTTP POST notifications.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Endpoint URL</Label>
              <Input value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} placeholder="https://your-server.com/webhook" />
            </div>
            <div>
              <Label>Event Type</Label>
              <Select value={newWebhookEvent} onValueChange={setNewWebhookEvent}>
                <SelectTrigger><SelectValue placeholder="Select event type" /></SelectTrigger>
                <SelectContent>
                  {ALL_EVENT_TYPES.map((et) => (
                    <SelectItem key={et} value={et}>{et}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewWebhookDialog(false)}>Cancel</Button>
            <Button onClick={createWebhook} disabled={loading}>Create Webhook</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook Secret Reveal Dialog */}
      <Dialog open={showWebhookSecretDialog} onOpenChange={setShowWebhookSecretDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Secret</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-amber-600">
              <AlertTriangle className="h-4 w-4" /> This secret will never be shown again. Copy it now.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Use this secret to verify webhook signatures via the <code>X-Solera-Signature</code> header (HMAC-SHA256).</p>
          <div className="bg-muted p-3 rounded-md font-mono text-sm break-all">{revealedWebhookSecret}</div>
          <DialogFooter>
            <Button onClick={() => copyToClipboard(revealedWebhookSecret)}><Copy className="h-4 w-4 mr-1.5" />Copy Secret</Button>
            <Button variant="outline" onClick={() => setShowWebhookSecretDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
