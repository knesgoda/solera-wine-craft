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
import { ArrowLeft, Loader2, Plus, Thermometer, Droplets } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function VesselDetail() {
  const { vesselId } = useParams<{ vesselId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization } = useAuth();

  const [showLogForm, setShowLogForm] = useState(false);
  const [logTempF, setLogTempF] = useState("");
  const [logBrix, setLogBrix] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [loggedAt, setLoggedAt] = useState(new Date().toISOString().slice(0, 16));

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

  const addLog = useMutation({
    mutationFn: async () => {
      const record = {
        vessel_id: vesselId!,
        vintage_id: vessel?.vintage_id || null,
        logged_at: new Date(loggedAt).toISOString(),
        temp_f: logTempF ? parseFloat(logTempF) : null,
        brix: logBrix ? parseFloat(logBrix) : null,
        notes: logNotes || null,
      };
      const { error } = await supabase.from("fermentation_logs").insert(record as any);
      if (error) throw error;

      // Evaluate alert rules asynchronously
      supabase.functions.invoke("evaluate-alerts", {
        body: { type: "fermentation_log", record },
      }).catch((e) => console.error("Alert evaluation failed:", e));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fermentation-logs", vesselId] });
      queryClient.invalidateQueries({ queryKey: ["latest-logs"] });
      toast.success("Log entry added");
      setLogTempF(""); setLogBrix(""); setLogNotes("");
      setLoggedAt(new Date().toISOString().slice(0, 16));
      setShowLogForm(false);
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!vessel) {
    return <div className="p-6 text-center"><p className="text-muted-foreground">Vessel not found.</p></div>;
  }

  const chartData = logs.map((l: any) => ({
    date: format(parseISO(l.logged_at), "MM/dd HH:mm"),
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

      {/* Add Log Entry */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Log Entries</CardTitle>
            <Button size="sm" onClick={() => setShowLogForm(!showLogForm)}>
              <Plus className="h-4 w-4 mr-1" /> Add Entry
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showLogForm && (
            <div className="border border-border rounded-lg p-4 mb-4 space-y-3">
              <div><Label>Logged At</Label><Input type="datetime-local" value={loggedAt} onChange={(e) => setLoggedAt(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Temp (°F)</Label><Input type="number" step="0.1" value={logTempF} onChange={(e) => setLogTempF(e.target.value)} /></div>
                <div><Label>Brix (°)</Label><Input type="number" step="0.1" value={logBrix} onChange={(e) => setLogBrix(e.target.value)} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)} rows={2} /></div>
              <Button className="w-full min-h-[44px]" onClick={() => addLog.mutate()} disabled={addLog.isPending}>
                {addLog.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Entry
              </Button>
            </div>
          )}

          {logsDesc.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No log entries yet. Add your first entry above.</p>
          ) : (
            <div className="space-y-2">
              {logsDesc.map((log: any) => (
                <div key={log.id} className="border border-border rounded-lg p-3">
                  <p className="text-sm font-medium text-foreground mb-1">
                    {format(parseISO(log.logged_at), "MMM d, yyyy h:mm a")}
                  </p>
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
                  </div>
                  {log.notes && <p className="text-sm text-muted-foreground mt-1">{log.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
