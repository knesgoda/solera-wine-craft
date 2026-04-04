import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Download, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const WINE_TYPES = [
  { value: "still_table_wine", label: "Still Table Wine" },
  { value: "sparkling_wine", label: "Sparkling Wine" },
  { value: "dessert_wine", label: "Dessert Wine" },
  { value: "vermouth", label: "Vermouth" },
  { value: "other", label: "Other" },
] as const;

/** TTB standard: 1 ton of grapes yields approximately 170 gallons of wine */
const TONS_TO_GALLONS = 170;
/** TTB standard: 1 standard case (12 × 750 ml bottles) = 2.378 gallons */
const CASE_TO_GALLONS = 2.378;

interface WineOps {
  wine_type: string;
  beginning_inventory_gallons: number;
  produced_gallons: number;
  received_gallons: number;
  bottled_gallons: number;
  shipped_gallons: number;
  dumped_gallons: number;
  ending_inventory_gallons: number;
  overrides: Record<string, boolean>;
}

function defaultOps(): WineOps {
  return {
    wine_type: "still_table_wine",
    beginning_inventory_gallons: 0,
    produced_gallons: 0,
    received_gallons: 0,
    bottled_gallons: 0,
    shipped_gallons: 0,
    dumped_gallons: 0,
    ending_inventory_gallons: 0,
    overrides: {},
  };
}

