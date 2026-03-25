import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, Users, CreditCard, Percent } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart,
} from "recharts";

interface Props {
  api: (action: string, payload?: any) => Promise<any>;
}

function BigStat({ label, value, icon: Icon, loading }: { label: string; value: string; icon: any; loading?: boolean }) {
  if (loading) return <Card className="bg-white shadow-sm"><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>;
  return (
    <Card className="bg-white shadow-sm">
      <CardContent className="p-6 flex items-center gap-4">
        <div className="p-3 rounded-xl" style={{ background: "#6B1B2A15" }}>
          <Icon className="h-6 w-6" style={{ color: "#6B1B2A" }} />
        </div>
        <div>
          <p className="text-3xl font-bold" style={{ color: "#1A1A1A" }}>{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function RevenueTab({ api }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-revenue-detail"],
    queryFn: () => api("revenue-detail"),
  });

  const { data: mrrData, isLoading: mrrLoading } = useQuery({
    queryKey: ["admin-weekly-mrr"],
    queryFn: () => api("weekly-mrr"),
  });

  const weeks = mrrData?.weeks || [];

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <BigStat label="Current MRR" value={`$${data?.mrr || 0}`} icon={DollarSign} loading={isLoading} />
        <BigStat label="ARR" value={`$${(data?.arr || 0).toLocaleString()}`} icon={TrendingUp} loading={isLoading} />
        <BigStat label="Active Subscriptions" value={String(data?.activeSubscriptions || 0)} icon={Users} loading={isLoading} />
        <BigStat label="Avg Revenue / User" value={`$${data?.avgRevenuePerUser || 0}`} icon={CreditCard} loading={isLoading} />
        <BigStat label="Churn Rate (30d)" value={`${data?.churnRate || 0}%`} icon={Percent} loading={isLoading} />
      </div>

      {/* MRR Trend */}
      <Card className="bg-white shadow-sm">
        <CardHeader><CardTitle className="text-sm">Weekly MRR (12 weeks)</CardTitle></CardHeader>
        <CardContent>
          {mrrLoading ? <Skeleton className="h-64 w-full" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={weeks}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="weekOf" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="mrr" name="MRR" fill="#6B1B2A" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="mrr" name="Trend" stroke="#C8902A" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Subscription Table */}
      <Card className="bg-white shadow-sm">
        <CardHeader><CardTitle className="text-sm">Active Subscriptions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <Skeleton className="h-48 w-full m-4" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Org Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.subscriptions || []).map((sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.orgName}</TableCell>
                    <TableCell><Badge variant="outline">{sub.plan}</Badge></TableCell>
                    <TableCell>${sub.mrr}</TableCell>
                    <TableCell className="capitalize">{sub.billingCycle}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {sub.nextBilling ? new Date(sub.nextBilling).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {sub.cardLast4 ? (
                        <Badge variant="outline" className="text-green-700 border-green-300">•••• {sub.cardLast4}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(sub.startedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.subscriptions || []).length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No active subscriptions</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Failed Payments */}
      {(data?.failedPayments || []).length > 0 && (
        <Card className="bg-white shadow-sm border-red-200">
          <CardHeader><CardTitle className="text-sm text-red-700">Failed Payments (30 days)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Org</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Failed Date</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.failedPayments.map((fp: any, i: number) => (
                  <TableRow key={i} className="bg-red-50">
                    <TableCell>{fp.orgName}</TableCell>
                    <TableCell>${fp.amount}</TableCell>
                    <TableCell className="text-xs">{new Date(fp.failedDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs text-red-700">{fp.failureReason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Upgrade / Downgrade Log */}
      {(data?.upgrades || []).length > 0 && (
        <Card className="bg-white shadow-sm">
          <CardHeader><CardTitle className="text-sm">Upgrade / Downgrade Log (90 days)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Org</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>MRR Impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.upgrades.map((u: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{u.orgName}</TableCell>
                    <TableCell>{u.fromPlan}</TableCell>
                    <TableCell>{u.toPlan}</TableCell>
                    <TableCell className="text-xs">{new Date(u.date).toLocaleDateString()}</TableCell>
                    <TableCell className={u.mrrImpact >= 0 ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
                      {u.mrrImpact >= 0 ? "+" : ""}${u.mrrImpact}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
