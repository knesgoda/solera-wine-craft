import { cn } from "@/lib/utils";

interface TierRangeBarProps {
  tiers: Array<{
    tier_label: string;
    min_value: number | null;
    max_value: number | null;
    price_adjustment: number;
    is_reject: boolean;
  }>;
  direction: "higher_is_better" | "lower_is_better";
}

export function TierRangeBar({ tiers, direction }: TierRangeBarProps) {
  if (tiers.length === 0) return null;

  // Determine the full range
  const allValues = tiers.flatMap((t) => [t.min_value, t.max_value].filter((v): v is number => v != null));
  if (allValues.length === 0) return null;

  const rangeMin = Math.min(...allValues);
  const rangeMax = Math.max(...allValues);
  const span = rangeMax - rangeMin || 1;
  const padding = span * 0.1;
  const displayMin = rangeMin - padding;
  const displayMax = rangeMax + padding;
  const displaySpan = displayMax - displayMin;

  const sortedTiers = [...tiers].sort((a, b) => (a.min_value ?? -Infinity) - (b.min_value ?? -Infinity));

  return (
    <div className="mt-2 space-y-1">
      <div className="relative h-6 bg-muted rounded-md overflow-hidden flex">
        {sortedTiers.map((tier, i) => {
          const left = ((tier.min_value ?? displayMin) - displayMin) / displaySpan;
          const right = ((tier.max_value ?? displayMax) - displayMin) / displaySpan;
          const width = Math.max(right - left, 0.02);

          const colorClass = tier.is_reject
            ? "bg-destructive/60"
            : tier.price_adjustment > 0
            ? "bg-green-400/70"
            : tier.price_adjustment < 0
            ? "bg-amber-400/70"
            : "bg-primary/30";

          return (
            <div
              key={i}
              className={cn("absolute top-0 bottom-0 border-r border-background/50", colorClass)}
              style={{ left: `${left * 100}%`, width: `${width * 100}%` }}
              title={`${tier.tier_label}: ${tier.min_value ?? "∞"} – ${tier.max_value ?? "∞"} (${tier.is_reject ? "REJECT" : tier.price_adjustment >= 0 ? "+" : ""}${tier.is_reject ? "" : "$" + tier.price_adjustment})`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>{rangeMin}</span>
        <span className="text-center">{direction === "higher_is_better" ? "→ Better" : "← Better"}</span>
        <span>{rangeMax}</span>
      </div>
    </div>
  );
}