export default function ComplianceReports() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [wineOps, setWineOps] = useState<WineOps[]>([defaultOps()]);
  const [calculating, setCalculating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [exportingAdditions, setExportingAdditions] = useState(false);
  const [additionsStart, setAdditionsStart] = useState("");
  const [additionsEnd, setAdditionsEnd] = useState("");
  const [additionsDialogOpen, setAdditionsDialogOpen] = useState(false);

  const fetchReports = async () => {
    if (!profile?.org_id) return;
    const { data } = await supabase
      .from("ttb_reports")
      .select("*")
      .eq("org_id", profile.org_id)
      .order("report_period_end", { ascending: false });
    setReports(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, [profile?.org_id]);

  const autoCalculate = async () => {
    if (!profile?.org_id || !periodStart || !periodEnd) return;
    if (new Date(periodEnd) < new Date(periodStart)) {
      toast.error("End date must be on or after the start date");
      return;
    }
    setCalculating(true);

    // Get produced gallons from vintages harvested in period
    const { data: vintages } = await supabase
      .from("vintages")
      .select("tons_harvested")
      .eq("org_id", profile.org_id)
      .gte("harvest_date", periodStart)
      .lte("harvest_date", periodEnd);
    const producedGallons = (vintages || []).reduce((sum, v) => sum + (v.tons_harvested || 0) * TONS_TO_GALLONS, 0);

    // Get bottled gallons from inventory adjustments (production_addition)
    const { data: adjustments } = await supabase
      .from("inventory_adjustments")
      .select("cases_delta, bottles_delta")
      .eq("org_id", profile.org_id)
      .eq("reason", "production_addition")
      .gte("adjusted_at", periodStart)
      .lte("adjusted_at", periodEnd);
    const bottledGallons = (adjustments || []).reduce((sum, a) => sum + ((a.cases_delta || 0) * CASE_TO_GALLONS), 0);

    // Get shipped gallons from fulfilled orders
    const { data: orders } = await supabase
      .from("orders")
      .select("quantity_cases")
      .eq("org_id", profile.org_id)
      .eq("status", "shipped")
      .gte("shipped_at", periodStart)
      .lte("shipped_at", periodEnd);
    const shippedGallons = (orders || []).reduce((sum, o) => sum + ((o.quantity_cases || 0) * CASE_TO_GALLONS), 0);

    // Get beginning inventory from prior report
    const { data: priorReport } = await supabase
      .from("ttb_reports")
      .select("id")
      .eq("org_id", profile.org_id)
      .lt("report_period_end", periodStart)
      .order("report_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    let beginningInventory = 0;
    if (priorReport) {
      const { data: priorOps } = await supabase
        .from("ttb_wine_premise_operations")
        .select("ending_inventory_gallons")
        .eq("report_id", priorReport.id)
        .eq("wine_type", "still_table_wine")
        .maybeSingle();
      beginningInventory = priorOps?.ending_inventory_gallons || 0;
    }

    const endingInventory = Math.max(0, beginningInventory + producedGallons - bottledGallons - shippedGallons);

    setWineOps([{
      ...defaultOps(),
      beginning_inventory_gallons: Math.round(beginningInventory * 100) / 100,
      produced_gallons: Math.round(producedGallons * 100) / 100,
      bottled_gallons: Math.round(bottledGallons * 100) / 100,
      shipped_gallons: Math.round(shippedGallons * 100) / 100,
      ending_inventory_gallons: Math.round(endingInventory * 100) / 100,
      overrides: {},
    }]);
    setCalculating(false);
  };

  const updateOpsField = (idx: number, field: string, value: number) => {
    setWineOps((prev) => prev.map((ops, i) =>
      i === idx ? { ...ops, [field]: value, overrides: { ...ops.overrides, [field]: true } } : ops
    ));
  };

  const validate = (): boolean => {
    for (const ops of wineOps) {
      const inflow = ops.beginning_inventory_gallons + ops.produced_gallons + ops.received_gallons;
      const outflow = ops.bottled_gallons + ops.shipped_gallons + ops.dumped_gallons + ops.ending_inventory_gallons;
      if (inflow === 0 && outflow === 0) continue;
      const diff = Math.abs(inflow - outflow);
      const tolerance = Math.max(inflow, outflow) * 0.01;
      if (diff > tolerance) {
        setValidationError(
          `${WINE_TYPES.find((t) => t.value === ops.wine_type)?.label}: Inflow (${inflow.toFixed(2)} gal) ≠ Outflow (${outflow.toFixed(2)} gal). Difference: ${diff.toFixed(2)} gal exceeds 1% tolerance.`
        );
        return false;
      }
    }
    setValidationError(null);
    return true;
  };

  const handleSaveReport = async () => {
    if (!profile?.org_id || !periodStart || !periodEnd) return;
    if (new Date(periodEnd) < new Date(periodStart)) {
      toast.error("End date must be on or after the start date");
      return;
    }
    if (!validate()) return;
    setSaving(true);

    const { data: report, error } = await supabase
      .from("ttb_reports")
      .insert({ org_id: profile.org_id, report_period_start: periodStart, report_period_end: periodEnd, status: "draft" as any })
      .select()
      .single();

    if (error || !report) { toast.error(error?.message || "Failed to create report"); setSaving(false); return; }

    const opsRows = wineOps.map((ops) => ({
      report_id: report.id,
      org_id: profile.org_id!,
      wine_type: ops.wine_type as any,
      beginning_inventory_gallons: ops.beginning_inventory_gallons,
      produced_gallons: ops.produced_gallons,
      received_gallons: ops.received_gallons,
      bottled_gallons: ops.bottled_gallons,
      shipped_gallons: ops.shipped_gallons,
      dumped_gallons: ops.dumped_gallons,
      ending_inventory_gallons: ops.ending_inventory_gallons,
      period_start: periodStart,
      period_end: periodEnd,
    }));

    await supabase.from("ttb_wine_premise_operations").insert(opsRows);
    toast.success("TTB Report created");
    setDialogOpen(false);
    setSaving(false);
    fetchReports();
  };

  const handleGeneratePdf = async (reportId: string) => {
    setGeneratingPdf(reportId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ttb-report", { body: { report_id: reportId } });
      if (error) throw error;
      toast.success("PDF generated");
      fetchReports();
    } catch (e: any) {
      toast.error(e.message || "Failed to generate PDF");
    }
    setGeneratingPdf(null);
  };

  const handleMarkSubmitted = async (reportId: string) => {
    await supabase.from("ttb_reports").update({ status: "submitted" as any, submitted_at: new Date().toISOString() }).eq("id", reportId);
    toast.success("Marked as submitted");
    fetchReports();
  };

  const handleExportAdditions = async () => {
    if (!additionsStart || !additionsEnd) return;
    setExportingAdditions(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ttb-report", {
        body: { type: "additions_log", from: additionsStart, to: additionsEnd },
      });
      if (error) throw error;
      if (data?.pdf_url) window.open(data.pdf_url, "_blank");
      toast.success("Additions log exported");
      setAdditionsDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to export");
    }
    setExportingAdditions(false);
  };

  const statusColor = (s: string) => {
    if (s === "submitted") return "default";
    if (s === "ready") return "secondary";
    return "outline";
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">TTB Compliance Reports</h1>
          <p className="text-muted-foreground">Generate OW-1 reports and export additions logs.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={additionsDialogOpen} onOpenChange={setAdditionsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><FileText className="h-4 w-4 mr-2" /> Export Additions Log</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Export Additions Log</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>From</Label><Input type="date" value={additionsStart} onChange={(e) => setAdditionsStart(e.target.value)} /></div>
                  <div className="space-y-2"><Label>To</Label><Input type="date" value={additionsEnd} onChange={(e) => setAdditionsEnd(e.target.value)} /></div>
                </div>
                <Button onClick={handleExportAdditions} disabled={exportingAdditions || !additionsStart || !additionsEnd} className="w-full">
                  <Download className="h-4 w-4 mr-2" /> {exportingAdditions ? "Generating…" : "Export PDF"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Report</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Generate OW-1 Report</DialogTitle></DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Period Start</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Period End</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
                  <div className="flex items-end">
                    <Button onClick={autoCalculate} disabled={calculating || !periodStart || !periodEnd} variant="secondary" className="w-full">
                      {calculating ? "Calculating…" : "Auto-Calculate"}
                    </Button>
                  </div>
                </div>

                {wineOps.map((ops, idx) => (
                  <Card key={idx}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        <Select value={ops.wine_type} onValueChange={(v) => setWineOps((prev) => prev.map((o, i) => i === idx ? { ...o, wine_type: v } : o))}>
                          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{WINE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(["beginning_inventory_gallons", "produced_gallons", "received_gallons", "bottled_gallons", "shipped_gallons", "dumped_gallons", "ending_inventory_gallons"] as const).map((field) => (
                          <div key={field} className="space-y-1">
                            <Label className="text-xs capitalize">{field.replace(/_/g, " ").replace("gallons", "(gal)")}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={ops[field]}
                              onChange={(e) => updateOpsField(idx, field, parseFloat(e.target.value) || 0)}
                              className={ops.overrides[field] ? "border-yellow-500 bg-yellow-50" : "border-green-500 bg-green-50"}
                            />
                            <span className={`text-[10px] ${ops.overrides[field] ? "text-yellow-600" : "text-green-600"}`}>
                              {ops.overrides[field] ? "Manual" : "Calculated"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button variant="outline" size="sm" onClick={() => setWineOps((prev) => [...prev, defaultOps()])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Wine Type Row
                </Button>

                {validationError && (
                  <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {validationError}
                  </div>
                )}

                <Button onClick={handleSaveReport} disabled={saving} className="w-full">
                  {saving ? "Creating…" : "Create Report"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {reports.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No TTB reports yet. Create your first report above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.report_period_start} — {r.report_period_end}</TableCell>
                    <TableCell><Badge variant={statusColor(r.status)}>{r.status}</Badge></TableCell>
                    <TableCell>{r.generated_at ? format(new Date(r.generated_at), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell>{r.submitted_at ? format(new Date(r.submitted_at), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {r.pdf_url ? (
                        <Button size="sm" variant="outline" onClick={() => window.open(r.pdf_url, "_blank")}>
                          <Download className="h-3 w-3 mr-1" /> PDF
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleGeneratePdf(r.id)} disabled={generatingPdf === r.id}>
                          <FileText className="h-3 w-3 mr-1" /> {generatingPdf === r.id ? "Generating…" : "Generate PDF"}
                        </Button>
                      )}
                      {r.status !== "submitted" && (
                        <Button size="sm" variant="secondary" onClick={() => handleMarkSubmitted(r.id)}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Mark Submitted
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
