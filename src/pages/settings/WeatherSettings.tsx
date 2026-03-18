import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, CloudSun, MapPin } from "lucide-react";
import { toast } from "sonner";

interface ConfigRow {
  id: string;
  vineyard_id: string;
  org_id: string;
  latitude: number | null;
  longitude: number | null;
  gdd_base_temp_f: number;
  active: boolean;
}

export default function WeatherSettings() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [backfilling, setBackfilling] = useState<string | null>(null);

  const { data: vineyards = [], isLoading: loadingV } = useQuery({
    queryKey: ["vineyards", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vineyards")
        .select("id, name, coordinates")
        .eq("org_id", organization!.id)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id,
  });

  const { data: configs = [], isLoading: loadingC } = useQuery({
    queryKey: ["weather-configs", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vineyard_weather_config")
        .select("*")
        .eq("org_id", organization!.id);
      if (error) throw error;
      return data as ConfigRow[];
    },
    enabled: !!organization?.id,
  });

  const configMap = new Map(configs.map((c) => [c.vineyard_id, c]));

  const saveConfig = useMutation({
    mutationFn: async (params: { vineyardId: string; lat: string; lng: string; baseTemp: string; active: boolean }) => {
      const existing = configMap.get(params.vineyardId);
      const payload: any = {
        org_id: organization!.id,
        vineyard_id: params.vineyardId,
        latitude: params.lat ? parseFloat(params.lat) : null,
        longitude: params.lng ? parseFloat(params.lng) : null,
        gdd_base_temp_f: params.baseTemp ? parseFloat(params.baseTemp) : 50,
        active: params.active,
      };

      if (existing) {
        const { error } = await supabase
          .from("vineyard_weather_config")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vineyard_weather_config")
          .insert(payload);
        if (error) throw error;
      }

      // If activating for the first time, trigger backfill
      if (params.active && (!existing || !existing.active)) {
        setBackfilling(params.vineyardId);
        try {
          await supabase.functions.invoke("fetch-weather", {
            body: { vineyard_id: params.vineyardId, backfill: true },
          });
          toast.success("Historical weather data backfilled");
        } catch (err: any) {
          console.error("Backfill error:", err);
          toast.error("Backfill failed — will retry on next daily run");
        } finally {
          setBackfilling(null);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weather-configs"] });
      queryClient.invalidateQueries({ queryKey: ["weather-readings"] });
      toast.success("Weather config saved");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const isLoading = loadingV || loadingC;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <CloudSun className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Weather Settings</h1>
      </div>

      <p className="text-muted-foreground mb-6">
        Configure weather data ingestion for each vineyard. Coordinates are pre-populated from your vineyard records.
        When activated, historical data from April 1 of the current season will be backfilled automatically.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : vineyards.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No vineyards found. Add vineyards first to configure weather.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {vineyards.map((v: any) => (
            <VineyardWeatherCard
              key={v.id}
              vineyard={v}
              config={configMap.get(v.id)}
              isBackfilling={backfilling === v.id}
              onSave={(lat, lng, baseTemp, active) =>
                saveConfig.mutate({ vineyardId: v.id, lat, lng, baseTemp, active })
              }
              isSaving={saveConfig.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VineyardWeatherCard({
  vineyard,
  config,
  isBackfilling,
  onSave,
  isSaving,
}: {
  vineyard: any;
  config?: ConfigRow;
  isBackfilling: boolean;
  onSave: (lat: string, lng: string, baseTemp: string, active: boolean) => void;
  isSaving: boolean;
}) {
  // Parse coordinates from vineyard if available
  const parsedCoords = vineyard.coordinates
    ? vineyard.coordinates.split(",").map((s: string) => s.trim())
    : [null, null];

  const [lat, setLat] = useState(config?.latitude?.toString() || parsedCoords[0] || "");
  const [lng, setLng] = useState(config?.longitude?.toString() || parsedCoords[1] || "");
  const [baseTemp, setBaseTemp] = useState(config?.gdd_base_temp_f?.toString() || "50");
  const [active, setActive] = useState(config?.active || false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg">{vineyard.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {config?.active && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
            )}
            {isBackfilling && (
              <Badge variant="secondary" className="bg-secondary/20 text-secondary">
                <Loader2 className="h-3 w-3 animate-spin mr-1" /> Backfilling…
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Latitude</Label>
            <Input type="number" step="0.0001" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="38.2975" />
          </div>
          <div>
            <Label>Longitude</Label>
            <Input type="number" step="0.0001" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-122.2869" />
          </div>
        </div>
        <div>
          <Label>GDD Base Temp (°F)</Label>
          <Input type="number" step="1" value={baseTemp} onChange={(e) => setBaseTemp(e.target.value)} className="w-32" />
        </div>
        <div className="flex items-center justify-between">
          <Label>Enable Weather Ingestion</Label>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
        <Button
          className="w-full min-h-[44px]"
          onClick={() => onSave(lat, lng, baseTemp, active)}
          disabled={isSaving || isBackfilling || !lat || !lng}
        >
          {(isSaving || isBackfilling) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isBackfilling ? "Backfilling historical data…" : "Save Config"}
        </Button>
      </CardContent>
    </Card>
  );
}
