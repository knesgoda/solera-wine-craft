import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Plus, Trash2, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { GradingScaleBuilder, type GradingScaleForm, type MetricForm } from "@/components/growers/GradingScaleBuilder";
import { SEOHead } from "@/components/SEOHead";

interface BlockAssignment {
  id?: string;
  block_id: string;
  estimated_tons: string;
  notes: string;
}

const currentYear = new Date().getFullYear();

export default function ContractForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const prefilledGrowerId = searchParams.get("grower_id") || "";
  const isEdit = !!id;
  const navigate = useNavigate();
  const { organization, user } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [grower_id, setGrowerId] = useState(prefilledGrowerId);
  const [vintage_year, setVintageYear] = useState(String(currentYear));
  const [contract_number, setContractNumber] = useState("");
  const [status, setStatus] = useState("draft");
  const [pricing_unit, setPricingUnit] = useState("per_ton");
  const [base_price, setBasePrice] = useState("");
  const [est_tons, setEstTons] = useState("");
  const [est_acres, setEstAcres] = useState("");
  const [min_tons, setMinTons] = useState("");
  const [max_tons, setMaxTons] = useState("");
  const [payment_term, setPaymentTerm] = useState("net_30");
  const [custom_days, setCustomDays] = useState("");
  const [delivery_start, setDeliveryStart] = useState<Date | undefined>();
  const [delivery_end, setDeliveryEnd] = useState<Date | undefined>();
  const [special_terms, setSpecialTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [blockAssignments, setBlockAssignments] = useState<BlockAssignment[]>([]);
  const [gradingScale, setGradingScale] = useState<GradingScaleForm>({
    enabled: false, name: "", description: "", is_template: false, metrics: [],
  });
  const [dirty, setDirty] = useState(false);

  // Queries
  const { data: growers = [] } = useQuery({
    queryKey: ["growers-dropdown", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("growers").select("id, name").eq("org_id", organization!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["blocks-dropdown", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("blocks").select("id, name, variety, vineyard_id, vineyards(name)").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const { data: existingAssignments = [] } = useQuery({
    queryKey: ["existing-block-assignments", organization?.id, vintage_year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_block_assignments")
        .select("block_id, contract_id, grower_contracts(contract_number, vintage_year, status)")
        .eq("org_id", organization!.id);
      if (error) throw error;
      return data.filter((a: any) =>
        a.grower_contracts?.vintage_year === parseInt(vintage_year) &&
        a.grower_contracts?.status === "active" &&
        a.contract_id !== id
      );
    },
    enabled: !!organization?.id,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["grading-templates", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grading_scales")
        .select("id, name, grading_scale_metrics(*, grading_scale_tiers(*))")
        .eq("org_id", organization!.id)
        .eq("is_template", true);
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  // Check if grading scale is locked (graded weigh tags exist)
  const { data: hasGradedTags = false } = useQuery({
    queryKey: ["contract-has-graded-tags", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("weigh_tags")
        .select("*", { count: "exact", head: true })
        .eq("contract_id", id!)
        .in("status", ["graded", "approved", "paid"] as any);
      if (error) throw error;
      return (count || 0) > 0;
    },
    enabled: isEdit,
  });

  const scaleIsLocked = isEdit && hasGradedTags;

  // Load existing contract for edit
  const { data: existingContract, isLoading: loadingContract } = useQuery({
    queryKey: ["contract-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("grower_contracts").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  const { data: existingBlocks = [] } = useQuery({
    queryKey: ["contract-blocks-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contract_block_assignments").select("*").eq("contract_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  const { data: existingScale } = useQuery({
    queryKey: ["contract-scale-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grading_scales")
        .select("*, grading_scale_metrics(*, grading_scale_tiers(*))")
        .eq("contract_id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingContract) {
      setGrowerId(existingContract.grower_id);
      setVintageYear(String(existingContract.vintage_year));
      setContractNumber(existingContract.contract_number || "");
      setStatus(existingContract.status);
      setPricingUnit(existingContract.pricing_unit);
      setBasePrice(String(existingContract.base_price_per_unit));
      setEstTons(existingContract.estimated_tons != null ? String(existingContract.estimated_tons) : "");
      setEstAcres(existingContract.estimated_acres != null ? String(existingContract.estimated_acres) : "");
      setMinTons(existingContract.min_tons != null ? String(existingContract.min_tons) : "");
      setMaxTons(existingContract.max_tons != null ? String(existingContract.max_tons) : "");
      setPaymentTerm(existingContract.payment_term);
      setCustomDays(existingContract.payment_term_custom_days != null ? String(existingContract.payment_term_custom_days) : "");
      setDeliveryStart(existingContract.delivery_start_date ? parseISO(existingContract.delivery_start_date) : undefined);
      setDeliveryEnd(existingContract.delivery_end_date ? parseISO(existingContract.delivery_end_date) : undefined);
      setSpecialTerms(existingContract.special_terms || "");
      setNotes(existingContract.notes || "");
    }
  }, [existingContract]);

  useEffect(() => {
    if (existingBlocks.length > 0) {
      setBlockAssignments(existingBlocks.map((b: any) => ({
        id: b.id,
        block_id: b.block_id,
        estimated_tons: b.estimated_tons != null ? String(b.estimated_tons) : "",
        notes: b.notes || "",
      })));
    }
  }, [existingBlocks]);

  useEffect(() => {
    if (existingScale) {
      setGradingScale({
        enabled: true,
        id: existingScale.id,
        name: existingScale.name,
        description: existingScale.description || "",
        is_template: existingScale.is_template || false,
        metrics: (existingScale.grading_scale_metrics || []).map((m: any) => ({
          id: m.id,
          metric_name: m.metric_name,
          metric_key: m.metric_key,
          unit: m.unit || "",
          direction: m.direction,
          weight: Number(m.weight) || 1,
          sort_order: m.sort_order,
          tiers: (m.grading_scale_tiers || []).map((t: any) => ({
            id: t.id,
            tier_label: t.tier_label,
            min_value: t.min_value != null ? String(t.min_value) : "",
            max_value: t.max_value != null ? String(t.max_value) : "",
            price_adjustment: String(t.price_adjustment || 0),
            is_reject: t.is_reject || false,
            sort_order: t.sort_order,
          })),
        })),
      });
    }
  }, [existingScale]);

  const assignedBlockIds = new Set(existingAssignments.map((a: any) => a.block_id));

  const validate = () => {
    if (!grower_id) { toast({ title: "Grower is required", variant: "destructive" }); return false; }
    if (!vintage_year) { toast({ title: "Vintage year is required", variant: "destructive" }); return false; }
    if (!base_price || isNaN(parseFloat(base_price))) { toast({ title: "Valid base price is required", variant: "destructive" }); return false; }
    if (gradingScale.enabled && !gradingScale.name.trim()) { toast({ title: "Grading scale name is required", variant: "destructive" }); return false; }
    return true;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const contractPayload = {
        org_id: organization!.id,
        grower_id,
        vintage_year: parseInt(vintage_year),
        contract_number: contract_number || undefined,
        status: status as any,
        pricing_unit: pricing_unit as any,
        base_price_per_unit: parseFloat(base_price),
        estimated_tons: est_tons ? parseFloat(est_tons) : null,
        estimated_acres: est_acres ? parseFloat(est_acres) : null,
        min_tons: min_tons ? parseFloat(min_tons) : null,
        max_tons: max_tons ? parseFloat(max_tons) : null,
        payment_term: payment_term as any,
        payment_term_custom_days: custom_days ? parseInt(custom_days) : null,
        delivery_start_date: delivery_start ? format(delivery_start, "yyyy-MM-dd") : null,
        delivery_end_date: delivery_end ? format(delivery_end, "yyyy-MM-dd") : null,
        special_terms: special_terms || null,
        notes: notes || null,
      };

      let contractId = id;

      if (isEdit) {
        const { error } = await supabase.from("grower_contracts").update({ ...contractPayload, updated_by: user?.id }).eq("id", id!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("grower_contracts").insert({ ...contractPayload, created_by: user?.id }).select("id").single();
        if (error) throw error;
        contractId = data.id;
      }

      // Block assignments: delete all then re-insert
      await supabase.from("contract_block_assignments").delete().eq("contract_id", contractId!);
      if (blockAssignments.length > 0) {
        const { error: baError } = await supabase.from("contract_block_assignments").insert(
          blockAssignments.filter((ba) => ba.block_id).map((ba) => ({
            org_id: organization!.id,
            contract_id: contractId!,
            block_id: ba.block_id,
            estimated_tons: ba.estimated_tons ? parseFloat(ba.estimated_tons) : null,
            notes: ba.notes || null,
          }))
        );
        if (baError) throw baError;
      }

      // Grading scale
      if (gradingScale.enabled) {
        // Delete existing scale (cascade deletes metrics+tiers)
        if (isEdit) {
          await supabase.from("grading_scales").delete().eq("contract_id", contractId!);
        }

        const { data: scaleData, error: scaleError } = await supabase.from("grading_scales").insert({
          org_id: organization!.id,
          contract_id: contractId!,
          name: gradingScale.name.trim(),
          description: gradingScale.description || null,
          is_template: gradingScale.is_template,
        }).select("id").single();
        if (scaleError) throw scaleError;

        for (let mi = 0; mi < gradingScale.metrics.length; mi++) {
          const m = gradingScale.metrics[mi];
          const { data: metricData, error: metricError } = await supabase.from("grading_scale_metrics").insert({
            org_id: organization!.id,
            grading_scale_id: scaleData.id,
            metric_name: m.metric_name.trim(),
            metric_key: m.metric_key.trim(),
            data_type: "numeric" as any,
            unit: m.unit || null,
            direction: m.direction as any,
            weight: m.weight,
            sort_order: mi,
          }).select("id").single();
          if (metricError) throw metricError;

          if (m.tiers.length > 0) {
            const { error: tierError } = await supabase.from("grading_scale_tiers").insert(
              m.tiers.map((t, ti) => ({
                org_id: organization!.id,
                metric_id: metricData.id,
                tier_label: t.tier_label.trim(),
                min_value: t.min_value ? parseFloat(t.min_value) : null,
                max_value: t.max_value ? parseFloat(t.max_value) : null,
                price_adjustment: parseFloat(t.price_adjustment) || 0,
                is_reject: t.is_reject,
                sort_order: ti,
              }))
            );
            if (tierError) throw tierError;
          }
        }
      } else if (isEdit) {
        // Remove grading scale if disabled
        await supabase.from("grading_scales").delete().eq("contract_id", contractId!);
      }

      return contractId;
    },
    onSuccess: (contractId) => {
      queryClient.invalidateQueries({ queryKey: ["grower-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["grower-contracts-all"] });
      toast({ title: isEdit ? "Contract updated" : "Contract created" });
      navigate(`/growers/contracts/${contractId}`);
    },
    onError: (err: any) => {
      toast({ title: "Error saving contract", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!validate()) return;
    saveMutation.mutate();
  };

  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const handleCancel = () => {
    if (dirty) { setShowDiscardDialog(true); return; }
    navigate(-1);
  };

  if (isEdit && loadingContract) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto" onChange={() => setDirty(true)}>
      <SEOHead title={`${isEdit ? "Edit" : "New"} Contract | Solera`} description="Contract form" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/growers">Growers</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/growers/contracts">Contracts</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{isEdit ? "Edit" : "New Contract"}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="text-2xl font-display font-bold">{isEdit ? "Edit Contract" : "New Grower Contract"}</h1>

      {/* SECTION A: Contract Details */}
      <Card>
        <CardHeader><CardTitle>Contract Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Grower *</Label>
              <Select value={grower_id} onValueChange={setGrowerId}>
                <SelectTrigger><SelectValue placeholder="Select grower" /></SelectTrigger>
                <SelectContent>
                  {growers.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vintage Year *</Label>
              <Input type="number" value={vintage_year} onChange={(e) => setVintageYear(e.target.value)} />
            </div>
            <div>
              <Label>Contract Number</Label>
              <Input value={contract_number} onChange={(e) => setContractNumber(e.target.value)} placeholder="Auto-generated if blank" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Pricing Unit</Label>
              <Select value={pricing_unit} onValueChange={setPricingUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_ton">Per Ton</SelectItem>
                  <SelectItem value="per_acre">Per Acre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Base Price *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input className="pl-7" type="number" step="0.01" value={base_price} onChange={(e) => setBasePrice(e.target.value)} placeholder="3500.00" />
              </div>
            </div>
            <div>
              <Label>{pricing_unit === "per_acre" ? "Estimated Acres" : "Estimated Tons"}</Label>
              <Input
                type="number"
                step="0.1"
                value={pricing_unit === "per_acre" ? est_acres : est_tons}
                onChange={(e) => pricing_unit === "per_acre" ? setEstAcres(e.target.value) : setEstTons(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Minimum Tons</Label>
              <Input type="number" step="0.1" value={min_tons} onChange={(e) => setMinTons(e.target.value)} />
            </div>
            <div>
              <Label>Maximum Tons</Label>
              <Input type="number" step="0.1" value={max_tons} onChange={(e) => setMaxTons(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Payment Terms</Label>
              <Select value={payment_term} onValueChange={setPaymentTerm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="net_30">Net 30</SelectItem>
                  <SelectItem value="net_45">Net 45</SelectItem>
                  <SelectItem value="net_60">Net 60</SelectItem>
                  <SelectItem value="net_90">Net 90</SelectItem>
                  <SelectItem value="on_delivery">On Delivery</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payment_term === "custom" && (
              <div>
                <Label>Custom Days</Label>
                <Input type="number" value={custom_days} onChange={(e) => setCustomDays(e.target.value)} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Delivery Start</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !delivery_start && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {delivery_start ? format(delivery_start, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={delivery_start} onSelect={setDeliveryStart} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Delivery End</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !delivery_end && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {delivery_end ? format(delivery_end, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={delivery_end} onSelect={setDeliveryEnd} disabled={(d) => delivery_start ? d < delivery_start : false} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label>Special Terms</Label>
            <Textarea value={special_terms} onChange={(e) => setSpecialTerms(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* SECTION B: Block Assignments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Assigned Blocks</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setBlockAssignments([...blockAssignments, { block_id: "", estimated_tons: "", notes: "" }])}>
              <Plus className="mr-1 h-3 w-3" /> Add Block
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {blockAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
              No blocks assigned. Click Add Block to assign vineyard blocks to this contract.
            </p>
          ) : (
            blockAssignments.map((ba, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-5">
                  {i === 0 && <Label className="text-xs">Block</Label>}
                  <Select value={ba.block_id} onValueChange={(v) => {
                    const updated = [...blockAssignments];
                    updated[i] = { ...updated[i], block_id: v };
                    setBlockAssignments(updated);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select block" /></SelectTrigger>
                    <SelectContent>
                      {blocks.map((b: any) => {
                        const taken = assignedBlockIds.has(b.id);
                        return (
                          <SelectItem key={b.id} value={b.id} disabled={taken}>
                            {(b as any).vineyards?.name} › {b.name} {b.variety ? `(${b.variety})` : ""}
                            {taken && " — assigned"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  {i === 0 && <Label className="text-xs">Est. Tons</Label>}
                  <Input type="number" step="0.1" value={ba.estimated_tons} onChange={(e) => {
                    const updated = [...blockAssignments];
                    updated[i] = { ...updated[i], estimated_tons: e.target.value };
                    setBlockAssignments(updated);
                  }} />
                </div>
                <div className="col-span-3">
                  {i === 0 && <Label className="text-xs">Notes</Label>}
                  <Input value={ba.notes} onChange={(e) => {
                    const updated = [...blockAssignments];
                    updated[i] = { ...updated[i], notes: e.target.value };
                    setBlockAssignments(updated);
                  }} />
                </div>
                <div className="col-span-1">
                  <Button size="sm" variant="ghost" className="text-destructive h-10 w-full" onClick={() => setBlockAssignments(blockAssignments.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* SECTION C: Grading Scale */}
      {scaleIsLocked ? (
        <Alert className="border-amber-300 bg-amber-50">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            This grading scale is locked because deliveries have been graded against it. To change grading criteria, create a new contract.
          </AlertDescription>
        </Alert>
      ) : (
        <GradingScaleBuilder scale={gradingScale} onChange={setGradingScale} templates={templates} />
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Save Changes" : "Create Contract"}
        </Button>
      </div>
    </div>
  );
}
