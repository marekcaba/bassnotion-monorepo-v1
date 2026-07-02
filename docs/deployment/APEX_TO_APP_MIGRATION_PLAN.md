# Apex → App Subdomain Migration Plan

**Status:** Planned (not started). Build-ready.
**Author intent (2026-07-02):** "Everything that is not public — marketing pages, landing pages,
free public stuff aside — should live on `app.bassicology.com`. Therefore `/admin`, `/settings`,
etc. belong there too."

**Prereq:** the Library move (PR #199) is the proven template — `/library` was migrated
`APEX_ONLY → APP_ROUTES` exactly this way. Read that diff first; every route below follows the same
recipe.

---

## The principle — with the refinement the audit forced

> **Public/marketing → apex (`bassicology.com`). Non-public/member → app (`app.bassicology.com`).**

The app subdomain is **`noindex`** (robots off — see the runbook Step 9) and **auth-gated at the
edge** (P2 gate in `middleware.ts`). So "move to app" means two coupled things: *it stops being
indexable* and *it requires a session cookie*. That is exactly right for member surfaces — and
exactly WRONG for a public conversion funnel.

The audit found the four apex routes do **not** all fit "non-public":

| Route | Auth today | Public role | Verdict |
|---|---|---|---|
| `/admin` | Authenticated (`AdminGuard`) | none | **MOVE → app** ✅ |
| `/dashboard` | Authenticated (`AuthGuard`) | none — **legacy v1**, superseded by `/app/backstage` | **DELETE (don't move)** — see §Dashboard |
| `/assessment` | **PUBLIC** (unauth; `/api/v1/assessment/config` needs no Bearer) | **conversion funnel** entry (WelcomeScreen, JourneySection, /preview) | **KEEP on apex** — moving it noindexes + gates a public funnel ⚠️ |
| `/drum-record` | **PUBLIC** (QA tool, testers on any phone) | none, but needs to open unauthenticated | **KEEP on apex** (or delete if retired) ⚠️ |

**So the real scope is smaller than "move all four":** move `/admin`, delete legacy `/dashboard`,
and LEAVE the two public routes on the apex. If you want `/assessment` behind the app anyway,
that's a product decision about the funnel — flagged below, not assumed.

---

## Route-by-route

### /admin — MOVE into the app shell (inside the sidebar nav)

**Decision (author, 2026-07-02):** admin renders **inside the member nav shell** (the sidebar with
Backstage/Gym/Library/…), not chrome-less.

**Size:** large — ~20 pages under `app/admin/` (monitoring, assessment config, tutorials +
`[slug]/edit`, scales, gigs, grooves, folders, founder-card, funnels, instruments/wurlitzer,
products, training-goals). Its own `layout.tsx` renders an `AdminGuard` + a horizontal admin navbar.
`tutorials/[slug]/edit` has a full-bleed `layout.tsx` override (no navbar).

**Recipe:**
1. Move `apps/frontend/src/app/admin/` → `apps/frontend/src/app/app/admin/`.
2. `middleware.ts`: remove `/admin` from `APEX_ONLY`, add `/admin` to `APP_ROUTES` (the prefix match
   already covers all `/admin/*` subpages). It then rewrites `/admin` → `/app/admin` and inherits
   the P2 edge auth gate. **Keep `AdminGuard`** — the edge gate only checks cookie *presence*; the
   role check must stay.
3. **Shell decision — inside the member sidebar:** two sub-options, pick at build time:
   - (a) Add an "Admin" item to a member-gated section of `MAIN_NAV_ITEMS`/`BOTTOM_NAV_ITEMS`
     (visible only when `isAdmin`), and let `AppClientLayout` wrap `/app/admin/*` like any room.
     The admin's OWN horizontal navbar (in `admin/layout.tsx`) becomes a secondary nav *inside* the
     content pane — decide whether to keep it (two-level nav) or fold its links into the sidebar.
   - (b) Keep the admin's horizontal navbar as-is but mount it inside the shell's `<main>`.
   Recommend (a) with the admin navbar retained as an in-content sub-nav (least rework, clear
   hierarchy). **Do NOT** add audio wiring — admin has no player.
4. **Inbound links (all INTERNAL — no marketing links to admin):**
   - `app/dashboard/page.tsx:419-473` — 4 admin nav buttons. Moot once dashboard is deleted (§below).
   - `domains/platform/components/UserAccountSection.tsx:78,85` — `/admin/tutorials/{slug}/edit` +
     `/admin/tutorials`. Clean paths still resolve after the move (rewrite handles it) — **no change
     needed** (they're already clean `/admin/...`, which will now rewrite into the app).
   - `domains/widgets/.../YouTubeWidgetPage.tsx` — `/admin/tutorials/{slug}/edit`. Same: clean path,
     no change.
   - `app/admin/tutorials/page.tsx` self-referential `router.push('/admin/...')` — no change.
   - **Key insight:** because these already use the *clean* `/admin/...` path (not an absolute apex
     URL), moving `/admin` into `APP_ROUTES` makes them Just Work on the app host. The only links
     that would break are absolute-apex ones — **the audit found none.**
5. **SEO:** none (authenticated, no metadata). No robots change needed.
6. **Verify:** tsc; `/admin` → 200 on app host (rewrite), `AdminGuard` still gates non-admins,
   sidebar shows Admin for admins only, `tutorials/[slug]/edit` still full-bleed.

### /dashboard — DELETE (legacy v1), don't move

**Audit verdict: legacy v1**, superseded by `/app/backstage` (middleware already redirects app `/` →
`/backstage`). Its own code comments say navigation "moved to the side-nav component"; it's largely
an "AutoAnimate demo" + admin buttons + profile editing that duplicates `UserIndicator`/Settings.

**But it's still linked**, so deletion = repoint each inbound link to the modern equivalent:
| Link | File:line | Repoint to |
|---|---|---|
| UserIndicator avatar click | `domains/user/components/UserIndicator.tsx:26` | `/backstage` (the app home) |
| Assessment v1 completion | `app/assessment/page.tsx:170` | `/backstage` (or stay on apex → app handoff, see §Assessment) |
| Assessment v2 completion | `app/assessment/v2/page.tsx:24` | `/backstage?journey=…` |
| Assessment ResultsScreen | `domains/assessment/components/ResultsScreen.tsx:97` | `/backstage` |
| Post-registration | `app/register/page.tsx:75` | `/backstage` |
| UserIndicator test | `domains/user/components/__tests__/UserIndicator.test.tsx` | update mock expectation |

⚠️ **`UserIndicator` is on every page header (apex + app).** Repointing it to `/backstage` (an app
route) is correct on the app host but from the APEX it must cross origin → use `navigateToMarketing`
or an app-absolute URL. Handle the origin like the existing cross-product links do.

**Alternative:** if you're not ready to delete, treat it like /admin (move to app) — but the audit
says it's dead weight. Recommend delete.

### /assessment — KEEP on apex (public funnel) unless you decide otherwise

**Public + unauthenticated + a conversion funnel entry.** Moving it to the app subdomain would
**noindex it** and **gate it behind login** — breaking the funnel. It has v1 + v2, both active.

**Recommendation:** leave in `APEX_ONLY`. The only cleanup is its *exit* redirects (currently →
`/dashboard`, which is being deleted) → repoint to `/backstage` via the apex→app handoff (same
pattern the billing/welcome upgrade flow already uses to hand off apex→app).

**If you DO want it on the app** (product call — e.g. assessment becomes members-only): then it's a
full move (folder + APP_ROUTES + the public API auth) AND you accept losing its public/SEO role.
Don't do this without deciding the funnel consequence.

### /drum-record — KEEP on apex (or delete if retired)

Public QA tool, must open unauthenticated on any device, **orphaned** (no inbound links — only its
own asset `test-groove-2-drums.ogg`). Moving it behind the auth gate defeats its purpose. Leave it,
or delete it if the drum-tempo engine QA is done. No links to repoint either way.

---

## Recommended sequencing

1. **PR A — Move `/admin` into the app shell.** Self-contained, all-internal links, biggest win for
   the principle. Includes the sidebar/shell wiring decision.
2. **PR B — Delete legacy `/dashboard`** + repoint its ~6 inbound links to `/backstage` (mind the
   `UserIndicator` cross-origin case).
3. **PR C (optional) — Assessment exit-redirect cleanup** (`/dashboard` → `/backstage` handoff),
   keeping assessment itself on the apex.
4. **Leave `/assessment` + `/drum-record` public on the apex** unless a product decision says
   otherwise.

Each PR is independently reviewable and low-risk. Do NOT bundle — PR A touches the edge auth routing.

## The template

`/library` (PR #199) is the exact recipe: folder → `app/app/<x>`, `APEX_ONLY` → `APP_ROUTES`, repoint
inbound links by intent, verify route resolves 200 + gate + shell. Every move above is that, scaled.

## Also on the list (separate "v1 legacy sweep")

Not part of this migration but adjacent v1 cruft to retire: `/preview`, `/preview-v2`, `/auth-demo`,
the marketing nav's dead "Practice" link (was → legacy `/library`), the unrendered `WelcomeScreen`
component, the YouTube-widget "Back to Library" chrome. Track separately.
