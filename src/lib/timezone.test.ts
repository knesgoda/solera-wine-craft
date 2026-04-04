import { describe, it, expect, beforeEach } from "vitest";
import { setOrgTimezone, getOrgTimezone, localToUTC, formatDate, formatDateTime } from "./timezone";

describe("getOrgTimezone", () => {
  it("returns set timezone after setOrgTimezone", () => {
    setOrgTimezone("America/New_York");
    expect(getOrgTimezone()).toBe("America/New_York");
  });

  it("falls back to non-null string when org timezone is null", () => {
    setOrgTimezone(null);
    const tz = getOrgTimezone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });
});

describe("localToUTC", () => {
  it("returns an ISO string for a valid date", () => {
    const result = localToUTC("2026-01-15T12:00:00");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("round-trips a Date object back to ISO", () => {
    const date = new Date("2026-06-01T00:00:00Z");
    const result = localToUTC(date);
    expect(new Date(result).toISOString()).toBe(date.toISOString());
  });
});

describe("formatDate", () => {
  beforeEach(() => setOrgTimezone("America/New_York"));

  it("returns a non-empty string for valid UTC dates", () => {
    const result = formatDate("2026-03-15T12:00:00Z");
    expect(result).toBeTruthy();
    expect(result).not.toBe("—");
  });

  it("returns — for invalid date strings", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("includes the year in the output", () => {
    const result = formatDate("2026-07-04T12:00:00Z");
    expect(result).toContain("2026");
  });
});

describe("formatDateTime", () => {
  beforeEach(() => setOrgTimezone("UTC"));

  it("returns — for invalid dates", () => {
    expect(formatDateTime("invalid")).toBe("—");
  });

  it("short format includes month and day", () => {
    const result = formatDateTime("2026-01-15T18:00:00Z", { format: "short" });
    expect(result).toBeTruthy();
    expect(result).not.toBe("—");
  });

  it("full format includes year and timezone name", () => {
    const result = formatDateTime("2026-01-15T18:00:00Z", { format: "full" });
    expect(result).toContain("2026");
  });
});
