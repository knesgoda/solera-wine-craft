import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const additionTypes = [
  { value: "so2", label: "SO₂" },
  { value: "yeast_nutrient", label: "Yeast Nutrient" },
  { value: "enzyme", label: "Enzyme" },
  { value: "fining_agent", label: "Fining Agent" },
  { value: "acid", label: "Acid" },
  { value: "other", label: "Other" },
];

const units = ["g", "kg", "mL", "L", "oz", "lb"];

interface Props {
  vintageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAddition?: any;
}

export function NewAdditionDialog({ vintageId, open, onOpenChange, editingAddition }: Props) {
  const { organization, profile } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const isEditing = !!editingAddition;

  const [additionType, setAdditionType] = useState("");
  const [ttbCode, setTtbCode] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [batchSize, setBatchSize] = useState("");
  const [addedBy, setAddedBy] = useState(
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || ""
  );

  useEffect(() => {
    if (editingAddition) {
      setAdditionType(editingAddition.addition_type || "");
      setTtbCode(editingAddition.ttb_code || "");
      setAmount(editingAddition.amount != null ? String(editingAddition.amount) : "");
      setUnit(editingAddition.unit || "");
      setBatchSize(editingAddition.batch_size != null ? String(editingAddition.batch_size) : "");
      setAddedBy(editingAddition.added_by || "");
    } else {
      setAdditionType("");
      setTtbCode("");
      setAmount("");
      setUnit("");
      setBatchSize("");
      setAddedBy([profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "");
    }
  }, [editingAddition, open]);

  const save = useMutation({
    mutationFn: async () => {
      const record = {
        vintage_id: vintageId,
        org_id: organization!.id,
        addition_type: additionType as any,
        ttb_code: ttbCode || null,
        amount: parseFloat(amount),
        unit: unit as any,
        batch_size: batchSize ? parseFloat(batchSize) : null,
        added_by: addedBy || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("ttb_additions")
          .update(record as any)
          .eq("id", editingAddition.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ttb_additions").insert(record as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ttb-additions", vintageId] });
      toast.success(isEditing ? "Addition updated" : "Addition recorded");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const canSubmit = additionType && amount && unit;

  const title = isEditing ? "Edit Treatment" : "Add Treatment";
  const buttonText = isEditing ? "Update Addition" : "Record Addition";

  const formContent = (
    <div className="space-y-4 mt-2">
      <div>
        <Label>Type *</Label>
        <Select value={additionType} onValueChange={setAdditionType}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {additionTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>TTB Code</Label>
        <Input value={ttbCode} onChange={(e) => setTtbCode(e.target.value)} placeholder="e.g. 24.246" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Amount *</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label>Unit *</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Batch Size (gallons)</Label>
        <Input type="number" step="0.1" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
      </div>
      <div>
        <Label>Added By</Label>
        <Input value={addedBy} onChange={(e) => setAddedBy(e.target.value)} />
      </div>
      <Button className="w-full min-h-[44px]" onClick={() => save.mutate()} disabled={!canSubmit || save.isPending}>
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {buttonText}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="pb-safe max-h-[90vh] overflow-y-auto">
          <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
          {formContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
