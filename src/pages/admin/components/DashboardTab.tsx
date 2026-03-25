import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, UserPlus, Activity, FlaskConical, CheckSquare,
  Upload, Wine, Sparkles, TrendingUp, TrendingDown, DollarSign,
  CreditCard, AlertTriangle,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  api: (action: string, payload?: any) => Promise<any>;
}

const TIER_COLORS: Record<string, string> = {
  hobbyist: "#94a3b8",
  small_boutique: "#C8902A",
  mid_size: "#6B1B2A",
  enterprise: "#1A1A1A",
};

const TIER_LABELS: Record<string, string> = {
  hobbyist: "Hobbyist",
  small_boutique: "Pro",
  mid_size: "Growth",
  enterprise: "Enterprise",
};

function StatCard({ label, value, delta, icon: Icon, loading }: {
  label: string; value: string | number; delta?: number; icon: any; loading?: boolean;
}) {
  if (loading) return (
    <Card className="bg-white shadow-sm">
      <CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent>
    </Card>
  );
  return (
    <Card className="bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>{value}</p>
            {delta !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                {delta >= 0 ? <TrendingUp className="h-3 w-3 text-green-600" /> : <TrendingDown className="h-3 w-3 text-red-600" />}
                <span className={`text-xs font-medium ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {delta >= 0 ? "+" : ""}{delta}
                </span>
              </div>
            )}
          </div>
          <div className="p-2 rounded-lg" style={{ background: "#6B1B2A15" }}>
            <Icon className="h-5 w-5" style={{ color: "#6B1B2A" }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardTab({ api }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: () => api("dashboard-stats"),
  });

  const tierData = data?.tierCounts
    ? Object.entries(data.tierCounts).map(([tier, count]) => ({
        name: TIER_LABELS[tier] || tier,
        value: count as number,
        color: TIER_COLORS[tier] || "#ccc",
      }))
    : [];

  const totalOrgs = data?.totalOrgs || 0;

  return (
    <div className="space-y-8">
      {/* Users & Growth */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          Users & Growth
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Organizations" value={data?.totalOrgs || 0} icon={Building2} loading={isLoading} />
          <StatCard label="New (24h)" value={data?.newOrgs24h || 0} delta={data?.newOrgs24hDelta} icon={UserPlus} loading={isLoading} />
          <StatCard label="New (7 days)" value={data?.newOrgs7d || 0} delta={data?.newOrgs7dDelta} icon={UserPlus} loading={isLoading} />
          <Card className="bg-white shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Tier Breakdown</p>
              {isLoading ? <Skeleton className="h-24 w-full" /> : (
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={tierData} dataKey="value" cx="50%" cy="50%" innerRadius={18} outerRadius={35} strokeWidth={1}>
                          {tierData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1">
                    {tierData.map((t) => (
                      <div key={t.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                        <span className="text-muted-foreground">{t.name}</span>
                        <span className="font-semibold">{t.value}</span>
                        <span className="text-muted-foreground">({totalOrgs > 0 ? Math.round(t.value / totalOrgs * 100) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Revenue */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          Revenue
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Current MRR" value={`$${data?.revenue?.mrr || 0}`} icon={DollarSign} loading={isLoading} />
          <StatCard label="MRR Added (7d)" value={`$${data?.revenue?.mrrAdded7d || 0}`} icon={TrendingUp} loading={isLoading} />
          <StatCard label="Churned MRR (7d)" value={`$${data?.revenue?.mrrChurned7d || 0}`} icon={TrendingDown} loading={isLoading} />
          <StatCard label="Net New MRR (7d)" value={`$${(data?.revenue?.mrrAdded7d || 0) - (data?.revenue?.mrrChurned7d || 0)}`} icon={DollarSign} loading={isLoading} />
          <Card className="bg-white shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Active Paid Subs</p>
              <p className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>{data?.revenue?.activeSubscriptions || 0}</p>
              {(data?.revenue?.failedPayments7d || 0) > 0 && (
                <Badge variant="destructive" className="mt-1 text-xs">
                  {data.revenue.failedPayments7d} failed payments
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Engagement */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          Engagement
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Orgs (24h)" value={data?.activeOrgs24h || 0} icon={Activity} loading={isLoading} />
          <StatCard label="Active Orgs (7d)" value={data?.activeOrgs7d || 0} icon={Activity} loading={isLoading} />
          <StatCard label="Total Lab Samples" value={(data?.totalLabSamples || 0).toLocaleString()} icon={FlaskConical} loading={isLoading} />
          <StatCard label="Tasks Completed" value={(data?.totalTasksCompleted || 0).toLocaleString()} icon={CheckSquare} loading={isLoading} />
          <StatCard label="Imports Completed" value={data?.totalImportsCompleted || 0} icon={Upload} loading={isLoading} />
          <StatCard label="Total Vintages" value={data?.totalVintages || 0} icon={Wine} loading={isLoading} />
          <StatCard label="Ask Solera (7d)" value={data?.aiQueries7d || 0} icon={Sparkles} loading={isLoading} />
          <StatCard label="Active Subs" value={data?.revenue?.activeSubscriptions || 0} icon={CreditCard} loading={isLoading} />
        </div>
      </section>

      {/* Alerts & Flags */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          Alerts & Flags
        </h2>
        <div className="space-y-2">
          {isLoading ? (
            <>{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</>
          ) : (
            (data?.alerts || []).map((alert: any, i: number) => (
              <Card
                key={i}
                className="shadow-sm"
                style={{
                  background: alert.severity === "green" ? "#f0fdf4" : alert.severity === "red" ? "#fef2f2" : "#fffbeb",
                  borderColor: alert.severity === "green" ? "#bbf7d0" : alert.severity === "red" ? "#fecaca" : "#fde68a",
                }}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  {alert.severity === "green" ? null : <AlertTriangle className="h-4 w-4" style={{ color: alert.severity === "red" ? "#dc2626" : "#d97706" }} />}
                  <span className="text-sm font-medium" style={{ color: "#1A1A1A" }}>{alert.icon} {alert.label}</span>
                  {alert.link && (
                    <Badge variant="outline" className="ml-auto text-xs cursor-pointer">{alert.link}</Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
