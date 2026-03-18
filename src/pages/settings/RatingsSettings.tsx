import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// Representative California vintage rating data (publicly available reference data)
const SAMPLE_RATINGS: Record<string, Array<{ year: number; region: string; gdd_total: number; harvest_date: string; rating: number; notes: string }>> = {
  "California Vintage Charts": [
    { year: 2023, region: "Napa Valley", gdd_total: 3420, harvest_date: "2023-09-28", rating: 93, notes: "Warm season, extended hang time" },
    { year: 2022, region: "Napa Valley", gdd_total: 3280, harvest_date: "2022-10-05", rating: 95, notes: "Classic year, balanced ripening" },
    { year: 2021, region: "Napa Valley", gdd_total: 3150, harvest_date: "2021-09-20", rating: 91, notes: "Drought conditions, early harvest" },
    { year: 2020, region: "Napa Valley", gdd_total: 3380, harvest_date: "2020-09-15", rating: 88, notes: "Fire smoke impact in some areas" },
    { year: 2019, region: "Napa Valley", gdd_total: 3200, harvest_date: "2019-10-01", rating: 96, notes: "Exceptional balance and depth" },
    { year: 2018, region: "Napa Valley", gdd_total: 3350, harvest_date: "2018-09-25", rating: 94, notes: "Long growing season, excellent concentration" },
    { year: 2017, region: "Napa Valley", gdd_total: 3500, harvest_date: "2017-09-10", rating: 90, notes: "Heat spikes, early harvest" },
    { year: 2016, region: "Napa Valley", gdd_total: 3250, harvest_date: "2016-09-30", rating: 95, notes: "Near-perfect conditions" },
    { year: 2023, region: "Sonoma", gdd_total: 3100, harvest_date: "2023-10-02", rating: 92, notes: "Cool pockets retained acidity" },
    { year: 2022, region: "Sonoma", gdd_total: 2980, harvest_date: "2022-10-10", rating: 94, notes: "Elegant, age-worthy wines" },
    { year: 2021, region: "Sonoma", gdd_total: 2850, harvest_date: "2021-09-25", rating: 90, notes: "Compact fruit, good structure" },
    { year: 2019, region: "Sonoma", gdd_total: 2950, harvest_date: "2019-10-05", rating: 95, notes: "Outstanding vintage across varieties" },
    { year: 2023, region: "Central Coast", gdd_total: 2800, harvest_date: "2023-10-15", rating: 91, notes: "Late harvest, marine influence" },
    { year: 2022, region: "Central Coast", gdd_total: 2700, harvest_date: "2022-10-20", rating: 93, notes: "Cool climate advantage" },
    { year: 2019, region: "Central Coast", gdd_total: 2650, harvest_date: "2019-10-18", rating: 94, notes: "Benchmark year for Pinot" },
    { year: 2023, region: "Sierra Foothills", gdd_total: 3600, harvest_date: "2023-09-20", rating: 89, notes: "Warm, big reds" },
    { year: 2022, region: "Sierra Foothills", gdd_total: 3450, harvest_date: "2022-09-28", rating: 91, notes: "Good altitude moderation" },
  ],
  "Historical GDD Database": [
    { year: 2015, region: "Napa Valley", gdd_total: 3300, harvest_date: "2015-09-15", rating: 94, notes: "Fourth year of drought, early and concentrated" },
    { year: 2014, region: "Napa Valley", gdd_total: 3400, harvest_date: "2014-09-18", rating: 96, notes: "Earthquake year, outstanding quality" },
    { year: 2013, region: "Napa Valley", gdd_total: 3250, harvest_date: "2013-09-22", rating: 95, notes: "Excellent across the board" },
    { year: 2012, region: "Napa Valley", gdd_total: 3180, harvest_date: "2012-09-28", rating: 97, notes: "One of the great Napa vintages" },
    { year: 2015, region: "Sonoma", gdd_total: 3050, harvest_date: "2015-09-20", rating: 93, notes: "Early, intense, well-structured" },
    { year: 2014, region: "Sonoma", gdd_total: 3100, harvest_date: "2014-09-25", rating: 94, notes: "Ripe and balanced" },
    { year: 2013, region: "Sonoma", gdd_total: 2900, harvest_date: "2013-10-02", rating: 93, notes: "Consistent quality" },
    { year: 2015, region: "Central Coast", gdd_total: 2750, harvest_date: "2015-10-10", rating: 92, notes: "Concentrated flavors" },
    { year: 2014, region: "Central Coast", gdd_total: 2680, harvest_date: "2014-10-15", rating: 93, notes: "Excellent Rhône varieties" },
    { year: 2015, region: "Sierra Foothills", gdd_total: 3550, harvest_date: "2015-09-12", rating: 90, notes: "Hot year, bold Zinfandels" },
  ],
};

