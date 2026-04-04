import { describe, it, expect } from "vitest";
import { hasAccess, TIER_ORDER } from "../tier-access";

describe("tier-access", () => {
  it("returns true when org tier meets requirement", () => {
    expect(hasAccess("enterprise", "hobbyist")).toBe(true);
    expect(hasAccess("enterprise", "enterprise")).toBe(true);
    expect(hasAccess("mid_size", "small_boutique")).toBe(true);
    expect(hasAccess("hobbyist", "hobbyist")).toBe(true);
  });

  it("returns false when org tier is below requirement", () => {
    expect(hasAccess("hobbyist", "enterprise")).toBe(false);
    expect(hasAccess("small_boutique", "mid_size")).toBe(false);
    expect(hasAccess("hobbyist", "small_boutique")).toBe(false);
  });

  it("returns false for invalid/unknown tiers", () => {
    expect(hasAccess("unknown", "hobbyist")).toBe(false);
    expect(hasAccess("hobbyist", "unknown")).toBe(false);
    expect(hasAccess("", "hobbyist")).toBe(false);
    expect(hasAccess("hobbyist", "")).toBe(false);
  });

  it("TIER_ORDER has exactly 4 tiers", () => {
    expect(TIER_ORDER).toHaveLength(4);
    expect(TIER_ORDER[0]).toBe("hobbyist");
    expect(TIER_ORDER[3]).toBe("enterprise");
  });
});
