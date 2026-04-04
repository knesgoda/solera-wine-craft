import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Bell, ShieldAlert, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useTierGate } from "@/hooks/useTierGate";

const PARAMETERS = [
  { value: "brix", label: "Brix" },
  { value: "ph", label: "pH" },
  { value: "ta", label: "TA" },
  { value: "va", label: "VA" },
  { value: "so2_free", label: "Free SO₂" },
  { value: "so2_total", label: "Total SO₂" },
  { value: "temp_f", label: "Temperature (°F)" },
  { value: "gdd_cumulative", label: "GDD Cumulative" },
  { value: "ripening_divergence", label: "Ripening Divergence" },
];

const OPERATORS = [
  { value: "gte", label: "≥ (greater or equal)" },
  { value: "lte", label: "≤ (less or equal)" },
  { value: "eq", label: "= (equal)" },
];

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "push", label: "Push" },
  { value: "both", label: "Email + Push" },
];

const OP_SYMBOLS: Record<string, string> = { gte: "≥", lte: "≤", eq: "=" };

const AlertSettings = () => {
  const { profile, organization } = useAuth();
  const orgId = organization?.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [form, setForm] = useState({
    parameter: "",
    operator: "",
    threshold: "",
    channel: "both",
    variety_filter: "",
    brix_spread_threshold: "4.0",
  });

  const isDivergence = form.parameter === "ripening_divergence";
  const { allowed: divergenceAllowed, requiredTierDisplay } = useTierGate("small_boutique");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["alert-rules", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_rules")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  // Get varieties for the divergence rule dropdown
  const { data: varieties = [] } = useQuery({
    queryKey: ["block-varieties", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocks")
        .select("variety, vineyards!inner(org_id)")
        .eq("vineyards.org_id", orgId!)
        .not("variety", "is", null);
      if (error) throw error;
      const unique = [...new Set((data || []).map((b: any) => b.variety).filter(Boolean))] as string[];
      return unique.sort();
    },
    enabled: !!orgId,
  });

  const createRule = useMutation({
    mutationFn: async () => {
      if (isDivergence) {
        const { error } = await supabase.from("alert_rules").insert({
          org_id: orgId!,
          parameter: "ripening_divergence" as any,
          operator: "gte" as any,
          threshold: parseFloat(form.brix_spread_threshold) || 4.0,
          channel: form.channel as any,
          variety_filter: form.variety_filter || null,
          brix_spread_threshold: parseFloat(form.brix_spread_threshold) || 4.0,
        } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("alert_rules").insert({
          org_id: orgId!,
          parameter: form.parameter as any,
          operator: form.operator as any,
          threshold: parseFloat(form.threshold),
          channel: form.channel as any,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules", orgId] });
      setOpen(false);
      setForm({ parameter: "", operator: "", threshold: "", channel: "both", variety_filter: "", brix_spread_threshold: "4.0" });
      toast.success("Alert rule created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("alert_rules").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules", orgId] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alert_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules", orgId] });
      toast.success("Rule deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const paramLabel = (val: string) => PARAMETERS.find((p) => p.value === val)?.label || val;
  const channelLabel = (val: string) => CHANNELS.find((c) => c.value === val)?.label || val;

  const formatRuleDescription = (rule: any) => {
    if (rule.parameter === "ripening_divergence") {
      const variety = (rule as any).variety_filter || "All varieties";
      const spread = (rule as any).brix_spread_threshold ?? 4.0;
      return `Ripening Divergence: ${variety} — ${spread}° Brix spread`;
    }
    return `${paramLabel(rule.parameter)} ${OP_SYMBOLS[rule.operator]} ${rule.threshold}`;
  };

  const canSubmit = isDivergence
    ? !!form.brix_spread_threshold
    : !!form.parameter && !!form.operator && !!form.threshold;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Alert Rules</h1>
          <p className="text-muted-foreground mt-1">Configure automated alerts for lab and cellar data</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">New Alert Rule</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createRule.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Parameter</Label>
                <Select value={form.parameter} onValueChange={(v) => setForm({ ...form, parameter: v })}>
                  <SelectTrigger><SelectValue placeholder="Select parameter" /></SelectTrigger>
                  <SelectContent>
                    {PARAMETERS.map((p) => (
                      <SelectItem
                        key={p.value}
                        value={p.value}
                        disabled={p.value === "ripening_divergence" && !divergenceAllowed}
                      >
                        {p.value === "ripening_divergence" && <TrendingUp className="h-3.5 w-3.5 mr-1.5 inline" />}
                        {p.label}
                        {p.value === "ripening_divergence" && !divergenceAllowed && (
                          <span className="text-xs text-muted-foreground ml-1">({requiredTierDisplay}+)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isDivergence ? (
                <>
                  <div className="space-y-2">
                    <Label>Variety to Monitor</Label>
                    <Select value={form.variety_filter} onValueChange={(v) => setForm({ ...form, variety_filter: v })}>
                      <SelectTrigger><SelectValue placeholder="All varieties" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All varieties</SelectItem>
                        {varieties.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Leave blank to monitor all varieties</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Brix Spread Threshold</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.brix_spread_threshold}
                      onChange={(e) => setForm({ ...form, brix_spread_threshold: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Alert fires when the spread between fastest and slowest blocks exceeds this value</p>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Operator</Label>
                    <Select value={form.operator} onValueChange={(v) => setForm({ ...form, operator: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Threshold</Label>
                    <Input type="number" step="0.01" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} required />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notification Channel</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createRule.isPending || !canSubmit}>
                {createRule.isPending ? "Creating..." : "Create Rule"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="animate-pulse text-muted-foreground">Loading rules...</div>
      ) : rules.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-display text-lg font-semibold mb-1">No alert rules</h3>
            <p className="text-muted-foreground text-sm mb-4">Set up rules to get notified about critical thresholds</p>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Rule</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => (
            <Card key={rule.id} className="border-none shadow-sm">
              <CardContent className="py-4 px-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Switch
                      checked={rule.active}
                      onCheckedChange={(active) => toggleRule.mutate({ id: rule.id, active })}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {rule.parameter === "ripening_divergence" && (
                          <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <span className="font-medium text-foreground">
                          {formatRuleDescription(rule)}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {channelLabel(rule.channel)}
                        </Badge>
                        {!rule.active && (
                          <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {rule.last_triggered_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last triggered {formatDistanceToNow(new Date(rule.last_triggered_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingRuleId(rule.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    <AlertDialog open={!!deletingRuleId} onOpenChange={(open) => { if (!open) setDeletingRuleId(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete alert rule?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => { deleteRule.mutate(deletingRuleId!); setDeletingRuleId(null); }}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  );
};

export default AlertSettings;