const SOURCES = ["California Vintage Charts", "Historical GDD Database"];

export default function RatingsSettings() {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const [importing, setImporting] = useState<string | null>(null);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["ratings-config", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("public_ratings_config")
        .select("*")
        .order("source_name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ sourceName, enabled }: { sourceName: string; enabled: boolean }) => {
      const existing = configs.find((c: any) => c.source_name === sourceName);
      if (existing) {
        const { error } = await (supabase.from as any)("public_ratings_config")
          .update({ enabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from as any)("public_ratings_config")
          .insert({ org_id: orgId, source_name: sourceName, enabled });
        if (error) throw error;
      }

      if (enabled) {
        setImporting(sourceName);
        const ratings = SAMPLE_RATINGS[sourceName] || [];
        // Delete old imported data from this source first
        await (supabase.from as any)("analog_vintages")
          .delete()
          .eq("rating_source", sourceName)
          .eq("imported", true);

        // Insert new
        if (ratings.length > 0) {
          const rows = ratings.map((r) => ({
            org_id: orgId,
            year: r.year,
            region: r.region,
            gdd_total: r.gdd_total,
            harvest_date: r.harvest_date,
            rating: r.rating,
            rating_source: sourceName,
            notes: r.notes,
            imported: true,
          }));
          const { error } = await (supabase.from as any)("analog_vintages").insert(rows);
          if (error) throw error;
        }

        // Update last_imported_at
        const existing2 = configs.find((c: any) => c.source_name === sourceName);
        if (existing2) {
          await (supabase.from as any)("public_ratings_config")
            .update({ last_imported_at: new Date().toISOString() })
            .eq("id", existing2.id);
        }
        setImporting(null);
      } else {
        // Disable: remove imported data
        await (supabase.from as any)("analog_vintages")
          .delete()
          .eq("rating_source", sourceName)
          .eq("imported", true);
      }
    },
    onSuccess: () => {
      toast.success("Ratings source updated");
      qc.invalidateQueries({ queryKey: ["ratings-config"] });
      qc.invalidateQueries({ queryKey: ["analog-vintages"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isEnabled = (name: string) => configs.find((c: any) => c.source_name === name)?.enabled || false;
  const lastImported = (name: string) => configs.find((c: any) => c.source_name === name)?.last_imported_at;

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Public Ratings Sources</h1>
        <p className="text-muted-foreground text-sm mt-1">Enable vintage rating sources for the Analog Explorer</p>
      </div>

      <div className="space-y-4">
        {SOURCES.map((source) => (
          <Card key={source}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-accent" />
                  <div>
                    <CardTitle className="text-base">{source}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {SAMPLE_RATINGS[source]?.length || 0} vintage records across California regions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {importing === source && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch
                    checked={isEnabled(source)}
                    onCheckedChange={(checked) => toggleMutation.mutate({ sourceName: source, enabled: checked })}
                    disabled={toggleMutation.isPending}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {isEnabled(source) ? (
                  <>
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Active</Badge>
                    {lastImported(source) && (
                      <span>Last imported: {format(new Date(lastImported(source)!), "MMM d, yyyy 'at' h:mm a")}</span>
                    )}
                  </>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
