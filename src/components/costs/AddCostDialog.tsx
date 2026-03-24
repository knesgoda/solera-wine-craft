import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AddCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedVintageId?: string;
}

export function AddCostDialog({ open, onOpenChange, preselectedVintageId }: AddCostDialogProps) {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  const queryClient = useQueryClient();

  const [method, setMethod] = useState<string>("apportioned");
  const [vintageId, setVintageId] = useState(preselectedVintageId || "");
  const [categoryId, setCategoryId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState<Date>(new Date());
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [notes, setNotes] = useState("");
  // Transactional
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  // Ad hoc
  const [vendor, setVendor] = useState("");

  useEffect(() => {
    if (preselectedVintageId) setVintageId(preselectedVintageId);
  }, [preselectedVintageId]);

  useEffect(() => {
    if (!open) {
      setMethod("apportioned");
      if (!preselectedVintageId) setVintageId("");
      setCategoryId("");
      setEffectiveDate(new Date());
      setDescription("");
      setTotalAmount("");
      setNotes("");
      setMaterialId("");
      setQuantity("");
      setUnit("");
      setCostPerUnit("");
      setVendor("");
    }
  }, [open, preselectedVintageId]);

  const { data: vintages = [] } = useQuery({
    queryKey: ["vintages-for-costs", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vintages")
        .select("id, year, blocks(name)")
        .eq("org_id", orgId!)
        .order("year", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId && open,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["cost-categories", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_categories")
        .select("*")
        .eq("org_id", orgId!)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && open,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["material-unit-costs", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_unit_costs")
        .select("*, cost_categories(name)")
        .eq("org_id", orgId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId && open && method === "transactional",
  });

  // Auto-fill when material selected
  useEffect(() => {
    if (materialId && method === "transactional") {
      const mat = materials.find((m: any) => m.id === materialId);
      if (mat) {
        setUnit(mat.unit);
        setCostPerUnit(String(mat.cost_per_unit));
        if (mat.category_id) setCategoryId(mat.category_id);
      }
    }
  }, [materialId, materials, method]);

  // Auto-calculate transactional total
  const transactionalTotal = method === "transactional" && quantity && costPerUnit
    ? (parseFloat(quantity) * parseFloat(costPerUnit)).toFixed(2)
    : "";

  // Auto-generate transactional description
  const transactionalDesc = method === "transactional" && materialId
    ? (() => {
        const mat = materials.find((m: any) => m.id === materialId);
        return mat && quantity ? `${mat.name} - ${quantity}${unit} @ $${costPerUnit}/${unit}` : "";
      })()
    : "";

  // Get lot gallons
  const getLotGallons = async (vId: string): Promise<number> => {
    // From vessels
    const { data: vessels } = await supabase
      .from("fermentation_vessels")
      .select("capacity_liters")
      .eq("vintage_id", vId);
    const vesselGal = (vessels || []).reduce((s: number, v: any) => s + (v.capacity_liters || 0) / 3.78541, 0);
    // From barrels
    const { data: barrels } = await supabase
      .from("barrels")
      .select("size_liters")
      .eq("vintage_id", vId);
    const barrelGal = (barrels || []).reduce((s: number, b: any) => s + (b.size_liters || 0) / 3.78541, 0);
    // Fallback to tons
    if (vesselGal + barrelGal === 0) {
      const { data: v } = await supabase.from("vintages").select("tons_harvested").eq("id", vId).single();
      return (v?.tons_harvested || 0) * 170;
    }
    return vesselGal + barrelGal;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amount = method === "transactional" ? parseFloat(transactionalTotal) : parseFloat(totalAmount);
      if (!amount || amount <= 0) throw new Error("Amount must be greater than 0");
      if (!vintageId) throw new Error("Vintage is required");
      if (!categoryId) throw new Error("Category is required");

      const lotGallons = await getLotGallons(vintageId);

      const entry: any = {
        org_id: orgId,
        vintage_id: vintageId,
        category_id: categoryId,
        method: method as any,
        description: method === "transactional" ? transactionalDesc : description,
        total_amount: amount,
        effective_date: format(effectiveDate, "yyyy-MM-dd"),
        lot_gallons_at_entry: lotGallons > 0 ? lotGallons : null,
        notes: notes || null,
        created_by: profile?.id,
      };

      if (method === "transactional") {
        entry.quantity = parseFloat(quantity);
        entry.unit = unit;
        entry.cost_per_unit = parseFloat(costPerUnit);
      }

      const { error } = await supabase.from("cost_entries").insert(entry);
      if (error) throw error;

      return { amount, lotGallons };
    },
    onSuccess: ({ amount, lotGallons }) => {
      queryClient.invalidateQueries({ queryKey: ["cost-entries"] });
      queryClient.invalidateQueries({ queryKey: ["cost-summary-ytd"] });
      queryClient.invalidateQueries({ queryKey: ["lot-cost-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["vintage-costs"] });
      const perGal = lotGallons > 0 ? ` ($${(amount / lotGallons).toFixed(2)}/gal)` : "";
      toast.success(`Cost added: $${amount.toFixed(2)}${perGal}`);
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const canSave = vintageId && categoryId && (
    method === "transactional" ? (materialId && quantity && costPerUnit) :
    (description.trim() && totalAmount)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Cost Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Method */}
          <div className="space-y-1.5">
            <Label>Costing Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="apportioned">Apportioned</SelectItem>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="ad_hoc">Ad Hoc</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Vintage */}
          <div className="space-y-1.5">
            <Label>Vintage/Lot *</Label>
            <Select value={vintageId} onValueChange={setVintageId}>
              <SelectTrigger><SelectValue placeholder="Select lot..." /></SelectTrigger>
              <SelectContent>
                {vintages.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.year} {v.blocks?.name || ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2">
                      {c.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />}
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Effective Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(effectiveDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={effectiveDate} onSelect={(d) => d && setEffectiveDate(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Method-specific fields */}
          {method === "transactional" ? (
            <>
              <div className="space-y-1.5">
                <Label>Material *</Label>
                <Select value={materialId} onValueChange={setMaterialId}>
                  <SelectTrigger><SelectValue placeholder="Select material..." /></SelectTrigger>
                  <SelectContent>
                    {materials.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} (${Number(m.cost_per_unit).toFixed(4)}/{m.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Quantity *</Label>
                  <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="500" />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <Input value={unit} readOnly className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label>$/Unit</Label>
                  <Input type="number" step="0.0001" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} />
                </div>
              </div>
              {transactionalTotal && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-lg font-bold text-foreground">${parseFloat(transactionalTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Description *</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={method === "ad_hoc" ? "Mobile bottling service - Nov 2026" : "Quarterly barrel storage allocation"} />
              </div>
              <div className="space-y-1.5">
                <Label>Total Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" step="0.01" min="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="pl-7" placeholder="0.00" />
                </div>
              </div>
              {method === "ad_hoc" && (
                <div className="space-y-1.5">
                  <Label>Vendor/Source</Label>
                  <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Optional" />
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Cost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
