import { describe, it, expect, beforeEach } from "vitest";
import {
  setUnitSystem,
  getUnitSystem,
  formatVolume,
  formatTemperature,
  formatArea,
  formatWeight,
  formatNumber,
  formatCurrency,
} from "../units";

describe("units", () => {
  beforeEach(() => {
    setUnitSystem("imperial");
  });

  describe("setUnitSystem / getUnitSystem", () => {
    it("defaults to imperial", () => {
      expect(getUnitSystem()).toBe("imperial");
    });

    it("can switch to metric", () => {
      setUnitSystem("metric");
      expect(getUnitSystem()).toBe("metric");
    });

    it("falls back to imperial for null", () => {
      setUnitSystem(null);
      expect(getUnitSystem()).toBe("imperial");
    });
  });

  describe("formatVolume", () => {
    it("formats liters to gallons in imperial", () => {
      const result = formatVolume(378.541);
      expect(result).toContain("gal");
      expect(result).toContain("100");
    });

    it("formats liters in metric", () => {
      setUnitSystem("metric");
      const result = formatVolume(100);
      expect(result).toContain("L");
      expect(result).toContain("100");
    });
  });

  describe("formatTemperature", () => {
    it("shows Fahrenheit in imperial", () => {
      expect(formatTemperature(72)).toContain("°F");
      expect(formatTemperature(72)).toContain("72");
    });

    it("converts to Celsius in metric", () => {
      setUnitSystem("metric");
      const result = formatTemperature(212);
      expect(result).toContain("°C");
      expect(result).toContain("100");
    });
  });

  describe("formatArea", () => {
    it("shows acres in imperial", () => {
      expect(formatArea(10)).toContain("acres");
    });

    it("converts to hectares in metric", () => {
      setUnitSystem("metric");
      expect(formatArea(10)).toContain("ha");
    });
  });

  describe("formatWeight", () => {
    it("shows lbs in imperial", () => {
      expect(formatWeight(100)).toContain("lbs");
    });

    it("converts to kg in metric", () => {
      setUnitSystem("metric");
      expect(formatWeight(100)).toContain("kg");
    });
  });

  describe("formatNumber", () => {
    it("formats numbers with decimals", () => {
      const result = formatNumber(1234.567, 2);
      expect(result).toContain("1,234.57");
    });
  });

  describe("formatCurrency", () => {
    it("formats USD by default", () => {
      const result = formatCurrency(1234.5);
      expect(result).toContain("$");
      expect(result).toContain("1,234.50");
    });
  });
});
