import { describe, it, expect } from "vitest";
import { validateWineOpsBalance, WineOpsEntry } from "./complianceValidation";

function makeEntry(overrides: Partial<WineOpsEntry> = {}): WineOpsEntry {
  return {
    wine_type: "red",
    beginning_inventory_gallons: 0,
    produced_gallons: 0,
    received_gallons: 0,
    bottled_gallons: 0,
    shipped_gallons: 0,
    dumped_gallons: 0,
    ending_inventory_gallons: 0,
    ...overrides,
  };
}

describe("validateWineOpsBalance", () => {
  it("returns valid for empty list", () => {
    expect(validateWineOpsBalance([])).toEqual({ valid: true, error: null });
  });

  it("skips rows where both inflow and outflow are zero", () => {
    const result = validateWineOpsBalance([makeEntry()]);
    expect(result.valid).toBe(true);
  });

  it("passes when inflow equals outflow exactly", () => {
    const entry = makeEntry({
      beginning_inventory_gallons: 100,
      ending_inventory_gallons: 100,
    });
    expect(validateWineOpsBalance([entry]).valid).toBe(true);
  });

  it("passes when diff is exactly at the 1% tolerance boundary", () => {
    // inflow = 100, outflow = 99, diff = 1, tolerance = 100 * 0.01 = 1 — exactly at boundary
    const entry = makeEntry({
      produced_gallons: 100,
      ending_inventory_gallons: 99,
    });
    expect(validateWineOpsBalance([entry]).valid).toBe(true);
  });

  it("fails when diff exceeds 1% tolerance", () => {
    const entry = makeEntry({
      produced_gallons: 100,
      ending_inventory_gallons: 98, // diff=2, tolerance=1
    });
    const result = validateWineOpsBalance([entry]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("red");
    expect(result.error).toContain("1% tolerance");
  });

  it("includes inflow and outflow values in the error message", () => {
    const entry = makeEntry({
      produced_gallons: 200,
      ending_inventory_gallons: 195,
    });
    const result = validateWineOpsBalance([entry]);
    expect(result.error).toContain("200.00");
    expect(result.error).toContain("195.00");
  });

  it("returns valid when all rows are balanced", () => {
    const entries = [
      makeEntry({ wine_type: "red", produced_gallons: 500, ending_inventory_gallons: 500 }),
      makeEntry({ wine_type: "white", produced_gallons: 200, ending_inventory_gallons: 200 }),
    ];
    expect(validateWineOpsBalance(entries).valid).toBe(true);
  });

  it("fails on the first unbalanced row regardless of order", () => {
    const entries = [
      makeEntry({ wine_type: "white", produced_gallons: 100, ending_inventory_gallons: 100 }),
      makeEntry({ wine_type: "red", produced_gallons: 100, ending_inventory_gallons: 50 }),
    ];
    const result = validateWineOpsBalance(entries);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("red");
  });
});
