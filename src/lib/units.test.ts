import { describe, it, expect, beforeEach } from "vitest";
import { setUnitSystem, formatVolume, formatTemperature, formatArea, formatWeight } from "./units";

// units.ts uses localStorage.getItem which may not exist in test environment — that's fine,
// it falls back to "en" locale

describe("formatVolume", () => {
  beforeEach(() => setUnitSystem("imperial"));

  it("converts liters to gallons in imperial mode", () => {
    setUnitSystem("imperial");
    const result = formatVolume(3.78541);
    expect(result).toContain("1");
    expect(result).toContain("gal");
  });

  it("displays liters in metric mode", () => {
    setUnitSystem("metric");
    const result = formatVolume(10);
    expect(result).toContain("10");
    expect(result).toContain("L");
  });

  it("handles 0 liters", () => {
    setUnitSystem("imperial");
    expect(formatVolume(0)).toContain("0");
  });
});

describe("formatTemperature", () => {
  it("displays Fahrenheit in imperial mode", () => {
    setUnitSystem("imperial");
    const result = formatTemperature(72);
    expect(result).toContain("72");
    expect(result).toContain("°F");
  });

  it("converts F to C in metric mode", () => {
    setUnitSystem("metric");
    const result = formatTemperature(32);
    expect(result).toContain("0");
    expect(result).toContain("°C");
  });

  it("converts 212°F to 100°C", () => {
    setUnitSystem("metric");
    const result = formatTemperature(212);
    expect(result).toContain("100");
    expect(result).toContain("°C");
  });
});

describe("formatArea", () => {
  it("displays acres in imperial mode", () => {
    setUnitSystem("imperial");
    const result = formatArea(1);
    expect(result).toContain("1");
    expect(result).toContain("acres");
  });

  it("converts acres to hectares in metric mode", () => {
    setUnitSystem("metric");
    const result = formatArea(1);
    expect(result).toContain("0.40");
    expect(result).toContain("ha");
  });

  it("handles 0 acres", () => {
    setUnitSystem("imperial");
    expect(formatArea(0)).toContain("0");
  });
});

describe("formatWeight", () => {
  it("displays lbs in imperial mode", () => {
    setUnitSystem("imperial");
    const result = formatWeight(100);
    expect(result).toContain("100");
    expect(result).toContain("lbs");
  });

  it("converts lbs to kg in metric mode", () => {
    setUnitSystem("metric");
    const result = formatWeight(1000);
    expect(result).toContain("453");
    expect(result).toContain("kg");
  });

  it("handles 0 lbs", () => {
    setUnitSystem("imperial");
    expect(formatWeight(0)).toContain("0");
  });
});
