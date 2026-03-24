import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Ban, GitMerge, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

interface CostAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vintageId: string;
}

export function CostAuditDialog({ open, onOpenChange, vintageId }: CostAuditDialogProps) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["cost-audit-log", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("*, cost_categories(name), blending_trials(name), profiles!cost_entries_created_by_fkey(first_name, last_name), voided_profiles:profiles!cost_entries_voided_by_fkey(first_name, last_name)")
        .eq("vintage_id", vintageId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const timeline: any[] = [];
      for (const e of (data || []) as any[]) {
        const creatorName = e.profiles ? `${e.profiles.first_name || ""} ${e.profiles.last_name || ""}`.trim() : "System";
        // Created event
        timeline.push({
          id: `${e.id}-created`,
          date: e.created_at,
          type: e.blend_trial_id ? "blend_received" : "created",
          icon: e.blend_trial_id ? GitMerge : Plus,
          title: e.blend_trial_id
            ? `Blend cost received: ${e.blending_trials?.name || "Unknown blend"}`
            : `Cost entry created: ${e.cost_categories?.name || "Unknown"}`,
          description: e.description,
          amount: Number(e.total_amount),
          method: e.method,
          user: creatorName,
          blendName: e.blending_trials?.name,
          transferRatio: e.transfer_ratio,
        });

        // Voided event
        if (e.status === "voided" && e.voided_at) {
          const voiderName = e.voided_profiles ? `${e.voided_profiles.first_name || ""} ${e.voided_profiles.last_name || ""}`.trim() : "System";
          timeline.push({
            id: `${e.id}-voided`,
            date: e.voided_at,
            type: "voided",
            icon: Ban,
            title: `Cost entry voided: ${e.cost_categories?.name || "Unknown"}`,
            description: e.void_reason || "No reason provided",
            amount: Number(e.total_amount),
            user: voiderName,
          });
        }
      }

      return timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    },
    enabled: !!vintageId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cost Audit Log</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No cost events recorded for this lot.</p>
        ) : (
          <div className="relative pl-6 space-y-0">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
            {events.map((ev: any) => {
              const Icon = ev.icon;
              const isVoid = ev.type === "voided";
              const isBlend = ev.type === "blend_received";
              return (
                <div key={ev.id} className="relative pb-5 last:pb-0">
                  <div className={cn(
                    "absolute left-[-17px] top-1 h-5 w-5 rounded-full flex items-center justify-center border-2 border-background",
                    isVoid ? "bg-destructive/20" : isBlend ? "bg-primary/20" : "bg-muted"
                  )}>
                    <Icon className={cn("h-3 w-3", isVoid ? "text-destructive" : isBlend ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div className="ml-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-sm font-medium", isVoid ? "text-destructive" : "text-foreground")}>{ev.title}</span>
                      {ev.method && <Badge variant="outline" className="text-xs capitalize">{ev.method.replace("_", " ")}</Badge>}
                    </div>
                    <p className={cn("text-xs mt-0.5", isVoid ? "text-destructive/70" : "text-muted-foreground")}>{ev.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="font-mono">{ev.amount < 0 ? `-${fmt(Math.abs(ev.amount))}` : fmt(ev.amount)}</span>
                      <span>by {ev.user}</span>
                      <span>{format(parseISO(ev.date), "MMM d, yyyy h:mm a")}</span>
                    </div>
                    {ev.transferRatio && (
                      <p className="text-xs text-primary mt-0.5">Transfer ratio: {(ev.transferRatio * 100).toFixed(0)}%</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
