import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, DollarSign, GitMerge, Plus, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { AddCostDialog } from "@/components/costs/AddCostDialog";
import { CostEntryAudit } from "@/components/costs/CostEntryAudit";
import { toast } from "sonner";

const fmt = (n: number | null) =>
  n != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n) : "—";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  voided: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  transferred: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

const METHOD_LABELS: Record<string, string> = {
  apportioned: "Apportioned",
  transactional: "Transactional",
  ad_hoc: "Ad Hoc",
};

const CAT_COLORS = [
  "hsl(348, 58%, 26%)", "hsl(36, 64%, 47%)", "hsl(25, 60%, 35%)",
  "hsl(200, 60%, 45%)", "hsl(320, 50%, 45%)", "hsl(0, 0%, 50%)",
  "hsl(160, 50%, 40%)", "hsl(100, 40%, 40%)", "hsl(0, 0%, 65%)",
];

export default function LotCostDetail() {
  const { vintageId } = useParams<{ vintageId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [whatIfAmount, setWhatIfAmount] = useState("");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const { isAtLeast } = useRoleAccess();
  const queryClient = useQueryClient();

  const handleRecalcLot = async () => {
    if (!vintageId) return;
    setRecalculating(true);
    try {
      await supabase.rpc("recalculate_lot_cost_summary_for_vintage" as any, { p_vintage_id: vintageId }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["lot-cost-summary", vintageId] });
      queryClient.invalidateQueries({ queryKey: ["lot-cost-entries", vintageId] });
      toast.success("COGS recalculated for this lot");
    } catch { toast.error("Recalculation failed"); }
    finally { setRecalculating(false); }
  };

  // Vintage info
  const { data: vintage } = useQuery({
    queryKey: ["vintage-info", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vintages").select("*").eq("id", vintageId!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!vintageId,
  });

  // Summary
  const { data: summary } = useQuery({
    queryKey: ["lot-cost-summary", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lot_cost_summaries").select("*").eq("vintage_id", vintageId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!vintageId,
  });

  // Cost entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["lot-cost-entries", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("*, cost_categories(name, color), blending_trials(name)")
        .eq("vintage_id", vintageId!)
        .order("effective_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!vintageId,
  });

  // Blend history: costs received from blends
  const { data: blendReceived = [] } = useQuery({
    queryKey: ["blend-received", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("blend_trial_id, source_vintage_id, total_amount, transfer_ratio, blending_trials(name), vintages!cost_entries_source_vintage_id_fkey(year, variety, name)")
        .eq("vintage_id", vintageId!)
        .not("blend_trial_id", "is", null)
        .eq("status", "active" as any);
      if (error) throw error;
      // Group by source
      const grouped: Record<string, { name: string; total: number; ratio: number; blendName: string }> = {};
      (data || []).forEach((e: any) => {
        const key = e.source_vintage_id || "unknown";
        if (!grouped[key]) {
          const sn = e.vintages?.name || `${e.vintages?.year || ""} ${e.vintages?.variety || ""}`.trim();
          grouped[key] = { name: sn || "Unknown", total: 0, ratio: Number(e.transfer_ratio) || 0, blendName: e.blending_trials?.name || "" };
        }
        grouped[key].total += Number(e.total_amount) || 0;
      });
      return Object.values(grouped);
    },
    enabled: !!vintageId,
  });

  // Blend history: costs sent to other blends
  const { data: blendSent = [] } = useQuery({
    queryKey: ["blend-sent", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("vintage_id, total_amount, transfer_ratio, blending_trials(name), vintages!cost_entries_vintage_id_fkey(year, variety, name)")
        .eq("source_vintage_id", vintageId!)
        .eq("status", "active" as any);
      if (error) throw error;
      const grouped: Record<string, { name: string; total: number; blendName: string }> = {};
      (data || []).forEach((e: any) => {
        const key = e.vintage_id;
        if (!grouped[key]) {
          const n = e.vintages?.name || `${e.vintages?.year || ""} ${e.vintages?.variety || ""}`.trim();
          grouped[key] = { name: n || "Unknown", total: 0, blendName: e.blending_trials?.name || "" };
        }
        grouped[key].total += Number(e.total_amount) || 0;
      });
      return Object.values(grouped);
    },
    enabled: !!vintageId,
  });

  // Pie chart data
  const pieData = summary ? [
    { name: "Grape", value: Number(summary.grape_cost) || 0 },
    { name: "Labor", value: Number(summary.labor_cost) || 0 },
    { name: "Cooperage", value: Number(summary.cooperage_cost) || 0 },
    { name: "Chemicals", value: Number(summary.chemicals_cost) || 0 },
    { name: "Bottling", value: Number(summary.bottling_cost) || 0 },
    { name: "Overhead", value: Number(summary.overhead_cost) || 0 },
    { name: "Other", value: Number(summary.other_cost) || 0 },
  ].filter((d) => d.value > 0) : [];
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);
  const totalGallons = Number(summary?.total_gallons) || 0;

  // Timeline data: cumulative cost over time
  const activeEntries = entries.filter((e: any) => e.status === "active");
  const timelineData = activeEntries.reduce((acc: any[], e: any) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
    acc.push({
      date: e.effective_date,
      cumulative: prev + Number(e.total_amount),
      label: e.blend_trial_id ? "Blend transfer" : e.weigh_tag_id ? "Grape received" : e.description?.substring(0, 30),
    });
    return acc;
  }, []);

  // Projections
  const isNotBottled = vintage && !["bottled", "released"].includes(vintage.status);
  const currentCogs = Number(summary?.total_cost) || 0;
  const whatIfNum = parseFloat(whatIfAmount) || 0;
  const projectedCpg = totalGallons > 0 ? (currentCogs + whatIfNum) / totalGallons : 0;

  const lotName = vintage?.name || `${vintage?.year || ""} ${vintage?.variety || ""}`.trim() || "Lot";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => navigate("/costs/dashboard")} className="h-auto p-0 hover:bg-transparent">
          <ArrowLeft className="h-4 w-4 mr-1" /> COGS Dashboard
        </Button>
        <span>/</span>
        <span className="text-foreground font-medium">{lotName}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">{lotName}</h1>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          {vintage?.variety && <span>{vintage.variety}</span>}
          {vintage?.year && <span>• {vintage.year}</span>}
          {vintage?.status && <Badge variant="outline" className="capitalize">{vintage.status}</Badge>}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total COGS", value: fmt(currentCogs) },
          { label: "$/Gallon", value: summary?.cost_per_gallon ? `$${Number(summary.cost_per_gallon).toFixed(2)}` : "—" },
          { label: "$/Barrel (59 gal)", value: summary?.cost_per_barrel ? `$${Number(summary.cost_per_barrel).toFixed(0)}` : "—" },
          { label: "$/Case (12 btl)", value: summary?.cost_per_case ? `$${Number(summary.cost_per_case).toFixed(2)}` : "—" },
          { label: "Volume", value: totalGallons > 0 ? `${totalGallons.toFixed(0)} gal` : "—" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section 1: Cost Breakdown */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Cost Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-1/3 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                      <TableHead className="text-right">$/Gallon</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pieData.sort((a, b) => b.value - a.value).map((d, i) => (
                      <TableRow key={d.name}>
                        <TableCell>
                          <span className="inline-flex items-center gap-2 text-sm">
                            <span className="h-3 w-3 rounded-full" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                            {d.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(d.value)}</TableCell>
                        <TableCell className="text-right text-sm">{(d.value / pieTotal * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-right font-mono text-sm">{totalGallons > 0 ? `$${(d.value / totalGallons).toFixed(2)}` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 2: Cost Timeline */}
      {timelineData.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Cost Timeline</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => { try { return format(parseISO(v), "MMM d"); } catch { return v; } }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-sm">
                          <p className="text-muted-foreground">{d.date}</p>
                          <p className="font-mono font-bold text-foreground">{fmt(d.cumulative)}</p>
                          <p className="text-xs text-muted-foreground">{d.label}</p>
                        </div>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="cumulative" stroke="hsl(348, 58%, 26%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 3: Cost Entries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cost Entries ({activeEntries.length})</CardTitle>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Cost</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No costs recorded for this lot yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e: any) => (
                    <TableRow key={e.id} className={e.status === "voided" ? "opacity-60" : ""}>
                      <TableCell className="text-sm whitespace-nowrap">{format(parseISO(e.effective_date), "MMM d")}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          {e.cost_categories?.color && <span className="h-2 w-2 rounded-full" style={{ background: e.cost_categories.color }} />}
                          {e.cost_categories?.name}
                        </span>
                      </TableCell>
                      <TableCell className={cn("text-sm max-w-[200px]", e.status === "voided" && "line-through")}>
                        <span className="truncate block">{e.description}</span>
                        {e.blend_trial_id && (
                          <button
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                            onClick={() => navigate(`/cellar/blending/${e.blend_trial_id}`)}
                          >
                            <GitMerge className="h-3 w-3" /> From Blend{e.blending_trials?.name ? `: ${e.blending_trials.name}` : ""}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{METHOD_LABELS[e.method]}</TableCell>
                      <TableCell className={cn("text-right font-mono text-sm", e.status === "voided" && "line-through")}>
                        {fmt(Number(e.total_amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs capitalize", STATUS_BADGE[e.status])}>{e.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Blend History */}
      {(blendReceived.length > 0 || blendSent.length > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Blend Cost History</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {blendReceived.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Costs Received From</p>
                {blendReceived.map((b: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <div>
                      <span className="text-foreground">{b.name}</span>
                      {b.blendName && <span className="text-muted-foreground ml-2">via {b.blendName}</span>}
                      <Badge variant="outline" className="ml-2 text-xs">{(b.ratio * 100).toFixed(0)}%</Badge>
                    </div>
                    <span className="font-mono font-medium text-foreground">{fmt(b.total)}</span>
                  </div>
                ))}
              </div>
            )}
            {blendSent.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Costs Sent To</p>
                {blendSent.map((b: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <div>
                      <span className="text-foreground">{b.name}</span>
                      {b.blendName && <span className="text-muted-foreground ml-2">via {b.blendName}</span>}
                    </div>
                    <span className="font-mono font-medium text-foreground">{fmt(b.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 5: Projections */}
      {isNotBottled && totalGallons > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Projections</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Current $/Gallon</p>
                <p className="text-lg font-bold text-foreground">{totalGallons > 0 ? `$${(currentCogs / totalGallons).toFixed(2)}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Est. $/Bottle at bottling</p>
                <p className="text-lg font-bold text-foreground">{totalGallons > 0 ? `$${(currentCogs / (totalGallons / 2.378) / 12).toFixed(2)}` : "—"}</p>
              </div>
            </div>
            <div className="border-t border-border pt-4">
              <Label className="text-sm font-medium">What-If Calculator</Label>
              <p className="text-xs text-muted-foreground mb-2">Enter additional costs to see projected impact</p>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-[200px]">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="pl-8"
                    value={whatIfAmount}
                    onChange={(e) => setWhatIfAmount(e.target.value)}
                  />
                </div>
                {whatIfNum > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">New $/gal: </span>
                    <span className="font-mono font-bold text-foreground">${projectedCpg.toFixed(2)}</span>
                    <span className="text-muted-foreground ml-2">
                      (+${(whatIfNum / totalGallons).toFixed(2)}/gal)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <AddCostDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} preselectedVintageId={vintageId} />
    </div>
  );
}
