import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, RefreshCw, Link2, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { lovable } from "@/integrations/lovable/index";

const MODULES = [
  { value: "vintage_lab", label: "Vintage & Lab" },
  { value: "tasks", label: "Tasks" },
  { value: "inventory", label: "Inventory" },
];

const SCHEDULES = [
  { value: "manual", label: "Manual only" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily (midnight)" },
];

const CONFLICT_OPTIONS = [
  { value: "solera_wins", label: "Solera wins" },
  { value: "sheet_wins", label: "Sheet wins" },
  { value: "flag_for_review", label: "Flag for review" },
];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  partial: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
};

function parseSheetUrl(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : url.length > 20 ? url : null;
}

const GoogleSheetsSettings = () => {
  const { organization, session } = useAuth();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  const [connectOpen, setConnectOpen] = useState(false);
  const [deletingConnId, setDeletingConnId] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [tabName, setTabName] = useState("");
  const [module, setModule] = useState("");
  const [schedule, setSchedule] = useState("manual");
  const [conflictRes, setConflictRes] = useState("solera_wins");

  // Mapping review state
  const [mappingStep, setMappingStep] = useState<"form" | "mapping" | "saving">("form");
  const [suggestedMappings, setSuggestedMappings] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["sheet-connections", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_sheet_connections")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const connectGoogle = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/settings/integrations/google-sheets",
      extraParams: {
        prompt: "consent",
      },
    });
    if (error) toast.error("Google sign-in failed");
  };

  const fetchSheetHeaders = async () => {
    const sheetId = parseSheetUrl(sheetUrl);
    if (!sheetId || !tabName) {
      toast.error("Enter a valid Sheet URL and tab name");
      return;
    }

    setMappingStep("mapping");

    try {
      const { data, error } = await supabase.functions.invoke("sync-google-sheet", {
        body: { action: "fetch_headers", sheet_id: sheetId, tab_name: tabName },
      });
      if (error) throw error;

      const sheetHeaders = data.headers || [];
      setHeaders(sheetHeaders);

      // Get AI mapping suggestions
      const { data: mapData, error: mapErr } = await supabase.functions.invoke("suggest-mapping", {
        body: {
          headers: sheetHeaders,
          sampleRows: data.sampleRows || [],
          sourceType: "google_sheets",
        },
      });
      if (mapErr) throw mapErr;
      setSuggestedMappings(mapData.mappings || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch sheet headers");
      setMappingStep("form");
    }
  };

  const saveConnection = useMutation({
    mutationFn: async () => {
      const sheetId = parseSheetUrl(sheetUrl)!;

      // Save mappings
      for (const m of suggestedMappings) {
        if (m.target_table && m.target_field) {
          await supabase.from("import_mappings").upsert({
            org_id: orgId!,
            source_column: m.source_column,
            source_type: "csv" as any, // reuse csv type for sheets
            target_table: m.target_table,
            target_field: m.target_field,
            confidence: m.confidence,
            overridden_by_user: false,
          }, { onConflict: "org_id,source_column,source_type" });
        }
      }

      // Save connection
      const { error } = await supabase.from("google_sheet_connections").insert({
        org_id: orgId!,
        google_sheet_id: sheetId,
        sheet_name: sheetName || "Untitled",
        tab_name: tabName,
        module: module as any,
        sync_schedule: schedule as any,
        conflict_resolution: conflictRes as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheet-connections", orgId] });
      toast.success("Google Sheet connected");
      resetForm();
      setConnectOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("google_sheet_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheet-connections", orgId] });
      toast.success("Connection removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleConnection = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("google_sheet_connections").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sheet-connections", orgId] }),
  });

  const runSync = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.functions.invoke("sync-google-sheet", {
        body: { action: "sync", connection_id: connectionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sheet-connections", orgId] });
      queryClient.invalidateQueries({ queryKey: ["sync-logs"] });
      toast.success(`Synced ${data?.rows_synced || 0} rows`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setSheetUrl(""); setSheetName(""); setTabName(""); setModule("");
    setSchedule("manual"); setConflictRes("solera_wins");
    setMappingStep("form"); setSuggestedMappings([]); setHeaders([]);
  };

  const moduleLabel = (v: string) => MODULES.find(m => m.value === v)?.label || v;
  const scheduleLabel = (v: string) => SCHEDULES.find(s => s.value === v)?.label || v;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Google Sheets Sync</h1>
          <p className="text-muted-foreground mt-1">Connect spreadsheets to keep data in sync</p>
        </div>
        <Dialog open={connectOpen} onOpenChange={(o) => { setConnectOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Connect Sheet</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Connect Google Sheet</DialogTitle>
            </DialogHeader>

            {mappingStep === "form" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  First, sign in with Google to grant access to your sheets, then enter the sheet details.
                </p>
                <Button variant="outline" className="w-full" onClick={connectGoogle}>
                  <Link2 className="h-4 w-4 mr-2" /> Sign in with Google
                </Button>

                <div className="space-y-2">
                  <Label>Sheet URL or ID *</Label>
                  <Input
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sheet Name</Label>
                    <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="My Winery Data" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tab Name *</Label>
                    <Input value={tabName} onChange={(e) => setTabName(e.target.value)} placeholder="Sheet1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Maps to Module *</Label>
                  <Select value={module} onValueChange={setModule}>
                    <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                    <SelectContent>
                      {MODULES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sync Schedule</Label>
                    <Select value={schedule} onValueChange={setSchedule}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SCHEDULES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Conflict Resolution</Label>
                    <Select value={conflictRes} onValueChange={setConflictRes}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONFLICT_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={!sheetUrl || !tabName || !module}
                  onClick={fetchSheetHeaders}
                >
                  Fetch Headers & Map Columns
                </Button>
              </div>
            )}

            {mappingStep === "mapping" && (
              <div className="space-y-4">
                <h3 className="font-display font-semibold text-foreground">Column Mapping Review</h3>
                {suggestedMappings.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Analyzing columns...
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source Column</TableHead>
                          <TableHead>Target Table</TableHead>
                          <TableHead>Target Field</TableHead>
                          <TableHead>Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {suggestedMappings.map((m: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{m.source_column}</TableCell>
                            <TableCell className="text-sm">{m.target_table || "—"}</TableCell>
                            <TableCell className="text-sm">{m.target_field || "—"}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  m.confidence === "high" ? "bg-green-100 text-green-800" :
                                  m.confidence === "medium" ? "bg-amber-100 text-amber-800" :
                                  "bg-muted text-muted-foreground"
                                }
                              >
                                {m.confidence}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Button
                      className="w-full"
                      onClick={() => saveConnection.mutate()}
                      disabled={saveConnection.isPending}
                    >
                      {saveConnection.isPending ? "Saving..." : "Confirm & Save Connection"}
                    </Button>
                  </>
                )}
                <Button variant="ghost" className="w-full" onClick={() => setMappingStep("form")}>
                  Back
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="animate-pulse text-muted-foreground">Loading connections...</div>
      ) : connections.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-display text-lg font-semibold mb-1">No sheets connected</h3>
            <p className="text-muted-foreground text-sm mb-4">Connect a Google Sheet to sync data automatically</p>
            <Button onClick={() => setConnectOpen(true)}><Plus className="h-4 w-4 mr-2" />Connect Sheet</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {connections.map((conn: any) => (
            <ConnectionCard
              key={conn.id}
              conn={conn}
              onToggle={(active) => toggleConnection.mutate({ id: conn.id, active })}
              onSync={() => runSync.mutate(conn.id)}
              onDelete={() => setDeletingConnId(conn.id)}
              isSyncing={runSync.isPending}
              moduleLabel={moduleLabel}
              scheduleLabel={scheduleLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function ConnectionCard({ conn, onToggle, onSync, onDelete, isSyncing, moduleLabel, scheduleLabel }: any) {
  const { data: logs = [] } = useQuery({
    queryKey: ["sync-logs", conn.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .eq("connection_id", conn.id)
        .order("synced_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch checked={conn.active} onCheckedChange={onToggle} />
            <div>
              <CardTitle className="text-base font-display">{conn.sheet_name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tab: {conn.tab_name} · {moduleLabel(conn.module)} · {scheduleLabel(conn.sync_schedule)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onSync} disabled={isSyncing}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
              Sync Now
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        {conn.last_synced_at && (
          <p className="text-xs text-muted-foreground mt-2">
            Last synced {formatDistanceToNow(new Date(conn.last_synced_at), { addSuffix: true })}
          </p>
        )}
      </CardHeader>

      {logs.length > 0 && (
        <CardContent className="pt-0">
          <p className="text-xs font-medium text-muted-foreground mb-2">Recent Syncs</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Time</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Rows</TableHead>
                <TableHead className="text-xs text-right">Conflicts</TableHead>
                <TableHead className="text-xs text-right">Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{format(new Date(log.synced_at), "MMM d, h:mm a")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {STATUS_ICONS[log.status]}
                      <span className="text-xs capitalize">{log.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-right">{log.rows_synced}</TableCell>
                  <TableCell className="text-xs text-right">{log.conflicts}</TableCell>
                  <TableCell className="text-xs text-right">{log.errors}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}

export default GoogleSheetsSettings;
