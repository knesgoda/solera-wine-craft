import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [vesselType, setVesselType] = useState<string>("");
  const [vesselStatus, setVesselStatus] = useState<string>("empty_clean");
  const [capacity, setCapacity] = useState("");
  const [fillLevelPct, setFillLevelPct] = useState<string>("0");
  const [material, setMaterial] = useState("");
  const [tempControlled, setTempControlled] = useState(false);
  const [oakType, setOakType] = useState<string>("");
  const [toastLevel, setToastLevel] = useState<string>("");
  const [barrelAge, setBarrelAge] = useState<string>("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fermentation_vessels").insert({
        org_id: organization!.id,
        name,
        vessel_type: vesselType || null,
        status: vesselStatus || null,
        fill_level_pct: fillLevelPct === "" ? 0 : parseInt(fillLevelPct, 10),
        capacity_liters: capacity ? parseFloat(capacity) : null,
        material: material || null,
        temp_controlled: tempControlled,
        oak_type: vesselType === "barrel" ? (oakType || null) : null,
        toast_level: vesselType === "barrel" ? (toastLevel || null) : null,
        barrel_age_fills: vesselType === "barrel" && barrelAge !== "" ? parseInt(barrelAge, 10) : null,
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
    setName(""); setVesselType(""); setVesselStatus("empty_clean");
    setCapacity(""); setFillLevelPct("0"); setMaterial(""); setTempControlled(false);
    setOakType(""); setToastLevel(""); setBarrelAge(""); setNotes("");
  };

  const formContent = (
    <div className="space-y-4 mt-2">
      <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tank 1" /></div>
      <div>
        <Label className="inline-flex items-center">Vessel Type *<HelpTooltip content="The container type: tank, barrel, amphora, etc. Affects oxygenation, flavor development, and the appropriate monitoring schedule." /></Label>
        <Select value={vesselType} onValueChange={setVesselType}>
          <SelectTrigger><SelectValue placeholder="Select vessel type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tank">Tank</SelectItem>
            <SelectItem value="barrel">Barrel</SelectItem>
            <SelectItem value="amphora">Amphora</SelectItem>
            <SelectItem value="concrete_egg">Concrete Egg</SelectItem>
            <SelectItem value="flex_tank">Flex Tank</SelectItem>
            <SelectItem value="foudre">Foudre</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="inline-flex items-center">Vessel Status<HelpTooltip content="Current state of the vessel. Determines what actions are available and affects monitoring schedule." /></Label>
        <Select value={vesselStatus} onValueChange={setVesselStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="empty_clean">Empty &amp; Clean</SelectItem>
            <SelectItem value="active_fermentation">Active Fermentation</SelectItem>
            <SelectItem value="aging">Aging</SelectItem>
            <SelectItem value="awaiting_cleaning">Awaiting Cleaning</SelectItem>
            <SelectItem value="out_of_service">Out of Service</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label className="inline-flex items-center">Capacity (liters)<HelpTooltip content="Total volume the vessel holds, in liters or gallons depending on your unit preference. Used for fill level tracking and cooperage planning." /></Label><Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
      <div>
        <Label className="inline-flex items-center">Fill Level (%)<HelpTooltip content="Current volume of wine in this vessel as a percentage of capacity. Solera uses this to flag ullage, which is empty headspace that could cause oxidation." /></Label>
        <Input type="number" min={0} max={100} step={1} value={fillLevelPct} onChange={(e) => setFillLevelPct(e.target.value)} />
      </div>
      <div><Label className="inline-flex items-center">Material<HelpTooltip content="The vessel material such as stainless steel, oak barrel, concrete, or amphora. Affects oxygenation, flavor development, and the appropriate monitoring schedule." /></Label><Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="e.g. Stainless Steel" /></div>
      <div className="flex items-center justify-between">
        <Label>Temperature Controlled</Label>
        <Switch checked={tempControlled} onCheckedChange={setTempControlled} />
      </div>
      {vesselType === "barrel" && (
        <div className="space-y-4 border border-border rounded-lg p-3 bg-muted/30">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Barrel Details</div>
          <div>
            <Label className="inline-flex items-center">Oak Type<HelpTooltip content="The species and origin of oak. French adds spice and structure. American adds vanilla and coconut. Hungarian is a middle ground. Affects flavor extraction rate." /></Label>
            <Select value={oakType} onValueChange={setOakType}>
              <SelectTrigger><SelectValue placeholder="Select oak type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="french">French</SelectItem>
                <SelectItem value="american">American</SelectItem>
                <SelectItem value="hungarian">Hungarian</SelectItem>
                <SelectItem value="eastern_european">Eastern European</SelectItem>
                <SelectItem value="slavonian">Slavonian</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="inline-flex items-center">Toast Level<HelpTooltip content="How heavily the barrel was charred during manufacture. Light preserves wood tannins. Medium adds vanilla and caramel. Heavy adds smoke and reduces tannin extraction." /></Label>
            <Select value={toastLevel} onValueChange={setToastLevel}>
              <SelectTrigger><SelectValue placeholder="Select toast level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="medium_plus">Medium Plus</SelectItem>
                <SelectItem value="heavy">Heavy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="inline-flex items-center">Barrel Age (fills)<HelpTooltip content="How many times this barrel has been used. First-fill barrels impart the most flavor. By the third or fourth fill, oak influence is minimal." /></Label>
            <Input type="number" min={0} max={20} step={1} value={barrelAge} onChange={(e) => setBarrelAge(e.target.value)} placeholder="0" />
          </div>
        </div>
      )}
      <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <Button className="w-full min-h-[44px]" onClick={() => create.mutate()} disabled={!name.trim() || !vesselType || create.isPending}>
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
