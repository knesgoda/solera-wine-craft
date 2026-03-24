import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Lock, Star, Calculator, DollarSign } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { propagateBlendCosts } from "@/lib/blendCostPropagation";
import { BlendCostImpact } from "@/components/cellar/BlendCostImpact";
import { BlendCostTransferTab } from "@/components/cellar/BlendCostTransferTab";
import { useTierGate } from "@/hooks/useTierGate";

const COLORS = [
  "hsl(348, 58%, 26%)", "hsl(36, 64%, 47%)", "hsl(200, 60%, 45%)",
  "hsl(160, 50%, 40%)", "hsl(280, 50%, 50%)", "hsl(20, 70%, 50%)",
];

export default function TrialDetail() {
  const { trialId } = useParams<{ trialId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization, profile } = useAuth();
  const [targetVolume, setTargetVolume] = useState("");
  const growthTier = useTierGate("mid_size");

  const { data: trial, isLoading } = useQuery({
    queryKey: ["trial", trialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blending_trials")
        .select("*, vintages(year)")
        .eq("id", trialId!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!trialId,
  });

  const { data: lots = [] } = useQuery({
    queryKey: ["trial-lots", trialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blending_trial_lots")
        .select("*, vintages(year), barrels(barrel_id)")
        .eq("trial_id", trialId!)
        .order("percentage", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!trialId,
  });

  const finalize = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("blending_trials")
        .update({ finalized: true } as any)
        .eq("id", trialId!);
      if (error) throw error;

      // Propagate costs if Growth+ tier
      if (growthTier.allowed && profile?.org_id && profile?.id) {
        try {
          const result = await propagateBlendCosts(trialId!, profile.org_id, profile.id);
          return result;
        } catch (err: any) {
          console.error("Cost propagation failed:", err);
          // Don't fail the finalization just because cost propagation failed
          return null;
        }
      }
      return null;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["trial", trialId] });
      queryClient.invalidateQueries({ queryKey: ["blending-trials"] });
      queryClient.invalidateQueries({ queryKey: ["blend-cost-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["blend-cost-preview"] });
      queryClient.invalidateQueries({ queryKey: ["cost-entries"] });
      queryClient.invalidateQueries({ queryKey: ["lot-cost-summary"] });
      toast.success("Trial finalized — blend recipe locked");
      if (result && !result.alreadyPropagated && result.entryCount > 0) {
        toast.success(`Production costs transferred: $${result.totalTransferred.toFixed(2)} from ${result.sourceLotCount} source lot${result.sourceLotCount !== 1 ? "s" : ""}`);
      } else if (result && result.entryCount === 0 && !result.alreadyPropagated) {
        toast.info("No costs to transfer — source lots have no recorded production costs.");
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!trial) {
    return <div className="p-6 text-center"><p className="text-muted-foreground">Trial not found.</p></div>;
  }

  const chartData = lots.map((l: any, i: number) => ({
    name: l.vintages?.year ? `${l.vintages.year}${l.barrels?.barrel_id ? ` · ${l.barrels.barrel_id}` : ""}` : (l.barrels?.barrel_id || `Lot ${i + 1}`),
    value: l.percentage,
    color: COLORS[i % COLORS.length],
  }));

  const scaleTarget = targetVolume ? parseFloat(targetVolume) : null;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-24 md:pb-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/cellar/blending")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-xl">{trial.name}</CardTitle>
              {trial.finalized && (
                <Badge className="bg-primary/10 text-primary mt-1" variant="secondary">
                  <Lock className="h-3 w-3 mr-1" /> Finalized
                </Badge>
              )}
            </div>
            {trial.stars && (
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < trial.stars ? "text-secondary fill-secondary" : "text-muted"}`} />
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {trial.vintages && <div className="text-sm"><span className="text-muted-foreground">Vintage:</span> <span className="font-medium">{trial.vintages.year}</span></div>}
          {trial.total_volume_liters && <div className="text-sm"><span className="text-muted-foreground">Total Volume:</span> <span className="font-medium">{trial.total_volume_liters}L</span></div>}
          <div className="text-sm"><span className="text-muted-foreground">Created:</span> {format(parseISO(trial.created_at), "MMM d, yyyy")}</div>
          {trial.notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {trial.notes}</div>}
        </CardContent>
      </Card>

      <Tabs defaultValue="composition" className="space-y-4">
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="composition" className="flex-1">Composition</TabsTrigger>
          <TabsTrigger value="calculator" className="flex-1">Scale-Up</TabsTrigger>
          {growthTier.allowed && (
            <TabsTrigger value="costs" className="flex-1 gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Costs
            </TabsTrigger>
          )}
        </TabsList>

        {/* Composition Tab */}
        <TabsContent value="composition">
          {lots.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Blend Composition</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name} (${value}%)`}>
                        {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-1">
                  {lots.map((l: any, i: number) => (
                    <div key={l.id} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span>{l.vintages?.year || "—"} {l.barrels?.barrel_id ? `· ${l.barrels.barrel_id}` : ""}</span>
                      </div>
                      <div className="flex gap-4 text-muted-foreground">
                        <span>{l.percentage}%</span>
                        {l.volume_liters && <span>{l.volume_liters}L</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Scale-Up Calculator Tab */}
        <TabsContent value="calculator">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5" /> Scale-Up Calculator
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <Label>Target Total Volume (L)</Label>
                <Input type="number" value={targetVolume} onChange={(e) => setTargetVolume(e.target.value)} placeholder="Enter target volume" />
              </div>
              {scaleTarget && lots.length > 0 && (
                <div className="space-y-1">
                  {lots.map((l: any, i: number) => {
                    const scaled = (l.percentage / 100) * scaleTarget;
                    return (
                      <div key={l.id} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                        <span>{l.vintages?.year || "—"} {l.barrels?.barrel_id ? `· ${l.barrels.barrel_id}` : ""} ({l.percentage}%)</span>
                        <span className="font-medium">{scaled.toFixed(1)}L</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-sm font-semibold pt-2">
                    <span>Total</span>
                    <span>{scaleTarget.toFixed(1)}L</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Transfer Tab */}
        {growthTier.allowed && (
          <TabsContent value="costs">
            {!trial.finalized && (
              <BlendCostImpact trialId={trialId!} />
            )}
            {trial.finalized && (
              <BlendCostTransferTab trialId={trialId!} targetVintageId={trial.vintage_id} />
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Finalize Button */}
      {!trial.finalized && (
        <Button
          className="w-full min-h-[44px] mt-6"
          onClick={() => finalize.mutate()}
          disabled={finalize.isPending}
        >
          {finalize.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
          Finalize Blend Recipe
        </Button>
      )}
    </div>
  );
}
