import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from "recharts";

interface Props {
  api: (action: string, payload?: any) => Promise<any>;
}

export function WeeklyStrategyTab({ api }: Props) {
  const queryClient = useQueryClient();

  // MRR Trend
  const { data: mrrData, isLoading: mrrLoading } = useQuery({
    queryKey: ["admin-weekly-mrr"],
    queryFn: () => api("stripe-weekly-mrr"),
  });

  // Engagement / signups
  const { data: engData, isLoading: engLoading } = useQuery({
    queryKey: ["admin-engagement"],
    queryFn: () => api("engagement-stats"),
  });

  // Search Console metrics
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => api("admin-metrics-list"),
  });

  // Form state
  const [scForm, setScForm] = useState({
    week_of: new Date().toISOString().slice(0, 10),
    sc_impressions: 0,
    sc_clicks: 0,
    sc_avg_position: 0,
    sc_top_queries: [{ query: "", clicks: 0, impressions: 0, position: 0 }],
    notes: "",
  });

  const saveMutation = useMutation({
    mutationFn: () => api("admin-metrics-upsert", {
      ...scForm,
      sc_top_queries: scForm.sc_top_queries.filter(q => q.query),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-metrics"] });
      toast.success("Metrics saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addQuery = () => {
    if (scForm.sc_top_queries.length >= 5) return;
    setScForm({ ...scForm, sc_top_queries: [...scForm.sc_top_queries, { query: "", clicks: 0, impressions: 0, position: 0 }] });
  };

  const removeQuery = (idx: number) => {
    setScForm({ ...scForm, sc_top_queries: scForm.sc_top_queries.filter((_, i) => i !== idx) });
  };

  const updateQuery = (idx: number, field: string, value: any) => {
    const updated = [...scForm.sc_top_queries];
    (updated[idx] as any)[field] = value;
    setScForm({ ...scForm, sc_top_queries: updated });
  };

  const weeks = mrrData?.weeks || [];
  const metrics = metricsData?.metrics || [];
  const signups = engData?.signupsByWeek || [];

  return (
    <div className="space-y-8">
      {/* MRR Trend */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          Revenue Trend
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-white shadow-sm">
            <CardHeader><CardTitle className="text-sm">Weekly MRR</CardTitle></CardHeader>
            <CardContent>
              {mrrLoading ? <Skeleton className="h-48 w-full" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeks.slice(-8)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weekOf" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="mrr" fill="#6B1B2A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardHeader><CardTitle className="text-sm">MRR by Tier</CardTitle></CardHeader>
            <CardContent>
              {mrrLoading ? <Skeleton className="h-48 w-full" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeks.slice(-8)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weekOf" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="mrr_small_boutique" name="Pro" stackId="a" fill="#C8902A" />
                    <Bar dataKey="mrr_mid_size" name="Growth" stackId="a" fill="#6B1B2A" />
                    <Bar dataKey="mrr_enterprise" name="Enterprise" stackId="a" fill="#1A1A1A" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* User Cohorts */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          User Cohorts
        </h2>
        <Card className="bg-white shadow-sm">
          <CardHeader><CardTitle className="text-sm">New Signups per Week</CardTitle></CardHeader>
          <CardContent>
            {engLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={signups}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="weekOf" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="signups" stroke="#6B1B2A" strokeWidth={2} dot={{ fill: "#C8902A" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Search Console Form */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          Search Console Data
        </h2>
        <Card className="bg-white shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Week Of</Label>
                <Input type="date" value={scForm.week_of} onChange={(e) => setScForm({ ...scForm, week_of: e.target.value })} />
              </div>
              <div>
                <Label>Impressions</Label>
                <Input type="number" value={scForm.sc_impressions} onChange={(e) => setScForm({ ...scForm, sc_impressions: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Clicks</Label>
                <Input type="number" value={scForm.sc_clicks} onChange={(e) => setScForm({ ...scForm, sc_clicks: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Avg Position</Label>
                <Input type="number" step="0.1" value={scForm.sc_avg_position} onChange={(e) => setScForm({ ...scForm, sc_avg_position: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Top Queries</Label>
                <Button variant="ghost" size="sm" onClick={addQuery} disabled={scForm.sc_top_queries.length >= 5}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {scForm.sc_top_queries.map((q, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 mb-2">
                  <Input placeholder="Query" value={q.query} onChange={(e) => updateQuery(i, "query", e.target.value)} className="col-span-2" />
                  <Input type="number" placeholder="Clicks" value={q.clicks} onChange={(e) => updateQuery(i, "clicks", parseInt(e.target.value) || 0)} />
                  <Input type="number" placeholder="Impressions" value={q.impressions} onChange={(e) => updateQuery(i, "impressions", parseInt(e.target.value) || 0)} />
                  <div className="flex gap-1">
                    <Input type="number" step="0.1" placeholder="Pos" value={q.position} onChange={(e) => updateQuery(i, "position", parseFloat(e.target.value) || 0)} />
                    <Button variant="ghost" size="icon" onClick={() => removeQuery(i)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label>Strategic Notes</Label>
              <Textarea value={scForm.notes} onChange={(e) => setScForm({ ...scForm, notes: e.target.value })} rows={3} placeholder="Weekly strategic notes…" />
            </div>

            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save Week
            </Button>
          </CardContent>
        </Card>

        {/* Saved data */}
        {!metricsLoading && metrics.length > 0 && (
          <Card className="bg-white shadow-sm mt-4">
            <CardHeader><CardTitle className="text-sm">Search Console Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={[...metrics].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week_of" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="sc_clicks" name="Clicks" stroke="#6B1B2A" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="sc_impressions" name="Impressions" stroke="#C8902A" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Past weeks notes */}
        {metrics.length > 0 && (
          <div className="mt-4 space-y-2">
            {metrics.map((m: any) => (
              <Card key={m.id} className="bg-white shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{m.week_of}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.sc_clicks} clicks · {m.sc_impressions} imp · pos {m.sc_avg_position}
                    </span>
                  </div>
                  {m.notes && <p className="text-sm text-muted-foreground">{m.notes}</p>}
                  {m.sc_top_queries && (m.sc_top_queries as any[]).length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Top: {(m.sc_top_queries as any[]).map((q: any) => q.query).join(", ")}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
