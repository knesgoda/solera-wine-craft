import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Thermometer, Droplets, Clock, Loader2, Warehouse } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { NewVesselDialog } from "@/components/cellar/NewVesselDialog";

function tempColor(temp: number | null) {
  if (temp == null) return "text-muted-foreground";
  if (temp < 55) return "text-blue-500";
  if (temp <= 85) return "text-green-600";
  return "text-destructive";
}

export default function CellarDashboard() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: vessels = [], isLoading, isError: vesselsError } = useQuery({
    queryKey: ["vessels", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fermentation_vessels")
        .select("*, vintages(year, id)")
        .eq("org_id", organization!.id)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id,
  });

  // Fetch latest log for each vessel
  const vesselIds = vessels.map((v: any) => v.id);
  const { data: latestLogs = [] } = useQuery({
    queryKey: ["latest-logs", vesselIds],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from("fermentation_logs")
        .select("*")
        .in("vessel_id", vesselIds)
        .order("logged_at", { ascending: false });
      if (error) throw error;
      // Get latest per vessel
      const map = new Map<string, any>();
      (data as any[]).forEach((log) => {
        if (!map.has(log.vessel_id)) map.set(log.vessel_id, log);
      });
      return Array.from(map.values());
    },
    enabled: vesselIds.length > 0,
  });

  // Fetch first log per vessel for "days since"
  const { data: firstLogs = [] } = useQuery({
    queryKey: ["first-logs", vesselIds],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from("fermentation_logs")
        .select("vessel_id, logged_at")
        .in("vessel_id", vesselIds)
        .order("logged_at", { ascending: true });
      if (error) throw error;
      const map = new Map<string, string>();
      (data as any[]).forEach((log) => {
        if (!map.has(log.vessel_id)) map.set(log.vessel_id, log.logged_at);
      });
      return Array.from(map.entries());
    },
    enabled: vesselIds.length > 0,
  });

  const logMap = new Map(latestLogs.map((l: any) => [l.vessel_id, l]));
  const firstLogMap = new Map(firstLogs as [string, string][]);

  const activeVessels = vessels.filter((v: any) => v.vintage_id);
  const inactiveVessels = vessels.filter((v: any) => !v.vintage_id);

  const renderVesselCard = (vessel: any) => {
    const latest = logMap.get(vessel.id);
    const firstDate = firstLogMap.get(vessel.id);
    const daysSince = firstDate ? differenceInDays(new Date(), parseISO(firstDate)) : null;

    return (
      <Card
        key={vessel.id}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate(`/cellar/vessels/${vessel.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-medium text-foreground">{vessel.name}</p>
              {vessel.vintages && (
                <p className="text-sm text-muted-foreground">{vessel.vintages.year} Vintage</p>
              )}
            </div>
            <Badge variant="secondary" className="text-xs">
              {vessel.material || "Unknown"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="flex items-center gap-1 text-sm">
              <Thermometer className={`h-3.5 w-3.5 ${tempColor(latest?.temp_f)}`} />
              <span className={tempColor(latest?.temp_f)}>
                {latest?.temp_f != null ? `${latest.temp_f}°F` : "—"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{latest?.brix != null ? `${latest.brix}°Bx` : "—"}</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{daysSince != null ? `${daysSince}d` : "—"}</span>
            </div>
          </div>
          {vessel.capacity_liters && (
            <p className="text-xs text-muted-foreground mt-2">{vessel.capacity_liters}L capacity</p>
          )}
        </CardContent>
      </Card>
    );
  };

  if (vesselsError) return <div className="py-12 text-center text-destructive">Failed to load cellar data. Please refresh the page.</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Cellar</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Vessel
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList className="w-full">
          <TabsTrigger value="active" className="flex-1">
            Active ({activeVessels.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1">
            All Vessels ({vessels.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeVessels.length === 0 ? (
            <Card className="border-dashed border-2 border-border">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Warehouse className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No active fermentations</h3>
                <p className="text-muted-foreground mb-4">
                  Assign a vintage to a vessel to start tracking fermentation
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Add Vessel
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeVessels.map(renderVesselCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : vessels.length === 0 ? (
            <Card className="border-dashed border-2 border-border">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Warehouse className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No vessels yet</h3>
                <p className="text-muted-foreground mb-4">Add your first fermentation vessel</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Add Vessel
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {vessels.map(renderVesselCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <NewVesselDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
