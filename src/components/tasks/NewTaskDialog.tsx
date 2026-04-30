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
  const [taskType, setTaskType] = useState<string>("");
  const [priority, setPriority] = useState<string>("medium");
  const [assignedUserId, setAssignedUserId] = useState<string>("");

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

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["org-members", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("org_id", organization!.id);
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
        task_type: taskType || null,
        priority: priority || null,
        assigned_to_user_id: assignedUserId || null,
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
    setTaskType("");
    setPriority("medium");
    setAssignedUserId("");
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="inline-flex items-center">Task Type<HelpTooltip content="The viticulture activity category. Used for grouping tasks in reports and tracking labor hours by activity (e.g. spraying vs pruning vs harvest)." /></Label>
          <Select value={taskType} onValueChange={setTaskType}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="spraying">Spraying</SelectItem>
              <SelectItem value="pruning">Pruning</SelectItem>
              <SelectItem value="canopy_management">Canopy Management</SelectItem>
              <SelectItem value="irrigation">Irrigation</SelectItem>
              <SelectItem value="harvest">Harvest</SelectItem>
              <SelectItem value="sampling">Sampling</SelectItem>
              <SelectItem value="planting">Planting</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="inline-flex items-center">Priority<HelpTooltip content="Urgency level. High priority tasks surface at the top of dashboards and trigger reminders. Use Critical sparingly for time-sensitive work like spray windows." /></Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="inline-flex items-center">Assign To<HelpTooltip content="The team member responsible for completing this task. They will see it on their dashboard and receive notifications. Leave blank to assign to yourself." /></Label>
        <Select value={assignedUserId} onValueChange={setAssignedUserId}>
          <SelectTrigger><SelectValue placeholder="Select team member (optional)" /></SelectTrigger>
          <SelectContent>
            {teamMembers.map((m: any) => (
              <SelectItem key={m.id} value={m.id}>
                {[m.first_name, m.last_name].filter(Boolean).join(" ") || m.email}
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
