import { Wine, Calendar, CheckSquare, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format } from "date-fns";

const Dashboard = () => {
  const { profile, organization } = useAuth();
  const orgId = organization?.id;

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

  const { data: pickWindows = 0 } = useQuery({
    queryKey: ["dashboard-pick-windows", orgId],
    queryFn: async () => {
      const thirtyDays = format(addDays(new Date(), 30), "yyyy-MM-dd");
      const today = format(new Date(), "yyyy-MM-dd");
      const { count, error } = await supabase
        .from("vintages")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .eq("status", "in_progress")
        .gte("harvest_date", today)
        .lte("harvest_date", thirtyDays);
      if (error) throw error;
      return count || 0;
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
    { title: "Upcoming Pick Windows", value: pickWindows, icon: Calendar, link: "/vintages", color: "text-secondary" },
    { title: "Tasks Due", value: tasksDue, icon: CheckSquare, link: "/tasks", color: "text-secondary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
          Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">Here's what's happening at your winery</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Link to={stat.link} key={stat.title}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-display text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-none shadow-md">
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
            <Input placeholder="Ask about your vineyard, vintages, or operations..." className="flex-1" disabled />
            <Button disabled className="shrink-0">Ask</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">AI-powered insights coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
