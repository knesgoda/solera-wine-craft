import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewVintageDialog({ open, onOpenChange }: Props) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [blockId, setBlockId] = useState("");
  const [harvestDate, setHarvestDate] = useState<Date>();
  const [tonsHarvested, setTonsHarvested] = useState("");
  const [notes, setNotes] = useState("");

  const { data: blocks = [] } = useQuery({
    queryKey: ["all-blocks", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocks")
        .select("id, name, vineyard_id, vineyards(name)")
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vintages").insert({
        org_id: organization!.id,
        year: parseInt(year),
        block_id: blockId || null,
        harvest_date: harvestDate ? format(harvestDate, "yyyy-MM-dd") : null,
        tons_harvested: tonsHarvested ? parseFloat(tonsHarvested) : null,
        notes: notes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vintages"] });
      toast.success("Vintage created");
      setYear(new Date().getFullYear().toString());
      setBlockId("");
      setHarvestDate(undefined);
      setTonsHarvested("");
      setNotes("");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Vintage</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Year *</Label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div>
            <Label>Block</Label>
            <Select value={blockId} onValueChange={setBlockId}>
              <SelectTrigger><SelectValue placeholder="Select block (optional)" /></SelectTrigger>
              <SelectContent>
                {blocks.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name} · {b.vineyards?.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Harvest Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !harvestDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {harvestDate ? format(harvestDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={harvestDate} onSelect={setHarvestDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Tons Harvested</Label>
            <Input type="number" step="0.1" value={tonsHarvested} onChange={(e) => setTonsHarvested(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <Button className="w-full min-h-[44px]" onClick={() => create.mutate()} disabled={!year || create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Vintage
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
