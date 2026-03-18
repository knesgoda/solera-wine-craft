import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface Lot {
  vintage_id: string;
  barrel_id: string;
  percentage: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTrialDialog({ open, onOpenChange }: Props) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [name, setName] = useState("");
  const [vintageId, setVintageId] = useState("");
  const [totalVolume, setTotalVolume] = useState("");
  const [notes, setNotes] = useState("");
  const [stars, setStars] = useState(0);
  const [lots, setLots] = useState<Lot[]>([{ vintage_id: "", barrel_id: "", percentage: "" }]);

  const { data: vintages = [] } = useQuery({
    queryKey: ["vintages-for-trial", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vintages").select("id, year").eq("org_id", organization!.id).order("year", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id,
  });

  const { data: barrels = [] } = useQuery({
    queryKey: ["barrels-for-trial", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barrels").select("id, barrel_id").eq("org_id", organization!.id).order("barrel_id");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id,
  });

  const totalPct = lots.reduce((sum, l) => sum + (parseFloat(l.percentage) || 0), 0);

  const create = useMutation({
    mutationFn: async () => {
      if (Math.abs(totalPct - 100) > 0.1) throw new Error("Lot percentages must sum to 100%");

      const { data: trial, error } = await supabase.from("blending_trials").insert({
        org_id: organization!.id,
        name,
        vintage_id: vintageId || null,
        total_volume_liters: totalVolume ? parseFloat(totalVolume) : null,
        notes: notes || null,
        stars: stars || null,
      } as any).select().single();
      if (error) throw error;

      const vol = totalVolume ? parseFloat(totalVolume) : null;
      const lotInserts = lots
        .filter((l) => l.vintage_id || l.barrel_id)
        .map((l) => ({
          trial_id: (trial as any).id,
          vintage_id: l.vintage_id || null,
          barrel_id: l.barrel_id || null,
          percentage: parseFloat(l.percentage),
          volume_liters: vol ? (parseFloat(l.percentage) / 100) * vol : null,
        }));

      if (lotInserts.length > 0) {
        const { error: lotErr } = await supabase.from("blending_trial_lots").insert(lotInserts as any);
        if (lotErr) throw lotErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blending-trials"] });
      toast.success("Trial created");
      resetForm();
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setName(""); setVintageId(""); setTotalVolume(""); setNotes(""); setStars(0);
    setLots([{ vintage_id: "", barrel_id: "", percentage: "" }]);
  };

  const updateLot = (idx: number, field: keyof Lot, value: string) => {
    const updated = [...lots];
    updated[idx] = { ...updated[idx], [field]: value };
    setLots(updated);
  };

  const formContent = (
    <div className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto">
      <div><Label>Trial Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blend A v2" /></div>
      <div>
        <Label>Target Vintage</Label>
        <Select value={vintageId} onValueChange={setVintageId}>
          <SelectTrigger><SelectValue placeholder="Select vintage (optional)" /></SelectTrigger>
          <SelectContent>{vintages.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.year}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Total Volume (L)</Label><Input type="number" value={totalVolume} onChange={(e) => setTotalVolume(e.target.value)} /></div>

      {/* Star Rating */}
      <div>
        <Label>Rating</Label>
        <div className="flex gap-1 mt-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} type="button" onClick={() => setStars(s === stars ? 0 : s)} className="p-0.5">
              <Star className={`h-6 w-6 ${s <= stars ? "text-secondary fill-secondary" : "text-muted"}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Lots */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Lots</Label>
          <span className={`text-sm ${Math.abs(totalPct - 100) > 0.1 ? "text-destructive" : "text-primary"}`}>
            {totalPct.toFixed(1)}%
          </span>
        </div>
        {lots.map((lot, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 mb-2 items-end">
            <div>
              <Select value={lot.vintage_id} onValueChange={(v) => updateLot(idx, "vintage_id", v)}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Vintage" /></SelectTrigger>
                <SelectContent>{vintages.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.year}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Select value={lot.barrel_id} onValueChange={(v) => updateLot(idx, "barrel_id", v)}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Barrel" /></SelectTrigger>
                <SelectContent>{barrels.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.barrel_id}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input
              type="number"
              step="0.1"
              placeholder="%"
              value={lot.percentage}
              onChange={(e) => updateLot(idx, "percentage", e.target.value)}
              className="text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setLots(lots.filter((_, i) => i !== idx))}
              disabled={lots.length <= 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLots([...lots, { vintage_id: "", barrel_id: "", percentage: "" }])}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Lot
        </Button>
      </div>

      <div><Label>Tasting Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <Button className="w-full min-h-[44px]" onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
        {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Create Trial
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="pb-safe max-h-[90vh] overflow-y-auto">
          <SheetHeader><SheetTitle>New Blending Trial</SheetTitle></SheetHeader>
          {formContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Blending Trial</DialogTitle></DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
