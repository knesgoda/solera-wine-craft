import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { TierGate } from "@/components/TierGate";
import { toast } from "@/hooks/use-toast";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SmsSettings = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = profile?.org_id;

  const { data: config } = useQuery({
    queryKey: ["sms-config", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_config")
        .select("*")
        .eq("org_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const [sid, setSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [fromNumber, setFromNumber] = useState("");

  const saveConfig = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (config) {
        const { error } = await supabase.from("sms_config").update(updates).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sms_config").insert({ org_id: orgId!, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-config"] });
      toast({ title: "SMS settings saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    saveConfig.mutate({
      twilio_account_sid: sid || config?.twilio_account_sid,
      twilio_auth_token_encrypted: authToken || config?.twilio_auth_token_encrypted,
      from_number: fromNumber || config?.from_number,
      active: true,
    });
  };

  return (
    <TierGate requiredTier="enterprise" featureName="SMS Alerts (Twilio)">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings/alerts")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">SMS Alerts</h1>
            <p className="text-muted-foreground">Configure Twilio for SMS alert delivery.</p>
          </div>
        </div>

        <Card className="border-none shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-3">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-display text-lg">Twilio Configuration</CardTitle>
                  <CardDescription>Enter your Twilio credentials to enable SMS alerts.</CardDescription>
                </div>
              </div>
              <Badge variant={config?.active ? "default" : "secondary"}>
                {config?.active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Account SID</Label>
              <Input
                value={sid}
                onChange={(e) => setSid(e.target.value)}
                placeholder={config?.twilio_account_sid || "ACxxxxxxxx"}
              />
            </div>
            <div className="space-y-2">
              <Label>Auth Token</Label>
              <Input
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder={config?.twilio_auth_token_encrypted ? "••••••••" : "Enter auth token"}
              />
            </div>
            <div className="space-y-2">
              <Label>From Number</Label>
              <Input
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                placeholder={config?.from_number || "+1234567890"}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Label>Enable SMS Alerts</Label>
              <Switch
                checked={config?.active ?? false}
                onCheckedChange={(v) => saveConfig.mutate({ active: v })}
                disabled={!config}
              />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={saveConfig.isPending}>
              {saveConfig.isPending ? "Saving…" : "Save Configuration"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              Once configured, SMS will be available as a notification channel in your alert rules.
              SMS alerts are sent for harvest window alerts and anomaly detections when the rule channel includes SMS.
            </p>
          </CardContent>
        </Card>
      </div>
    </TierGate>
  );
};

export default SmsSettings;
