/**
 * Global Timezone Utilities for Solera
 *
 * All timestamps in Supabase are stored as UTC (timestamptz).
 * Conversion happens ONLY at the display layer and input layer.
 * Uses native Intl API — no moment.js or luxon.
 */

// ── Timezone database (grouped by region) ──────────────────────────
export const TIMEZONE_GROUPS: { label: string; zones: { value: string; label: string }[] }[] = [
  {
    label: "Americas",
    zones: [
      { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
      { value: "America/Denver", label: "Mountain Time (Denver)" },
      { value: "America/Chicago", label: "Central Time (Chicago)" },
      { value: "America/New_York", label: "Eastern Time (New York)" },
      { value: "America/Argentina/Mendoza", label: "Argentina (Mendoza)" },
      { value: "America/Santiago", label: "Chile (Santiago)" },
    ],
  },
  {
    label: "Europe",
    zones: [
      { value: "Europe/London", label: "United Kingdom (London)" },
      { value: "Europe/Paris", label: "France (Paris)" },
      { value: "Europe/Madrid", label: "Spain (Madrid)" },
      { value: "Europe/Rome", label: "Italy (Rome)" },
      { value: "Europe/Berlin", label: "Germany (Berlin)" },
      { value: "Europe/Tbilisi", label: "Georgia (Tbilisi)" },
    ],
  },
  {
    label: "Africa",
    zones: [
      { value: "Africa/Johannesburg", label: "South Africa (Johannesburg)" },
    ],
  },
  {
    label: "Oceania",
    zones: [
      { value: "Australia/Sydney", label: "Australia (Sydney)" },
      { value: "Australia/Adelaide", label: "Australia (Adelaide)" },
      { value: "Australia/Perth", label: "Australia (Perth)" },
      { value: "Pacific/Auckland", label: "New Zealand (Auckland)" },
    ],
  },
  {
    label: "Asia",
    zones: [{ value: "Asia/Tokyo", label: "Japan (Tokyo)" }],
  },
];

export const ALL_TIMEZONES = TIMEZONE_GROUPS.flatMap((g) => g.zones);

// ── Internal singleton for org timezone ────────────────────────────
let _orgTimezone: string | null = null;

/** Set the org timezone (called from AuthContext when org loads). */
export function setOrgTimezone(tz: string | null) {
  _orgTimezone = tz;
}

/** Get the org's timezone with fallback chain: org → browser → UTC */
export function getOrgTimezone(): string {
  if (_orgTimezone) return _orgTimezone;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** Detect the browser's timezone via Intl API */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

// ── Core formatting ────────────────────────────────────────────────

type FormatOption = "full" | "short" | "date" | "time" | "relative";

function toDate(d: string | Date): Date {
  return typeof d === "string" ? new Date(d) : d;
}

/** Format a UTC timestamp for display in the org's timezone */
export function formatDateTime(
  utcDate: string | Date,
  options?: { format?: FormatOption }
): string {
  const date = toDate(utcDate);
  if (isNaN(date.getTime())) return "—";

  const fmt = options?.format ?? "short";
  const tz = getOrgTimezone();

  switch (fmt) {
    case "full":
      return date.toLocaleString("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
    case "short":
      return date.toLocaleString("en-US", {
        timeZone: tz,
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    case "date":
      return formatDate(utcDate);
    case "time":
      return formatTime(utcDate, { includeZone: true });
    case "relative":
      return formatRelative(date);
    default:
      return date.toLocaleString("en-US", { timeZone: tz });
  }
}

/** Format a date-only string. Uses org timezone to determine calendar date. */
export function formatDate(utcDate: string | Date): string {
  const date = toDate(utcDate);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    timeZone: getOrgTimezone(),
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Format time only */
export function formatTime(
  utcDate: string | Date,
  options?: { includeZone?: boolean }
): string {
  const date = toDate(utcDate);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    timeZone: getOrgTimezone(),
    hour: "numeric",
    minute: "2-digit",
    ...(options?.includeZone ? { timeZoneName: "short" } : {}),
  });
}

/** Relative time: "2 hours ago", "in 3 days" */
function formatRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const absDiff = Math.abs(diffMs);
  const isPast = diffMs > 0;

  const minutes = Math.floor(absDiff / 60_000);
  const hours = Math.floor(absDiff / 3_600_000);
  const days = Math.floor(absDiff / 86_400_000);

  let label: string;
  if (minutes < 1) label = "just now";
  else if (minutes < 60) label = `${minutes}m`;
  else if (hours < 24) label = `${hours}h`;
  else if (days < 30) label = `${days}d`;
  else label = formatDate(date);

  if (label === "just now" || days >= 30) return label;
  return isPast ? `${label} ago` : `in ${label}`;
}

/** Get current date in org timezone (for "today" comparisons) */
export function getOrgToday(): Date {
  const tz = getOrgTimezone();
  const now = new Date();
  const localStr = now.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
  return new Date(localStr + "T00:00:00");
}

/**
 * Get start/end of a local day as UTC ISO strings.
 * Used for DB queries: "get all samples from March 26 local"
 */
export function getLocalDayRange(localDate: string | Date): {
  start: string;
  end: string;
} {
  const tz = getOrgTimezone();
  const d = toDate(localDate);
  const dateStr =
    typeof localDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(localDate)
      ? localDate
      : d.toLocaleDateString("en-CA", { timeZone: tz });

  // Create date boundaries in the org's timezone, then convert to UTC
  const startLocal = new Date(`${dateStr}T00:00:00`);
  const endLocal = new Date(`${dateStr}T23:59:59.999`);

  // Use Intl to get UTC offset at that moment
  const getUtcOffset = (dt: Date): number => {
    const utcStr = dt.toLocaleString("en-US", { timeZone: "UTC" });
    const localStr = dt.toLocaleString("en-US", { timeZone: tz });
    return new Date(utcStr).getTime() - new Date(localStr).getTime();
  };

  const offsetMs = getUtcOffset(startLocal);
  return {
    start: new Date(startLocal.getTime() + offsetMs).toISOString(),
    end: new Date(endLocal.getTime() + offsetMs).toISOString(),
  };
}

/** Parse a local datetime input to UTC for storage */
export function localToUTC(localDateTime: string | Date): string {
  const date = toDate(localDateTime);
  return date.toISOString();
}

/** Format for chart axis labels — short date in org timezone */
export function formatChartDate(utcDate: string | Date): string {
  const date = toDate(utcDate);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: getOrgTimezone(),
    month: "short",
    day: "numeric",
  });
}

/** Format for CSV/Excel export — unambiguous with timezone */
export function formatExportDateTime(utcDate: string | Date): string {
  const date = toDate(utcDate);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    timeZone: getOrgTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
    hour12: false,
  });
}

/** Calculate days since a timestamp, using org timezone for both dates */
export function daysSince(utcDate: string | Date): number {
  const tz = getOrgTimezone();
  const date = toDate(utcDate);
  const now = new Date();
  const localDate = date.toLocaleDateString("en-CA", { timeZone: tz });
  const localNow = now.toLocaleDateString("en-CA", { timeZone: tz });
  const diffMs =
    new Date(localNow).getTime() - new Date(localDate).getTime();
  return Math.floor(diffMs / 86_400_000);
}

/** Get timezone abbreviation for display: "PDT", "AEDT", etc. */
export function getTimezoneAbbr(): string {
  const tz = getOrgTimezone();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value ?? tz;
  } catch {
    return tz;
  }
}

/** Short date for display: "Mar 26, 2026" */
export function formatShortDate(utcDate: string | Date): string {
  const date = toDate(utcDate);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    timeZone: getOrgTimezone(),
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
