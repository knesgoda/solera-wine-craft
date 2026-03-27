

# SEO & AI Discoverability Hardening (Revised)

Skipping all `/coming-soon` → `/signup` changes per your request. Here's what we'll implement:

## Changes

### 1. Stronger static meta in `index.html`
Update the `<title>` and `<meta name="description">` to match the SEOHead defaults. Add static `og:title`, `og:description`, `og:url`, `og:site_name` fallbacks for non-JS crawlers. Add `<link rel="alternate" hreflang="x-default">`.

### 2. Create `public/llms.txt`
Structured summary for AI crawlers: what Solera is, pricing tiers, key features, comparison positioning, and links to key pages.

### 3. Clean up `robots.txt`
Remove the raw Supabase function sitemap URL. Keep only `https://solera.vin/sitemap.xml`.

### 4. Default `noIndex` on app pages
Add `<SEOHead noIndex />` in `AppLayout.tsx` so all authenticated app pages (dashboard, settings, cellar, etc.) are excluded from search indexes by default.

### 5. Add `WebSite` schema with `SearchAction`
Add a `WebSite` JSON-LD block to `HOMEPAGE_SCHEMA` in `SEOHead.tsx` for better Google sitelinks and AI understanding.

## Implementation Order
1. `index.html` — meta updates + hreflang
2. `public/llms.txt` — new file
3. `public/robots.txt` — remove Supabase URL
4. `src/components/AppLayout.tsx` — add `<SEOHead noIndex />`
5. `src/components/SEOHead.tsx` — add `WebSite` schema

Five files touched, no migrations needed.

