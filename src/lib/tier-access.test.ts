import { describe, it, expect } from "vitest";
import { hasAccess, TIER_ORDER } from "./tier-access";

describe("hasAccess", () => {
  it("hobbyist can access hobbyist features", () => {
    expect(hasAccess("hobbyist", "hobbyist")).toBe(true);
  });

  it("hobbyist cannot access small_boutique features", () => {
    expect(hasAccess("hobbyist", "small_boutique")).toBe(false);
  });

  it("small_boutique can access hobbyist features", () => {
    expect(hasAccess("small_boutique", "hobbyist")).toBe(true);
  });

  it("small_boutique can access small_boutique features", () => {
    expect(hasAccess("small_boutique", "small_boutique")).toBe(true);
  });

  it("small_boutique cannot access mid_size features", () => {
    expect(hasAccess("small_boutique", "mid_size")).toBe(false);
  });

  it("mid_size can access small_boutique features", () => {
    expect(hasAccess("mid_size", "small_boutique")).toBe(true);
  });

  it("enterprise can access all tiers", () => {
    for (const tier of TIER_ORDER) {
      expect(hasAccess("enterprise", tier)).toBe(true);
    }
  });

  it("returns false for unknown org tier", () => {
    expect(hasAccess("unknown_tier", "hobbyist")).toBe(false);
  });

  it("returns false for unknown required tier", () => {
    expect(hasAccess("enterprise", "unknown_tier")).toBe(false);
  });

  it("tier order is hobbyist < small_boutique < mid_size < enterprise", () => {
    for (let i = 0; i < TIER_ORDER.length - 1; i++) {
      expect(hasAccess(TIER_ORDER[i], TIER_ORDER[i + 1])).toBe(false);
      expect(hasAccess(TIER_ORDER[i + 1], TIER_ORDER[i])).toBe(true);
    }
  });
});
