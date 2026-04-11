import { useAuth } from "@/contexts/AuthContext";

// Map DB tier names to user-friendly names
const TIER_DISPLAY: Record<string, string> = {
  hobbyist: "Hobbyist",
  small_boutique: "Pro",
  mid_size: "Growth",
  enterprise: "Enterprise",
};

const TIER_ORDER = ["hobbyist", "small_boutique", "mid_size", "enterprise"];

export type TierName = "hobbyist" | "small_boutique" | "mid_size" | "enterprise";

// Tier limits
export const TIER_LIMITS: Record<string, { users: number; vineyards: number; blocks: number }> = {
  hobbyist: { users: 1, vineyards: 1, blocks: 2 },
  small_boutique: { users: 5, vineyards: 999, blocks: 999 },
  mid_size: { users: 15, vineyards: 999, blocks: 999 },
  enterprise: { users: 999, vineyards: 999, blocks: 999 },
};

export function useTierGate(requiredTier: TierName) {
  const { organization } = useAuth();
  const subStatus = organization?.subscription_status;
  // Treat non-active subscriptions as hobbyist
  const isActiveSubscription = subStatus === "active" || subStatus === "trialing";
  const storedTier = organization?.tier || "hobbyist";
  const currentTier = isActiveSubscription ? storedTier : "hobbyist";
  const currentIdx = TIER_ORDER.indexOf(currentTier);
  const requiredIdx = TIER_ORDER.indexOf(requiredTier);
  const allowed = currentIdx >= requiredIdx;

  return {
    allowed,
    currentTier,
    currentTierDisplay: TIER_DISPLAY[currentTier] || currentTier,
    requiredTierDisplay: TIER_DISPLAY[requiredTier] || requiredTier,
  };
}

export function getTierDisplay(tier: string) {
  return TIER_DISPLAY[tier] || tier;
}
