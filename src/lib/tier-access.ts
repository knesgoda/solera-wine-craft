export const TIER_ORDER = ['hobbyist', 'small_boutique', 'mid_size', 'enterprise'] as const;
export type Tier = typeof TIER_ORDER[number];

export function hasAccess(orgTier: string, requiredTier: string): boolean {
  const currentIdx = TIER_ORDER.indexOf(orgTier as Tier);
  const requiredIdx = TIER_ORDER.indexOf(requiredTier as Tier);
  if (currentIdx === -1 || requiredIdx === -1) return false;
  return currentIdx >= requiredIdx;
}
