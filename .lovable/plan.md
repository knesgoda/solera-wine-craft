## Vintage Peak Prediction

A read-only analytical view inside the Vintage Detail page that estimates when a bottled vintage will reach its sensory peak. No new tables, no schema changes, no edits to existing tabs or data entry flows.

### Data sources (all existing)

- `vintages` — `harvest_date`, `bottled_at` (or `released_at` as fallback), `block_id`, `notes`
- `blocks` — `variety`, `vineyard_id` (joined for GDD lookup)
- `lab_samples` — initial Brix from earliest sample, latest pH and TA closest to bottling
- `fermentation_vessels` — `oak_type`, `barrel_age_fills` filtered by `vintage_id` for oak program signal
- `weather_readings` — cumulative GDD for vineyard during the vintage growing season

### Files to create

```text
src/lib/peakPrediction.ts            // pure scoring function + types + constants
src/components/vintages/PeakPredictionTab.tsx   // tab content (banner + factors + Ask Solera CTA)
```

### Files to modify

- `src/pages/vintages/VintageDetail.tsx` — add 5th tab `peak` between Anomalies and Costs, gated by `useTierGate("small_boutique")`. No other changes.
- `src/App.tsx` — add deep route `/vintages/:vintageId/peak-prediction` rendering VintageDetail with `?tab=peak`, OR simply add the tab and skip the deep route (see below).
- `src/pages/AskSolera.tsx` — read `?prompt=` query param on mount and prefill the input box (does NOT auto-send).

### `calculatePeakWindow(input)` — pure function

Signature:
```ts
type PeakInput = {
  variety: string | null;
  bottleDate: Date | null;
  initialBrix: number | null;
  bottlingPh: number | null;
  bottlingTa: number | null;
  cumulativeGdd: number | null;
  oakProgram: 'new_french' | 'neutral' | 'stainless' | null;
};
type PeakFactor = {
  name: string; value: string | null; impact: 'earlier' | 'neutral' | 'later'; hasData: boolean;
};
type PeakResult = {
  bottleDate: Date; peakStartYear: number; peakEndYear: number;
  peakConfidence: 'low' | 'medium' | 'high';
  drinkingWindowMonths: number; factors: PeakFactor[];
};
```

Implementation outline:
1. Constants at top: `WEIGHTS = { brix: 0.20, ph: 0.15, ta: 0.15, variety: 0.25, gdd: 0.15, oak: 0.10 }`, `VARIETY_PEAK` lookup table (Cab 8-12, Pinot 5-8, Chard 3-6, Syrah 6-10, Albariño 1-3, Merlot 5-8, Zin 4-7, Riesling 5-15, default 3-6), oak adjustments (`new_french: +1.5y`, `neutral: 0`, `stainless: -1y`).
2. Start from variety baseline midpoint and span. Apply weighted shifts:
   - Brix: `(brix - 24.5) * weight * yearsPerUnit` for reds; clamp ±2 years
   - pH: above 3.65 shift earlier; below 3.4 extend
   - TA: <5.5 g/L shift earlier; >7 extend
   - GDD: >2800 extend (+1y); <2200 shorten (-1y)
   - Oak: additive shift on END year only
3. Confidence: count non-null inputs of the 6; ≥6 high, 4–5 medium, <4 low.
4. Falls back gracefully — every missing input contributes 0 shift and produces a `factors` row with `hasData: false`.
5. Bottle date fallback chain: `bottled_at → released_at → harvest_date + 18 months → today`.

### `PeakPredictionTab` UI (3 sections, brand tokens only)

**Section 1 — Drinking Window Banner** (full-width Card):
- Heading (Playfair): `{vintageYear} {variety}`
- Large line: `Optimal drinking window: {peakStartYear} – {peakEndYear}`
- Confidence badge with `HelpTooltip` listing missing inputs when not High
- Horizontal timeline: bottle year → bottle year + 20. CSS gradient `bg-gradient-to-r from-cream via-gold/40 to-cream` with the peak-window band overlaid using `bg-primary/30` between left% and right% computed from year offsets. Today marker is an absolutely positioned vertical line `bg-primary`.

**Section 2 — Factor Breakdown** (Collapsible/Accordion):
- 6 rows: name, value (or `No data — using default` muted), and a small directional indicator (TrendingDown / Minus / TrendingUp from lucide).

**Section 3 — Ask Solera CTA** (Button):
- `navigate('/ask-solera?prompt=' + encodeURIComponent('Analyze the aging potential of my {Year} {Variety} and tell me how it compares to similar vintages in our records.'))`

### Tier gating

- Wrap the tab content in `<TierGate requiredTier="small_boutique" featureName="Peak Prediction">…</TierGate>`. "Pro" maps to `small_boutique` per `useTierGate` map.
- The tab trigger remains visible to all users; the locked state appears inside the tab panel. Cleaner UX than hiding the tab.

### AskSolera prefill

Add at top of `AskSolera`:
```tsx
const [searchParams] = useSearchParams();
useEffect(() => {
  const prompt = searchParams.get('prompt');
  if (prompt) setInput(prompt);
}, []);
```
No auto-send, no scheduled submit.

### Deep route

Add `<Route path="/vintages/:vintageId/peak-prediction" element={<VintageDetail />} />` in App.tsx. Inside VintageDetail, read `useLocation().pathname.endsWith('/peak-prediction')` to set Tabs `defaultValue="peak"`. Existing `/vintages/:vintageId` route stays as-is.

### Verification checklist

- `calculatePeakWindow` covers all-null input and returns finite years
- Confidence resolves to low / medium / high correctly
- Today marker positions correctly when today is before bottle date or after window
- Pro gate: Hobbyist sees TierGate locked card with Upgrade Plan button
- Ask Solera prefill populates input but does not call `sendMessage`
- No HelpTooltip content over 300 chars
- No edits to existing Lab / TTB / Anomalies / Costs tabs or data entry dialogs
