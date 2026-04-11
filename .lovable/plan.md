

# Waitlist Copy Updates

The audit fixes from the previous implementation already resolved the three main issues (pricing tier mismatch, vintrace pricing, honeypot). Two small copy changes remain on the waitlist form:

## Changes

### 1. Update error message (ComingSoon.tsx, line 72)
Current: `"Something went wrong. Please try again."`
New: `"Something went wrong — please try again or email kevin@solera.vin"`

### 2. Update success message (ComingSoon.tsx, line 183)
Current: `"You're on the list. We'll be in touch soon — thank you."`
New: `"You're on the list. We'll reach out before we open the doors."`

## Already Confirmed (no changes needed)
- All CTA buttons route to `/coming-soon` — no dead links
- Duplicate email check works via Postgres unique constraint (code 23505)
- Blog posts render with `prose prose-lg`, `remarkGfm`, and `@tailwindcss/typography`
- Competitor pricing matches research (Innovint $149, Ekos $279, Commerce7 $299 + fees, WineDirect $149 + 4.5%, vintrace $184)
- No placeholder content on any marketing page

## Files modified
- `src/pages/ComingSoon.tsx` — two string changes only

