import { describe, it, expect, beforeEach } from "vitest";
import {
  setOrgTimezone,
  getOrgTimezone,
  formatDateTime,
  formatDate,
  formatTime,
  formatChartDate,
  daysSince,
  getTimezoneAbbr,
  detectBrowserTimezone,
} from "../timezone";

describe("timezone", () => {
  beforeEach(() => {
    setOrgTimezone(null);
  });

  describe("getOrgTimezone", () => {
    it("returns browser timezone when no org timezone is set", () => {
      const tz = getOrgTimezone();
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    });

    it("returns the org timezone when set", () => {
      setOrgTimezone("America/Los_Angeles");
      expect(getOrgTimezone()).toBe("America/Los_Angeles");
    });
  });

  describe("detectBrowserTimezone", () => {
    it("returns a valid timezone string", () => {
      const tz = detectBrowserTimezone();
      expect(typeof tz).toBe("string");
      expect(tz).not.toBe("");
    });
  });

  describe("formatDateTime", () => {
    it("returns dash for invalid date", () => {
      expect(formatDateTime("not-a-date")).toBe("—");
    });

    it("formats a valid date", () => {
      setOrgTimezone("America/New_York");
      const result = formatDateTime("2026-01-15T12:00:00Z", { format: "full" });
      expect(result).toContain("2026");
      expect(result).toContain("Jan");
    });
  });

  describe("formatDate", () => {
    it("formats a date-only string", () => {
      setOrgTimezone("UTC");
      const result = formatDate("2026-06-15T00:00:00Z");
      expect(result).toContain("June");
      expect(result).toContain("15");
    });

    it("returns dash for invalid input", () => {
      expect(formatDate("invalid")).toBe("—");
    });
  });

  describe("formatTime", () => {
    it("formats time with zone", () => {
      setOrgTimezone("UTC");
      const result = formatTime("2026-06-15T14:30:00Z", { includeZone: true });
      expect(result).toContain("2:30");
      expect(result).toContain("UTC");
    });
  });

  describe("formatChartDate", () => {
    it("formats for chart axis", () => {
      setOrgTimezone("UTC");
      const result = formatChartDate("2026-06-15T00:00:00Z");
      expect(result).toContain("Jun");
      expect(result).toContain("15");
    });

    it("returns empty for invalid date", () => {
      expect(formatChartDate("invalid")).toBe("");
    });
  });

  describe("daysSince", () => {
    it("returns 0 for today", () => {
      const now = new Date().toISOString();
      expect(daysSince(now)).toBe(0);
    });

    it("returns positive for past dates", () => {
      const past = new Date(Date.now() - 3 * 86400000).toISOString();
      expect(daysSince(past)).toBeGreaterThanOrEqual(2);
      expect(daysSince(past)).toBeLessThanOrEqual(4);
    });
  });

  describe("getTimezoneAbbr", () => {
    it("returns a timezone abbreviation", () => {
      setOrgTimezone("America/New_York");
      const abbr = getTimezoneAbbr();
      expect(typeof abbr).toBe("string");
      // Should be something like EDT, EST, etc.
      expect(abbr.length).toBeLessThanOrEqual(5);
    });
  });
});
