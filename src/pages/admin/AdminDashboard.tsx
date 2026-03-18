import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Users, BarChart3, AlertTriangle, HeartPulse, Plus, Trash2, Pencil,
  Copy, ExternalLink, RefreshCw, CheckCircle2, XCircle, BookOpen,
  TrendingUp, DollarSign, Wine, FlaskConical, ShoppingCart, Building2,
} from "lucide-react";
import { Link } from "react-router-dom";

// ─── Types ───
interface AdminState {
  authed: boolean;
  password: string;
}

// ─── API Helper ───
function useAdminApi(password: string) {
  return useCallback(
    async (action: string, payload?: any) => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { password, action, payload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    [password]
  );
}

// ─── Login Gate ───
function AdminLogin({ onLogin }: { onLogin: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await supabase.functions.invoke("verify-admin", {
        body: { password: pw },
      });
      if (data?.verified) {
        onLogin(pw);
      } else {
        setError("Invalid password");
      }
    } catch {
      setError("Authentication failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display">Solera Admin</CardTitle>
          <CardDescription>Enter admin password to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying…" : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Overview Tab ───
function OverviewTab({ api }: { api: (a: string, p?: any) => Promise<any> }) {
  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api("overview-stats"),
  });

  if (!data) return <div className="text-muted-foreground text-sm">Loading stats…</div>;

  const tierLabels: Record<string, string> = {
    hobbyist: "Hobbyist", small_boutique: "Pro", mid_size: "Growth", enterprise: "Enterprise",
  };

  const stats = [
    { label: "MRR", value: `$${(data.mrr || 0).toLocaleString()}`, icon: DollarSign },
    { label: "Projected ARR", value: `$${((data.mrr || 0) * 12).toLocaleString()}`, icon: TrendingUp },
    { label: "Active Users", value: data.totalActiveUsers, icon: Users },
    { label: "New This Week", value: data.newSignupsThisWeek, icon: Plus },
    { label: "Total Vintages", value: data.totalVintages, icon: Wine },
    { label: "Lab Samples", value: data.totalLabSamples, icon: FlaskConical },
    { label: "DTC Orders", value: data.totalOrders, icon: ShoppingCart },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orgs by Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(data.tierCounts || {}).map(([tier, count]) => (
              <div key={tier} className="flex items-center gap-2">
                <Badge variant="outline">{tierLabels[tier] || tier}</Badge>
                <span className="font-semibold text-foreground">{count as number}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Customers Tab ───
function CustomersTab({ api, password }: { api: (a: string, p?: any) => Promise<any>; password: string }) {
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [contextText, setContextText] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: () => api("customer-list"),
  });

  const { data: orgDetail } = useQuery({
    queryKey: ["admin-org-detail", selectedOrg],
    queryFn: () => api("org-detail", { orgId: selectedOrg }),
    enabled: !!selectedOrg,
  });

  const buildContext = async (orgId: string) => {
    try {
      const res = await api("support-context", { orgId });
      setContextText(res.context);
      toast.success("Support context built");
    } catch {
      toast.error("Failed to build context");
    }
  };

  const tierLabels: Record<string, string> = {
    hobbyist: "Hobbyist", small_boutique: "Pro", mid_size: "Growth", enterprise: "Enterprise",
  };

  const customers = data?.customers || [];

  if (selectedOrg && orgDetail) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => { setSelectedOrg(null); setContextText(null); }}>
          ← Back to list
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{orgDetail.org?.name}</h2>
            <Badge variant="outline">{tierLabels[orgDetail.org?.tier] || orgDetail.org?.tier}</Badge>
          </div>
          <Button variant="secondary" onClick={() => buildContext(selectedOrg)}>
            <Copy className="h-4 w-4 mr-2" /> Build Support Context
          </Button>
        </div>

        {contextText && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Copy this into Claude to get AI-assisted support diagnosis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap text-foreground bg-background p-4 rounded-lg border max-h-96 overflow-auto">
                {contextText}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => { navigator.clipboard.writeText(contextText); toast.success("Copied!"); }}
              >
                <Copy className="h-3 w-3 mr-1" /> Copy to Clipboard
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Users ({orgDetail.users?.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgDetail.users?.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-foreground">{u.first_name} {u.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Vintages ({orgDetail.vintages?.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Variety</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgDetail.vintages?.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-foreground">{v.name}</TableCell>
                    <TableCell className="text-muted-foreground">{v.variety}</TableCell>
                    <TableCell className="text-muted-foreground">{v.vintage_year}</TableCell>
                    <TableCell><Badge variant="outline">{v.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Import History</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgDetail.imports?.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-muted-foreground text-xs">{new Date(i.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-foreground">{i.source_type}</TableCell>
                    <TableCell>
                      <Badge variant={i.status === "completed" ? "default" : "destructive"}>{i.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.imported_rows}/{i.total_rows}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Signup</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Vintages</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c: any) => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => setSelectedOrg(c.id)}
              >
                <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                <TableCell><Badge variant="outline">{tierLabels[c.tier] || c.tier}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {c.lastActive ? new Date(c.lastActive).toLocaleDateString() : "Never"}
                </TableCell>
                <TableCell className="text-foreground">${c.mrr}</TableCell>
                <TableCell className="text-muted-foreground">{c.userCount}</TableCell>
                <TableCell className="text-muted-foreground">{c.vintageCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Health Alerts Tab ───
function HealthAlertsTab({ api }: { api: (a: string, p?: any) => Promise<any> }) {
  const { data } = useQuery({
    queryKey: ["admin-health-alerts"],
    queryFn: () => api("health-alerts"),
  });

  const alerts = data?.alerts || [];
  const typeIcons: Record<string, any> = {
    churn_risk: AlertTriangle,
    import_failed: XCircle,
    onboarding_needed: Building2,
  };
  const typeColors: Record<string, string> = {
    churn_risk: "text-yellow-600",
    import_failed: "text-destructive",
    onboarding_needed: "text-blue-600",
  };

  return (
    <div className="space-y-3">
      {alerts.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
            All clear — no health alerts.
          </CardContent>
        </Card>
      )}
      {alerts.map((alert: any, i: number) => {
        const Icon = typeIcons[alert.type] || AlertTriangle;
        return (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-4">
              <Icon className={`h-5 w-5 shrink-0 ${typeColors[alert.type] || ""}`} />
              <div className="min-w-0">
                <p className="font-medium text-foreground">{alert.orgName}</p>
                <p className="text-sm text-muted-foreground">{alert.detail}</p>
              </div>
              <Badge variant="outline" className="ml-auto shrink-0">
                {alert.type.replace(/_/g, " ")}
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Changelog Publisher Tab ───
function ChangelogTab({ api }: { api: (a: string, p?: any) => Promise<any> }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-changelogs"],
    queryFn: () => api("list-changelogs"),
  });

  const [form, setForm] = useState({ version: "", released_at: new Date().toISOString().slice(0, 10), entries: "" });

  const resetForm = () => {
    setForm({ version: "", released_at: new Date().toISOString().slice(0, 10), entries: "" });
    setEditing(null);
    setShowForm(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let entries_json;
      try {
        entries_json = JSON.parse(form.entries);
      } catch {
        throw new Error("Invalid JSON for entries");
      }
      const payload = { version: form.version, released_at: form.released_at, entries_json };
      if (editing) {
        return api("update-changelog", { id: editing.id, ...payload });
      }
      return api("create-changelog", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-changelogs"] });
      toast.success(editing ? "Changelog updated" : "Changelog published");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api("delete-changelog", { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-changelogs"] });
      toast.success("Deleted");
    },
  });

  const startEdit = (cl: any) => {
    setForm({
      version: cl.version,
      released_at: cl.released_at?.slice(0, 10) || "",
      entries: JSON.stringify(cl.entries_json, null, 2),
    });
    setEditing(cl);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-foreground">Changelog Entries</h3>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Entry
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Version</Label>
                <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="1.0.0" />
              </div>
              <div>
                <Label>Release Date</Label>
                <Input type="date" value={form.released_at} onChange={(e) => setForm({ ...form, released_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Entries (JSON array)</Label>
              <Textarea
                rows={8}
                value={form.entries}
                onChange={(e) => setForm({ ...form, entries: e.target.value })}
                placeholder='[{"tag":"New","title":"Feature name","items":["Detail 1","Detail 2"]}]'
                className="font-mono text-xs"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {editing ? "Update" : "Publish"}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(data?.changelogs || []).map((cl: any) => (
        <Card key={cl.id}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">v{cl.version}</p>
              <p className="text-xs text-muted-foreground">{new Date(cl.released_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => startEdit(cl)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(cl.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Roadmap Manager Tab ───
function RoadmapTab({ api }: { api: (a: string, p?: any) => Promise<any> }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", status: "planned", phase: "" });

  const { data } = useQuery({
    queryKey: ["admin-roadmap"],
    queryFn: () => api("list-roadmap"),
  });

  const resetForm = () => {
    setForm({ title: "", description: "", status: "planned", phase: "" });
    setEditing(null);
    setShowForm(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) return api("update-roadmap", { id: editing.id, ...form });
      return api("create-roadmap", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roadmap"] });
      toast.success(editing ? "Updated" : "Created");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api("delete-roadmap", { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roadmap"] });
      toast.success("Deleted");
    },
  });

  const startEdit = (item: any) => {
    setForm({ title: item.title, description: item.description || "", status: item.status, phase: item.phase || "" });
    setEditing(item);
    setShowForm(true);
  };

  const statusLabels: Record<string, string> = {
    in_progress: "In Progress", coming_soon: "Coming Soon", planned: "Planned",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-foreground">Roadmap Items</h3>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Item
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="coming_soon">Coming Soon</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Phase (optional)</Label>
                <Input value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} placeholder="Phase 6" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {editing ? "Update" : "Create"}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(data?.items || []).map((item: any) => (
        <Card key={item.id}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{item.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{statusLabels[item.status] || item.status}</Badge>
                {item.phase && <Badge variant="secondary" className="text-xs">{item.phase}</Badge>}
                <span className="text-xs text-muted-foreground">{item.votes} votes</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => startEdit(item)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Environment Health Tab ───
function HealthCheckTab({ api }: { api: (a: string, p?: any) => Promise<any> }) {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["admin-health-check"],
    queryFn: () => api("health-check"),
  });

  const checks = data?.checks || {};
  const serviceLabels: Record<string, string> = {
    supabase: "Database",
    openMeteo: "Open-Meteo (Weather)",
    stripe: "Stripe (Payments)",
    resend: "Resend (Email)",
    ai: "Lovable AI",
  };

  const hasRed = Object.values(checks).some((c: any) => c.status === "red");

  return (
    <div className="space-y-4">
      {hasRed && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm font-medium text-destructive">One or more services are unhealthy.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Service Status</h3>
        <div className="flex items-center gap-2">
          {data?.checkedAt && (
            <span className="text-xs text-muted-foreground">
              Last checked: {new Date(data.checkedAt).toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {Object.entries(checks).map(([key, check]: [string, any]) => (
          <Card key={key}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {check.status === "green" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <div>
                  <p className="font-medium text-foreground">{serviceLabels[key] || key}</p>
                  {check.detail && <p className="text-xs text-muted-foreground">{check.detail}</p>}
                </div>
              </div>
              <Badge variant={check.status === "green" ? "default" : "destructive"}>
                {check.status === "green" ? "Healthy" : "Down"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main Admin Dashboard ───
export default function AdminDashboard() {
  const [auth, setAuth] = useState<AdminState>({ authed: false, password: "" });
  const api = useAdminApi(auth.password);

  if (!auth.authed) {
    return (
      <>
        <SEOHead title="Admin — Solera" noIndex />
        <AdminLogin onLogin={(pw) => setAuth({ authed: true, password: pw })} />
      </>
    );
  }

  return (
    <>
      <SEOHead title="Admin Dashboard — Solera" noIndex />
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-xl font-bold text-foreground">Solera Admin</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/blog">
                  <BookOpen className="h-4 w-4 mr-1" /> Blog Admin
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAuth({ authed: false, password: "" })}>
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Tabs defaultValue="overview">
            <TabsList className="mb-6 flex-wrap">
              <TabsTrigger value="overview" className="gap-1"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
              <TabsTrigger value="customers" className="gap-1"><Users className="h-4 w-4" /> Customers</TabsTrigger>
              <TabsTrigger value="alerts" className="gap-1"><AlertTriangle className="h-4 w-4" /> Health Alerts</TabsTrigger>
              <TabsTrigger value="changelog" className="gap-1"><Plus className="h-4 w-4" /> Changelog</TabsTrigger>
              <TabsTrigger value="roadmap" className="gap-1"><TrendingUp className="h-4 w-4" /> Roadmap</TabsTrigger>
              <TabsTrigger value="health" className="gap-1"><HeartPulse className="h-4 w-4" /> Env Health</TabsTrigger>
            </TabsList>

            <TabsContent value="overview"><OverviewTab api={api} /></TabsContent>
            <TabsContent value="customers"><CustomersTab api={api} password={auth.password} /></TabsContent>
            <TabsContent value="alerts"><HealthAlertsTab api={api} /></TabsContent>
            <TabsContent value="changelog"><ChangelogTab api={api} /></TabsContent>
            <TabsContent value="roadmap"><RoadmapTab api={api} /></TabsContent>
            <TabsContent value="health"><HealthCheckTab api={api} /></TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}
