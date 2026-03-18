import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Upload, Package } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const ALLOCATION_LABELS: Record<string, string> = {
  dtc: "DTC", wine_club: "Wine Club", wholesale: "Wholesale",
  restaurant: "Restaurant", library: "Library", custom_crush_client: "Custom Crush Client",
};

const REASON_LABELS: Record<string, string> = {
  production_addition: "Production Addition", sale: "Sale", breakage: "Breakage",
  comp: "Comp", audit_correction: "Audit Correction", custom_crush_transfer: "Custom Crush Transfer",
};

const SkuDetail = () => {
  const { skuId } = useParams();
  const navigate = useNavigate();
  const { organization, user } = useAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const [showAdjust, setShowAdjust] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Adjustment form
  const [casesDelta, setCasesDelta] = useState("0");
  const [bottlesDelta, setBottlesDelta] = useState("0");
  const [reason, setReason] = useState("production_addition");
  const [adjNotes, setAdjNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: sku, isLoading } = useQuery({
    queryKey: ["sku-detail", skuId],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_skus").select("*").eq("id", skuId!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!skuId,
  });

  const { data: adjustments = [] } = useQuery({
    queryKey: ["sku-adjustments", skuId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_adjustments")
        .select("*")
        .eq("sku_id", skuId!)
        .order("adjusted_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!skuId,
  });

  const { data: linkedVintage } = useQuery({
    queryKey: ["sku-vintage", sku?.vintage_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vintages").select("*, blocks:block_id(variety, name)").eq("id", sku.vintage_id).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!sku?.vintage_id,
  });

  const handleAdjustment = async () => {
    if (!orgId || !skuId) return;
    setSaving(true);
    try {
      const cd = parseInt(casesDelta) || 0;
      const bd = parseInt(bottlesDelta) || 0;

      const { error: adjError } = await supabase.from("inventory_adjustments").insert({
        org_id: orgId,
        sku_id: skuId,
        cases_delta: cd,
        bottles_delta: bd,
        reason: reason as any,
        notes: adjNotes || null,
        adjusted_by: user?.id || null,
      } as any);
      if (adjError) throw adjError;

      // Update SKU totals
      const newCases = (Number(sku.cases) || 0) + cd;
      const newLoose = (Number(sku.loose_bottles) || 0) + bd;
      const { error: updateError } = await supabase.from("inventory_skus")
        .update({ cases: Math.max(0, newCases), loose_bottles: Math.max(0, newLoose) } as any)
        .eq("id", skuId);
      if (updateError) throw updateError;

      // Low stock check
      if (newCases < 5) {
        await supabase.from("notifications").insert({
          org_id: orgId,
          user_id: user!.id,
          message: `Low stock alert: "${sku.label}" is down to ${Math.max(0, newCases)} cases`,
          type: "alert",
          channel: "email",
        });
      }

      toast.success("Adjustment recorded");
      qc.invalidateQueries({ queryKey: ["sku-detail", skuId] });
      qc.invalidateQueries({ queryKey: ["sku-adjustments", skuId] });
      qc.invalidateQueries({ queryKey: ["inventory-skus"] });
      setShowAdjust(false);
      setCasesDelta("0"); setBottlesDelta("0"); setAdjNotes("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !skuId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${orgId}/${skuId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("label-images").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("label-images").getPublicUrl(path);
      await supabase.from("inventory_skus").update({ label_image_url: publicUrl } as any).eq("id", skuId);
      qc.invalidateQueries({ queryKey: ["sku-detail", skuId] });
      toast.success("Label image uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!sku) return <div className="p-8 text-muted-foreground">SKU not found</div>;

  const totalBottles = (Number(sku.cases) || 0) * (Number(sku.bottles_per_case) || 12) + (Number(sku.loose_bottles) || 0);
  const totalValue = totalBottles * (Number(sku.price) || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-foreground">{sku.label}</h1>
          <div className="flex gap-2 mt-1">
            <Badge variant="secondary">{ALLOCATION_LABELS[sku.allocation_type] || sku.allocation_type}</Badge>
            {sku.vintage_year && <Badge variant="outline">{sku.vintage_year}</Badge>}
          </div>
        </div>
        <Button onClick={() => setShowAdjust(true)}><Plus className="h-4 w-4 mr-2" />Add Adjustment</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cases On Hand</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold font-display">{Number(sku.cases) || 0}</p></CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Bottles</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold font-display">{totalBottles}</p></CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Value</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold font-display">${totalValue.toLocaleString()}</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-md">
          <CardHeader><CardTitle className="font-display">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Variety</span><span>{sku.variety || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Bottles/Case</span><span>{sku.bottles_per_case || 12}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Loose Bottles</span><span>{sku.loose_bottles || 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Price/Bottle</span><span>${Number(sku.price)?.toFixed(2) || "0.00"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cost/Bottle</span><span>{sku.cost_per_bottle ? `$${Number(sku.cost_per_bottle).toFixed(2)}` : "—"}</span></div>
            {sku.notes && <div className="pt-2 border-t"><p className="text-muted-foreground">{sku.notes}</p></div>}
            {linkedVintage?.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Tasting Notes (from vintage)</p>
                <p className="text-muted-foreground">{linkedVintage.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader><CardTitle className="font-display">Label Image</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {sku.label_image_url ? (
              <img src={sku.label_image_url} alt="Label" className="max-h-48 rounded-lg object-contain" />
            ) : (
              <div className="h-32 w-full rounded-lg bg-muted flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
            <Label className="cursor-pointer">
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <span><Upload className="h-4 w-4 mr-2" />{uploading ? "Uploading..." : "Upload Label"}</span>
              </Button>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </Label>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">Adjustment History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Cases Δ</TableHead>
                <TableHead>Bottles Δ</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map((adj: any) => (
                <TableRow key={adj.id}>
                  <TableCell>{format(new Date(adj.adjusted_at), "MMM d, yyyy")}</TableCell>
                  <TableCell className={adj.cases_delta > 0 ? "text-green-600" : adj.cases_delta < 0 ? "text-red-600" : ""}>
                    {adj.cases_delta > 0 ? "+" : ""}{adj.cases_delta}
                  </TableCell>
                  <TableCell className={adj.bottles_delta > 0 ? "text-green-600" : adj.bottles_delta < 0 ? "text-red-600" : ""}>
                    {adj.bottles_delta > 0 ? "+" : ""}{adj.bottles_delta}
                  </TableCell>
                  <TableCell><Badge variant="outline">{REASON_LABELS[adj.reason] || adj.reason}</Badge></TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">{adj.notes || "—"}</TableCell>
                </TableRow>
              ))}
              {adjustments.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No adjustments yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Adjustment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cases Δ</Label><Input type="number" value={casesDelta} onChange={(e) => setCasesDelta(e.target.value)} /></div>
              <div><Label>Bottles Δ</Label><Input type="number" value={bottlesDelta} onChange={(e) => setBottlesDelta(e.target.value)} /></div>
            </div>
            <div>
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={adjNotes} onChange={(e) => setAdjNotes(e.target.value)} rows={2} /></div>
            <Button onClick={handleAdjustment} disabled={saving} className="w-full">{saving ? "Saving..." : "Record Adjustment"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SkuDetail;
