import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Thermometer, Droplets, Wind, AlertTriangle, Snowflake, Sun } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  vineyardId: string;
}

export function WeatherTab({ vineyardId }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear();
  const april1 = `${currentYear}-04-01`;
  const fourteenDaysAgo = subDays(new Date(), 14).toISOString().slice(0, 10);

  // Check if weather config is active
  const { data: config } = useQuery({
    queryKey: ["weather-config", vineyardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vineyard_weather_config")
        .select("*")
        .eq("vineyard_id", vineyardId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Today's reading
  const { data: todayReading } = useQuery({
    queryKey: ["weather-today", vineyardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weather_readings")
        .select("*")
        .eq("vineyard_id", vineyardId)
        .eq("recorded_at", today)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!config?.active,
  });

  // GDD season data for chart
  const { data: seasonData = [] } = useQuery({
    queryKey: ["weather-season", vineyardId, april1],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weather_readings")
        .select("recorded_at, gdd_cumulative, gdd_daily")
        .eq("vineyard_id", vineyardId)
        .gte("recorded_at", april1)
        .lte("recorded_at", today)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!config?.active,
  });

  // Last 14 days
  const { data: recentReadings = [], isLoading } = useQuery({
    queryKey: ["weather-recent", vineyardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weather_readings")
        .select("*")
        .eq("vineyard_id", vineyardId)
        .gte("recorded_at", fourteenDaysAgo)
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!config?.active,
  });

  // Forecast days (next 3 days) for frost/heat alerts
  const { data: forecastDays = [] } = useQuery({
    queryKey: ["weather-forecast", vineyardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weather_readings")
        .select("recorded_at, temp_min_f, temp_max_f")
        .eq("vineyard_id", vineyardId)
        .gt("recorded_at", today)
        .order("recorded_at", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!config?.active,
  });

  if (!config?.active) {
    return (
      <Card className="border-dashed border-2 border-border">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Weather tracking is not enabled for this vineyard.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Go to Settings → Weather to activate.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const frostAlert = forecastDays.some((d: any) => d.temp_min_f != null && d.temp_min_f < 32);
  const heatAlert = forecastDays.some((d: any) => d.temp_max_f != null && d.temp_max_f > 95);

  const gddChartData = seasonData.map((d: any) => ({
    date: format(parseISO(d.recorded_at), "MMM d"),
    gdd: d.gdd_cumulative,
  }));

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {(frostAlert || heatAlert) && (
        <div className="flex flex-col gap-2">
          {frostAlert && (
            <Card className="border-blue-300 bg-blue-50">
              <CardContent className="p-3 flex items-center gap-2">
                <Snowflake className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Frost Alert: Low temperatures below 32°F expected in the next 3 days</span>
              </CardContent>
            </Card>
          )}
          {heatAlert && (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-800">Heat Event: Temperatures above 95°F expected in the next 3 days</span>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Current Conditions */}
      {todayReading && (
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Sun className="h-5 w-5" /> Today's Conditions</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <Thermometer className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold text-foreground">{todayReading.temp_max_f}°</p>
                <p className="text-sm text-muted-foreground">High</p>
              </div>
              <div className="text-center">
                <Thermometer className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                <p className="text-2xl font-bold text-foreground">{todayReading.temp_min_f}°</p>
                <p className="text-sm text-muted-foreground">Low</p>
              </div>
              <div className="text-center">
                <Droplets className="h-5 w-5 mx-auto text-blue-400 mb-1" />
                <p className="text-2xl font-bold text-foreground">{todayReading.precip_inches || 0}"</p>
                <p className="text-sm text-muted-foreground">Precip</p>
              </div>
              <div className="text-center">
                <Wind className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold text-foreground">{todayReading.wind_mph || 0}</p>
                <p className="text-sm text-muted-foreground">Wind (mph)</p>
              </div>
            </div>
            {todayReading.gdd_cumulative != null && (
              <div className="mt-4 pt-3 border-t border-border text-center">
                <p className="text-sm text-muted-foreground">Season GDD (from Apr 1)</p>
                <p className="text-3xl font-bold text-primary">{todayReading.gdd_cumulative}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* GDD Chart */}
      {gddChartData.length >= 2 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Cumulative GDD</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={gddChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="gdd" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Readings Table */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Last 14 Days</CardTitle></CardHeader>
        <CardContent>
          {recentReadings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No weather data yet. Data will appear after the daily ingestion runs.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>High</TableHead>
                    <TableHead>Low</TableHead>
                    <TableHead className="hidden sm:table-cell">Precip</TableHead>
                    <TableHead className="hidden sm:table-cell">Wind</TableHead>
                    <TableHead>GDD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentReadings.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{format(parseISO(r.recorded_at), "MMM d")}</TableCell>
                      <TableCell>{r.temp_max_f != null ? `${r.temp_max_f}°F` : "—"}</TableCell>
                      <TableCell>{r.temp_min_f != null ? `${r.temp_min_f}°F` : "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">{r.precip_inches != null ? `${r.precip_inches}"` : "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">{r.wind_mph != null ? `${r.wind_mph} mph` : "—"}</TableCell>
                      <TableCell>{r.gdd_daily != null ? r.gdd_daily : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
