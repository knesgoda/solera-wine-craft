

## Fix: Sidebar Logo Layout

The issue is that the sidebar header uses the **word-marked logo** (which already says "Solera") at a tiny 36×36px size, plus a separate "Solera" text label. This makes the header area look cramped and redundant.

### Changes

**`src/components/AppSidebar.tsx`** (lines 255-258):
- When **expanded**: Show only the word-marked logo at a larger size (e.g., `h-8` height, auto width) — no separate text needed since the logo already contains the word "Solera"
- When **collapsed**: Show a smaller square version of the logo (keep `h-9 w-9`) as an icon
- Add slight padding adjustments so the logo has breathing room

This is a single-file change with no database or backend impact.

