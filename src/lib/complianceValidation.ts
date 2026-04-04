/** TTB standard: 1 ton of grapes yields approximately 170 gallons of wine */
/** TTB standard: 1 standard case (12 × 750 ml bottles) = 2.378 gallons */

export interface WineOpsEntry {
  wine_type: string;
  beginning_inventory_gallons: number;
  produced_gallons: number;
  received_gallons: number;
  bottled_gallons: number;
  shipped_gallons: number;
  dumped_gallons: number;
  ending_inventory_gallons: number;
}

export interface ValidationResult {
  valid: boolean;
  /** Error message if invalid, null if valid */
  error: string | null;
}

/**
 * Validate wine operations balance: inflow must equal outflow within 1% tolerance.
 * Rows where both inflow and outflow are zero are skipped (empty rows).
 */
export function validateWineOpsBalance(wineOps: WineOpsEntry[]): ValidationResult {
  for (const ops of wineOps) {
    const inflow = ops.beginning_inventory_gallons + ops.produced_gallons + ops.received_gallons;
    const outflow = ops.bottled_gallons + ops.shipped_gallons + ops.dumped_gallons + ops.ending_inventory_gallons;
    if (inflow === 0 && outflow === 0) continue;
    const diff = Math.abs(inflow - outflow);
    const tolerance = Math.max(inflow, outflow) * 0.01;
    if (diff > tolerance) {
      return {
        valid: false,
        error: `${ops.wine_type}: Inflow (${inflow.toFixed(2)} gal) ≠ Outflow (${outflow.toFixed(2)} gal). Difference: ${diff.toFixed(2)} gal exceeds 1% tolerance.`,
      };
    }
  }
  return { valid: true, error: null };
}
