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
import { ArrowLeft, Loader2, Lock, Star, Calculator } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "hsl(348, 58%, 26%)", "hsl(36, 64%, 47%)", "hsl(200, 60%, 45%)",
  "hsl(160, 50%, 40%)", "hsl(280, 50%, 50%)", "hsl(20, 70%, 50%)",
];

export default function TrialDetail() {
  const { trialId } = useParams<{ trialId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization } = useAuth();
  const [targetVolume, setTargetVolume] = useState("");

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trial", trialId] });
      queryClient.invalidateQueries({ queryKey: ["blending-trials"] });
      toast.success("Trial finalized — blend recipe locked");
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

      {/* Lot Breakdown Chart */}
      {lots.length > 0 && (
        <Card className="mb-6">
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

      {/* Scale-Up Calculator */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Scale-Up Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <Label>Target Total Volume (L)</Label>
            <Input
              type="number"
              value={targetVolume}
              onChange={(e) => setTargetVolume(e.target.value)}
              placeholder="Enter target volume"
            />
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

      {/* Finalize Button */}
      {!trial.finalized && (
        <Button
          className="w-full min-h-[44px]"
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
