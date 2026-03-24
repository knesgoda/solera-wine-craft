import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Wheat, FileCheck, Scale, DollarSign, Truck } from "lucide-react";

export function GrowerDashboardWidgets() {
  const { organization } = useAuth();
  const orgId = organization?.id;

  const { data: activeContracts = 0 } = useQuery({
    queryKey: ["dashboard-active-contracts", orgId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("grower_contracts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .eq("status", "active" as any);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!orgId,
  });

  const { data: harvestProgress } = useQuery({
    queryKey: ["dashboard-harvest-progress", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grower_contracts")
        .select("total_delivered_tons, estimated_tons")
        .eq("org_id", orgId!)
        .eq("status", "active" as any);
      if (error) throw error;
      const delivered = (data || []).reduce((s, c: any) => s + (Number(c.total_delivered_tons) || 0), 0);
      const estimated = (data || []).reduce((s, c: any) => s + (Number(c.estimated_tons) || 0), 0);
      return { delivered, estimated, pct: estimated > 0 ? Math.round((delivered / estimated) * 100) : 0 };
    },
    enabled: !!orgId,
  });

  const { data: pendingApprovals = 0 } = useQuery({
    queryKey: ["dashboard-pending-approvals", orgId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("weigh_tags")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .eq("status", "graded" as any);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!orgId,
  });

  const currentYear = new Date().getFullYear();
  const { data: ytdValue = 0 } = useQuery({
    queryKey: ["dashboard-ytd-value", orgId, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grower_contracts")
        .select("total_contract_value")
        .eq("org_id", orgId!)
        .eq("vintage_year", currentYear);
      if (error) throw error;
      return (data || []).reduce((s, c: any) => s + (Number(c.total_contract_value) || 0), 0);
    },
    enabled: !!orgId,
  });

  const { data: recentDeliveries = [] } = useQuery({
    queryKey: ["dashboard-recent-deliveries", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weigh_tags")
        .select("id, tag_number, net_tons, status, growers(name)")
        .eq("org_id", orgId!)
        .order("delivery_date", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const WT_STATUS_COLORS: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    graded: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    disputed: "bg-destructive/10 text-destructive",
    paid: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wheat className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-display font-semibold text-foreground">Grower Contracts</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link to="/growers/contracts">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Contracts</CardTitle>
              <FileCheck className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold font-display text-foreground">{activeContracts}</div></CardContent>
          </Card>
        </Link>

        <Link to="/growers/intake">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
              <Scale className="h-5 w-5 text-secondary" />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold font-display text-foreground">{pendingApprovals}</div></CardContent>
          </Card>
        </Link>

        <Link to="/growers/contracts">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">YTD Contract Value</CardTitle>
              <DollarSign className="h-5 w-5 text-secondary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold font-display text-foreground">${ytdValue.toLocaleString()}</div></CardContent>
          </Card>
        </Link>

        <Link to="/growers/contracts">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Harvest Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold font-display text-foreground">{harvestProgress?.pct ?? 0}%</div>
              <Progress value={harvestProgress?.pct ?? 0} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {harvestProgress?.delivered.toFixed(1) ?? 0} / {harvestProgress?.estimated.toFixed(1) ?? 0} tons
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {recentDeliveries.length > 0 && (
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Truck className="h-4 w-4" /> Recent Deliveries
              </CardTitle>
              <Link to="/growers/intake" className="text-xs text-primary hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentDeliveries.map((wt: any) => (
                <Link key={wt.id} to={`/growers/intake/${wt.id}`} className="flex items-center justify-between py-1.5 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{wt.tag_number}</span>
                    <span className="text-sm text-muted-foreground">{wt.growers?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{wt.net_tons != null ? `${Number(wt.net_tons).toFixed(2)}t` : "—"}</span>
                    <Badge variant="secondary" className={`text-xs ${WT_STATUS_COLORS[wt.status] || ""}`}>{wt.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
