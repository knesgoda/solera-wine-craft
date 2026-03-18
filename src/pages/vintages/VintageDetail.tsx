import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, FlaskConical, FileText, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";
import { NewLabSampleDialog } from "@/components/vintages/NewLabSampleDialog";
import { LabChart } from "@/components/vintages/LabChart";
import { TtbAdditionsTab } from "@/components/vintages/TtbAdditionsTab";

const statusLabels: Record<string, string> = {
  planned: "Planned", in_progress: "In Progress", harvested: "Harvested",
  in_cellar: "In Cellar", bottled: "Bottled", released: "Released",
};
const statusOrder = ["planned", "in_progress", "harvested", "in_cellar", "bottled", "released"];

export default function VintageDetail() {
  const { vintageId } = useParams<{ vintageId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization } = useAuth();
  const [labDialogOpen, setLabDialogOpen] = useState(false);

  const { data: vintage, isLoading } = useQuery({
    queryKey: ["vintage", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vintages")
        .select("*, blocks(name, vineyard_id, vineyards(name))")
        .eq("id", vintageId!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!vintageId,
  });

  const { data: labSamples = [] } = useQuery({
    queryKey: ["lab-samples", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_samples")
        .select("*")
        .eq("vintage_id", vintageId!)
        .order("sampled_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!vintageId,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("vintages")
        .update({ status: status as any })
        .eq("id", vintageId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vintage", vintageId] });
      queryClient.invalidateQueries({ queryKey: ["vintages"] });
      toast.success("Status updated");
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!vintage) {
    return <div className="p-6 text-center"><p className="text-muted-foreground">Vintage not found.</p></div>;
  }

  const currentIdx = statusOrder.indexOf(vintage.status);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-24 md:pb-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/vintages")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl">{vintage.year} Vintage</CardTitle>
            <Select value={vintage.status} onValueChange={(v) => updateStatus.mutate(v)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOrder.map((s) => (
                  <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {vintage.blocks && (
            <div className="text-sm">
              <span className="text-muted-foreground">Block:</span>{" "}
              <span className="font-medium text-foreground">{vintage.blocks.name}</span>
              {vintage.blocks.vineyards?.name && <span className="text-muted-foreground"> · {vintage.blocks.vineyards.name}</span>}
            </div>
          )}
          {vintage.harvest_date && (
            <div className="text-sm"><span className="text-muted-foreground">Harvest Date:</span> <span className="font-medium text-foreground">{format(parseISO(vintage.harvest_date), "MMMM d, yyyy")}</span></div>
          )}
          {vintage.tons_harvested != null && (
            <div className="text-sm"><span className="text-muted-foreground">Tons Harvested:</span> <span className="font-medium text-foreground">{vintage.tons_harvested}</span></div>
          )}
          {vintage.notes && (
            <div className="text-sm"><span className="text-muted-foreground">Notes:</span> <span className="text-foreground">{vintage.notes}</span></div>
          )}
        </CardContent>
      </Card>

      {/* Milestone Timeline */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg">Status Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-0 overflow-x-auto">
            {statusOrder.map((s, i) => {
              const reached = i <= currentIdx;
              return (
                <div key={s} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[70px]">
                    <div className={`h-4 w-4 rounded-full border-2 ${reached ? "bg-primary border-primary" : "bg-muted border-border"}`} />
                    <span className={`text-[10px] mt-1 text-center ${reached ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {statusLabels[s]}
                    </span>
                  </div>
                  {i < statusOrder.length - 1 && (
                    <div className={`h-0.5 w-6 ${i < currentIdx ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Lab Samples & TTB Additions */}
      <Tabs defaultValue="lab" className="space-y-4">
        <TabsList className="w-full">
          <TabsTrigger value="lab" className="flex-1 gap-2">
            <FlaskConical className="h-4 w-4" /> Lab Samples
          </TabsTrigger>
          <TabsTrigger value="additions" className="flex-1 gap-2">
            <FileText className="h-4 w-4" /> TTB Additions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lab">
          {/* Lab Chart */}
          {labSamples.length >= 2 && (
            <Card className="mb-4">
              <CardHeader><CardTitle className="text-lg">Lab Trends</CardTitle></CardHeader>
              <CardContent><LabChart samples={labSamples} /></CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Sample Log</CardTitle>
                <Button size="sm" onClick={() => setLabDialogOpen(true)}>Add Sample</Button>
              </div>
            </CardHeader>
            <CardContent>
              {labSamples.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No lab samples yet.</p>
              ) : (
                <div className="space-y-3">
                  {labSamples.map((s: any) => (
                    <div key={s.id} className="border border-border rounded-lg p-3">
                      <p className="text-sm font-medium text-foreground mb-1">
                        {format(parseISO(s.sampled_at), "MMM d, yyyy h:mm a")}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        {s.brix != null && <div><span className="text-muted-foreground">Brix:</span> {s.brix}°</div>}
                        {s.ph != null && <div><span className="text-muted-foreground">pH:</span> {s.ph}</div>}
                        {s.ta != null && <div><span className="text-muted-foreground">TA:</span> {s.ta}</div>}
                        {s.va != null && <div><span className="text-muted-foreground">VA:</span> {s.va}</div>}
                        {s.so2_free != null && <div><span className="text-muted-foreground">Free SO₂:</span> {s.so2_free}</div>}
                        {s.so2_total != null && <div><span className="text-muted-foreground">Total SO₂:</span> {s.so2_total}</div>}
                        {s.alcohol != null && <div><span className="text-muted-foreground">Alcohol:</span> {s.alcohol}%</div>}
                        {s.rs != null && <div><span className="text-muted-foreground">RS:</span> {s.rs}</div>}
                      </div>
                      {s.notes && <p className="text-sm text-muted-foreground mt-1">{s.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="additions">
          <TtbAdditionsTab
            vintageId={vintageId!}
            vintageYear={vintage.year}
            wineryName={organization?.name || "Winery"}
          />
        </TabsContent>
      </Tabs>

      <NewLabSampleDialog vintageId={vintageId!} open={labDialogOpen} onOpenChange={setLabDialogOpen} />
    </div>
  );
}
