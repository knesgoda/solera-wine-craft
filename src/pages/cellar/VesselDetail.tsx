import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Loader2, Plus, Thermometer, Droplets, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { HelpTooltip } from "@/components/ui/HelpTooltip";

/** Safely parse an ISO date string, falling back to current date on failure */
const safeParse = (d: string): Date => {
  try {
    const parsed = parseISO(d);
    if (isNaN(parsed.getTime())) return new Date();
    return parsed;
  } catch {
    return new Date();
  }
};
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function VesselDetail() {
  const { vesselId } = useParams<{ vesselId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization } = useAuth();

  const [showLogForm, setShowLogForm] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [logTempF, setLogTempF] = useState("");
  const [logBrix, setLogBrix] = useState("");
  const [logCapMgmt, setLogCapMgmt] = useState<string>("");
  const [logNotes, setLogNotes] = useState("");
  const [loggedAt, setLoggedAt] = useState(new Date().toISOString().slice(0, 16));
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  const { data: vessel, isLoading } = useQuery({
    queryKey: ["vessel", vesselId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fermentation_vessels")
        .select("*, vintages(year, id)")
        .eq("id", vesselId!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!vesselId,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["fermentation-logs", vesselId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fermentation_logs")
        .select("*")
        .eq("vessel_id", vesselId!)
        .order("logged_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!vesselId,
  });

  const { data: vintages = [] } = useQuery({
    queryKey: ["vintages", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vintages")
        .select("id, year, status")
        .eq("org_id", organization!.id)
        .order("year", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id,
  });

  const resetForm = () => {
    setLogTempF("");
    setLogBrix("");
    setLogCapMgmt("");
    setLogNotes("");
    setLoggedAt(new Date().toISOString().slice(0, 16));
    setEditingLogId(null);
    setShowLogForm(false);
  };

  const saveLog = useMutation({
    mutationFn: async () => {
      const record = {
        vessel_id: vesselId!,
        vintage_id: vessel?.vintage_id || null,
        logged_at: new Date(loggedAt).toISOString(),
        temp_f: logTempF ? parseFloat(logTempF) : null,
        brix: logBrix ? parseFloat(logBrix) : null,
        cap_management: logCapMgmt || null,
        notes: logNotes || null,
      };

      if (editingLogId) {
        const { error } = await supabase
          .from("fermentation_logs")
          .update(record as any)
          .eq("id", editingLogId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fermentation_logs").insert(record as any);
        if (error) throw error;

        // Evaluate alert rules asynchronously via authenticated proxy
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session?.access_token) return;
          supabase.functions.invoke("proxy-evaluate-alerts", {
            body: { type: "fermentation_log", record },
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).catch((e) => console.error("Alert evaluation failed:", e));
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fermentation-logs", vesselId] });
      queryClient.invalidateQueries({ queryKey: ["latest-logs"] });
      toast.success(editingLogId ? "Log entry updated" : "Log entry added");
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteLog = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase.from("fermentation_logs").delete().eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fermentation-logs", vesselId] });
      queryClient.invalidateQueries({ queryKey: ["latest-logs"] });
      toast.success("Log entry deleted");
      setDeletingLogId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const assignVintage = useMutation({
    mutationFn: async (vintageId: string) => {
      const { error } = await supabase
        .from("fermentation_vessels")
        .update({ vintage_id: vintageId === "none" ? null : vintageId } as any)
        .eq("id", vesselId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vessel", vesselId] });
      queryClient.invalidateQueries({ queryKey: ["vessels"] });
      toast.success("Vintage updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleEditLog = (log: any) => {
    setEditingLogId(log.id);
    setLogTempF(log.temp_f != null ? String(log.temp_f) : "");
    setLogBrix(log.brix != null ? String(log.brix) : "");
    setLogCapMgmt(log.cap_management || "");
    setLogNotes(log.notes || "");
    setLoggedAt(safeParse(log.logged_at).toISOString().slice(0, 16));
    setShowLogForm(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!vessel) {
    return <div className="p-6 text-center"><p className="text-muted-foreground">Vessel not found.</p></div>;
  }

  const chartData = logs.map((l: any) => ({
    date: format(safeParse(l.logged_at), "MM/dd HH:mm"),
    temp_f: l.temp_f,
    brix: l.brix,
  }));

  const logsDesc = [...logs].reverse();

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24 md:pb-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/cellar")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="text-xl">{vessel.name}</CardTitle>
            <Badge variant="secondary">{vessel.material || "Unknown"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {vessel.capacity_liters && (
            <div className="text-sm"><span className="text-muted-foreground">Capacity:</span> <span className="font-medium">{vessel.capacity_liters}L</span></div>
          )}
          {vessel.vessel_type && (
            <div className="text-sm">
              <span className="text-muted-foreground inline-flex items-center">Vessel Type<HelpTooltip content="The container type: tank, barrel, amphora, etc. Affects oxygenation, flavor development, and the appropriate monitoring schedule." /></span>{" "}
              <span className="font-medium capitalize">{String(vessel.vessel_type).replace(/_/g, " ")}</span>
            </div>
          )}
          {vessel.status && (
            <div className="text-sm">
              <span className="text-muted-foreground inline-flex items-center">Status<HelpTooltip content="Current state of the vessel. Determines what actions are available and affects monitoring schedule." /></span>{" "}
              <span className="font-medium capitalize">{String(vessel.status).replace(/_/g, " ")}</span>
            </div>
          )}
          {vessel.fill_level_pct != null && (
            <div className="text-sm">
              <span className="text-muted-foreground inline-flex items-center">Fill Level<HelpTooltip content="Current volume of wine in this vessel as a percentage of capacity. Solera uses this to flag ullage, which is empty headspace that could cause oxidation." /></span>{" "}
              <span className="font-medium">{vessel.fill_level_pct}%</span>
            </div>
          )}
          {vessel.vessel_type === "barrel" && (
            <>
              {vessel.oak_type && (
                <div className="text-sm">
                  <span className="text-muted-foreground inline-flex items-center">Oak Type<HelpTooltip content="The species and origin of oak. French adds spice and structure. American adds vanilla and coconut. Hungarian is a middle ground." /></span>{" "}
                  <span className="font-medium capitalize">{String(vessel.oak_type).replace(/_/g, " ")}</span>
                </div>
              )}
              {vessel.toast_level && (
                <div className="text-sm">
                  <span className="text-muted-foreground inline-flex items-center">Toast Level<HelpTooltip content="How heavily the barrel was charred during manufacture. Light preserves wood tannins. Medium adds vanilla and caramel. Heavy adds smoke." /></span>{" "}
                  <span className="font-medium capitalize">{String(vessel.toast_level).replace(/_/g, " ")}</span>
                </div>
              )}
              {vessel.barrel_age_fills != null && (
                <div className="text-sm">
                  <span className="text-muted-foreground inline-flex items-center">Barrel Age (fills)<HelpTooltip content="How many times this barrel has been used. First-fill barrels impart the most flavor. By the third or fourth fill, oak influence is minimal." /></span>{" "}
                  <span className="font-medium">{vessel.barrel_age_fills}</span>
                </div>
              )}
            </>
          )}
          <div className="text-sm"><span className="text-muted-foreground">Temp Controlled:</span> <span className="font-medium">{vessel.temp_controlled ? "Yes" : "No"}</span></div>
          {vessel.notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {vessel.notes}</div>}
          <div>
            <Label className="text-sm text-muted-foreground">Assigned Vintage</Label>
            <Select value={vessel.vintage_id || "none"} onValueChange={(v) => assignVintage.mutate(v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No vintage</SelectItem>
                {vintages.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>{v.year} — {v.status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      {logs.length >= 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Brix Over Time</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="brix" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Temperature Over Time</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="temp_f" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add/Edit Log Entry */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Log Entries</CardTitle>
            <Button size="sm" onClick={() => { resetForm(); setShowLogForm(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Entry
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showLogForm && (
            <div className="border border-border rounded-lg p-4 mb-4 space-y-3">
              <div><Label>Logged At</Label><Input type="datetime-local" value={loggedAt} onChange={(e) => setLoggedAt(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="inline-flex items-center">Temp (°F)<HelpTooltip content="Fermentation temperature in Fahrenheit. Affects yeast activity and flavor development. Most red ferments run 75 to 85 F. White ferments are typically cooler at 55 to 65 F." /></Label><Input type="number" step="0.1" value={logTempF} onChange={(e) => setLogTempF(e.target.value)} /></div>
                <div><Label className="inline-flex items-center">Brix (°)<HelpTooltip content="Current Brix reading. A healthy ferment drops roughly 1 to 2 Brix per day. A slower drop may indicate a stuck or sluggish ferment." /></Label><Input type="number" step="0.1" value={logBrix} onChange={(e) => setLogBrix(e.target.value)} /></div>
              </div>
              <div>
                <Label className="inline-flex items-center">Cap Management<HelpTooltip content="Cap management action performed this log entry. Pump overs circulate juice over the skins. Punch downs push the cap below the surface. Both extract color, tannin, and flavor." /></Label>
                <Select value={logCapMgmt} onValueChange={setLogCapMgmt}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="pump_over">Pump Over</SelectItem>
                    <SelectItem value="punch_down">Punch Down</SelectItem>
                    <SelectItem value="rack_and_return">Rack and Return</SelectItem>
                    <SelectItem value="delestage">Délestage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)} rows={2} /></div>
              <div className="flex gap-2">
                <Button className="flex-1 min-h-[44px]" onClick={() => saveLog.mutate()} disabled={saveLog.isPending}>
                  {saveLog.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingLogId ? "Update Entry" : "Save Entry"}
                </Button>
                <Button variant="outline" className="min-h-[44px]" onClick={resetForm}>Cancel</Button>
              </div>
            </div>
          )}

          {logsDesc.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No log entries yet. Add your first entry above.</p>
          ) : (
            <div className="space-y-2">
              {logsDesc.map((log: any) => (
                <div key={log.id} className="border border-border rounded-lg p-3 relative">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-foreground mb-1">
                      {format(safeParse(log.logged_at), "MMM d, yyyy h:mm a")}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 min-h-[44px] min-w-[44px] -mt-1 -mr-1">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditLog(log)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeletingLogId(log.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex gap-4 text-sm">
                    {log.temp_f != null && (
                      <span className="flex items-center gap-1">
                        <Thermometer className="h-3.5 w-3.5" /> {log.temp_f}°F
                      </span>
                    )}
                    {log.brix != null && (
                      <span className="flex items-center gap-1">
                        <Droplets className="h-3.5 w-3.5" /> {log.brix}°Bx
                      </span>
                    )}
                    {log.cap_management && log.cap_management !== "none" && (
                      <span className="capitalize text-muted-foreground">
                        {String(log.cap_management).replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  {log.notes && <p className="text-sm text-muted-foreground mt-1">{log.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingLogId} onOpenChange={(open) => !open && setDeletingLogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete log entry?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingLogId && deleteLog.mutate(deletingLogId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
