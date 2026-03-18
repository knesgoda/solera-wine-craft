import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FlaskConical, FileText, Beaker, Download, Loader2 } from "lucide-react";
import { LabChart } from "@/components/vintages/LabChart";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

export default function ClientVintageDetail() {
  const { vintageId } = useParams();
  const navigate = useNavigate();
  const [generatingCoa, setGeneratingCoa] = useState(false);

  const { data: vintage } = useQuery({
    queryKey: ["client-vintage", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vintages").select("*, blocks(name)").eq("id", vintageId!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!vintageId,
  });

  const { data: labSamples = [] } = useQuery({
    queryKey: ["client-lab-samples", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lab_samples").select("*").eq("vintage_id", vintageId!).order("sampled_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!vintageId,
  });

  const { data: additions = [] } = useQuery({
    queryKey: ["client-additions", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ttb_additions").select("*").eq("vintage_id", vintageId!).order("added_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!vintageId,
  });

  const { data: trials = [] } = useQuery({
    queryKey: ["client-trials", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase.from("blending_trials").select("*, blending_trial_lots(*)").eq("vintage_id", vintageId!).eq("finalized", true);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!vintageId,
  });

  const handleDownloadCoa = async () => {
    setGeneratingCoa(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-coa", { body: { vintage_id: vintageId } });
      if (error) throw error;
      if (data?.pdf_url) window.open(data.pdf_url, "_blank");
      toast.success("COA generated");
    } catch (e: any) { toast.error(e.message); }
    finally { setGeneratingCoa(false); }
  };

  if (!vintage) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/client/vintages")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-foreground">{vintage.year} Vintage</h1>
          <p className="text-sm text-muted-foreground">{vintage.blocks?.name || ""}</p>
        </div>
        <Badge variant="secondary" className="capitalize">{vintage.status}</Badge>
        <Button variant="outline" onClick={handleDownloadCoa} disabled={generatingCoa}>
          {generatingCoa ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}Download COA
        </Button>
      </div>

      <Tabs defaultValue="lab" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lab" className="gap-2"><FlaskConical className="h-4 w-4" />Lab Results</TabsTrigger>
          <TabsTrigger value="additions" className="gap-2"><FileText className="h-4 w-4" />Additions</TabsTrigger>
          <TabsTrigger value="blends" className="gap-2"><Beaker className="h-4 w-4" />Blends</TabsTrigger>
        </TabsList>

        <TabsContent value="lab">
          {labSamples.length >= 2 && (
            <Card className="mb-4 border-none shadow-md">
              <CardHeader><CardTitle className="font-display">Lab Trends</CardTitle></CardHeader>
              <CardContent><LabChart samples={labSamples} /></CardContent>
            </Card>
          )}
          <Card className="border-none shadow-md">
            <CardHeader><CardTitle className="font-display">Sample Log</CardTitle></CardHeader>
            <CardContent>
              {labSamples.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No lab samples yet.</p>
              ) : (
                <div className="space-y-3">
                  {labSamples.map((s: any) => (
                    <div key={s.id} className="border rounded-lg p-3">
                      <p className="text-sm font-medium mb-1">{format(parseISO(s.sampled_at), "MMM d, yyyy h:mm a")}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        {s.brix != null && <div><span className="text-muted-foreground">Brix:</span> {s.brix}°</div>}
                        {s.ph != null && <div><span className="text-muted-foreground">pH:</span> {s.ph}</div>}
                        {s.ta != null && <div><span className="text-muted-foreground">TA:</span> {s.ta}</div>}
                        {s.va != null && <div><span className="text-muted-foreground">VA:</span> {s.va}</div>}
                        {s.so2_free != null && <div><span className="text-muted-foreground">Free SO₂:</span> {s.so2_free}</div>}
                        {s.alcohol != null && <div><span className="text-muted-foreground">Alc:</span> {s.alcohol}%</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="additions">
          <Card className="border-none shadow-md">
            <CardHeader><CardTitle className="font-display">TTB Additions</CardTitle></CardHeader>
            <CardContent>
              {additions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No additions recorded.</p>
              ) : (
                <div className="space-y-2">
                  {additions.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                      <div><span className="font-medium capitalize">{a.addition_type}</span> · {a.amount} {a.unit}</div>
                      <span className="text-muted-foreground">{format(parseISO(a.added_at), "MMM d, yyyy")}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blends">
          <Card className="border-none shadow-md">
            <CardHeader><CardTitle className="font-display">Finalized Blends</CardTitle></CardHeader>
            <CardContent>
              {trials.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No finalized blends yet.</p>
              ) : (
                <div className="space-y-3">
                  {trials.map((t: any) => (
                    <div key={t.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{t.name}</span>
                        {t.stars && <span className="text-sm">{"★".repeat(t.stars)}</span>}
                      </div>
                      {t.notes && <p className="text-sm text-muted-foreground">{t.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
