import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, CheckCircle2, Clock, CreditCard } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  graded: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  disputed: "bg-destructive/10 text-destructive",
  paid: "bg-purple-100 text-purple-800",
};

export default function WeighTagDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  const { data: wt, isLoading } = useQuery({
    queryKey: ["weigh-tag-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weigh_tags")
        .select("*, growers(id, name), grower_contracts(id, contract_number, base_price_per_unit), blocks(name), vintages(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ["weigh-tag-metrics", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weigh_tag_metrics")
        .select("*, grading_scale_metrics(metric_name, unit, direction), grading_scale_tiers(tier_label)")
        .eq("weigh_tag_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["weigh-tag-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["weigh-tags"] });
    queryClient.invalidateQueries({ queryKey: ["contract-weigh-tags"] });
    queryClient.invalidateQueries({ queryKey: ["contract-detail"] });
  };

  const statusMutation = useMutation({
    mutationFn: async ({ newStatus, extraFields }: { newStatus: string; extraFields?: Record<string, any> }) => {
      const { error } = await supabase.from("weigh_tags").update({
        status: newStatus as any,
        ...extraFields,
        updated_at: new Date().toISOString(),
      }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleApprove = () => statusMutation.mutate({
    newStatus: "approved",
    extraFields: { approved_at: new Date().toISOString(), approved_by: user?.id },
  });

  const handleDispute = () => {
    statusMutation.mutate({
      newStatus: "disputed",
      extraFields: { notes: disputeReason ? `DISPUTE: ${disputeReason}\n\n${wt?.notes || ""}` : wt?.notes },
    });
    setDisputeOpen(false);
  };

  const handlePaid = () => statusMutation.mutate({ newStatus: "paid" });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!wt) return <div className="py-16 text-center text-muted-foreground">Weigh tag not found.</div>;

  const basePrice = Number(wt.grower_contracts?.base_price_per_unit) || 0;
  const totalAdj = Number(wt.total_price_adjustment) || 0;

  const timeline = [
    { label: "Created", time: wt.created_at, icon: Clock },
    wt.graded_at ? { label: "Graded", time: wt.graded_at, icon: CheckCircle2 } : null,
    wt.approved_at ? { label: "Approved", time: wt.approved_at, icon: CheckCircle2 } : null,
    wt.status === "paid" ? { label: "Paid", time: wt.updated_at, icon: CreditCard } : null,
    wt.status === "disputed" ? { label: "Disputed", time: wt.updated_at, icon: AlertTriangle } : null,
  ].filter(Boolean) as Array<{ label: string; time: string; icon: any }>;

  return (
    <div className="space-y-6">
      <SEOHead title={`${wt.tag_number} | Harvest Intake | Solera`} description="Weigh tag detail" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/growers">Growers</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/growers/intake">Intake</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{wt.tag_number}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold">{wt.tag_number}</h1>
            <Badge variant="secondary" className={STATUS_COLORS[wt.status]}>{wt.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Delivered {wt.delivery_date}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {wt.status === "graded" && (
            <Button size="sm" onClick={handleApprove} disabled={statusMutation.isPending}>
              <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
            </Button>
          )}
          {(wt.status === "graded" || wt.status === "approved") && (
            <Button size="sm" variant="destructive" onClick={() => setDisputeOpen(true)}>
              <AlertTriangle className="mr-1 h-3 w-3" /> Dispute
            </Button>
          )}
          {wt.status === "approved" && (
            <Button size="sm" variant="outline" onClick={handlePaid} disabled={statusMutation.isPending}>
              <CreditCard className="mr-1 h-3 w-3" /> Mark as Paid
            </Button>
          )}
        </div>
      </div>

      {wt.is_rejected && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Delivery Rejected</AlertTitle>
          <AlertDescription>{wt.rejection_reason}</AlertDescription>
        </Alert>
      )}

      {/* Delivery Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Delivery Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Grower</p>
            <Link to={`/growers/${wt.growers?.id}`} className="text-primary hover:underline font-medium">{wt.growers?.name}</Link>
          </div>
          <div>
            <p className="text-muted-foreground">Contract</p>
            <Link to={`/growers/contracts/${wt.grower_contracts?.id}`} className="text-primary hover:underline font-medium">{wt.grower_contracts?.contract_number}</Link>
          </div>
          <div>
            <p className="text-muted-foreground">Block</p>
            <p className="font-medium">{wt.blocks?.name || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Vintage</p>
            <p className="font-medium">{(wt as any).vintages?.name || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Truck ID</p>
            <p className="font-medium">{wt.truck_id || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Driver</p>
            <p className="font-medium">{wt.driver_name || "—"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Weights */}
      <Card>
        <CardHeader><CardTitle className="text-base">Weights</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Gross Weight", value: wt.gross_weight_lbs != null ? `${Number(wt.gross_weight_lbs).toLocaleString()} lbs` : "—" },
            { label: "Tare Weight", value: wt.tare_weight_lbs != null ? `${Number(wt.tare_weight_lbs).toLocaleString()} lbs` : "—" },
            { label: "Net Weight", value: wt.net_weight_lbs != null ? `${Number(wt.net_weight_lbs).toLocaleString()} lbs` : "—" },
            { label: "Net Tons", value: wt.net_tons != null ? Number(wt.net_tons).toFixed(4) : "—" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold">{s.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quality Grade */}
      {metrics.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Quality Grade</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Adjustment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.grading_scale_metrics?.metric_name}</TableCell>
                      <TableCell>{Number(m.measured_value).toFixed(2)}{m.grading_scale_metrics?.unit || ""}</TableCell>
                      <TableCell>
                        <Badge variant={m.is_reject ? "destructive" : "secondary"}>
                          {m.grading_scale_tiers?.tier_label || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {m.is_reject ? "REJECT" : (
                          <span className={Number(m.price_adjustment) > 0 ? "text-green-600" : Number(m.price_adjustment) < 0 ? "text-destructive" : ""}>
                            {Number(m.price_adjustment) >= 0 ? "+" : ""}${Number(m.price_adjustment)}
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
                <p className={`font-bold ${totalAdj > 0 ? "text-green-600" : totalAdj < 0 ? "text-destructive" : ""}`}>
                  {totalAdj >= 0 ? "+" : ""}${totalAdj.toLocaleString()}/ton
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Final Price</p>
                <p className="font-bold text-lg">${wt.final_price_per_unit != null ? Number(wt.final_price_per_unit).toLocaleString() : "—"}/ton</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Value</p>
                <p className="font-bold text-lg">${wt.total_value != null ? Number(wt.total_value).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status History */}
      <Card>
        <CardHeader><CardTitle className="text-base">Status History</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            {timeline.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground">→</span>}
                <div className="flex items-center gap-1.5 text-sm">
                  <step.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{step.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(step.time).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {wt.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{wt.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      {wt.photo_urls && (wt.photo_urls as string[]).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Photos</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              {(wt.photo_urls as string[]).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`Delivery photo ${i + 1}`} className="h-24 w-24 object-cover rounded-md border" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dispute Dialog */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dispute Delivery</DialogTitle></DialogHeader>
          <Textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Reason for dispute…"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDispute}>Submit Dispute</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
