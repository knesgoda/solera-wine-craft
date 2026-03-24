import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Pencil, ChevronDown, Download, Plus, Scale, AlertTriangle, Lock, FileText } from "lucide-react";
import { TierRangeBar } from "@/components/growers/TierRangeBar";
import { SEOHead } from "@/components/SEOHead";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800",
  fulfilled: "bg-blue-100 text-blue-800",
  cancelled: "bg-destructive/10 text-destructive",
  expired: "bg-amber-100 text-amber-800",
};

const WT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  graded: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  disputed: "bg-destructive/10 text-destructive",
  paid: "bg-muted text-muted-foreground",
};

const PAYMENT_LABELS: Record<string, string> = {
  net_30: "Net 30", net_45: "Net 45", net_60: "Net 60", net_90: "Net 90",
  on_delivery: "On Delivery", custom: "Custom",
};

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization } = useAuth();
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; status: string; message: string }>({ open: false, status: "", message: "" });

  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("grower_contracts").select("*, growers(id, name)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: blockAssignments = [] } = useQuery({
    queryKey: ["contract-blocks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_block_assignments")
        .select("*, blocks(name, variety, vineyards(name))")
        .eq("contract_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: gradingScale } = useQuery({
    queryKey: ["contract-scale", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grading_scales")
        .select("*, grading_scale_metrics(*, grading_scale_tiers(*))")
        .eq("contract_id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: weighTags = [] } = useQuery({
    queryKey: ["contract-weigh-tags", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weigh_tags")
        .select("*, blocks(name)")
        .eq("contract_id", id!)
        .order("delivery_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Auto-expire check
  useEffect(() => {
    if (contract && contract.status === "active" && contract.delivery_end_date) {
      const endDate = new Date(contract.delivery_end_date);
      if (endDate < new Date()) {
        supabase.from("grower_contracts").update({ status: "expired" as any, updated_at: new Date().toISOString() }).eq("id", id!).then(() => {
          queryClient.invalidateQueries({ queryKey: ["contract-detail", id] });
        });
      }
    }
  }, [contract, id, queryClient]);

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.from("grower_contracts").update({ status: newStatus as any }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["grower-contracts"] });
      toast({ title: "Status updated" });
      setConfirmDialog({ open: false, status: "", message: "" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleStatusChange = (newStatus: string) => {
    if (!contract) return;

    // Validate transitions
    if (newStatus === "fulfilled") {
      const hasApproved = weighTags.some((wt: any) => wt.status === "approved" && !wt.is_rejected);
      if (!hasApproved) {
        toast({ title: "Cannot fulfill", description: "At least one non-rejected, approved delivery is required.", variant: "destructive" });
        return;
      }
    }

    if (newStatus === "cancelled") {
      setConfirmDialog({ open: true, status: "cancelled", message: "Cancelling will not delete existing weigh tags or payment records. Continue?" });
      return;
    }

    if (newStatus === "active" && contract.status === "fulfilled") {
      setConfirmDialog({ open: true, status: "active", message: "Re-opening this fulfilled contract will allow new deliveries. Continue?" });
      return;
    }

    statusMutation.mutate(newStatus);
  };

  // Enhanced CSV export with metric columns
  const { data: weighTagMetrics = [] } = useQuery({
    queryKey: ["contract-wt-metrics", id],
    queryFn: async () => {
      const wtIds = weighTags.map((wt: any) => wt.id);
      if (wtIds.length === 0) return [];
      const { data, error } = await supabase
        .from("weigh_tag_metrics")
        .select("*, grading_scale_metrics(metric_name)")
        .in("weigh_tag_id", wtIds);
      if (error) throw error;
      return data;
    },
    enabled: weighTags.length > 0,
  });

  const exportCSV = () => {
    if (weighTags.length === 0) return;
    const metricNames = gradingScale?.grading_scale_metrics
      ? (gradingScale.grading_scale_metrics as any[]).sort((a, b) => a.sort_order - b.sort_order).map((m: any) => m.metric_name)
      : [];
    const headers = ["Tag Number", "Delivery Date", "Block", "Gross Weight (lbs)", "Tare Weight (lbs)", "Net Weight (lbs)", "Net Tons", ...metricNames, "Total Adjustment", "Final Price Per Ton", "Total Value", "Status"];
    const rows = weighTags.map((wt: any) => {
      const wtMetrics = weighTagMetrics.filter((m: any) => m.weigh_tag_id === wt.id);
      const metricValues = metricNames.map((name) => {
        const found = wtMetrics.find((m: any) => m.grading_scale_metrics?.metric_name === name);
        return found ? Number(found.measured_value) : "";
      });
      return [
        wt.tag_number, wt.delivery_date, wt.blocks?.name || "", wt.gross_weight_lbs, wt.tare_weight_lbs,
        wt.net_weight_lbs, wt.net_tons, ...metricValues,
        wt.total_price_adjustment, wt.final_price_per_unit, wt.total_value, wt.status,
      ];
    });
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contract?.contract_number || "contract"}-financials.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!contract) return;
    const metricNames = gradingScale?.grading_scale_metrics
      ? (gradingScale.grading_scale_metrics as any[]).sort((a, b) => a.sort_order - b.sort_order).map((m: any) => m.metric_name)
      : [];

    const deliveryRows = weighTags.map((wt: any) =>
      `<tr><td>${wt.tag_number}</td><td>${wt.delivery_date}</td><td>${wt.blocks?.name || "—"}</td><td style="text-align:right">${Number(wt.net_tons).toFixed(2)}</td><td style="text-align:right">$${Number(wt.total_price_adjustment || 0)}</td><td style="text-align:right">$${Number(wt.final_price_per_unit || 0).toLocaleString()}</td><td style="text-align:right">$${Number(wt.total_value || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td></tr>`
    ).join("");

    const scaleHtml = gradingScale ? `
      <h3>Grading Scale: ${gradingScale.name}</h3>
      ${(gradingScale.grading_scale_metrics as any[] || []).map((m: any) =>
        `<p><strong>${m.metric_name}</strong> (${m.unit || ""}) — ${m.direction === "higher_is_better" ? "Higher is better" : "Lower is better"}</p>`
      ).join("")}
    ` : "";

    const html = `<!DOCTYPE html><html><head><title>${contract.contract_number} Summary</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:20px;font-size:14px}h1{font-size:20px}h2{font-size:16px;margin-top:24px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5}.total{font-weight:bold;background:#f0f0f0}</style></head><body>
      <h1>Contract Summary: ${contract.contract_number}</h1>
      <p><strong>Grower:</strong> ${contract.growers?.name} | <strong>Vintage:</strong> ${contract.vintage_year} | <strong>Status:</strong> ${contract.status}</p>
      <h2>Terms</h2>
      <p>Pricing: ${contract.pricing_unit === "per_ton" ? "Per Ton" : "Per Acre"} | Base Price: $${Number(contract.base_price_per_unit).toLocaleString()} | Payment: ${PAYMENT_LABELS[contract.payment_term] || contract.payment_term}</p>
      ${contract.delivery_start_date ? `<p>Delivery Window: ${contract.delivery_start_date} — ${contract.delivery_end_date || "Open"}</p>` : ""}
      ${scaleHtml}
      <h2>Deliveries</h2>
      <table><thead><tr><th>Tag #</th><th>Date</th><th>Block</th><th style="text-align:right">Net Tons</th><th style="text-align:right">Adjustment</th><th style="text-align:right">Final Price</th><th style="text-align:right">Total</th></tr></thead><tbody>
      ${deliveryRows}
      <tr class="total"><td colspan="3">Total</td><td style="text-align:right">${delivered.toFixed(2)}</td><td></td><td></td><td style="text-align:right">$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td></tr>
      </tbody></table>
      <h2>Summary</h2>
      <p>Total Tons: ${delivered.toFixed(2)} | Total Value: $${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} | Avg Price/Ton: $${avgPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
    </body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!contract) return <div className="py-16 text-center text-muted-foreground">Contract not found.</div>;

  const delivered = Number(contract.total_delivered_tons) || 0;
  const estimated = Number(contract.estimated_tons) || 0;
  const remaining = Math.max(estimated - delivered, 0);
  const totalValue = Number(contract.total_contract_value) || 0;
  const avgPrice = delivered > 0 ? totalValue / delivered : Number(contract.base_price_per_unit);
  const hasGradedTags = weighTags.some((wt: any) => ["graded", "approved", "paid"].includes(wt.status));
  const scaleIsLocked = hasGradedTags && contract.status !== "draft";

  // Status transitions with edge cases
  const getTransitions = () => {
    const t: string[] = [];
    if (contract.status === "draft") t.push("active");
    if (contract.status === "active") { t.push("fulfilled"); t.push("cancelled"); }
    if (contract.status === "fulfilled") t.push("active"); // re-open
    return t;
  };
  const transitions = getTransitions();

  // Min tons warning
  const minTonsWarning = contract.min_tons && contract.delivery_end_date &&
    new Date(contract.delivery_end_date) < new Date() && delivered < Number(contract.min_tons);

  const deliveryProgress = (() => {
    if (!contract.delivery_start_date || !contract.delivery_end_date) return null;
    const start = new Date(contract.delivery_start_date).getTime();
    const end = new Date(contract.delivery_end_date).getTime();
    const now = Date.now();
    if (now < start) return 0;
    if (now > end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  })();

  // Contract deletion check
  const canDelete = contract.status === "draft" && weighTags.length === 0;

  return (
    <div className="space-y-6">
      <SEOHead title={`${contract.contract_number} | Contracts | Solera`} description="Contract detail" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/growers">Growers</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/growers/contracts">Contracts</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{contract.contract_number}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {minTonsWarning && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Minimum Delivery Not Met</AlertTitle>
          <AlertDescription className="text-amber-700">
            Minimum delivery of {Number(contract.min_tons).toFixed(1)} tons was not met. Only {delivered.toFixed(2)} tons delivered.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold">{contract.contract_number}</h1>
            <Badge variant="secondary" className={STATUS_COLORS[contract.status]}>{contract.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            <Link to={`/growers/${contract.growers?.id}`} className="hover:underline text-primary">{contract.growers?.name}</Link>
            {" · "}{contract.vintage_year} vintage
          </p>
        </div>
        <div className="flex gap-2">
          {transitions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">Change Status <ChevronDown className="ml-1 h-3 w-3" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {transitions.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)} className="capitalize">{s}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate(`/growers/contracts/${id}/edit`)}>
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="blocks">Blocks ({blockAssignments.length})</TabsTrigger>
          <TabsTrigger value="grading">Grading Scale</TabsTrigger>
          <TabsTrigger value="weigh-tags">Weigh Tags ({weighTags.length})</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Base Price", value: `$${Number(contract.base_price_per_unit).toLocaleString()}/${contract.pricing_unit === "per_ton" ? "ton" : "acre"}` },
              { label: "Estimated", value: `${estimated.toFixed(1)} tons` },
              { label: "Delivered", value: `${delivered.toFixed(2)} tons` },
              { label: "Remaining", value: `${remaining.toFixed(2)} tons` },
              { label: "Total Value", value: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
              { label: "Avg Price/Ton", value: `$${avgPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {deliveryProgress !== null && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Delivery Window: {contract.delivery_start_date} — {contract.delivery_end_date}
                </p>
                <Progress value={deliveryProgress} className="h-2" />
              </CardContent>
            </Card>
          )}

          {(contract.min_tons || contract.max_tons) && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-2">Delivery Commitment</p>
                <div className="flex gap-6 text-sm">
                  {contract.min_tons && <span>Min: <strong>{Number(contract.min_tons).toFixed(1)} tons</strong></span>}
                  <span>Delivered: <strong>{delivered.toFixed(2)} tons</strong></span>
                  {contract.max_tons && <span>Max: <strong>{Number(contract.max_tons).toFixed(1)} tons</strong></span>}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4 text-sm space-y-2">
                <p><span className="text-muted-foreground">Payment Terms:</span> {PAYMENT_LABELS[contract.payment_term] || contract.payment_term}{contract.payment_term === "custom" && contract.payment_term_custom_days ? ` (${contract.payment_term_custom_days} days)` : ""}</p>
                <p><span className="text-muted-foreground">Pricing:</span> {contract.pricing_unit === "per_ton" ? "Per Ton" : "Per Acre"}</p>
              </CardContent>
            </Card>
            {(contract.special_terms || contract.notes) && (
              <Card>
                <CardContent className="pt-4 text-sm space-y-2">
                  {contract.special_terms && <div><span className="text-muted-foreground">Special Terms:</span><p className="mt-1">{contract.special_terms}</p></div>}
                  {contract.notes && <div><span className="text-muted-foreground">Notes:</span><p className="mt-1">{contract.notes}</p></div>}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* BLOCKS */}
        <TabsContent value="blocks">
          {blockAssignments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">No blocks assigned.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Block</TableHead>
                    <TableHead>Vineyard</TableHead>
                    <TableHead>Variety</TableHead>
                    <TableHead className="text-right">Est. Tons</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockAssignments.map((ba: any) => (
                    <TableRow key={ba.id}>
                      <TableCell className="font-medium">
                        {ba.blocks ? ba.blocks.name : (
                          <span className="text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> (Deleted Block)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{ba.blocks?.vineyards?.name || "—"}</TableCell>
                      <TableCell>{ba.blocks?.variety || "—"}</TableCell>
                      <TableCell className="text-right">{ba.estimated_tons != null ? Number(ba.estimated_tons).toFixed(1) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* GRADING SCALE */}
        <TabsContent value="grading" className="space-y-4">
          {!gradingScale ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p>No grading scale configured. This contract uses base price only.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{gradingScale.name}</h3>
                  {gradingScale.description && <p className="text-sm text-muted-foreground">{gradingScale.description}</p>}
                </div>
                {scaleIsLocked && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    <Lock className="mr-1 h-3 w-3" /> Locked — deliveries graded against this scale
                  </Badge>
                )}
              </div>

              {(gradingScale.grading_scale_metrics || []).map((m: any) => (
                <Card key={m.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{m.metric_name}</CardTitle>
                      {m.unit && <span className="text-sm text-muted-foreground">({m.unit})</span>}
                      <Badge variant="outline" className="text-xs">
                        {m.direction === "higher_is_better" ? "↑ Higher is better" : "↓ Lower is better"}
                      </Badge>
                      {m.weight !== 1 && <Badge variant="secondary" className="text-xs">Weight: {m.weight}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(m.grading_scale_tiers || []).length > 0 && (
                      <>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Tier</TableHead>
                                <TableHead className="text-xs">Min</TableHead>
                                <TableHead className="text-xs">Max</TableHead>
                                <TableHead className="text-xs">Adjustment</TableHead>
                                <TableHead className="text-xs">Reject</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(m.grading_scale_tiers || [])
                                .sort((a: any, b: any) => a.sort_order - b.sort_order)
                                .map((t: any) => (
                                <TableRow key={t.id}>
                                  <TableCell className="font-medium text-sm">{t.tier_label}</TableCell>
                                  <TableCell className="text-sm">{t.min_value ?? "—"}</TableCell>
                                  <TableCell className="text-sm">{t.max_value ?? "—"}</TableCell>
                                  <TableCell className="text-sm">
                                    {t.is_reject ? "—" : (
                                      <span className={t.price_adjustment > 0 ? "text-green-600" : t.price_adjustment < 0 ? "text-destructive" : ""}>
                                        {t.price_adjustment >= 0 ? "+" : ""}${t.price_adjustment}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>{t.is_reject && <Badge variant="destructive" className="text-xs">Reject</Badge>}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <TierRangeBar
                          direction={m.direction}
                          tiers={(m.grading_scale_tiers || []).map((t: any) => ({
                            tier_label: t.tier_label,
                            min_value: t.min_value,
                            max_value: t.max_value,
                            price_adjustment: Number(t.price_adjustment) || 0,
                            is_reject: t.is_reject,
                          }))}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* WEIGH TAGS */}
        <TabsContent value="weigh-tags" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => navigate(`/growers/intake/new?contract_id=${id}`)}>
              <Plus className="mr-1 h-3 w-3" /> Record Delivery
            </Button>
          </div>
          {weighTags.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <Scale className="h-10 w-10 mx-auto mb-3" />
              <p>No deliveries recorded yet. Record the first fruit delivery for this contract.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Block</TableHead>
                    <TableHead className="text-right">Net Tons</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Final Price</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weighTags.map((wt: any) => (
                    <TableRow key={wt.id} className="cursor-pointer" onClick={() => navigate(`/growers/intake/${wt.id}`)}>
                      <TableCell className="font-medium">{wt.tag_number}</TableCell>
                      <TableCell>{wt.delivery_date}</TableCell>
                      <TableCell className="hidden sm:table-cell">{wt.blocks?.name || "—"}</TableCell>
                      <TableCell className="text-right">{wt.net_tons != null ? Number(wt.net_tons).toFixed(2) : "—"}</TableCell>
                      <TableCell><Badge variant="secondary" className={WT_STATUS_COLORS[wt.status] || ""}>{wt.status}</Badge></TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{wt.final_price_per_unit != null ? `$${Number(wt.final_price_per_unit).toLocaleString()}` : "—"}</TableCell>
                      <TableCell className="text-right">{wt.total_value != null ? `$${Number(wt.total_value).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* FINANCIALS */}
        <TabsContent value="financials" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Financial Summary</h3>
            {weighTags.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportPDF}>
                  <FileText className="mr-1 h-3 w-3" /> Export PDF
                </Button>
                <Button size="sm" variant="outline" onClick={exportCSV}>
                  <Download className="mr-1 h-3 w-3" /> Export CSV
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Value</p><p className="text-xl font-bold">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p></CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Tons</p><p className="text-xl font-bold">{delivered.toFixed(2)}</p></CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4"><p className="text-xs text-muted-foreground">Avg Adjusted Price</p><p className="text-xl font-bold">${avgPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}/ton</p></CardContent>
            </Card>
          </div>

          {weighTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">No deliveries to report.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Net Tons</TableHead>
                    <TableHead className="text-right">Base Price</TableHead>
                    <TableHead className="text-right">Adjustment</TableHead>
                    <TableHead className="text-right">Final Price</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weighTags.map((wt: any) => (
                    <TableRow key={wt.id}>
                      <TableCell className="font-medium">{wt.tag_number}</TableCell>
                      <TableCell>{wt.delivery_date}</TableCell>
                      <TableCell className="text-right">{wt.net_tons != null ? Number(wt.net_tons).toFixed(2) : "—"}</TableCell>
                      <TableCell className="text-right">${Number(contract.base_price_per_unit).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {wt.total_price_adjustment != null ? (
                          <span className={Number(wt.total_price_adjustment) > 0 ? "text-green-600" : Number(wt.total_price_adjustment) < 0 ? "text-destructive" : ""}>
                            {Number(wt.total_price_adjustment) >= 0 ? "+" : ""}${Number(wt.total_price_adjustment).toLocaleString()}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{wt.final_price_per_unit != null ? `$${Number(wt.final_price_per_unit).toLocaleString()}` : "—"}</TableCell>
                      <TableCell className="text-right">{wt.total_value != null ? `$${Number(wt.total_value).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{delivered.toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(o) => setConfirmDialog({ ...confirmDialog, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <DialogDescription>{confirmDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, status: "", message: "" })}>Cancel</Button>
            <Button variant={confirmDialog.status === "cancelled" ? "destructive" : "default"} onClick={() => statusMutation.mutate(confirmDialog.status)}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
