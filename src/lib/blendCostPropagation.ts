import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type CostEntry = Database["public"]["Tables"]["cost_entries"]["Row"];
type BlendingTrial = Database["public"]["Tables"]["blending_trials"]["Row"];
type BlendingTrialLot = Database["public"]["Tables"]["blending_trial_lots"]["Row"];

interface PropagationResult {
  success: boolean;
  totalTransferred: number;
  sourceLotCount: number;
  entryCount: number;
  alreadyPropagated?: boolean;
  message: string;
}

/**
 * Calculates the recursion depth of a cost entry by following the source_cost_entry_id chain.
 */
async function getEntryDepth(entryId: string, maxDepth: number = 10): Promise<number> {
  let depth = 0;
  let currentId: string | null = entryId;

  while (currentId && depth < maxDepth) {
    const { data } = await supabase
      .from("cost_entries")
      .select("source_cost_entry_id")
      .eq("id", currentId)
      .maybeSingle();
    if (!data?.source_cost_entry_id) break;
    currentId = data.source_cost_entry_id;
    depth++;
  }
  return depth;
}

/**
 * Propagates costs from source vintages into the target vintage of a blending trial.
 * This is IDEMPOTENT — calling it twice for the same blend trial will skip if already done.
 * Source lot costs are NEVER modified — new entries are created on the target lot.
 */
export async function propagateBlendCosts(
  blendTrialId: string,
  orgId: string,
  userId: string
): Promise<PropagationResult> {
  // 1. Check if already propagated (idempotency)
  const { data: existing } = await supabase
    .from("cost_entries")
    .select("id")
    .eq("blend_trial_id", blendTrialId)
    .eq("org_id", orgId)
    .limit(1);

  if (existing && existing.length > 0) {
    return {
      success: true,
      totalTransferred: 0,
      sourceLotCount: 0,
      entryCount: 0,
      alreadyPropagated: true,
      message: "Costs already propagated for this blend.",
    };
  }

  // 2. Load the blending trial and its components
  const { data: trial, error: trialError } = await supabase
    .from("blending_trials")
    .select("*, vintage_id")
    .eq("id", blendTrialId)
    .eq("org_id", orgId)
    .single();
  if (trialError || !trial) throw new Error("Blend trial not found");

  const targetVintageId = trial.vintage_id;
  if (!targetVintageId) throw new Error("Blend trial has no target vintage");

  const { data: components, error: compError } = await supabase
    .from("blending_trial_lots")
    .select("*, vintages(year, blocks(name))")
    .eq("trial_id", blendTrialId);
  if (compError) throw compError;
  if (!components || components.length === 0) {
    return {
      success: true,
      totalTransferred: 0,
      sourceLotCount: 0,
      entryCount: 0,
      message: "No costs to transfer — blend has no source lots.",
    };
  }

  let totalTransferred = 0;
  let entryCount = 0;
  let sourceLotCount = 0;

  // 3. For each source vintage, propagate costs
  for (const comp of components) {
    if (!comp.vintage_id) continue;

    const transferRatio = (comp.percentage || 0) / 100;
    if (transferRatio <= 0) continue;

    // Load all active cost entries from the source vintage
    const { data: sourceCosts, error: costError } = await supabase
      .from("cost_entries")
      .select("*")
      .eq("vintage_id", comp.vintage_id)
      .eq("status", "active")
      .eq("org_id", orgId);
    if (costError) throw costError;
    if (!sourceCosts || sourceCosts.length === 0) continue;

    sourceLotCount++;
    const compWithJoins = comp as BlendingTrialLot & { vintages?: { year?: number; blocks?: { name?: string } } };
    const sourceName = `${compWithJoins.vintages?.year || ""} ${compWithJoins.vintages?.blocks?.name || ""}`.trim();

    for (const source of sourceCosts) {
      // Recursion depth check (max 10 levels)
      if (source.source_cost_entry_id) {
        const depth = await getEntryDepth(source.id);
        if (depth >= 10) {
          console.warn(`Skipping cost entry ${source.id} — recursion depth exceeds 10`);
          continue;
        }
      }

      const transferAmount = Number(source.total_amount) * transferRatio;
      if (transferAmount <= 0) continue;

      const newEntry: Database["public"]["Tables"]["cost_entries"]["Insert"] = {
        org_id: orgId,
        vintage_id: targetVintageId,
        category_id: source.category_id,
        method: source.method,
        status: "active",
        description: `Blend transfer from ${sourceName}: ${source.description}`,
        total_amount: Math.round(transferAmount * 100) / 100,
        effective_date: new Date().toISOString().split("T")[0],
        source_cost_entry_id: source.id,
        blend_trial_id: blendTrialId,
        source_vintage_id: comp.vintage_id,
        transfer_ratio: transferRatio,
        created_by: userId,
      };

      if (source.quantity) {
        newEntry.quantity = Number(source.quantity) * transferRatio;
        newEntry.unit = source.unit;
        newEntry.cost_per_unit = source.cost_per_unit;
      }

      const { error: insertError } = await supabase.from("cost_entries").insert(newEntry);
      if (insertError) throw insertError;

      totalTransferred += transferAmount;
      entryCount++;
    }
  }

  return {
    success: true,
    totalTransferred: Math.round(totalTransferred * 100) / 100,
    sourceLotCount,
    entryCount,
    message: entryCount > 0
      ? `Blend costs propagated: $${totalTransferred.toFixed(2)} from ${sourceLotCount} source lot${sourceLotCount !== 1 ? "s" : ""}`
      : "No costs to transfer — source lots have no recorded production costs.",
  };
}

