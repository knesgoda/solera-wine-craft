# HelpTooltip System — Implementation Plan

Add a single reusable click-activated help tooltip and place it next to ~80 field labels and stat tiles across the app, so users get inline guidance without crowding the UI.

## Part 1 — Build the reusable component

**New file:** `src/components/ui/HelpTooltip.tsx`

- Built on the already-installed `@radix-ui/react-popover` (no new deps).
- Props: `content: string` (required), `size?: "sm" | "md"` (default `"sm"`).
- Click-only trigger (Radix Popover defaults to click on Trigger). Click outside / Escape close automatically.
- ? button: 16px (sm) / 20px circle, transparent bg, 1px solid Solera gold (`#C8902A`), gold text 10px/600, hover fills gold with white text, gold focus ring, `aria-label="Help"`, `aria-expanded` reflects open state.
- Popover: max-width 280px, bg `#1a1a1a`, text `#F5F0E8` 13px / line-height 1.5, radius 6px, padding 10px 14px, shadow `0 4px 12px rgba(0,0,0,0.3)`, `role="tooltip"`, side `top` with `collisionPadding` so it auto-flips below near viewport edges, includes a small `<PopoverArrow>` matching the dark bg.
- All Tailwind utility classes are static (no template literals); explicit hex colors used inline via `style` only where Tailwind tokens don't match the spec exactly (popover bg/text), to satisfy the JIT static-class rule.

## Parts 2–10 — Place tooltips

For every label below, render `<HelpTooltip content="…" />` immediately after the label text, inline, with a 4px left margin (`ml-1`). Stat tile titles get the icon next to the title text inside `<CardTitle>`.

- **Part 2 — Dashboard** (`src/pages/Dashboard.tsx`): the 5 stat card titles + the Ask Solera CardTitle ("Ask Solera" line) for the input.
- **Part 3 — Vineyard Operations** (`src/pages/operations/BlockDetail.tsx`, `VineyardDetail.tsx`, `src/components/tasks/NewTaskDialog.tsx`, `src/pages/tasks/TaskDetail.tsx`): block metadata fields (Variety, Clone, Rootstock, Acres, Row Orientation, Vine Spacing, Row Spacing, Year Planted, GDD Accumulation, Estimated Harvest Date) + task fields (Task Type, Assigned To, Due Date, Priority).
- **Part 4 — Vintage & Lab** (`src/components/vintages/NewLabSampleDialog.tsx`, `NewVintageDialog.tsx`, `src/pages/vintages/VintageDetail.tsx`): lab fields (Brix, pH, TA, VA, Free SO2, Total SO2, Alcohol, RS, Malic Acid, Sample Source) + vintage fields (Target Brix, Target pH, Fermentation Start Date, MLF Status).
- **Part 5 — Cellar & Fermentation** (`src/components/cellar/NewVesselDialog.tsx`, `NewTrialDialog.tsx`, `src/pages/cellar/VesselDetail.tsx`, `TrialDetail.tsx`): vessel fields (Vessel Type, Capacity, Fill Level, Vessel Status, Oak Type, Toast Level, Barrel Age), fermentation log fields (Temperature, Pump Over / Punch Down, Brix Drop, Inoculation Date, Yeast Strain), blending trial fields (Component Percentage, Trial Notes, Target Volume).
- **Part 6 — TTB Compliance** (`src/components/vintages/NewAdditionDialog.tsx`, `TtbAdditionsTab.tsx`, `src/pages/compliance/ComplianceReports.tsx`, `ComplianceSettings.tsx`): TTB additions (Addition Type, Quantity, Purpose, Lot Number) + OW-1 (Bond Number, Reporting Period, Wine on Hand Beginning, Produced This Period, Taxpaid Removals, Losses).
- **Part 7 — Sales / DTC / Inventory** (`src/components/inventory/NewSkuDialog.tsx`, `src/pages/inventory/SkuDetail.tsx`, `InventoryList.tsx`, `src/pages/club/ClubDetail.tsx`, `ClubShipments.tsx`): SKU fields (SKU, Bottle Size, Cases On Hand, Bottles On Hand, Allocation, Cost Per Bottle, Retail Price) + wine club (Shipment Frequency, Club Tier, Compliance State).
- **Part 8 — Custom Crush Portal** (`src/pages/clients/ClientDetail.tsx`, `src/pages/client/ClientVintageDetail.tsx`, `ClientDocuments.tsx`): Client Name, Lot Number, Grapes Received, Expected Yield, Contract Status, COA Status.
- **Part 9 — Data Migration & Integrations** (`src/components/import/ImportUploader.tsx`, `MappingReview.tsx`, `ImportPreview.tsx`, `src/pages/DataImport.tsx`, `src/pages/settings/GoogleSheetsSettings.tsx`, `ApiSettings.tsx`): Source Format, Column Mapping, Import Target, Duplicate Handling, Google Sheets Sync, Sync Frequency, API Key, Webhook URL.
- **Part 10 — Ask Solera** (`src/pages/AskSolera.tsx`): New Chat, Conversation History, Winery Context indicator (if rendered), Analog Explorer link/section.

If a specific field/label doesn't exist in a file, that tooltip is skipped for that file and noted in the final report rather than inventing UI.

## Part 11 — Final verification pass

After all placements:

1. Grep all `HelpTooltip content="…"` usages and report any whose content exceeds 300 characters (none of the supplied strings exceed this, but the check is run anyway).
2. Confirm every module imports the same `@/components/ui/HelpTooltip` and there are no parallel re-implementations (`rg "function HelpTooltip|const HelpTooltip"`).
3. Build/typecheck runs automatically; runtime errors panel is checked for HelpTooltip-related errors.
4. Manually scan each modified label row for crowding at 375px — tooltips use `inline-flex` with `ml-1` and the trigger is only 16px so they sit cleanly to the right of labels without breaking inputs/buttons. Any layout that wraps awkwardly gets `flex items-center gap-1` on the parent label.

Report findings; if all clean, output **TOOLTIP SYSTEM COMPLETE**.

## Technical notes

- Component is a single self-contained file using `Popover`, `PopoverTrigger`, `PopoverContent` from `@/components/ui/popover` (already wraps Radix). PopoverArrow is added via direct `@radix-ui/react-popover` import for the arrow only.
- No changes to `tailwind.config.ts`, no new packages, no DB/RLS/edge function changes.
- Memory rule respected: all Tailwind classes used are full static utilities; the gold/cream/near-black colors that aren't already tokens are applied via inline `style` to avoid arbitrary-value class generation issues.
- Per the "no em dashes in user-facing copy" rule, all tooltip strings supplied by the user use en dashes / hyphens — kept as provided. Any em dashes in the supplied copy will be normalized to hyphens before insertion.
