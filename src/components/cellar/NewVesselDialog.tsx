import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewVesselDialog({ open, onOpenChange }: Props) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [material, setMaterial] = useState("");
  const [tempControlled, setTempControlled] = useState(false);
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fermentation_vessels").insert({
        org_id: organization!.id,
        name,
        capacity_liters: capacity ? parseFloat(capacity) : null,
        material: material || null,
        temp_controlled: tempControlled,
        notes: notes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vessels"] });
      toast.success("Vessel added");
      resetForm();
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setName(""); setCapacity(""); setMaterial(""); setTempControlled(false); setNotes("");
  };

  const formContent = (
    <div className="space-y-4 mt-2">
      <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tank 1" /></div>
      <div><Label>Capacity (liters)</Label><Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
      <div><Label>Material</Label><Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="e.g. Stainless Steel" /></div>
      <div className="flex items-center justify-between">
        <Label>Temperature Controlled</Label>
        <Switch checked={tempControlled} onCheckedChange={setTempControlled} />
      </div>
      <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <Button className="w-full min-h-[44px]" onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
        {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Add Vessel
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="pb-safe max-h-[90vh] overflow-y-auto">
          <SheetHeader><SheetTitle>New Vessel</SheetTitle></SheetHeader>
          {formContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent><DialogHeader><DialogTitle>New Vessel</DialogTitle></DialogHeader>{formContent}</DialogContent>
    </Dialog>
  );
}
