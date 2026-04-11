import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, FlaskConical, FileText, AlertTriangle, MoreVertical, Pencil, Trash2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { FormattedDateTime } from "@/components/timezone";
import { useState } from "react";
import { NewLabSampleDialog, type LabSampleData } from "@/components/vintages/NewLabSampleDialog";
import { LabChart } from "@/components/vintages/LabChart";
import { LabChartWithComparison } from "@/components/vintages/LabChartWithComparison";
import { TtbAdditionsTab } from "@/components/vintages/TtbAdditionsTab";
import { AnomaliesTab } from "@/components/vintages/AnomaliesTab";
import { VintageCostsTab } from "@/components/costs/VintageCostsTab";
import { useTierGate } from "@/hooks/useTierGate";
import { DollarSign } from "lucide-react";

const statusLabels: Record<string, string> = {
  planned: "Planned", in_progress: "In Progress", harvested: "Harvested",
  in_cellar: "In Cellar", bottled: "Bottled", released: "Released",
};
const statusOrder = ["planned", "in_progress", "harvested", "in_cellar", "bottled", "released"];

export default function VintageDetail() {
  const { vintageId } = useParams<{ vintageId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization, profile } = useAuth();
  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [editingSample, setEditingSample] = useState<LabSampleData | null>(null);
  const [deletingSampleId, setDeletingSampleId] = useState<string | null>(null);
  const [isEditingVintage, setIsEditingVintage] = useState(false);
  const [showDeleteVintage, setShowDeleteVintage] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [editHarvestDate, setEditHarvestDate] = useState<Date | undefined>(undefined);
  const [editTons, setEditTons] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const orgId = profile?.org_id;
  const tierGate = useTierGate("mid_size");

  const deleteSample = useMutation({
    mutationFn: async (sampleId: string) => {
      const { error } = await supabase.from("lab_samples").delete().eq("id", sampleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-samples", vintageId] });
      toast.success("Lab sample deleted");
      setDeletingSampleId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const { data: vintage, isLoading } = useQuery({
    queryKey: ["vintage", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vintages")
        .select("*, blocks(id, name, variety, vineyard_id, vineyards(name))")
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

  const { data: clientOrgs = [] } = useQuery({
    queryKey: ["client-orgs-for-assign", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_orgs").select("id, name").eq("parent_org_id", orgId!).eq("active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const assignClient = useMutation({
    mutationFn: async (clientOrgId: string | null) => {
      const { error } = await supabase.from("vintages").update({ client_org_id: clientOrgId }).eq("id", vintageId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vintage", vintageId] });
      toast.success("Client assignment updated");
    },
  });

  const updateVintageDetails = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vintages").update({
        harvest_date: editHarvestDate ? format(editHarvestDate, "yyyy-MM-dd") : null,
        tons_harvested: editTons ? parseFloat(editTons) : null,
        notes: editNotes || null,
      } as any).eq("id", vintageId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vintage", vintageId] });
      queryClient.invalidateQueries({ queryKey: ["vintages"] });
      toast.success("Vintage updated");
      setIsEditingVintage(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteVintage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vintages").delete().eq("id", vintageId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vintages"] });
      toast.success("Vintage deleted");
      navigate("/vintages");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startEditingVintage = () => {
    setEditHarvestDate(vintage?.harvest_date ? parseISO(vintage.harvest_date) : undefined);
    setEditTons(vintage?.tons_harvested != null ? String(vintage.tons_harvested) : "");
    setEditNotes(vintage?.notes || "");
    setIsEditingVintage(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!vintage) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">This vintage isn't available offline.</p>
        <p className="text-sm text-muted-foreground mt-1">Connect to the internet to load vintage details.</p>
      </div>
    );
  }

  const currentIdx = statusOrder.indexOf(vintage.status);

  const handleStatusChange = (newStatus: string) => {
    const newIdx = statusOrder.indexOf(newStatus);
    if (newIdx < currentIdx) {
      setPendingStatus(newStatus);
      return;
    }
    updateStatus.mutate(newStatus);
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-24 md:pb-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/vintages")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl">{vintage.year} Vintage</CardTitle>
            <div className="flex items-center gap-2">
              {!isEditingVintage && (
                <Button variant="ghost" size="icon" onClick={startEditingVintage} className="h-9 w-9">
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setShowDeleteVintage(true)} className="h-9 w-9 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Select value={vintage.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOrder.map((s) => (
                    <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {isEditingVintage ? (
            <div className="space-y-3 pt-1">
              <div className="text-sm space-y-1">
                <span className="text-muted-foreground">Harvest Date</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editHarvestDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {editHarvestDate ? format(editHarvestDate, "MMMM d, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editHarvestDate} onSelect={setEditHarvestDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="text-sm space-y-1">
                <span className="text-muted-foreground">Tons Harvested</span>
                <Input type="number" step="0.1" value={editTons} onChange={(e) => setEditTons(e.target.value)} placeholder="e.g. 2.5" />
              </div>
              <div className="text-sm space-y-1">
                <span className="text-muted-foreground">Notes</span>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => updateVintageDetails.mutate()} disabled={updateVintageDetails.isPending}>
                  {updateVintageDetails.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditingVintage(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              {vintage.harvest_date && (
                <div className="text-sm"><span className="text-muted-foreground">Harvest Date:</span> <span className="font-medium text-foreground">{format(parseISO(vintage.harvest_date), "MMMM d, yyyy")}</span></div>
              )}
              {vintage.tons_harvested != null && (
                <div className="text-sm"><span className="text-muted-foreground">Tons Harvested:</span> <span className="font-medium text-foreground">{vintage.tons_harvested}</span></div>
              )}
              {vintage.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes:</span> <span className="text-foreground">{vintage.notes}</span></div>
              )}
            </>
          )}

          {clientOrgs.length > 0 && (
            <div className="text-sm pt-2 border-t">
              <span className="text-muted-foreground">Client Assignment:</span>
              <Select value={vintage.client_org_id || "none"} onValueChange={(v) => assignClient.mutate(v === "none" ? null : v)}>
                <SelectTrigger className="w-[200px] mt-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {clientOrgs.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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

      {/* Tabs for Lab Samples, TTB Additions, Costs */}
      <Tabs defaultValue="lab" className="space-y-4">
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="lab" className="flex-1 gap-2">
            <FlaskConical className="h-4 w-4" /> Lab
          </TabsTrigger>
          <TabsTrigger value="additions" className="flex-1 gap-2">
            <FileText className="h-4 w-4" /> TTB
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="flex-1 gap-2">
            <AlertTriangle className="h-4 w-4" /> Anomalies
          </TabsTrigger>
          {tierGate.allowed && (
            <TabsTrigger value="costs" className="flex-1 gap-2">
              <DollarSign className="h-4 w-4" /> Costs
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="lab">
          {labSamples.length >= 1 && (
            <Card className="mb-4">
              <CardHeader><CardTitle className="text-lg">Lab Trends</CardTitle></CardHeader>
              <CardContent>
                <LabChartWithComparison
                  vintageId={vintageId!}
                  blockId={vintage?.blocks?.id || null}
                  variety={vintage?.blocks?.variety || null}
                  orgId={orgId || ""}
                  currentSamples={labSamples}
                />
                {/* Fallback to original chart if comparison not applicable */}
                {labSamples.length >= 2 && !vintage?.block_id && (
                  <LabChart samples={labSamples} />
                )}
              </CardContent>
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
                    <div key={s.id} className="border border-border rounded-lg p-3 relative">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-foreground mb-1">
                          <FormattedDateTime date={s.sampled_at} format="short" />
                        </p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="min-w-[44px] min-h-[44px] flex items-center justify-center -mt-1 -mr-1 text-muted-foreground hover:text-foreground">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingSample(s); setLabDialogOpen(true); }}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeletingSampleId(s.id)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
            vintageYear={vintage?.year}
            wineryName={organization?.name || "Winery"}
          />
        </TabsContent>

        <TabsContent value="anomalies">
          <AnomaliesTab vintageId={vintageId!} />
        </TabsContent>

        {tierGate.allowed && (
          <TabsContent value="costs">
            <VintageCostsTab vintageId={vintageId!} />
          </TabsContent>
        )}
      </Tabs>


      <NewLabSampleDialog
        vintageId={vintageId!}
        open={labDialogOpen}
        onOpenChange={(open) => { setLabDialogOpen(open); if (!open) setEditingSample(null); }}
        editingSample={editingSample}
      />

      <AlertDialog open={!!deletingSampleId} onOpenChange={(open) => { if (!open) setDeletingSampleId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lab sample?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The sample data will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingSampleId && deleteSample.mutate(deletingSampleId)}
              disabled={deleteSample.isPending}
            >
              {deleteSample.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingStatus} onOpenChange={(open) => { if (!open) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse vintage status?</AlertDialogTitle>
            <AlertDialogDescription>
              Move this vintage back to &ldquo;{pendingStatus ? statusLabels[pendingStatus] : ""}&rdquo;? This will reverse its status timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingStatus) { updateStatus.mutate(pendingStatus); setPendingStatus(null); } }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteVintage} onOpenChange={setShowDeleteVintage}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this vintage?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also delete all associated lab samples, TTB additions, and anomaly flags. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteVintage.mutate()}
              disabled={deleteVintage.isPending}
            >
              {deleteVintage.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
