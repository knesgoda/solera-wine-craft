/**
 * Vintage Peak Prediction
 *
 * Pure scoring function. No I/O. All weights and tunables live at the top
 * of the file so winemakers (and product) can adjust without hunting.
 */

export const WEIGHTS = {
  brix: 0.20,
  ph: 0.15,
  ta: 0.15,
  variety: 0.25,
  gdd: 0.15,
  oak: 0.10,
} as const;

/** Variety baseline drinking window in years post-bottle. */
export const VARIETY_PEAK: Record<string, [number, number]> = {
  "cabernet sauvignon": [8, 12],
  "pinot noir": [5, 8],
  "chardonnay": [3, 6],
  "syrah": [6, 10],
  "shiraz": [6, 10],
  "albarino": [1, 3],
  "albariño": [1, 3],
  "merlot": [5, 8],
  "zinfandel": [4, 7],
  "riesling": [5, 15],
};
export const DEFAULT_PEAK: [number, number] = [3, 6];

const WHITE_VARIETIES = new Set([
  "chardonnay", "albarino", "albariño", "riesling", "sauvignon blanc",
  "viognier", "pinot grigio", "pinot gris", "gewurztraminer", "gewürztraminer",
]);

export type OakProgram = "new_french" | "neutral" | "stainless" | null;

export interface PeakInput {
  variety: string | null;
  bottleDate: Date | null;
  initialBrix: number | null;
  bottlingPh: number | null;
  bottlingTa: number | null;
  cumulativeGdd: number | null;
  oakProgram: OakProgram;
}

export interface PeakFactor {
  key: "brix" | "ph" | "ta" | "variety" | "gdd" | "oak";
  name: string;
  value: string | null;
  impact: "earlier" | "neutral" | "later";
  hasData: boolean;
}

export interface PeakResult {
  bottleDate: Date;
  peakStartYear: number;
  peakEndYear: number;
  peakConfidence: "low" | "medium" | "high";
  drinkingWindowMonths: number;
  factors: PeakFactor[];
}

function normalizeVariety(v: string | null | undefined): string {
  return (v || "").trim().toLowerCase();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Calculate the optimal drinking window for a vintage.
 * Handles missing inputs gracefully — every null contributes a zero shift
 * and produces a `hasData: false` factor row.
 */
export function calculatePeakWindow(input: PeakInput): PeakResult {
  const today = new Date();
  const bottleDate = input.bottleDate ?? today;

  // Variety baseline
  const varietyKey = normalizeVariety(input.variety);
  const baseline = VARIETY_PEAK[varietyKey] ?? DEFAULT_PEAK;
  const isWhite = WHITE_VARIETIES.has(varietyKey);

  let startShift = 0;
  let endShift = 0;
  const factors: PeakFactor[] = [];

  // Variety factor (always counts as data when variety provided)
  factors.push({
    key: "variety",
    name: "Variety baseline",
    value: input.variety ? `${input.variety} (${baseline[0]}–${baseline[1]} yrs)` : null,
    impact: "neutral",
    hasData: !!input.variety,
  });

  // Brix
  if (input.initialBrix != null) {
    const center = isWhite ? 21.5 : 24.5;
    const shift = clamp((input.initialBrix - center) * WEIGHTS.brix * 1.2, -2, 2);
    startShift += shift;
    endShift += shift;
    factors.push({
      key: "brix",
      name: "Initial Brix at harvest",
      value: `${input.initialBrix}°`,
      impact: shift > 0.2 ? "later" : shift < -0.2 ? "earlier" : "neutral",
      hasData: true,
    });
  } else {
    factors.push({ key: "brix", name: "Initial Brix at harvest", value: null, impact: "neutral", hasData: false });
  }

  // pH
  if (input.bottlingPh != null) {
    let shift = 0;
    if (input.bottlingPh < 3.4) shift = WEIGHTS.ph * 4; // extend
    else if (input.bottlingPh > 3.65) shift = -WEIGHTS.ph * 4; // accelerate decline
    endShift += shift;
    factors.push({
      key: "ph",
      name: "pH at bottling",
      value: input.bottlingPh.toString(),
      impact: shift > 0 ? "later" : shift < 0 ? "earlier" : "neutral",
      hasData: true,
    });
  } else {
    factors.push({ key: "ph", name: "pH at bottling", value: null, impact: "neutral", hasData: false });
  }

  // TA
  if (input.bottlingTa != null) {
    let shift = 0;
    if (input.bottlingTa < 5.5) shift = -WEIGHTS.ta * 4;
    else if (input.bottlingTa > 7) shift = WEIGHTS.ta * 4;
    endShift += shift;
    factors.push({
      key: "ta",
      name: "TA at bottling",
      value: `${input.bottlingTa} g/L`,
      impact: shift > 0 ? "later" : shift < 0 ? "earlier" : "neutral",
      hasData: true,
    });
  } else {
    factors.push({ key: "ta", name: "TA at bottling", value: null, impact: "neutral", hasData: false });
  }

  // GDD
  if (input.cumulativeGdd != null) {
    let shift = 0;
    if (input.cumulativeGdd > 2800) shift = WEIGHTS.gdd * 6;
    else if (input.cumulativeGdd < 2200) shift = -WEIGHTS.gdd * 6;
    endShift += shift;
    factors.push({
      key: "gdd",
      name: "Cumulative GDD (vintage year)",
      value: `${Math.round(input.cumulativeGdd)} GDD`,
      impact: shift > 0 ? "later" : shift < 0 ? "earlier" : "neutral",
      hasData: true,
    });
  } else {
    factors.push({ key: "gdd", name: "Cumulative GDD (vintage year)", value: null, impact: "neutral", hasData: false });
  }

  // Oak
  if (input.oakProgram) {
    let shift = 0;
    let label = "";
    if (input.oakProgram === "new_french") { shift = WEIGHTS.oak * 15; label = "New French oak"; }
    else if (input.oakProgram === "neutral") { shift = 0; label = "Neutral oak"; }
    else if (input.oakProgram === "stainless") { shift = -WEIGHTS.oak * 10; label = "Stainless / no oak"; }
    endShift += shift;
    factors.push({
      key: "oak",
      name: "Oak program",
      value: label,
      impact: shift > 0 ? "later" : shift < 0 ? "earlier" : "neutral",
      hasData: true,
    });
  } else {
    factors.push({ key: "oak", name: "Oak program", value: null, impact: "neutral", hasData: false });
  }

  // Confidence: count factors with data
  const dataCount = factors.filter((f) => f.hasData).length;
  const peakConfidence: PeakResult["peakConfidence"] =
    dataCount >= 6 ? "high" : dataCount >= 4 ? "medium" : "low";

  // Apply shifts to baseline. Round to nearest year.
  const peakStartYear = bottleDate.getFullYear() + Math.max(1, Math.round(baseline[0] + startShift));
  let peakEndYear = bottleDate.getFullYear() + Math.max(2, Math.round(baseline[1] + endShift));
  if (peakEndYear < peakStartYear) peakEndYear = peakStartYear + 1;

  const drinkingWindowMonths = (peakEndYear - peakStartYear) * 12;

  return { bottleDate, peakStartYear, peakEndYear, peakConfidence, drinkingWindowMonths, factors };
}