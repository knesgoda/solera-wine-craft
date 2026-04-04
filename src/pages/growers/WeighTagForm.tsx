import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { SEOHead } from "@/components/SEOHead";

interface MetricEntry {
  metric_id: string;
  metric_name: string;
  metric_key: string;
  unit: string;
  direction: string;
  measured_value: string;
  matched_tier_id: string | null;
  matched_tier_label: string;
  price_adjustment: number;
  is_reject: boolean;
  tiers: any[];
}

function matchTier(value: number, tiers: any[]): { tier_id: string | null; label: string; adjustment: number; is_reject: boolean } {
  for (const t of tiers) {
    const min = t.min_value != null ? Number(t.min_value) : -Infinity;
    const max = t.max_value != null ? Number(t.max_value) : Infinity;
    if (value >= min && value < max) {
      return { tier_id: t.id, label: t.tier_label, adjustment: Number(t.price_adjustment) || 0, is_reject: t.is_reject || false };
    }
  }
  return { tier_id: null, label: "No matching tier", adjustment: 0, is_reject: false };
}

export default function WeighTagForm() {
  const [searchParams] = useSearchParams();
  const prefilledContractId = searchParams.get("contract_id") || "";
  const navigate = useNavigate();
  const { organization, user } = useAuth();
  const queryClient = useQueryClient();

  const [contractId, setContractId] = useState(prefilledContractId);
  const [tagNumber, setTagNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [blockId, setBlockId] = useState("");
  const [vintageId, setVintageId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [tareWeight, setTareWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [metricEntries, setMetricEntries] = useState<MetricEntry[]>([]);
  const [recordAnother, setRecordAnother] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  const { data: activeContracts = [] } = useQuery({
    queryKey: ["active-contracts-intake", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grower_contracts")
        .select("id, contract_number, grower_id, growers(name), base_price_per_unit, pricing_unit, max_tons, total_delivered_tons, estimated_tons")
        .eq("org_id", organization!.id)
        .eq("status", "active" as any)
        .order("contract_number");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const selectedContract = activeContracts.find((c: any) => c.id === contractId);

  const { data: contractBlocks = [] } = useQuery({
    queryKey: ["contract-blocks-intake", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_block_assignments")
        .select("block_id, blocks(id, name, variety)")
        .eq("contract_id", contractId);
      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });

  const { data: gradingScale } = useQuery({
    queryKey: ["contract-grading-intake", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grading_scales")
        .select("*, grading_scale_metrics(*, grading_scale_tiers(*))")
        .eq("contract_id", contractId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });

  const { data: vintages = [] } = useQuery({
    queryKey: ["vintages-dropdown", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vintages")
        .select("id, name, year")
        .eq("org_id", organization!.id)
        .order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  useEffect(() => {
    if (gradingScale?.grading_scale_metrics) {
      const sorted = [...gradingScale.grading_scale_metrics].sort((a: any, b: any) => a.sort_order - b.sort_order);
      setMetricEntries(sorted.map((m: any) => ({
        metric_id: m.id,
        metric_name: m.metric_name,
        metric_key: m.metric_key,
        unit: m.unit || "",
        direction: m.direction,
        measured_value: "",
        matched_tier_id: null,
        matched_tier_label: "",
        price_adjustment: 0,
        is_reject: false,
        tiers: (m.grading_scale_tiers || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      })));
    } else {
      setMetricEntries([]);
    }
  }, [gradingScale]);

  const grossNum = parseFloat(grossWeight) || 0;
  const tareNum = parseFloat(tareWeight) || 0;
  const netWeight = grossNum - tareNum;
  const netTons = netWeight / 2000;
  const weightError = grossWeight && tareWeight && grossNum <= tareNum;

  const updateMetricValue = (idx: number, value: string) => {
    const entries = [...metricEntries];
    entries[idx] = { ...entries[idx], measured_value: value };
    const numVal = parseFloat(value);
    if (!isNaN(numVal) && entries[idx].tiers.length > 0) {
      const result = matchTier(numVal, entries[idx].tiers);
      entries[idx].matched_tier_id = result.tier_id;
      entries[idx].matched_tier_label = result.label;
      entries[idx].price_adjustment = result.adjustment;
      entries[idx].is_reject = result.is_reject;
    } else {
      entries[idx].matched_tier_id = null;
      entries[idx].matched_tier_label = "";
      entries[idx].price_adjustment = 0;
      entries[idx].is_reject = false;
    }
    setMetricEntries(entries);
  };

  const hasGrading = gradingScale && metricEntries.length > 0;
  const allMetricsFilled = metricEntries.every((m) => m.measured_value !== "");
  const anyReject = metricEntries.some((m) => m.is_reject);
  const rejectMetrics = metricEntries.filter((m) => m.is_reject);
  const totalAdjustment = metricEntries.reduce((sum, m) => sum + (m.is_reject ? 0 : m.price_adjustment), 0);
  const basePrice = Number(selectedContract?.base_price_per_unit) || 0;
  const finalPrice = basePrice + totalAdjustment;
  const totalValue = finalPrice * netTons;

  // Max tons warning
  const maxTonsExceeded = selectedContract?.max_tons && netTons > 0 &&
    (Number(selectedContract.total_delivered_tons || 0) + netTons) > Number(selectedContract.max_tons);

  const validate = async () => {
    if (!contractId) { toast({ title: "Contract is required", variant: "destructive" }); return false; }
    if (!grossWeight || grossNum <= 0) { toast({ title: "Gross weight is required", variant: "destructive" }); return false; }
    if (!tareWeight || tareNum <= 0) { toast({ title: "Tare weight is required", variant: "destructive" }); return false; }
    if (grossNum <= tareNum) { toast({ title: "Gross weight must exceed tare weight", variant: "destructive" }); return false; }
    if (hasGrading) {
      for (const m of metricEntries) {
        if (!m.measured_value || isNaN(parseFloat(m.measured_value))) {
          toast({ title: `${m.metric_name} value is required`, variant: "destructive" });
          return false;
        }
      }
    }
    // Duplicate check
    if (!duplicateConfirmed && selectedContract) {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      const { data: dupes } = await supabase
        .from("weigh_tags")
        .select("tag_number, net_tons, created_at")
        .eq("grower_id", selectedContract.grower_id)
        .eq("delivery_date", deliveryDate)
        .eq("gross_weight_lbs", grossNum)
        .gte("created_at", yesterday.toISOString())
        .limit(1);
      if (dupes && dupes.length > 0) {
        const d = dupes[0] as any;
        const hoursAgo = Math.round((Date.now() - new Date(d.created_at).getTime()) / 3600000);
        setDuplicateWarning(`A similar delivery was recorded ${hoursAgo}h ago (${d.tag_number}, ${Number(d.net_tons).toFixed(2)} tons). Are you sure this is a new delivery?`);
        return false;
      }
    }
    return true;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const isGraded = hasGrading && allMetricsFilled;

      const { data: wtData, error: wtError } = await supabase
        .from("weigh_tags")
        .insert({
          org_id: organization!.id,
          contract_id: contractId,
          grower_id: selectedContract!.grower_id,
          tag_number: tagNumber || undefined,
          vintage_id: vintageId || null,
          block_id: blockId || null,
          delivery_date: deliveryDate,
          truck_id: truckId || null,
          driver_name: driverName || null,
          gross_weight_lbs: grossNum,
          tare_weight_lbs: tareNum,
          total_price_adjustment: isGraded ? totalAdjustment : 0,
          final_price_per_unit: isGraded ? finalPrice : null,
          total_value: isGraded ? totalValue : null,
          is_rejected: anyReject,
          rejection_reason: anyReject ? rejectMetrics.map((m) => `${m.metric_name}: ${m.measured_value}${m.unit}`).join("; ") : null,
          status: (isGraded ? "graded" : "pending") as any,
          notes: notes || null,
          graded_at: isGraded ? new Date().toISOString() : null,
          graded_by: isGraded ? user?.id : null,
          created_by: user?.id,
        })
        .select("id, tag_number")
        .single();

      if (wtError) throw wtError;

      if (isGraded && metricEntries.length > 0) {
        const { error: meError } = await supabase
          .from("weigh_tag_metrics")
          .insert(
            metricEntries.map((m) => ({
              org_id: organization!.id,
              weigh_tag_id: wtData.id,
              metric_id: m.metric_id,
              measured_value: parseFloat(m.measured_value),
              matched_tier_id: m.matched_tier_id,
              price_adjustment: m.price_adjustment,
              is_reject: m.is_reject,
            }))
          );
        if (meError) throw meError;
      }

      return wtData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["weigh-tags"] });
      queryClient.invalidateQueries({ queryKey: ["contract-detail"] });
      queryClient.invalidateQueries({ queryKey: ["contract-weigh-tags"] });
      queryClient.invalidateQueries({ queryKey: ["grower-contracts"] });
      const tons = netTons.toFixed(2);
      toast({
        title: `Delivery recorded: ${data.tag_number}`,
        description: `${tons} tons${hasGrading ? ` at $${finalPrice.toLocaleString()}/ton` : ""}`,
      });

      if (recordAnother) {
        setTagNumber("");
        setBlockId("");
        setGrossWeight("");
        setTareWeight("");
        setNotes("");
        setDriverName("");
        setTruckId("");
        setMetricEntries((prev) => prev.map((m) => ({ ...m, measured_value: "", matched_tier_id: null, matched_tier_label: "", price_adjustment: 0, is_reject: false })));
        setDirty(false);
      } else {
        navigate(`/growers/intake/${data.id}`);
      }
    },
    onError: (err: any) => {
      toast({ title: "Error saving delivery", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto" onChange={() => setDirty(true)}>
      <SEOHead title="Record Delivery | Solera" description="Record a new fruit delivery" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/growers">Growers</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/growers/intake">Intake</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Record Delivery</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="text-2xl font-display font-bold">Record Delivery</h1>

      <Card>
        <CardHeader><CardTitle>Delivery Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Contract *</Label>
              <Select value={contractId} onValueChange={(v) => { setContractId(v); setBlockId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select active contract" /></SelectTrigger>
                <SelectContent>
                  {activeContracts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contract_number}: {c.growers?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedContract && (
              <div>
                <Label>Grower</Label>
                <Input value={selectedContract.growers?.name || ""} disabled className="bg-muted" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tag Number</Label>
              <Input value={tagNumber} onChange={(e) => setTagNumber(e.target.value)} placeholder="Auto-generated if blank" />
            </div>
            <div>
              <Label>Delivery Date</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div>
              <Label>Block</Label>
              <Select value={blockId} onValueChange={setBlockId}>
                <SelectTrigger><SelectValue placeholder="Select block" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {contractBlocks.map((cb: any) => (
                    <SelectItem key={cb.block_id} value={cb.block_id}>
                      {cb.blocks?.name} {cb.blocks?.variety ? `(${cb.blocks.variety})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Vintage</Label>
              <Select value={vintageId} onValueChange={setVintageId}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {vintages.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.name} ({v.year})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Truck ID</Label>
              <Input value={truckId} onChange={(e) => setTruckId(e.target.value)} />
            </div>
            <div>
              <Label>Driver Name</Label>
              <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Weights</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Gross Weight (lbs) *</Label>
              <Input type="number" step="1" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} placeholder="e.g. 48000" />
            </div>
            <div>
              <Label>Tare Weight (lbs) *</Label>
              <Input type="number" step="1" value={tareWeight} onChange={(e) => setTareWeight(e.target.value)} placeholder="e.g. 28000" />
            </div>
            <div>
              <Label>Net Weight (lbs)</Label>
              <Input value={netWeight > 0 ? netWeight.toLocaleString() : "—"} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Net Tons</Label>
              <Input value={netTons > 0 ? netTons.toFixed(4) : "—"} disabled className="bg-muted font-bold" />
            </div>
          </div>
          {weightError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Gross weight must be greater than tare weight.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {hasGrading && (
        <Card>
          <CardHeader><CardTitle>Quality Metrics — {gradingScale?.name}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metricEntries.map((m, i) => (
                <div key={m.metric_id} className="border rounded-lg p-4 space-y-2">
                  <Label className="font-semibold">{m.metric_name} {m.unit && <span className="text-muted-foreground">({m.unit})</span>}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={m.measured_value}
                    onChange={(e) => updateMetricValue(i, e.target.value)}
                    placeholder={`Enter ${m.metric_name}`}
                  />
                  {m.measured_value && m.matched_tier_label && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Tier:</span>
                      <Badge
                        variant={m.is_reject ? "destructive" : "secondary"}
                        className={m.is_reject ? "" : m.price_adjustment > 0 ? "bg-green-100 text-green-800" : m.price_adjustment < 0 ? "bg-amber-100 text-amber-800" : ""}
                      >
                        {m.matched_tier_label}
                      </Badge>
                      {!m.is_reject && (
                        <span className={m.price_adjustment > 0 ? "text-green-600 font-medium" : m.price_adjustment < 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {m.price_adjustment >= 0 ? "+" : ""}${m.price_adjustment}/ton
                        </span>
                      )}
                    </div>
                  )}
                  {m.is_reject && (
                    <Alert variant="destructive" className="py-2">
                      <AlertTriangle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        REJECT — {m.metric_name} is {m.measured_value}{m.unit}, below minimum acceptable grade.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>

            {allMetricsFilled && netTons > 0 && (
              <Card className={anyReject ? "border-destructive" : "border-green-300"}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {anyReject ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    Grade Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Metric</TableHead>
                          <TableHead className="text-xs">Value</TableHead>
                          <TableHead className="text-xs">Tier</TableHead>
                          <TableHead className="text-xs text-right">Adjustment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metricEntries.map((m) => (
                          <TableRow key={m.metric_id}>
                            <TableCell className="text-sm">{m.metric_name}</TableCell>
                            <TableCell className="text-sm">{m.measured_value}{m.unit}</TableCell>
                            <TableCell>
                              <Badge variant={m.is_reject ? "destructive" : "secondary"} className="text-xs">
                                {m.matched_tier_label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {m.is_reject ? "REJECT" : (
                                <span className={m.price_adjustment > 0 ? "text-green-600" : m.price_adjustment < 0 ? "text-destructive" : ""}>
                                  {m.price_adjustment >= 0 ? "+" : ""}${m.price_adjustment}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Base Price</p>
                      <p className="font-bold">${basePrice.toLocaleString()}/ton</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Adjustment</p>
                      <p className={`font-bold ${totalAdjustment > 0 ? "text-green-600" : totalAdjustment < 0 ? "text-destructive" : ""}`}>
                        {totalAdjustment >= 0 ? "+" : ""}${totalAdjustment.toLocaleString()}/ton
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Final Price</p>
                      <p className="font-bold text-lg">${finalPrice.toLocaleString()}/ton</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Value</p>
                      <p className="font-bold text-lg">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {anyReject && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Delivery REJECTED</AlertTitle>
                      <AlertDescription>
                        {rejectMetrics.map((m) => `${m.metric_name}: ${m.measured_value}${m.unit}`).join("; ")}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional delivery notes…" />
        </CardContent>
      </Card>

      {/* Max tons warning */}
      {maxTonsExceeded && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            This delivery would bring total tonnage to {(Number(selectedContract?.total_delivered_tons || 0) + netTons).toFixed(2)}, which exceeds the contract maximum of {Number(selectedContract?.max_tons).toFixed(1)} tons. You can still record it, but the excess may not be covered.
          </AlertDescription>
        </Alert>
      )}

      {/* Duplicate warning */}
      {duplicateWarning && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 flex flex-col gap-2">
            <span>{duplicateWarning}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setDuplicateWarning(null); setDuplicateConfirmed(true); }}>Continue Anyway</Button>
              <Button size="sm" variant="ghost" onClick={() => setDuplicateWarning(null)}>Cancel</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between pb-8">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="record-another"
            checked={recordAnother}
            onChange={(e) => setRecordAnother(e.target.checked)}
            className="rounded border-border"
          />
          <Label htmlFor="record-another" className="text-sm">Record another delivery after save</Label>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { if (dirty && !confirm("Discard changes?")) return; navigate("/growers/intake"); }}>
            Cancel
          </Button>
          <Button onClick={async () => { if (await validate()) saveMutation.mutate(); }} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {anyReject ? "Record as Rejected" : "Save Delivery"}
          </Button>
        </div>
      </div>
    </div>
  );
}
