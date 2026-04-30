import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTaskDialog({ open, onOpenChange }: Props) {
  const { organization, user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [title, setTitle] = useState("");
  const [blockId, setBlockId] = useState<string>("");
  const [dueDate, setDueDate] = useState<Date>();
  const [instructions, setInstructions] = useState("");

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

  const createTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        org_id: organization!.id,
        title,
        block_id: blockId || null,
        assigned_to: user!.id,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        instructions: instructions || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created");
      resetAndClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetAndClose = () => {
    setTitle("");
    setBlockId("");
    setDueDate(undefined);
    setInstructions("");
    onOpenChange(false);
  };

  const formContent = (
    <div className="space-y-4 mt-2">
      <div>
        <Label htmlFor="task-title">Title *</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Spray Block A2"
        />
      </div>

      <div>
        <Label>Block</Label>
        <Select value={blockId} onValueChange={setBlockId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a block (optional)" />
          </SelectTrigger>
          <SelectContent>
            {blocks.map((b: any) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name} · {b.vineyards?.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="inline-flex items-center">Due Date<HelpTooltip content="The date this task should be completed. Overdue tasks appear highlighted in red on the dashboard." /></Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dueDate ? format(dueDate, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={setDueDate}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label>Instructions</Label>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Any additional details…"
          rows={3}
        />
      </div>

      <Button
        className="w-full min-h-[44px]"
        onClick={() => createTask.mutate()}
        disabled={!title.trim() || createTask.isPending}
      >
        {createTask.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Create Task
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="pb-safe max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Task</SheetTitle>
          </SheetHeader>
          {formContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
