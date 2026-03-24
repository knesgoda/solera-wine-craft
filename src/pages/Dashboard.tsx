import { Wine, Calendar, CheckSquare, Send, Package, DollarSign } from "lucide-react";
import { GrowerDashboardWidgets } from "@/components/growers/GrowerDashboardWidgets";
import { CogsDashboardWidgets } from "@/components/costs/CogsDashboardWidgets";
import { hasAccess } from "@/lib/tier-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format } from "date-fns";
import { usePrimeWindowBlocks } from "@/hooks/usePrimeWindowBlocks";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const { profile, organization } = useAuth();
  const orgId = organization?.id;
  const [showPrimeBlocks, setShowPrimeBlocks] = useState(false);

  const { data: activeVintages = 0 } = useQuery({
    queryKey: ["dashboard-active-vintages", orgId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("vintages")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .in("status", ["in_progress", "harvested", "in_cellar"]);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!orgId,
  });

  const { data: primeBlocks = [] } = usePrimeWindowBlocks();

  const { data: inventoryStats } = useQuery({
    queryKey: ["dashboard-inventory", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_skus")
        .select("cases, bottles_per_case, price, loose_bottles")
        .eq("org_id", orgId!)
        .eq("active", true);
      if (error) throw error;
      const totalCases = (data || []).reduce((s, r: any) => s + (Number(r.cases) || 0), 0);
      const totalValue = (data || []).reduce((s, r: any) => {
        const bottles = (Number(r.cases) || 0) * (Number(r.bottles_per_case) || 12) + (Number(r.loose_bottles) || 0);
        return s + bottles * (Number(r.price) || 0);
      }, 0);
      return { totalCases, totalValue };
    },
    enabled: !!orgId,
  });

  const { data: tasksDue = 0 } = useQuery({
    queryKey: ["dashboard-tasks-due", orgId],
    queryFn: async () => {
      const sevenDays = format(addDays(new Date(), 7), "yyyy-MM-dd");
      const { count, error } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .eq("status", "pending")
        .lte("due_date", sevenDays);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!orgId,
  });

  const stats = [
    { title: "Active Vintages", value: activeVintages, icon: Wine, link: "/vintages", color: "text-primary" },
    { title: "Prime Pick Windows", value: primeBlocks.length, icon: Calendar, color: "text-secondary", onClick: () => primeBlocks.length > 0 && setShowPrimeBlocks(true) },
    { title: "Tasks Due", value: tasksDue, icon: CheckSquare, link: "/tasks", color: "text-secondary" },
    { title: "Cases On Hand", value: inventoryStats?.totalCases ?? 0, icon: Package, link: "/inventory", color: "text-primary" },
    { title: "Inventory Value", value: `$${(inventoryStats?.totalValue ?? 0).toLocaleString()}`, icon: DollarSign, link: "/inventory", color: "text-secondary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
          Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">Here's what's happening at your winery</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const inner = (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-display text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          );

          if (stat.link) {
            return <Link to={stat.link} key={stat.title}>{inner}</Link>;
          }
          return (
            <div key={stat.title} onClick={stat.onClick} className="cursor-pointer">
              {inner}
            </div>
          );
        })}
      </div>

      <Link to="/ask-solera">
        <Card className="border-none shadow-md hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="text-lg font-display text-foreground flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-secondary/10">
                <Send className="h-4 w-4 text-secondary" />
              </span>
              Ask Solera
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input placeholder="Ask about your vineyard, vintages, or operations..." className="flex-1" readOnly />
              <Button className="shrink-0">Ask</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">AI-powered winery insights</p>
          </CardContent>
        </Card>
      </Link>

      {/* Production Costs Dashboard — Growth+ only */}
      {hasAccess(organization?.tier || "hobbyist", "mid_size") && (
        <CogsDashboardWidgets />
      )}

      {/* Grower Contracts Dashboard — Enterprise only */}
      {hasAccess(organization?.tier || "hobbyist", "enterprise") && (
        <GrowerDashboardWidgets />
      )}

      {/* Prime Window Blocks Dialog */}
      <Dialog open={showPrimeBlocks} onOpenChange={setShowPrimeBlocks}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Blocks in Prime Pick Window</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {primeBlocks.map((b) => (
              <Link
                key={b.blockId}
                to={`/operations/${b.vineyardId}/blocks/${b.blockId}`}
                onClick={() => setShowPrimeBlocks(false)}
                className="block"
              >
                <Card className="hover:shadow-md transition-shadow border-none shadow-sm">
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{b.blockName}</p>
                      <p className="text-xs text-muted-foreground">{b.vineyardName}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {format(b.predictedDate, "MMM d")}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">Brix: {b.currentBrix.toFixed(1)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {primeBlocks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No blocks currently in prime window</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
