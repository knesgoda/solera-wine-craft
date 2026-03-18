import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const ALLOCATION_OPTIONS = [
  { value: "dtc", label: "DTC" },
  { value: "wine_club", label: "Wine Club" },
  { value: "wholesale", label: "Wholesale" },
  { value: "restaurant", label: "Restaurant" },
  { value: "library", label: "Library" },
  { value: "custom_crush_client", label: "Custom Crush Client" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NewSkuDialog({ open, onOpenChange, onCreated }: Props) {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState("");
  const [variety, setVariety] = useState("");
  const [vintageYear, setVintageYear] = useState("");
  const [cases, setCases] = useState("0");
  const [bottlesPerCase, setBottlesPerCase] = useState("12");
  const [looseBottles, setLooseBottles] = useState("0");
  const [price, setPrice] = useState("");
  const [costPerBottle, setCostPerBottle] = useState("");
  const [allocationType, setAllocationType] = useState("dtc");
  const [notes, setNotes] = useState("");
  const [vintageId, setVintageId] = useState<string>("");

  const { data: vintages = [] } = useQuery({
    queryKey: ["vintages-for-sku", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vintages")
        .select("id, year, block_id, blocks:block_id(variety)")
        .eq("org_id", orgId!);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && open,
  });

  const handleVintageLink = (vid: string) => {
    setVintageId(vid);
    const v = vintages.find((vt: any) => vt.id === vid);
    if (v) {
      setVintageYear(String(v.year));
      if ((v as any).blocks?.variety) setVariety((v as any).blocks.variety);
    }
  };

  const handleSave = async () => {
    if (!orgId || !label) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("inventory_skus").insert({
        org_id: orgId,
        label,
        variety: variety || null,
        vintage_year: vintageYear ? parseInt(vintageYear) : null,
        cases: parseInt(cases) || 0,
        bottles_per_case: parseInt(bottlesPerCase) || 12,
        loose_bottles: parseInt(looseBottles) || 0,
        price: price ? parseFloat(price) : null,
        cost_per_bottle: costPerBottle ? parseFloat(costPerBottle) : null,
        allocation_type: allocationType as any,
        notes: notes || null,
        vintage_id: vintageId || null,
      } as any);
      if (error) throw error;
      toast.success("SKU created");
      onCreated();
      onOpenChange(false);
      setLabel(""); setVariety(""); setVintageYear(""); setCases("0"); setLooseBottles("0"); setPrice(""); setNotes(""); setVintageId("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">New SKU</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Label *</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Estate Cabernet Sauvignon" />
          </div>

          <div>
            <Label>Link to Vintage (optional)</Label>
            <Select value={vintageId} onValueChange={handleVintageLink}>
              <SelectTrigger><SelectValue placeholder="Select vintage..." /></SelectTrigger>
              <SelectContent>
                {vintages.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.year} — {v.blocks?.variety || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Variety</Label>
              <Input value={variety} onChange={(e) => setVariety(e.target.value)} />
            </div>
            <div>
              <Label>Vintage Year</Label>
              <Input type="number" value={vintageYear} onChange={(e) => setVintageYear(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Cases</Label>
              <Input type="number" value={cases} onChange={(e) => setCases(e.target.value)} />
            </div>
            <div>
              <Label>Bottles/Case</Label>
              <Input type="number" value={bottlesPerCase} onChange={(e) => setBottlesPerCase(e.target.value)} />
            </div>
            <div>
              <Label>Loose Bottles</Label>
              <Input type="number" value={looseBottles} onChange={(e) => setLooseBottles(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price / Bottle</Label>
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <Label>Cost / Bottle</Label>
              <Input type="number" step="0.01" value={costPerBottle} onChange={(e) => setCostPerBottle(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Allocation Type</Label>
            <Select value={allocationType} onValueChange={setAllocationType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALLOCATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <Button onClick={handleSave} disabled={saving || !label} className="w-full">
            {saving ? "Saving..." : "Create SKU"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
