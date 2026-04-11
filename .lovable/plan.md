

# Solera Marketing Site — Smoke Test Audit

## 1. Route Map

| Route | Component | Status |
|---|---|---|
| `/` | `src/pages/marketing/Homepage.tsx` | OK — renders inside `MarketingLayout` |
| `/coming-soon` | `src/pages/ComingSoon.tsx` | OK — standalone (no MarketingLayout wrapper) |
| `/features` | `src/pages/marketing/FeaturesPage.tsx` | OK |
| `/pricing` | `src/pages/marketing/PricingPage.tsx` | **HAS BUGS** (see below) |
| `/compare` | `src/pages/marketing/ComparePage.tsx` | OK |
| `/blog` | `src/pages/marketing/BlogIndex.tsx` | OK |
| `/blog/:slug` | `src/pages/marketing/BlogPost.tsx` | OK |
| `/about` | `src/pages/marketing/AboutPage.tsx` | OK |
| `/faq` | `src/pages/marketing/FaqPage.tsx` | OK |
| `/changelog` | `src/pages/marketing/ChangelogPage.tsx` | OK |
| `/privacy` | `src/pages/marketing/PrivacyPage.tsx` | OK |
| `/terms` | `src/pages/marketing/TermsPage.tsx` | OK |
| `/contact` | `src/pages/marketing/ContactPage.tsx` | OK |

Nav links (MarketingNavbar): Features, Pricing, Compare, Blog, About — all valid routes. Contact, FAQ, Changelog, Privacy, Terms are not in the navbar but are routed.

---

## 2. Waitlist / CTA Flow (`/coming-soon`)

- **Component**: `src/pages/ComingSoon.tsx`
- **On submit**: Inserts directly into `waitlist_signups` table via Supabase client, then fire-and-forget calls `notify-waitlist-signup` Edge Function (which sends admin email via Resend)
- **Validation**: HTML `required` on name/email, `type="email"` on email field; duplicate check via Postgres unique constraint (code `23505`) with friendly message
- **Success state**: Shows "You're on the list. We'll be in touch soon — thank you."
- **Error state**: Shows "Something went wrong. Please try again."
- **No honeypot** on this form (ContactPage has one, ComingSoon does not)
- **Issue**: No explicit client-side email format validation beyond `type="email"`; acceptable

**All marketing CTAs route to `/coming-soon`** — confirmed in Homepage, FeaturesPage, ComparePage, PricingPage, BlogPost mid-article CTA, and MarketingNavbar. No dead links found.

---

## 3. Pricing Page — CRITICAL BUG

### Tier key mismatch causes Pro and Growth to show "Free"

The `TIERS` array uses keys `"pro"` and `"growth"`, but `PADDLE_PRICES` in `src/constants/paddle-prices.ts` uses `"small_boutique"` and `"mid_size"`.

The `getPrice()` function does:
```
PADDLE_PRICES[tierKey] // tierKey = "pro" → undefined
```

When `priceConfig` is undefined, it returns `""`. The card then renders `{priceStr || "Free"}`, so **Pro and Growth both display "Free"** instead of $69/mo and $129/mo.

**Fix required**: Map tier keys in `getPrice()`:
```
const TIER_TO_PADDLE: Record<string, string> = {
  pro: "small_boutique",
  growth: "mid_size",
};
const paddleKey = TIER_TO_PADDLE[tierKey] || tierKey;
const priceConfig = PADDLE_PRICES[paddleKey];
```

### All CTA buttons route correctly
Every tier card button calls `handleCheckout()` which navigates to `/coming-soon`. No dead links, no `href="#"`.

### Savings calculator
Competitor data is hardcoded in `COMPETITOR_DATA`. Prices match competitive research:
- Innovint $149 ✓
- Ekos $279 ✓  
- WineDirect $149 ✓
- Commerce7 $299 ✓
- vintrace $184 ✓

### Hobbyist has no annual price
`PADDLE_PRICES.hobbyist` only has `monthly`, no `annual`. The toggle works correctly because `getPrice` returns "Free" for hobbyist regardless.

---

## 4. Blog

- **Renderer**: `react-markdown` with `remark-gfm` plugin — handles tables, strikethrough, task lists
- **Content source**: `blog_posts` table in database, queried via Supabase client
- **Prose CSS**: `@tailwindcss/typography` is in `package.json` (v0.5.16) and loaded in `tailwind.config.ts`. Blog post container has `prose prose-lg max-w-none` with extensive customizations for headings, links, code blocks, blockquotes
- **Tables, bullets, paragraphs**: All handled by `prose` + `remark-gfm`
- **TOC**: Auto-generated from H2 headings, shown on desktop sidebar
- **No issues found**

---

## 5. Compare Page

- **Competitor data**: All hardcoded in `COMPETITORS` array
- **Pricing figures verified**:
  - Innovint $149/mo ✓
  - Ekos $279/mo ✓
  - WineDirect $149/mo + fees ✓
  - Commerce7 $299/mo + fees ✓
  - vintrace "Contact for pricing" — **flag**: the pricing page savings calculator uses $184 for vintrace but the compare page says "Contact for pricing". These should be consistent.
  - VinSuite $149+/mo ✓
  - Spreadsheets Free ✓
- **CTAs**: All "Switch from X" buttons route to `/coming-soon` ✓
- **No issues beyond the vintrace pricing inconsistency**

---

## 6. Flags Summary

### CRITICAL
1. **Pricing page shows "Free" for Pro and Growth tiers** — tier key mismatch between `TIERS` array (`"pro"`, `"growth"`) and `PADDLE_PRICES` (`"small_boutique"`, `"mid_size"`)

### MEDIUM
2. **vintrace pricing inconsistency** — Compare page says "Contact for pricing" but Pricing page savings calculator uses $184/mo. Pick one.

### LOW
3. **`/coming-soon` renders outside `MarketingLayout`** — no navbar/footer on the waitlist page. This appears intentional (standalone landing page design) but worth confirming.
4. **Blog featured post placeholder** — featured post image area shows a `📝` emoji at 20% opacity instead of an actual image. This will look unpolished at launch if no `cover_image` field is populated.
5. **No honeypot on waitlist form** — ContactPage has a honeypot bot trap but ComingSoon does not. Low risk but inconsistent.

### NO ISSUES
- No broken image imports found (logo imports reference existing assets)
- No placeholder/lorem ipsum content detected
- No missing environment variable references in marketing pages
- All routes resolve to real components
- `@tailwindcss/typography` properly installed and configured

---

## Recommended Fix Priority

1. **Fix tier key mapping in PricingPage.tsx** — this is user-facing and makes paid tiers look free
2. **Resolve vintrace pricing** — pick $184 or "Contact" and use it everywhere
3. **Optional**: Add honeypot to waitlist form, add blog cover image support

