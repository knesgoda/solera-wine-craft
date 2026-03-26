import { getOrgTimezone } from "@/lib/timezone";

type UnitSystem = "metric" | "imperial";

let _unitSystem: UnitSystem = "imperial"; // default for US

export function setUnitSystem(system: UnitSystem | null) {
  _unitSystem = system || "imperial";
}

export function getUnitSystem(): UnitSystem {
  return _unitSystem;
}

function getLocale(): string {
  try {
    const stored = localStorage.getItem("solera_language");
    if (stored) return stored;
  } catch {}
  return "en";
}

/** Format volume — stored in liters, displayed in user's unit preference */
export function formatVolume(liters: number): string {
  const locale = getLocale();
  if (_unitSystem === "imperial") {
    const gallons = liters / 3.78541;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(gallons)} gal`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(liters)} L`;
}

/** Format temperature — stored in Fahrenheit currently, display converts if metric */
export function formatTemperature(tempF: number): string {
  const locale = getLocale();
  if (_unitSystem === "metric") {
    const celsius = (tempF - 32) * 5 / 9;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(celsius)}°C`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(tempF)}°F`;
}

/** Format area — stored in acres, display converts if metric */
export function formatArea(acres: number): string {
  const locale = getLocale();
  if (_unitSystem === "metric") {
    const hectares = acres * 0.404686;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(hectares)} ha`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(acres)} acres`;
}

/** Format weight — stored in lbs, display converts if metric */
export function formatWeight(lbs: number): string {
  const locale = getLocale();
  if (_unitSystem === "metric") {
    const kg = lbs * 0.453592;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(kg)} kg`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(lbs)} lbs`;
}

/** Format a number with locale-aware decimal separators */
export function formatNumber(value: number, decimals = 1): string {
  const locale = getLocale();
  return new Intl.NumberFormat(locale, { maximumFractionDigits: decimals }).format(value);
}

/** Format currency */
export function formatCurrency(amount: number, currency = "USD"): string {
  const locale = getLocale();
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}