/**
 * Preview what costs would be transferred without actually creating entries.
 */
export async function previewBlendCosts(
  blendTrialId: string,
  orgId: string
): Promise<{
  sources: Array<{
    vintageId: string;
    vintageName: string;
    percentage: number;
    costEntryCount: number;
    totalCost: number;
    transferAmount: number;
  }>;
  grandTotal: number;
}> {
  const { data: components } = await supabase
    .from("blending_trial_lots")
    .select("*, vintages(year, blocks(name))")
    .eq("trial_id", blendTrialId);

  if (!components || components.length === 0) return { sources: [], grandTotal: 0 };

  const sources: any[] = [];
  let grandTotal = 0;

  for (const comp of components) {
    if (!comp.vintage_id) continue;
    const transferRatio = (comp.percentage || 0) / 100;

    const { data: costs } = await supabase
      .from("cost_entries")
      .select("total_amount")
      .eq("vintage_id", comp.vintage_id)
      .eq("status", "active")
      .eq("org_id", orgId);

    const totalCost = (costs || []).reduce((s: number, c) => s + Number(c.total_amount), 0);
    const transferAmount = Math.round(totalCost * transferRatio * 100) / 100;
    const compWithJoins = comp as BlendingTrialLot & { vintages?: { year?: number; blocks?: { name?: string } } };
    const vintageName = `${compWithJoins.vintages?.year || ""} ${compWithJoins.vintages?.blocks?.name || ""}`.trim();

    sources.push({
      vintageId: comp.vintage_id,
      vintageName,
      percentage: comp.percentage,
      costEntryCount: costs?.length || 0,
      totalCost,
      transferAmount,
    });
    grandTotal += transferAmount;
  }

  return { sources, grandTotal: Math.round(grandTotal * 100) / 100 };
}

/**
 * Reverse (void) all cost entries created by a specific blend propagation.
 */
export async function reverseBlendCosts(
  blendTrialId: string,
  targetVintageId: string,
  userId: string,
  orgId: string
): Promise<{ voidedCount: number; voidedAmount: number }> {
  const { data: entries, error } = await supabase
    .from("cost_entries")
    .select("id, total_amount")
    .eq("blend_trial_id", blendTrialId)
    .eq("vintage_id", targetVintageId)
    .eq("status", "active")
    .eq("org_id", orgId);

  if (error) throw error;
  if (!entries || entries.length === 0) return { voidedCount: 0, voidedAmount: 0 };

  const totalAmount = entries.reduce((s, e) => s + Number(e.total_amount), 0);
  const ids = entries.map((e) => e.id);

  const { error: updateError } = await supabase
    .from("cost_entries")
    .update({
      status: "voided",
      voided_at: new Date().toISOString(),
      voided_by: userId,
      void_reason: "Blend cost reversal",
    })
    .in("id", ids);

  if (updateError) throw updateError;

  return { voidedCount: ids.length, voidedAmount: Math.round(totalAmount * 100) / 100 };
}
