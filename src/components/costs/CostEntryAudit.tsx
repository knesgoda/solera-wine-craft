import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Plus, Ban, GitMerge } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

interface CostEntryAuditProps {
  entry: any;
}

export function CostEntryAudit({ entry }: CostEntryAuditProps) {
  if (!entry) return null;

  const events: any[] = [];

  // Created
  events.push({
    icon: entry.blend_trial_id ? GitMerge : Plus,
    label: entry.blend_trial_id ? "Transferred via blend" : "Created",
    date: entry.created_at,
    details: [
      entry.blend_trial_id && `Blend: ${entry.blending_trials?.name || "Unknown"}`,
      entry.transfer_ratio && `Ratio: ${(entry.transfer_ratio * 100).toFixed(0)}%`,
      entry.source_vintage_id && `Source lot transferred`,
      `Amount: ${fmt(Number(entry.total_amount))}`,
      `Method: ${entry.method?.replace("_", " ")}`,
    ].filter(Boolean),
    color: entry.blend_trial_id ? "text-primary" : "text-muted-foreground",
  });

  // Voided
  if (entry.status === "voided" && entry.voided_at) {
    events.push({
      icon: Ban,
      label: "Voided",
      date: entry.voided_at,
      details: [
        entry.void_reason && `Reason: ${entry.void_reason}`,
      ].filter(Boolean),
      color: "text-destructive",
    });
  }

  return (
    <div className="space-y-3 pt-3 border-t border-border mt-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Audit History</p>
      <div className="relative pl-5 space-y-3">
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
        {events.map((ev, i) => {
          const Icon = ev.icon;
          return (
            <div key={i} className="relative">
              <div className="absolute left-[-13px] top-0.5 h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                <Icon className={cn("h-2.5 w-2.5", ev.color)} />
              </div>
              <div className="ml-2">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-medium", ev.color)}>{ev.label}</span>
                  <span className="text-xs text-muted-foreground">{format(parseISO(ev.date), "MMM d, yyyy")}</span>
                </div>
                {ev.details.map((d: string, j: number) => (
                  <p key={j} className="text-xs text-muted-foreground">{d}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
