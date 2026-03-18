import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  vintageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewLabSampleDialog({ vintageId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [sampledAt, setSampledAt] = useState(new Date().toISOString().slice(0, 16));
  const [brix, setBrix] = useState("");
  const [ph, setPh] = useState("");
  const [ta, setTa] = useState("");
  const [va, setVa] = useState("");
  const [so2Free, setSo2Free] = useState("");
  const [so2Total, setSo2Total] = useState("");
  const [alcohol, setAlcohol] = useState("");
  const [rs, setRs] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const record = {
        vintage_id: vintageId,
        sampled_at: new Date(sampledAt).toISOString(),
        brix: brix ? parseFloat(brix) : null,
        ph: ph ? parseFloat(ph) : null,
        ta: ta ? parseFloat(ta) : null,
        va: va ? parseFloat(va) : null,
        so2_free: so2Free ? parseFloat(so2Free) : null,
        so2_total: so2Total ? parseFloat(so2Total) : null,
        alcohol: alcohol ? parseFloat(alcohol) : null,
        rs: rs ? parseFloat(rs) : null,
        notes: notes || null,
      };
      const { error } = await supabase.from("lab_samples").insert(record as any);
      if (error) throw error;

      // Evaluate alert rules asynchronously
      supabase.functions.invoke("evaluate-alerts", {
        body: { type: "lab_sample", record },
      }).catch((e) => console.error("Alert evaluation failed:", e));

      // Detect anomalies asynchronously
      supabase.functions.invoke("detect-anomalies", {
        body: { type: "lab_sample", record },
      }).catch((e) => console.error("Anomaly detection failed:", e));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-samples", vintageId] });
      toast.success("Lab sample recorded");
      resetForm();
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setSampledAt(new Date().toISOString().slice(0, 16));
    setBrix(""); setPh(""); setTa(""); setVa("");
    setSo2Free(""); setSo2Total(""); setAlcohol(""); setRs(""); setNotes("");
  };

  const formContent = (
    <div className="space-y-4 mt-2">
      <div>
        <Label>Sampled At *</Label>
        <Input type="datetime-local" value={sampledAt} onChange={(e) => setSampledAt(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Brix (°)</Label><Input type="number" step="0.1" value={brix} onChange={(e) => setBrix(e.target.value)} /></div>
        <div><Label>pH</Label><Input type="number" step="0.01" value={ph} onChange={(e) => setPh(e.target.value)} /></div>
        <div><Label>TA (g/L)</Label><Input type="number" step="0.01" value={ta} onChange={(e) => setTa(e.target.value)} /></div>
        <div><Label>VA (g/L)</Label><Input type="number" step="0.01" value={va} onChange={(e) => setVa(e.target.value)} /></div>
        <div><Label>Free SO₂</Label><Input type="number" step="1" value={so2Free} onChange={(e) => setSo2Free(e.target.value)} /></div>
        <div><Label>Total SO₂</Label><Input type="number" step="1" value={so2Total} onChange={(e) => setSo2Total(e.target.value)} /></div>
        <div><Label>Alcohol (%)</Label><Input type="number" step="0.1" value={alcohol} onChange={(e) => setAlcohol(e.target.value)} /></div>
        <div><Label>RS (g/L)</Label><Input type="number" step="0.1" value={rs} onChange={(e) => setRs(e.target.value)} /></div>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <Button className="w-full min-h-[44px]" onClick={() => create.mutate()} disabled={!sampledAt || create.isPending}>
        {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Record Sample
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="pb-safe max-h-[90vh] overflow-y-auto">
          <SheetHeader><SheetTitle>New Lab Sample</SheetTitle></SheetHeader>
          {formContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Lab Sample</DialogTitle></DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
