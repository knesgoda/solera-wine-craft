import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, TrendingUp, Calendar, Thermometer, Star } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CaliforniaMap } from "@/components/analytics/CaliforniaMap";
import { toast } from "sonner";

interface AnalogMatch {
  year: number;
  region: string;
  gddTotal: number;
  harvestDate: string | null;
  rating: number | null;
  ratingSource: string | null;
  notes: string | null;
  similarityScore: number;
}

export default function AnalogExplorer() {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const [selectedVintageId, setSelectedVintageId] = useState<string>("");
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  // Fetch active vintages
  const { data: vintages = [] } = useQuery({
    queryKey: ["vintages-active", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vintages")
        .select("*, blocks(name, variety, vineyard_id, vineyards:vineyard_id(name, region))")
        .in("status", ["planned", "in_progress", "harvested", "in_cellar"])
        .order("year", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch analog vintages
  const { data: analogVintages = [] } = useQuery({
    queryKey: ["analog-vintages", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("analog_vintages")
        .select("*")
        .order("year", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });

  // Fetch weather readings for selected vintage
  const selectedVintage = vintages.find((v: any) => v.id === selectedVintageId);
  const vineyardId = (selectedVintage as any)?.blocks?.vineyard_id;

  const { data: weatherReadings = [] } = useQuery({
    queryKey: ["weather-for-analog", vineyardId, selectedVintage?.year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weather_readings")
        .select("*")
        .eq("vineyard_id", vineyardId)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!vineyardId,
  });

  // Fetch latest lab samples for Brix
  const { data: labSamples = [] } = useQuery({
    queryKey: ["lab-for-analog", selectedVintageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_samples")
        .select("*")
        .eq("vintage_id", selectedVintageId)
        .order("sampled_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedVintageId,
  });

  // Calculate current season GDD
  const currentGdd = useMemo(() => {
    if (!weatherReadings.length) return 0;
    const yearReadings = weatherReadings.filter((w: any) => {
      const d = new Date(w.recorded_at);
      return d.getFullYear() === (selectedVintage?.year || new Date().getFullYear());
    });
    if (yearReadings.length === 0) return 0;
    const last = yearReadings[yearReadings.length - 1] as any;
    return Number(last.gdd_cumulative) || yearReadings.reduce((sum: number, w: any) => sum + (Number(w.gdd_daily) || 0), 0);
  }, [weatherReadings, selectedVintage]);

  const currentBrix = labSamples.length > 0 ? Number((labSamples[0] as any).brix) || null : null;

  // Get region from vineyard
  const vintageRegion = (selectedVintage as any)?.blocks?.vineyards?.region || "Napa Valley";

  // Analog matching algorithm
  const analogMatches = useMemo((): AnalogMatch[] => {
    if (!selectedVintageId || analogVintages.length === 0) return [];

    const matches = analogVintages.map((av: any) => {
      // GDD similarity (50%) — closer GDD = higher score
      const gddDiff = Math.abs((av.gdd_total || 0) - currentGdd);
      const maxGddDiff = 1500;
      const gddScore = Math.max(0, 1 - gddDiff / maxGddDiff);

      // Harvest date proximity (30%) — compare day-of-year
      let harvestScore = 0.5;
      if (av.harvest_date && selectedVintage?.harvest_date) {
        const analogDay = new Date(av.harvest_date).getTime();
        const currentDay = new Date(selectedVintage.harvest_date).getTime();
        const dayDiff = Math.abs(differenceInDays(analogDay, currentDay));
        harvestScore = Math.max(0, 1 - dayDiff / 60);
      } else if (av.harvest_date) {
        // Project from GDD trajectory
        harvestScore = 0.5;
      }

      // Brix proximity (20%)
      let brixScore = 0.5;
      if (currentBrix && av.rating) {
        // Use rating as proxy for quality/Brix at harvest
        const brixDiff = Math.abs(currentBrix - 24);
        brixScore = Math.max(0, 1 - brixDiff / 10);
      }

      const totalScore = gddScore * 0.5 + harvestScore * 0.3 + brixScore * 0.2;

      return {
        year: av.year,
        region: av.region,
        gddTotal: av.gdd_total || 0,
        harvestDate: av.harvest_date,
        rating: av.rating,
        ratingSource: av.rating_source,
        notes: av.notes,
        similarityScore: Math.round(totalScore * 100),
      };
    });

    return matches.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 3);
  }, [analogVintages, selectedVintageId, currentGdd, currentBrix, selectedVintage]);

  // GDD chart data: current season vs top analog
  const chartData = useMemo(() => {
    if (!weatherReadings.length || analogMatches.length === 0) return [];

    const currentYear = selectedVintage?.year || new Date().getFullYear();
    const yearReadings = weatherReadings.filter((w: any) => {
      const d = new Date(w.recorded_at);
      return d.getFullYear() === currentYear && d.getMonth() >= 3; // April onward
    });

    const topAnalog = analogMatches[0];
    const analogGddPerDay = topAnalog.gddTotal / 180; // Approximate over growing season

    return yearReadings.map((w: any, idx: number) => ({
      date: format(new Date(w.recorded_at), "MMM d"),
      current: Math.round(Number(w.gdd_cumulative) || 0),
      analog: Math.round(analogGddPerDay * (idx + 1)),
    }));
  }, [weatherReadings, analogMatches, selectedVintage]);

  // Fetch AI insight
  const fetchInsight = async () => {
    if (analogMatches.length === 0) return;
    setInsightLoading(true);
    setAiInsight(null);
    try {
      const top = analogMatches[0];
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analog-insight`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          analogYear: top.year,
          analogRegion: top.region,
          analogGdd: top.gddTotal,
          analogRating: top.rating,
          currentVintageYear: selectedVintage?.year,
          currentGdd,
          similarityScore: top.similarityScore,
          varietyName: (selectedVintage as any)?.blocks?.variety,
        }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate insight");
      }
      const result = await resp.json();
      setAiInsight(result.insight);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate insight");
    } finally {
      setInsightLoading(false);
    }
  };

  const vintageLabel = (v: any) => {
    const block = v.blocks;
    return `${v.year} ${block?.variety || ""} — ${block?.name || "Unknown Block"}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Vintage Analog Explorer</h1>
          <p className="text-muted-foreground text-sm mt-1">Compare your current vintage to historical analogs</p>
        </div>

        <Select value={selectedVintageId} onValueChange={(v) => { setSelectedVintageId(v); setAiInsight(null); }}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select a vintage..." />
          </SelectTrigger>
          <SelectContent>
            {vintages.map((v: any) => (
              <SelectItem key={v.id} value={v.id}>{vintageLabel(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedVintageId ? (
        <Card>
          <CardContent className="py-16 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">Select a vintage above to find historical analogs</p>
          </CardContent>
        </Card>
      ) : analogVintages.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Star className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground mb-2">No analog vintage data available</p>
            <p className="text-xs text-muted-foreground">Enable rating sources in Settings → Ratings to import historical data</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Current vintage stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Season GDD</p>
                <p className="text-2xl font-bold text-foreground">{currentGdd.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Brix</p>
                <p className="text-2xl font-bold text-foreground">{currentBrix ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Region</p>
                <p className="text-lg font-semibold text-foreground truncate">{vintageRegion}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Harvest Date</p>
                <p className="text-lg font-semibold text-foreground">
                  {selectedVintage?.harvest_date ? format(parseISO(selectedVintage.harvest_date), "MMM d") : "Projected"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top 3 analog matches */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analogMatches.map((match, i) => (
              <Card key={`${match.year}-${match.region}`} className={i === 0 ? "ring-2 ring-accent" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-display">{match.year}</CardTitle>
                    <Badge variant={i === 0 ? "default" : "outline"} className="text-xs">
                      {match.similarityScore}% match
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{match.region}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Thermometer className="h-3 w-3" /> GDD Total</span>
                    <span className="font-medium">{match.gddTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Harvest</span>
                    <span className="font-medium">{match.harvestDate ? format(parseISO(match.harvestDate), "MMM d") : "—"}</span>
                  </div>
                  {match.rating && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3" /> Rating</span>
                      <span className="font-medium">{match.rating}/100</span>
                    </div>
                  )}
                  {match.notes && <p className="text-xs text-muted-foreground italic mt-1">{match.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* GDD Chart + Map */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            {/* GDD accumulation chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">GDD Accumulation: Current vs Top Analog ({analogMatches[0]?.year})</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="current" stroke="hsl(348, 58%, 26%)" strokeWidth={2} dot={false} name={`${selectedVintage?.year} (Current)`} />
                      <Line type="monotone" dataKey="analog" stroke="hsl(36, 64%, 47%)" strokeWidth={2} strokeDasharray="5 5" dot={false} name={`${analogMatches[0]?.year} (Analog)`} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                    No weather data available for chart
                  </div>
                )}
              </CardContent>
            </Card>

            {/* California map */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Region Match</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <CaliforniaMap highlightedRegion={analogMatches[0]?.region} />
              </CardContent>
            </Card>
          </div>

          {/* AI Insight */}
          <Card className="border-accent/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  AI Insight
                  <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" /> AI</Badge>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={fetchInsight}
                  disabled={insightLoading || analogMatches.length === 0}
                >
                  {insightLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  Generate Insight
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {aiInsight ? (
                <p className="text-sm text-foreground leading-relaxed">{aiInsight}</p>
              ) : insightLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyzing analog data...
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Click "Generate Insight" to get AI analysis of your analog match</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
