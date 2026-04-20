
Diagnostic only — no code changes. I have all the data needed from `vite.config.ts`, `src/main.tsx`, and the offline sync files already in context.

## PWA / Service Worker Diagnostic

**Files:** `vite.config.ts` (VitePWA config), `src/main.tsx` (registration), `src/hooks/useOfflineSync.ts` + `src/lib/syncQueue.ts` + `src/lib/syncFlush.ts` (offline write queue), `src/components/OfflineBanner.tsx` (offline UX).

### 1. What is cached for offline access

**App shell (precache):** Default Workbox precache via `registerType: "autoUpdate"` — all built JS/CSS bundles, `index.html`, plus `includeAssets` (`favicon.png`, `icon-192.png`, `icon-512.png`). `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` (5 MB cap per asset).

**Runtime data caches** (via `runtimeCaching` rules, all keyed by URL pattern against Supabase REST):

| URL pattern | Strategy | Cache name | Max entries | Max age |
|---|---|---|---|---|
| `/rest/v1/tasks` | NetworkFirst | tasks-cache | 100 | 24 h |
| `/rest/v1/lab_samples` | NetworkFirst | lab-cache | 200 | 24 h |
| `/rest/v1/blocks` | StaleWhileRevalidate | blocks-cache | 100 | 24 h |
| `/rest/v1/vintages` | StaleWhileRevalidate | vintages-cache | 100 | 24 h |

### 2. Strategies used

- **App shell**: precache + `autoUpdate` → effectively **cache-first** for all built assets, with background update on next load.
- **Tasks & lab samples (mutable, time-sensitive)**: **NetworkFirst** — try network, fall back to cache when offline.
- **Blocks & vintages (slow-changing reference data)**: **StaleWhileRevalidate** — serve cache immediately, refresh in background.

### 3. Offline coverage of the four key tables

| Table | Cached? | Strategy |
|---|---|---|
| `lab_samples` | ✅ Yes | NetworkFirst, 24 h |
| `blocks` | ✅ Yes | StaleWhileRevalidate, 24 h |
| `vintages` | ✅ Yes | StaleWhileRevalidate, 24 h |
| `tasks` | ✅ Yes | NetworkFirst, 24 h |

All four are cached. Note: cache key is the full URL including query string, so a page that issues a different `select=` / `order=` / filter combo than the cached one will miss cache and fail offline. Only the exact previously-fetched query is replayable offline.

### 4. Offline navigation to an uncached route

**Gap found.** The Workbox config has `navigateFallbackDenylist: [/^\/~oauth/]` but **no `navigateFallback`** is defined. With `registerType: "autoUpdate"` and Vite SPA, behavior is:

- **Previously visited route (HTML in precache via `index.html`)**: Service worker serves the precached `index.html`, React Router takes over, and `OfflineBanner` shows the red "You're offline" bar at the top. Page renders if its data dependencies are in the runtime caches above; otherwise queries fail and component error/empty states render.
- **Never-visited route or hard refresh of an arbitrary path while offline**: Because there is no explicit `navigateFallback: "index.html"`, the request can fall through to the network and produce the **browser's default offline error page** (Chrome's "No internet" dino, Safari "You are not connected to the Internet"). Not a graceful in-app offline screen.

There is **no dedicated `/offline.html`** fallback page and **no React-level "route uncached" boundary**. Offline UX relies entirely on:
1. The precached `index.html` being served for navigations (works for SPA deep-links only if Workbox's default `NavigationRoute` matches, which it does when `registerType: "autoUpdate"` injects the precache manifest — usually fine, but fragile).
2. The `OfflineBanner` component, which only renders inside `AppLayout` (authenticated routes). Unauthenticated/marketing routes get no offline banner.

### Recommended fixes (not applied)

1. Add `workbox.navigateFallback: "index.html"` and `navigateFallbackAllowlist: [/^(?!\/api).*/]` to guarantee the SPA shell is served for any navigation while offline.
2. Optionally add a static `/offline.html` for the rare case the precache itself is unavailable.
3. Consider extending runtime caching to `vineyards`, `fermentation_vessels`, `fermentation_logs` if those views need offline reads.
4. Document the query-string cache-key limitation, or normalize Supabase queries (consistent `select`, `order`) so offline replay reliably hits cache.

No code changes performed.
