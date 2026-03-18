import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SyncLogsTable } from "@/components/integrations/SyncLogsTable";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Link2, Unlink, RefreshCw, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const QuickBooksSettings = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = profile?.org_id;
  const [syncing, setSyncing] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["quickbooks-config", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quickbooks_config")
        .select("*")
        .eq("org_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const upsertConfig = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (config) {
        const { error } = await supabase
          .from("quickbooks_config")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("quickbooks_config")
          .insert({ org_id: orgId!, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-config"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleConnect = async () => {
    // In production, this would redirect to Intuit OAuth
    // For now, we create a placeholder config
    toast({
      title: "QuickBooks OAuth",
      description: "OAuth flow would redirect to Intuit for authorization. Configure QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET secrets first.",
    });
  };

  const handleDisconnect = async () => {
    if (!config) return;
    const { error } = await supabase
      .from("quickbooks_config")
      .update({
        active: false,
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        realm_id: null,
        company_name: null,
        token_expiry: null,
      })
      .eq("id", config.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-config"] });
      toast({ title: "QuickBooks disconnected" });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("sync-quickbooks", {
        body: { org_id: orgId },
      });
      if (error) throw error;
      toast({ title: "Sync complete" });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-config"] });
      queryClient.invalidateQueries({ queryKey: ["sync-logs", "quickbooks"] });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const isConnected = config?.active && config?.realm_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings/integrations")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">QuickBooks Online</h1>
          <p className="text-muted-foreground">Sync invoices, expenses, and inventory value with QuickBooks.</p>
        </div>
      </div>

      {/* Connection Card */}
      <Card className="border-none shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="font-display text-lg">Connection</CardTitle>
                <CardDescription>
                  {isConnected
                    ? `Connected to ${config.company_name || "QuickBooks"}`
                    : "Connect your QuickBooks Online account"}
                </CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : "Not Connected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {config?.last_synced_at
              ? `Last synced ${format(new Date(config.last_synced_at), "MMM d, h:mm a")}`
              : "Never synced"}
          </div>
          <div className="flex gap-2">
            {isConnected ? (
              <>
                <Button variant="outline" onClick={handleSync} disabled={syncing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  Sync Now
                </Button>
                <Button variant="destructive" onClick={handleDisconnect}>
                  <Unlink className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </>
            ) : (
              <Button onClick={handleConnect}>
                <Link2 className="h-4 w-4 mr-2" />
                Connect QuickBooks
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync Configuration */}
      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="font-display text-lg">Sync Configuration</CardTitle>
          <CardDescription>Choose what data to sync between Solera and QuickBooks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Sync Invoices</Label>
              <p className="text-sm text-muted-foreground">
                DTC orders and wine club shipments → QuickBooks invoices
              </p>
            </div>
            <Switch
              checked={config?.sync_invoices ?? false}
              onCheckedChange={(v) => upsertConfig.mutate({ sync_invoices: v })}
              disabled={!isConnected}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Sync Expenses</Label>
              <p className="text-sm text-muted-foreground">
                TTB additions and purchases → QuickBooks expenses
              </p>
            </div>
            <Switch
              checked={config?.sync_expenses ?? false}
              onCheckedChange={(v) => upsertConfig.mutate({ sync_expenses: v })}
              disabled={!isConnected}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Sync Inventory Value</Label>
              <p className="text-sm text-muted-foreground">
                Total inventory value → QuickBooks inventory asset account
              </p>
            </div>
            <Switch
              checked={config?.sync_inventory_value ?? false}
              onCheckedChange={(v) => upsertConfig.mutate({ sync_inventory_value: v })}
              disabled={!isConnected}
            />
          </div>
        </CardContent>
      </Card>

      {/* Token Info */}
      {isConnected && config?.token_expiry && (
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="font-display text-lg">Token Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Access token expires</span>
              <span>{format(new Date(config.token_expiry), "MMM d, h:mm a")}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Tokens refresh automatically before each sync. If the refresh token expires (180 days),
              you'll need to reconnect.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sync Logs */}
      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="font-display text-lg">Sync History</CardTitle>
          <CardDescription>Recent sync events between Solera and QuickBooks.</CardDescription>
        </CardHeader>
        <CardContent>
          <SyncLogsTable integration="quickbooks" />
        </CardContent>
      </Card>
    </div>
  );
};

export default QuickBooksSettings;
