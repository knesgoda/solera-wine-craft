import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Wine } from "lucide-react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const CAT_COLORS = [
  "hsl(348, 58%, 26%)", "hsl(36, 64%, 47%)", "hsl(25, 60%, 35%)",
  "hsl(200, 60%, 45%)", "hsl(320, 50%, 45%)", "hsl(0, 0%, 50%)", "hsl(0, 0%, 65%)",
];

export function CogsDashboardWidgets() {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const currentYear = new Date().getFullYear();

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ["cogs-dashboard-widgets", orgId, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lot_cost_summaries")
        .select("*, vintages(year, variety, name, status)")
        .eq("org_id", orgId!);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!orgId,
  });

  // YTD cost entries total
  const { data: ytdTotal = 0 } = useQuery({
    queryKey: ["cogs-ytd-total", orgId, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("total_amount")
        .eq("org_id", orgId!)
        .eq("status", "active" as any)
        .gte("effective_date", `${currentYear}-01-01`);
      if (error) throw error;
      return (data || []).reduce((s, e: any) => s + Number(e.total_amount), 0);
    },
    enabled: !!orgId,
  });

  const currentYearLots = summaries.filter((s: any) => s.vintages?.year === currentYear);
  const activeLots = summaries.filter((s: any) => !["bottled", "released"].includes(s.vintages?.status));

  const totalGallons = activeLots.reduce((s: number, l: any) => s + (Number(l.total_gallons) || 0), 0);
  const totalCost = activeLots.reduce((s: number, l: any) => s + (Number(l.total_cost) || 0), 0);
  const avgCpg = totalGallons > 0 ? totalCost / totalGallons : 0;

  const highestLot = activeLots.length > 0
    ? activeLots.reduce((max: any, l: any) => (Number(l.cost_per_gallon) || 0) > (Number(max.cost_per_gallon) || 0) ? l : max)
    : null;

  // Donut chart data
  const donutData = [
    { name: "Grape", value: summaries.reduce((s: number, l: any) => s + (Number(l.grape_cost) || 0), 0) },
    { name: "Labor", value: summaries.reduce((s: number, l: any) => s + (Number(l.labor_cost) || 0), 0) },
    { name: "Cooperage", value: summaries.reduce((s: number, l: any) => s + (Number(l.cooperage_cost) || 0), 0) },
    { name: "Chemicals", value: summaries.reduce((s: number, l: any) => s + (Number(l.chemicals_cost) || 0), 0) },
    { name: "Bottling", value: summaries.reduce((s: number, l: any) => s + (Number(l.bottling_cost) || 0), 0) },
    { name: "Overhead", value: summaries.reduce((s: number, l: any) => s + (Number(l.overhead_cost) || 0), 0) },
    { name: "Other", value: summaries.reduce((s: number, l: any) => s + (Number(l.other_cost) || 0), 0) },
  ].filter((d) => d.value > 0);

  if (isLoading) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-display font-semibold text-foreground">Production Costs</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      </section>
    );
  }

  if (summaries.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-display font-semibold text-foreground">Production Costs</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/costs/dashboard">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg COGS/Gallon</CardTitle>
              <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display text-foreground">{avgCpg > 0 ? `$${avgCpg.toFixed(2)}` : "—"}</div>
              <p className="text-xs text-muted-foreground">{activeLots.length} active lots</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/costs/dashboard">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Costs (YTD)</CardTitle>
              <TrendingUp className="h-5 w-5 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display text-foreground">{fmt(ytdTotal)}</div>
            </CardContent>
          </Card>
        </Link>

        <Link to={highestLot ? `/costs/lot/${highestLot.vintage_id}` : "/costs/dashboard"}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Highest Cost Lot</CardTitle>
              <Wine className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display text-foreground">
                {highestLot ? `$${Number(highestLot.cost_per_gallon).toFixed(2)}` : "—"}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {highestLot ? (highestLot.vintages?.name || `${highestLot.vintages?.year} ${highestLot.vintages?.variety}`) : "—"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/costs/dashboard">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {donutData.length > 0 ? (
                <div className="h-[60px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={15} outerRadius={28} strokeWidth={1}>
                        {donutData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
    </section>
  );
}
