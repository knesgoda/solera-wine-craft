

## FK Cascade Diagnostic — Vineyard & Org Deletion

**Source:** Live `pg_constraint` queries against the production schema, cross-checked against `scripts/audit/cascade-delete-report.txt`.

---

### PATH 1 — Delete a vineyard

| Relationship | Rule | Notes |
|---|---|---|
| `vineyards` ← `blocks.vineyard_id` | **CASCADE** | ✅ blocks deleted with vineyard |
| `blocks` ← `vintages.block_id` | **SET NULL** | ⚠️ vintages survive, lose block link |
| `blocks` ← `lab_samples.block_id` | **NO ACTION** | 🔴 **delete blocks if any lab_sample references them** |
| `blocks` ← `tasks.block_id` | **SET NULL** | ⚠️ tasks survive unlinked |
| `vintages` ← `lab_samples.vintage_id` | **CASCADE** | ✅ (irrelevant here, vintages aren't deleted) |
| `vintages` ← `ttb_additions.vintage_id` | **CASCADE** | ✅ (irrelevant here) |
| `vintages` / `blocks` ← `vintage_milestones.*` | **N/A** | ℹ️ Table does not exist in the schema |
| `vineyards` ← `tasks.*` | **No FK** | ℹ️ tasks have no `vineyard_id`; only `block_id` (SET NULL) and `org_id` (CASCADE) |

**Effective behavior:** Deleting a vineyard cascades to its blocks. But:
- 🔴 If any `lab_samples` row references one of those blocks via `block_id`, the cascade will **fail with FK violation** (NO ACTION = block-the-delete). Lab samples would need to be reassigned or deleted manually first.
- ⚠️ Vintages and tasks linked to those blocks survive as orphans (`block_id` set to NULL) — historically defensible (preserve harvest record after vineyard removal) but worth flagging.

---

### PATH 2 — Delete an organization

| Relationship | Rule | Notes |
|---|---|---|
| `organizations` ← `vineyards.org_id` | **CASCADE** | ✅ → triggers Path 1 sub-cascade |
| `organizations` ← `vintages.org_id` | **CASCADE** | ✅ → cascades to `lab_samples`, `ttb_additions` |
| `organizations` ← `profiles.org_id` | **CASCADE** | ✅ users-in-org wiped |
| `organizations` ← `tasks.org_id` | **CASCADE** | ✅ |
| `organizations` ← `growers.org_id` | **CASCADE** | ✅ |
| `organizations` ← `grower_contracts.org_id` | **CASCADE** | ✅ → cascades to `weigh_tags`, `contract_block_assignments`, `grading_scales` |
| `organizations` ← `client_orgs.parent_org_id` | **CASCADE** | ✅ → cascades to `client_users`, `client_messages`, `client_invite_tokens` |
| `organizations` ← `alert_rules.org_id` | **NO ACTION** | 🔴 blocks org delete |
| `organizations` ← `notifications.org_id` | **NO ACTION** | 🔴 blocks org delete |
| `organizations` ← `customers.org_id` | **NO ACTION** | 🔴 blocks org delete |
| `organizations` ← `orders.org_id` | **NO ACTION** | 🔴 blocks org delete |
| `organizations` ← `wine_clubs.org_id` | **NO ACTION** | 🔴 blocks org delete |
| `organizations` ← `club_members.org_id` | **NO ACTION** | 🔴 blocks org delete |
| `organizations` ← `club_shipments.org_id` | **NO ACTION** | 🔴 blocks org delete |
| `auth.users` ← `referrals.referrer_user_id` | **CASCADE** | ✅ tied to user, not org directly |
| `auth.users` ← `referrals.referred_user_id` | **SET NULL** | ⚠️ preserves history of who-converted |

**Effective behavior:** `cancellation-backups` flow + the cascade audit report confirm this works in practice **only because the application manually clears the NO ACTION tables first** (alert_rules, notifications) before issuing `DELETE FROM organizations`. Without that manual cleanup, org deletion fails.

---

### Flagged issues

| # | Severity | Finding |
|---|---|---|
| 1 | 🔴 High | `lab_samples.block_id` → `blocks` is **NO ACTION**. Deleting a vineyard with blocks that have lab samples will fail. Should be **CASCADE** (samples make no sense without their block) or **SET NULL** (preserve historical chemistry, drop spatial link). |
| 2 | 🟡 Medium | Seven org-children use **NO ACTION** instead of CASCADE: `alert_rules`, `notifications`, `customers`, `orders`, `wine_clubs`, `club_members`, `club_shipments`. Per `mem://database/deletion-constraints` this is intentional ("manual clear before org delete") but it means org deletion is **not** atomic — any code path that issues a raw `DELETE FROM organizations` without the cleanup script will fail. Risk: future devs / direct SQL / admin tooling. |
| 3 | 🟡 Medium | `vintages.block_id` and `tasks.block_id` use **SET NULL** when their parent block is deleted. Acceptable for historical preservation, but creates orphans with no UI to repair them. Audit log or pre-delete warning would help. |
| 4 | 🟢 Info | `referrals.referred_user_id` → `auth.users` uses **SET NULL**. Correct: preserves credit history when a referred user closes their account. |
| 5 | 🟢 Info | `vintage_milestones` referenced in the question **does not exist** as a table in this schema. (Vintage state transitions are tracked on the `vintages` row itself, not in a separate audit table.) |

---

### Recommended fixes (not applied — diagnostic only)

1. **Fix Path 1 break:** Change `lab_samples_block_id_fkey` from NO ACTION to **SET NULL** (preserves chemistry history; matches `vintages.block_id` and `tasks.block_id` pattern). One-line migration.
2. **Decide Path 2 atomicity:** Either (a) flip the seven NO ACTION org-children to CASCADE so `DELETE FROM organizations` is atomic, or (b) keep current behavior but **document and centralize** the manual-cleanup step in a single `delete_organization_safely(org_id)` SECURITY DEFINER function so no caller ever skips it.
3. **Add a periodic orphan-detection script** to `scripts/audit/` that flags vintages/tasks with NULL `block_id` for review — currently invisible after a vineyard deletion.

