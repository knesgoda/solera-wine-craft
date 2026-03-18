
# Solera — Phase 0: Foundation

## Design System
- **Colors**: Crimson `#6B1B2A`, Gold `#C8902A`, Cream `#F5F0E8`, White `#FFFFFF`, Dark `#1A1A1A`
- Update CSS variables and Tailwind config to match
- Placeholder logo: styled barrel icon using Lucide icons with gold/crimson tones

## 1. Supabase Schema & RLS
Connect Supabase, then create:
- **organizations** table: `id`, `name`, `tier` (enum: hobbyist/small_boutique/mid_size/enterprise), `type`, `enabled_modules` (text array), `onboarding_completed` (boolean)
- **profiles** table: `id` (FK to auth.users), `org_id` (FK to organizations), `first_name`, `last_name`, `email`, `push_subscription`, `avatar_url`
- **user_roles** table: `id`, `user_id` (FK to auth.users), `role` (enum: owner/admin/member) — separate table per security best practice
- **RLS policies**: All queries scoped to `org_id` via auth context. Security-definer `has_role()` function for role checks.
- **Trigger**: On signup, auto-create profile row

## 2. Auth Flows (3 pages)
- **/signup**: First name, last name, winery name, email, password. On submit: create org → create profile → assign "owner" role → redirect to onboarding
- **/login**: Email + password. Redirect to dashboard (or onboarding if not completed)
- **/forgot-password** + **/reset-password**: Standard Supabase password reset flow

## 3. Onboarding Wizard (3 steps, /onboarding)
- **Step 1**: Choose operation type (Hobbyist / Small Boutique / Mid-Size / Enterprise) — card selection UI
- **Step 2**: Toggle modules (Vineyard Ops, Vintage Management, Cellar Management, AI Analytics, Sales & DTC) — switch toggles
- **Step 3**: Summary confirmation → saves to `organizations` table → redirects to dashboard
- Only shown once after first signup; skipped if `onboarding_completed = true`

## 4. App Shell Layout
- **Desktop**: Left sidebar with navigation items (Dashboard, Vineyard Ops, Vintages, Cellar, Ask Solera, Sales, Data Import, Settings) — collapsible with icons
- **Mobile**: Bottom tab bar (5 key items), remaining items accessible via "More" tab
- **Top bar**: Org name on left, notification bell + user avatar dropdown on right
- All touch targets ≥ 44px on mobile

## 5. Dashboard (/dashboard)
- **3 stat cards**: Active Vintages, Upcoming Pick Windows, Tasks Due — each with placeholder data and link to respective module
- **Ask Solera** quick input stub: text input with send button (non-functional, placeholder only)
- Responsive grid: 3 columns on desktop, stacked on mobile

## 6. Placeholder Module Pages
- Empty pages for each nav item (Vineyard Ops, Vintages, Cellar, Ask Solera, Sales, Data Import, Settings) showing "Coming soon" state
- Routes configured but no feature logic

## 7. Responsive Design
- Fully responsive layout with Tailwind breakpoints
- Bottom tab nav on mobile (< 768px), sidebar on desktop
- All interactive elements meet 44px minimum touch target
