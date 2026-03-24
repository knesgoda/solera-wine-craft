import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, DollarSign } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { AddCostDialog } from "@/components/costs/AddCostDialog";

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

interface VintageCostsTabProps {
  vintageId: string;
}

export function VintageCostsTab({ vintageId }: VintageCostsTabProps) {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ["lot-cost-summary", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lot_cost_summaries")
        .select("*")
        .eq("vintage_id", vintageId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!vintageId,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["vintage-costs", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("*, cost_categories(name, color)")
        .eq("vintage_id", vintageId)
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!vintageId,
  });

  const fmt = (n: number | null) => n != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n) : "—";

  // Pie chart data
  const pieData = summary ? [
    { name: "Grape", value: Number(summary.grape_cost) || 0, color: "#6B1B2A" },
    { name: "Labor", value: Number(summary.labor_cost) || 0, color: "#C8902A" },
    { name: "Cooperage", value: Number(summary.cooperage_cost) || 0, color: "#8B4513" },
    { name: "Chemicals", value: Number(summary.chemicals_cost) || 0, color: "#2E86AB" },
    { name: "Bottling", value: Number(summary.bottling_cost) || 0, color: "#A23B72" },
    { name: "Overhead", value: Number(summary.overhead_cost) || 0, color: "#666666" },
    { name: "Other", value: Number(summary.other_cost) || 0, color: "#999999" },
  ].filter((d) => d.value > 0) : [];

  const activeEntries = entries.filter((e: any) => e.status === "active");

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total COGS", value: fmt(summary?.total_cost || 0) },
          { label: "$/Gallon", value: summary?.cost_per_gallon ? `$${Number(summary.cost_per_gallon).toFixed(2)}` : "—" },
          { label: "$/Barrel", value: summary?.cost_per_barrel ? `$${Number(summary.cost_per_barrel).toFixed(0)}` : "—" },
          { label: "$/Case", value: summary?.cost_per_case ? `$${Number(summary.cost_per_case).toFixed(2)}` : "—" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pie chart */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Cost Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost entries table */}
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
                      <TableCell className={cn("text-sm max-w-[180px] truncate", e.status === "voided" && "line-through")}>
                        {e.description}
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

      <AddCostDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} preselectedVintageId={vintageId} />
    </div>
  );
}
