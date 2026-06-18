# App Subdomain Migration Runbook — `/app/**` → `app.bassicology.com/**`

> **Purpose:** Move the authenticated product from a path prefix
> (`bassicology.com/app/*`) to a dedicated subdomain (`app.bassicology.com/*`),
> so members see clean URLs (`app.bassicology.com/gym`) that mirror the
> marketing/product split Pickup Music uses (`platform.pickupmusic.com`).
>
> **Status:** PLANNED — launch-time task. Do the **staging dry-run first**, then prod.
>
> **Created:** 2026-06-18. **Rewritten:** 2026-06-18 after a full code audit that
> overturned the original auth design, then **rewritten again 2026-06-18** after a
> second multi-agent audit overturned the *navigation/`usePathname()`* design (see
> "What the SECOND audit changed" below).

---

## ⚠️ READ THIS FIRST (part 1) — what the FIRST audit changed (auth)

The original draft assumed the Supabase **session lives in a cookie** and that
we'd widen the cookie domain to `.bassicology.com` for cross-subdomain SSO.
**That is false for this codebase.** Verified facts:

1. **The session is in `localStorage`, not cookies.**
   [apps/frontend/src/infrastructure/supabase/client.ts:74-106](../../apps/frontend/src/infrastructure/supabase/client.ts#L74-L106)
   creates the client with `persistSession: true`, `flowType: 'pkce'`, and
   `storage: undefined` for normal browsers → Supabase defaults to `localStorage`
   under the key `sb-<project-ref>-auth-token`. There is **no `@supabase/ssr`**,
   no `createServerClient`, no `cookieOptions`, no cookie `domain` anywhere in the
   auth path. The backend is **Bearer-token only**
   ([auth.guard.ts:63-66](../../apps/backend/src/domains/user/auth/guards/auth.guard.ts#L63-L66)
   reads `Authorization: Bearer` and nothing from cookies). **VERIFIED by the
   second audit: CONFIRMED, fully accurate.**

2. **`localStorage` is origin-scoped and CANNOT be shared across origins.**
   `https://bassicology.com` and `https://app.bassicology.com` are *different
   origins* with *separate* `localStorage`. There is no domain attribute to
   widen (that only exists for cookies). So the "cross-subdomain SSO via cookie
   domain" plan is not just unnecessary — it is **impossible** here without a
   rewrite of the auth storage layer.

   > **One-time migration note:** because `localStorage` is per-origin, a user
   > already logged in on `bassicology.com` will **not** carry their session to
   > `app.bassicology.com` — they re-authenticate once on the subdomain. With no
   > production users yet (per CLAUDE.md) this is a non-issue, but call it out if
   > that changes before launch.

3. **Therefore the architecture is forced, and it's the safe one:** the browser
   must only ever see **one origin** for the whole auth + product flow. We do a
   pure **host rewrite** (URL-preserving) where `app.bassicology.com/*` serves
   the existing `/app/*` files, **and we serve `/login`, `/register`, and
   `/auth/callback` on the SAME subdomain.** Login writes the session to
   `app.bassicology.com`'s localStorage; the app reads it from the same origin.
   No handoff, no cookie domain, no cross-origin anything.

   The **failure mode to avoid** is a user completing login on the **apex** while
   the app is on the subdomain. Auth redirects are built from
   `window.location.origin` (verified:
   [auth.ts:274,365,451](../../apps/frontend/src/domains/user/api/auth.ts#L274)),
   so a login started on `bassicology.com` writes the PKCE verifier **and** the
   session to **apex** localStorage; landing on `app.bassicology.com` then shows
   **empty localStorage = appears logged out.** There is no cookie-domain
   quick-fix because the session isn't a cookie.

   > **⚠️ The first runbook contradicted itself here** (the host-policy table kept
   > `/login` "allowed on the apex so marketing CTAs work"). That re-creates the
   > exact stranding failure above. **Resolution in this rewrite:** the apex
   > `/login`/`/register` **redirect (308) to the app subdomain** so the entire
   > auth flow always completes on one origin. Marketing CTAs may *link to* the
   > app login; they must not render an apex login that writes a session. See the
   > corrected host-policy table.

---

## ⚠️ READ THIS FIRST (part 2) — what the SECOND audit changed (navigation)

The previous rewrite claimed that after a `NextResponse.rewrite`, the client
`usePathname()` returns the **internal** path (`/app/gym`), so the ~10
active-link/panel comparisons against `/app/*` literals keep working with **ZERO
changes**. **That is backwards.** Verified against the official Next.js docs and
by opening every consumer:

- After `NextResponse.rewrite`, the browser URL is **preserved** (clean: `/gym`),
  and **`usePathname()` on the client returns that clean browser path** (`/gym`),
  **not** the internal `/app/gym`. Next.js also warns this server-vs-client
  divergence "can cause a hydration mismatch."
- Every comparator hard-matches `/app/*` literals and would therefore **break**
  on the app host: [SidebarNav.tsx:48-52](../../apps/frontend/src/domains/platform/components/SidebarNav.tsx#L48-L52)
  (active highlight never fires), [DetailPanel.tsx:32-39](../../apps/frontend/src/domains/platform/components/DetailPanel.tsx#L32-L39)
  (panel renders empty), [app/app/layout.tsx:24-30](../../apps/frontend/src/app/app/layout.tsx#L24-L30)
  (deep-route detection off by one), [UserAccountSection.tsx:57-60](../../apps/frontend/src/domains/platform/components/UserAccountSection.tsx#L57-L60)
  (admin "Edit Tutorial" gate).
- **`navigation.ts` URLs are dual-use:** the same literal is BOTH the
  `router.push` target ([SidebarNav.tsx:33](../../apps/frontend/src/domains/platform/components/SidebarNav.tsx#L33))
  AND the highlight comparator (line 50). One value cannot be both the `/app/*`
  comparator and the clean `/gym` push target. The old "do NOT change
  navigation.ts" rule therefore **guarantees** the URL bar reverts to `/app/gym`
  on the first in-app click — defeating the entire migration.

**The adopted design (decided 2026-06-18): "Clean URLs + a normalization hook."**

1. **Nav/link/`router.push` targets use CLEAN paths** (`/gym`, `/college`, …),
   so the URL bar stays clean on every click. The host rewrite turns `/gym` into
   the internal `/app/gym` for rendering. (Note: College's clean URL is
   **`/college`**, NOT `/bassment` — there is no `/bassment` route; see the
   College special case in Step 3.)
2. **A single shared hook `useInternalPathname()`** re-derives the internal path
   for the ~10 comparator sites, so highlighting/panel/admin-gate logic keeps
   comparing against `/app/*` literals and works identically on BOTH hosts:

   ```ts
   // apps/frontend/src/lib/hooks/use-internal-pathname.ts
   import { usePathname } from 'next/navigation';

   /**
    * On app.bassicology.com the URL is clean (/gym) and usePathname() returns it
    * clean. Comparator/panel logic is written against the INTERNAL /app/* tree,
    * so map the clean path back to the internal one. On the apex no comparator
    * mounts, so the transform is harmless there (NOT a strict no-op: '/' → '/app').
    */
   export function useInternalPathname(): string {
     const pathname = usePathname();
     if (pathname === '/') return '/app';
     // Label alias: the clean /college room serves the /app/bassment folder, so
     // the comparator must see /app/bassment (NOT /app/college, which no
     // comparator/activePattern matches). This mirrors the middleware's
     // /college → /app/bassment rewrite.
     if (pathname === '/college') return '/app/bassment';
     if (pathname.startsWith('/college/')) {
       return pathname.replace(/^\/college/, '/app/bassment');
     }
     // Already internal? leave alone. Use a boundary so a future top-level
     // /apps or /app-store is NOT mistaken for an already-prefixed /app path
     // (consistent with the middleware's `p === x || p.startsWith(x + '/')`).
     if (pathname === '/app' || pathname.startsWith('/app/')) return pathname;
     return `/app${pathname}`;
   }
   ```

   > **⚠️ The `/college` alias is the one room whose clean URL ≠ its folder.** It
   > must be reconciled in THREE places or the College room breaks on both sides:
   > (1) the middleware rewrites `/college` → `/app/bassment` (Step 2); (2) this
   > hook maps `/college` → `/app/bassment` for comparators (above); (3) the nav
   > writer URL is the clean **`/college`** (NOT `/bassment` — there is no
   > `/bassment` route, so the mechanical "drop `/app`" rule does NOT apply to
   > College). `CelebrationBlockView.tsx:48` (which pushes `/app/bassment`) must
   > also become `/college`, not `/bassment`.

   Swap `usePathname()` → `useInternalPathname()` in: `SidebarNav.tsx`,
   `DetailPanel.tsx`, `app/app/layout.tsx`, `UserAccountSection.tsx`,
   `BassmentJourneyView.tsx`, `CollapsedJourneyPath.tsx`, `TutorialFolder.tsx`.
   These read the path for *comparison only* — re-prefixing is correct and they
   need no other change.

   > **Why a hook, not a folder rename?** Renaming `app/app/*` → `app/*` would
   > also deliver clean URLs but touches ~20 files of hardcoded `/app/*` literals
   > and removes the AuthGuard-folder boundary. The hook + clean-nav-URL approach
   > is ~1 day, keeps the `app/app/` AuthGuard folder intact, and confines the
   > change to (a) nav/link targets and (b) seven comparator hooks.

3. **Hydration mismatch:** because the comparators now derive the internal path
   the same way on server and client, and the nav targets are clean on both, the
   server-rendered markup and the first client render agree. If any residual
   mismatch appears in dev, gate the *first-paint* active state behind a
   mounted flag (standard Next.js pattern) rather than reading the path during
   SSR.

**Net:** the auth half of the original plan was right; the navigation half was
inverted. This rewrite fixes the middleware, the nav-URL/`usePathname()` strategy,
the Stripe return paths, robots/SEO, and the CORS fail-open warning — and revises
the effort estimate from "~half a day" to **2–4 focused days + staging dry-run.**

---

## The mental model — the `/app` segment DISAPPEARS, files DON'T move

A subdomain is **not** a routing-folder migration. The Next.js files stay at
`apps/frontend/src/app/app/gym/page.tsx` (→ internal path `/app/gym`). A
**host-aware rewrite** maps the clean public path onto the existing tree:

```
User types:    app.bassicology.com/gym
                     │  middleware: host = app.*  →  rewrite /gym → /app/gym  (server-side, invisible)
                     ▼
Next renders:  apps/frontend/src/app/app/gym/page.tsx   (unmoved)
URL bar shows: app.bassicology.com/gym     ✅  (rewrite ≠ redirect: URL is unchanged)
```

- A **rewrite** changes what's served *without changing the URL the user sees*.
- A **redirect** changes the URL. We use redirects for: the reverse legacy path
  (`bassicology.com/app/*` → `app.bassicology.com/*`) AND apex `/login`/`/register`
  → app subdomain (single-origin auth).
- **The client `usePathname()` returns the CLEAN browser path** (`/gym`) on the
  app host — comparators must use `useInternalPathname()` (above) to get `/app/gym`.

### Why the internal folder path stays `/app/*` (and how comparators cope)

We keep the files at `app/app/*` so we don't churn ~20 hardcoded literals or the
AuthGuard folder boundary. But because the **client** path is clean, the ~10
comparator sites can't read `/app/*` from `usePathname()` directly — they use
`useInternalPathname()`, which re-prefixes `/app`. Consumers (read-only path
comparisons):

- [SidebarNav.tsx:48-52](../../apps/frontend/src/domains/platform/components/SidebarNav.tsx#L48-L52) (active nav highlight)
- [app/app/layout.tsx:24-30](../../apps/frontend/src/app/app/layout.tsx#L24-L30) (deep-route detail panel)
- [DetailPanel.tsx:32-39](../../apps/frontend/src/domains/platform/components/DetailPanel.tsx#L32-L39)
- [UserAccountSection.tsx:57-60](../../apps/frontend/src/domains/platform/components/UserAccountSection.tsx#L57-L60) (admin Edit-Tutorial regex `/^\/app\/tutorials\//`)
- [BassmentJourneyView.tsx:278](../../apps/frontend/src/domains/platform/components/BassmentJourneyView.tsx#L278), [CollapsedJourneyPath.tsx:132](../../apps/frontend/src/domains/platform/components/CollapsedJourneyPath.tsx#L132), [TutorialFolder.tsx:208](../../apps/frontend/src/domains/platform/components/TutorialFolder.tsx#L208)

### Nav/link/`router.push` WRITER sites → must become CLEAN paths

These put a path into the URL bar; on the app host they must be clean so the bar
stays clean. Drop the `/app` prefix (the middleware rewrites `/gym` → `/app/gym`).
**This list is the COMPLETE writer inventory — verified by
`grep -rn "navigateWithTransition('/app\|router.push('/app\|...\`/app"`.** Miss
one and Test #7 fails (URL bar reverts to `/app/*` on that click):

- [navigation.ts:30-58](../../apps/frontend/src/domains/platform/constants/navigation.ts#L30-L58) — `MAIN_NAV_ITEMS` + `BOTTOM_NAV_ITEMS` `url:` values (`/app/gym` → `/gym`, etc.). **Keep `activePatterns` as `/app/*`** — they feed the comparator. ⚠️ **TWO special cases (see below):** College `url` → `/college` (NOT `/bassment`); and items with **no `activePatterns`** must GAIN them.
- [AppSidebar.tsx:25](../../apps/frontend/src/domains/platform/components/AppSidebar.tsx#L25) (logo → `/app` → `/`)
- [MobileHeader.tsx:17](../../apps/frontend/src/domains/platform/components/MobileHeader.tsx#L17) (`/app` → `/`)
- [DrillSessionFrame.tsx:148](../../apps/frontend/src/domains/drill/components/DrillSessionFrame.tsx#L148) (drill done → `/app` → `/`)
- [NodeMatrix.tsx:711](../../apps/frontend/src/domains/platform/components/NodeMatrix.tsx#L711) (drill "Start the drill" → `/app/tutorials/${slug}` → `/tutorials/${slug}`) — **was missing**
- [CelebrationBlockView.tsx:48,57](../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/CelebrationBlockView.tsx#L48) — L48 `/app/bassment` → **`/college`** (the clean College URL, NOT `/bassment`); L57 `/app/tutorials/${slug}` → `/tutorials/${slug}` (**L57 was missing**)
- [BassmentJourneyView.tsx:220](../../apps/frontend/src/domains/platform/components/BassmentJourneyView.tsx#L220), [CollapsedJourneyPath.tsx:46](../../apps/frontend/src/domains/platform/components/CollapsedJourneyPath.tsx#L46) (`/app/tutorials/${slug}` → `/tutorials/${slug}`)
- [TutorialFolder.tsx:110](../../apps/frontend/src/domains/platform/components/TutorialFolder.tsx#L110) (`/app/tutorials/${slug}` → `/tutorials/${slug}`) — **was missing**; note this file is ALSO a comparator (line 208), so it needs both the writer drop AND the `useInternalPathname()` swap (it's currently dead code — mounted only via the unused `TutorialDock` — so this is latent, but fix it for correctness)
- [store/page.tsx:104](../../apps/frontend/src/app/app/store/page.tsx#L104) (`router.push(\`/app/store/${slug}\`)` → `/store/${slug}`) — **was missing**
- [store/[slug]/page.tsx:35,77](../../apps/frontend/src/app/app/store/[slug]/page.tsx#L35) (`router.push('/app/store')` → `/store`)
- [login/page.tsx:82](../../apps/frontend/src/app/login/page.tsx#L82) + [use-auth-redirect.ts:58](../../apps/frontend/src/domains/user/hooks/use-auth-redirect.ts#L58) (post-auth `/app` → `/`) — **the same fix as Step 7.1; listed here too so a Step-3 reader doesn't miss it**

> **SAFE writers (already clean — do NOT prefix):** `settings/page.tsx:172`
> `navigateWithTransition('/')` and `welcome/page.tsx:73`
> `navigateWithTransition(target)` (target is same-origin-guarded). Leave as-is.

> **The split rule, stated once:** a `/app/*` literal that is **compared** stays
> `/app/*` (read via `useInternalPathname()`); a `/app/*` literal that is
> **navigated to** becomes clean. Some files have both (`navigation.ts`,
> `TutorialFolder.tsx`): `url`/push → clean; `activePatterns`/comparison → `/app/*`.

#### ⚠️ Two `navigation.ts` special cases the mechanical rule gets WRONG

1. **College `url` must be `/college`, not `/bassment`.** College's room is the
   `/app/bassment` folder behind the clean `/college` alias. There is **no
   `/bassment` route**, so "drop `/app` from `/app/bassment`" → `/bassment`
   would 404. Set `url: '/college'`; keep `activePatterns: ['/app/bassment',
   '/app/tutorials']`; the hook maps `/college` → `/app/bassment` so highlighting
   + `DetailPanel` + `isDeepAppRoute` all match.
2. **Items with NO `activePatterns` lose their highlight when you clean `url`.**
   [SidebarNav.tsx:48-52](../../apps/frontend/src/domains/platform/components/SidebarNav.tsx#L48-L52)
   falls back to `pathname === item.url` when an item has no `activePatterns`.
   **Backstage** ([navigation.ts:32](../../apps/frontend/src/domains/platform/constants/navigation.ts#L32))
   and **Settings** ([navigation.ts:58](../../apps/frontend/src/domains/platform/constants/navigation.ts#L58))
   have none. After cleaning their `url` (`/app` → `/`, `/app/settings` →
   `/settings`) while `useInternalPathname()` returns `/app` / `/app/settings`,
   the equality is false → they never highlight.

   **⚠️ Do NOT just give Backstage `activePatterns: ['/app']`.** The comparator at
   [SidebarNav.tsx:50](../../apps/frontend/src/domains/platform/components/SidebarNav.tsx#L50)
   is `pathname === p || pathname.startsWith(p + '/')`, and **every** room's
   internal path starts with `/app/` (`/app/gym`, `/app/bassment`, `/app/gigs`,
   `/app/settings`, …). So `['/app']` makes Backstage light up on **every** room
   (permanent double-highlight). Backstage is the **root** — it needs an
   **exact-only** match, which the current `activePatterns` mechanism can't
   express. **The correct fix is a small `SidebarNav` change** to support an exact
   match, then use it for Backstage:

   ```ts
   // navigation.ts — add an optional flag
   export interface NavItem {
     // ...existing fields...
     /** Match this item ONLY on an exact internal-path equality (no prefix). */
     exactPatterns?: string[];
   }
   // Backstage (the /app root home): exact-only so it doesn't match sub-rooms.
   { title: 'Backstage', url: '/', icon: Martini, exactPatterns: ['/app'] },
   // Settings: a leaf with no deeper routes, so a normal prefix pattern is fine.
   { title: 'Settings', url: '/settings', icon: Settings, activePatterns: ['/app/settings'] },
   ```

   ```ts
   // SidebarNav.tsx — extend the isActive computation (reads useInternalPathname())
   const isActive =
     (item.exactPatterns?.some((p) => pathname === p) ?? false) ||
     (item.activePatterns
       ? item.activePatterns.some((p) => pathname === p || pathname.startsWith(p + '/'))
       : pathname === item.url);
   ```

   Settings' `['/app/settings']` as a normal `activePatterns` is **correct** (it
   has no deeper child routes, so prefix-match can't over-reach). Only **Backstage**
   needs the exact arm. (If you'd rather not touch `SidebarNav`, the minimal
   alternative is to keep Backstage's `url` as the internal `/app` and accept that
   its bar shows `/app` — but that re-introduces one ugly URL, so the
   `exactPatterns` change is preferred.)

### Public → internal mapping (complete — includes backstage & studio)

| User sees | Internally serves | Folder |
|---|---|---|
| `app.bassicology.com` | `/app` (Backstage home) | `app/app/page.tsx` |
| `app.bassicology.com/backstage` | `/app/backstage` | `app/app/backstage/page.tsx` |
| `app.bassicology.com/gym` | `/app/gym` | `app/app/gym/page.tsx` |
| `app.bassicology.com/college` | `/app/bassment` | `app/app/bassment/page.tsx` (label alias; nav `url`/writers use the clean **`/college`**, hook maps it back to `/app/bassment` for comparators) |
| `app.bassicology.com/gigs` | `/app/gigs` | `app/app/gigs/page.tsx` |
| `app.bassicology.com/studio` | `/app/studio` | `app/app/studio/page.tsx` |
| `app.bassicology.com/settings` | `/app/settings` | `app/app/settings/page.tsx` |
| `app.bassicology.com/store`, `/store/[slug]` | `/app/store`, `/app/store/[slug]` | `app/app/store/...` |
| `app.bassicology.com/tutorials/[slug]` | `/app/tutorials/[slug]` | `app/app/tutorials/[slug]` |
| `app.bassicology.com/welcome` | `/app/welcome` | Stripe post-checkout landing |
| `app.bassicology.com/login` | `/login` | `app/login/page.tsx` (served as-is, top-level) |
| `app.bassicology.com/register` | `/register` | `app/register/page.tsx` |
| `app.bassicology.com/auth/callback` | `/auth/callback` | `app/auth/callback/page.tsx` |

> **"Backstage" is overloaded:** the root `/app` page AND a separate
> `/app/backstage` page both exist and both label themselves "Backstage". The
> root is the home/landing room; `/app/backstage` is a distinct "coming soon"
> page. Both are real on disk — the middleware allow-list must include both.

Full route inventory under `apps/frontend/src/app/app/` (verified): `page.tsx`
(root), `backstage/`, `bassment/`, `gigs/`, `gym/`, `settings/`, `studio/`,
`welcome/`, `store/`, `store/[slug]/`, `tutorials/[slug]/`. One shared
[layout.tsx](../../apps/frontend/src/app/app/layout.tsx) — a **client** component
with `<AuthGuard redirectTo="/login">`. No `route.ts` handlers under `/app`.

### Apex routes that have NO `/app` twin (the middleware must NOT rewrite these)

These live at the top level and do **not** exist under `app/app/`. A naive
catch-all `→ /app/<path>` rewrite 404s every one of them on the app host:

`/library`, `/library/[tutorialId]`, `/pricing`, `/dashboard`, `/assessment`,
`/preview`, `/free/[slug]`, `/founders/welcome`, `/drum-record`, `/admin/*`,
`/verify-email` (referenced by post-auth redirect but **has no page anywhere**),
`/reset-password` (referenced by backend redirect but **has no page anywhere**),
`/api/waitlist/*`.

The app host must either **redirect** these to the apex (marketing/public) or
**404 by policy** (e.g. `/admin` decision) — never blind-rewrite them to `/app/*`.
See the corrected middleware (Step 2), which uses an **explicit allow-list** of
real `/app/*` routes instead of a catch-all.

---

## Host responsibility decisions (decided — reconciled with the middleware)

Because one Vercel project serves both hosts via one middleware, *every* route
technically resolves on *both* hosts unless the middleware blocks it. Policy:

| Route | apex `bassicology.com` | app `app.bassicology.com` | Rationale |
|---|---|---|---|
| `/` | marketing waitlist | rewrite → `/app` (Backstage home) | apex = marketing, app root = product home |
| `/login`, `/register` | **308 → app subdomain** | **REQUIRED, served as-is** | session must be written on app origin (single-origin auth) |
| `/auth/callback` | allowed (Supabase may land here) | **REQUIRED, served as-is** | OAuth/magic-link return |
| `/gym`, `/gigs`, `/settings`, `/store/*`, `/tutorials/*`, `/welcome`, `/backstage`, `/studio`, `/college` | n/a (these are app rooms) | rewrite → `/app/<same>` (allow-list) | the product surface |
| `/library`, `/free`, `/preview`, `/founders`, `/pricing`, `/dashboard`, `/assessment`, `/drum-record` | allowed (marketing/public) | **308 → apex** equivalent | apex-only; never rewrite to `/app/*` |
| `/admin/*` | allowed | **308 → apex** (recommended) | admin is internal tooling; keep one canonical host |
| `/app/*` (raw internal path) | **308 → app subdomain clean URL** | served (double-prefix guard) | kill the old URL shape, keep bookmarks |
| `/api/waitlist/*` | allowed | pass-through (apex handlers) | apex-only route handlers |

The simplest, safest launch policy:

- **apex** = everything public; apex `/login`/`/register` **308 → app**.
- **app subdomain** = login/register/callback (as-is) + the allow-listed `/app/*`
  tree at clean URLs; any apex-only route hit on the app host **308 → apex**.
- **The app's own AuthGuard `redirectTo="/login"`** resolves to
  `app.bassicology.com/login` (same host) — correct, no change.

---

## THE PROCESS — verbose, in order

> Do steps 1-10 on **staging first** (`app-staging.bassicology.com` or a Vercel
> preview alias), verify the whole checklist, then repeat for prod. Never flip
> prod DNS before the staging dry-run passes.

### Step 0 — Pre-flight: confirm current state (5 min, no changes)

```bash
# Confirm NO middleware exists yet (we are about to create the first one)
find apps/frontend -name "middleware.ts" -o -name "middleware.js" | grep -v node_modules
# → expect: empty

# Confirm the app route tree (verified inventory; 11 page.tsx files)
find apps/frontend/src/app/app -name page.tsx | sort

# Confirm the apex routes that must NOT be rewritten to /app/*
find apps/frontend/src/app -maxdepth 2 -name page.tsx -not -path "*/app/app/*" | sort

# Confirm the Supabase storage key in use (DevTools → Application → Local Storage
# on the running app): look for `sb-<ref>-auth-token`. Confirms localStorage, not cookie.
```

### Step 1 — DNS + Vercel domain (config; ~10 min + propagation up to a few hrs)

1. **Vercel dashboard → the frontend project → Settings → Domains → Add**
   `app.bassicology.com`.
   - Vercel will show a DNS target — add a **CNAME** `app` →
     `cname.vercel-dns.com` at your DNS provider (or the Vercel-managed A/ALIAS
     records it suggests).
2. **Staging first:** add `app-staging.bassicology.com` (or use the Vercel
   preview URL for the `develop` deployment) and point it at the **Preview**
   environment.
3. **HSTS note (important):** the apex already sends
   `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
   ([next.config.js:195-196](../../apps/frontend/next.config.js#L195-L196)).
   `includeSubDomains` means **every subdomain is forced to HTTPS** by browsers
   that have seen the apex. This is good (the new subdomain must be HTTPS), but
   it also means **a misconfigured/incomplete TLS cert on `app.` will hard-fail
   in browsers, not downgrade to HTTP.** Verify Vercel has issued the cert
   (green padlock) before announcing the URL. Because of `preload`, you cannot
   quickly "turn off HTTPS" to debug — get the cert right. **Note the long tail:**
   if `app.` is ever retired, `preload`-list removal ships on browser-release
   cadence (weeks–months), so the HTTPS commitment is sticky.
4. `vercel.json` ([root](../../vercel.json)) has `cleanUrls: true` and
   `trailingSlash: false` — fine, leave as-is. Domains are dashboard-only; no
   repo change here.

### Step 2 — The host-rewrite middleware (explicit allow-list, NOT a catch-all)

Create `apps/frontend/src/middleware.ts`. **This file does not exist today** — it
is the first middleware in the project. Execution order is verified: middleware
runs **before** the `next.config.js` `/api` & `/auth` proxy rewrites (which are
`afterFiles`), so passing `/api` and `/_next` through composes correctly.

**Design (corrected — the original catch-all 404'd every apex-only route):**

1. On host `app.bassicology.com` (and `app-staging.*`):
   - `/login`, `/register`, `/auth/*`, `/api/*`, `/_next/*` → serve as-is.
   - Apex-only routes (`/library`, `/pricing`, `/dashboard`, `/assessment`,
     `/preview`, `/free`, `/founders`, `/drum-record`, `/admin`, **`/auth-demo`**)
     → **308 → apex**. ⚠️ This list must include **every** real top-level page,
     because the fall-through below is pass-through, not a 404 — any omitted page
     leaks 200 onto the paid app host.
   - `/college` → rewrite to `/app/bassment` (label alias).
   - **Only the explicit app allow-list** (`/`, `/backstage`, `/gym`, `/gigs`,
     `/settings`, `/studio`, `/welcome`, `/store`, `/tutorials`) → rewrite to
     `/app/<same>`.
   - **Anything else → EXPLICIT 404** via a rewrite to a non-existent path. Do
     NOT use `NextResponse.next()` here — that's filesystem pass-through (serves
     shared top-level routes 200), not a 404.
   - **Double-prefix guard:** if the path already starts with `/app/`, serve it
     directly (handles a stale `/app/*` link or a Stripe return that still
     carries `/app`). See Step 6.
2. On the apex (`bassicology.com`):
   - `/login`, `/register` → **308 → app subdomain** (single-origin auth).
   - `/app/*` → **308 → app subdomain clean URL** (legacy bookmarks).
   - everything else → untouched (marketing/public stays on apex).

Reference implementation (adapt host strings to your staging alias):

```ts
// apps/frontend/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const APP_HOSTS = new Set([
  'app.bassicology.com',
  'app-staging.bassicology.com',
]);
const APP_ORIGIN = 'https://app.bassicology.com';
const APEX_ORIGIN = 'https://bassicology.com';

// Served as-is on the app host (auth + api + assets). Auth pages MUST resolve on
// the app origin so the Supabase session is written to app.bassicology.com.
const PASS_THROUGH = ['/login', '/register', '/auth', '/api', '/_next'];

// The ONLY clean paths the app host rewrites onto /app/*. Root '/' is handled
// separately. '/college' is the label alias for /app/bassment.
const APP_ROUTES = new Set([
  '/backstage',
  '/gym',
  '/gigs',
  '/settings',
  '/studio',
  '/welcome',
  '/store',     // also covers /store/<slug> via the prefix check below
  '/tutorials', // covers /tutorials/<slug>
]);

// Apex-only routes that must bounce back to the apex if hit on the app host.
// NOTE: include EVERY real top-level (non-/app) page, or it leaks 200 on the app
// host (NextResponse.next() is filesystem pass-through, NOT a 404). /auth-demo
// renders a full login UI; /dashboard is a legacy page — both must be listed.
const APEX_ONLY = [
  '/library', '/pricing', '/dashboard', '/assessment',
  '/preview', '/free', '/founders', '/drum-record', '/admin',
  '/auth-demo',
];

const startsWithAny = (p: string, prefixes: string[]) =>
  prefixes.some((x) => p === x || p.startsWith(x + '/'));

const inAppRoutes = (p: string) =>
  [...APP_ROUTES].some((x) => p === x || p.startsWith(x + '/'));

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const { pathname, search } = req.nextUrl;

  // ---------- App subdomain ----------
  if (APP_HOSTS.has(host)) {
    // Defensive: a stale /app/* link or Stripe return → serve directly (no /app/app).
    if (pathname === '/app' || pathname.startsWith('/app/')) {
      return NextResponse.next();
    }
    // Auth / api / assets → as-is (single-origin auth).
    if (startsWithAny(pathname, PASS_THROUGH)) return NextResponse.next();

    // Apex-only routes → bounce to apex (never rewrite into a nonexistent /app/*).
    if (startsWithAny(pathname, APEX_ONLY)) {
      return NextResponse.redirect(new URL(`${APEX_ORIGIN}${pathname}${search}`), 308);
    }

    // Label alias: /college → /app/bassment
    if (pathname === '/college' || pathname.startsWith('/college/')) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.replace(/^\/college/, '/app/bassment');
      return NextResponse.rewrite(url);
    }

    // Root → /app ; allow-listed clean path → /app/<same>.
    if (pathname === '/' || inAppRoutes(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = pathname === '/' ? '/app' : `/app${pathname}`;
      return NextResponse.rewrite(url);
    }

    // Unknown path on the app host → EXPLICIT 404. Do NOT fall through to
    // NextResponse.next(): that is filesystem pass-through and would SERVE any
    // shared top-level route (e.g. /auth-demo, /dashboard) at 200 on the paid
    // app host. Deny-by-default: rewrite to a non-existent path so Next renders
    // the 404 (or use a dedicated /not-found and rewrite to it).
    const notFound = req.nextUrl.clone();
    notFound.pathname = '/app/__not_found__'; // no such route → 404 page
    return NextResponse.rewrite(notFound);
  }

  // ---------- Apex ----------
  // Single-origin auth: push apex login/register to the app subdomain.
  if (startsWithAny(pathname, ['/login', '/register'])) {
    return NextResponse.redirect(new URL(`${APP_ORIGIN}${pathname}${search}`), 308);
  }
  // Legacy /app/* → clean subdomain URL.
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    const clean = pathname === '/app' ? '/' : pathname.replace(/^\/app/, '');
    return NextResponse.redirect(new URL(`${APP_ORIGIN}${clean}${search}`), 308);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything EXCEPT static assets and Next internals.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

**Things to verify about this middleware (don't skip):**

- The `matcher` must not catch `_next` or static files (the regex excludes
  anything with a file extension `.*\\..*` and `_next/*`). **`/robots.txt` is NOT
  matched** (it has a dot), so the middleware never touches it — which is exactly
  what we want: the `app/robots.ts` **route handler** (Step 9) runs and reads the
  host itself to vary per-host. (A request to `/robots.txt` resolves to the
  `robots.ts` route; the dotted-path exclusion only keeps *middleware* off it.)
- `/api/waitlist/*` keeps working on the apex (apex branch never touches `/api`)
  and is passed through on the app host. The `/api/*` and `/auth/*` proxy
  rewrites in [next.config.js:126-139](../../apps/frontend/next.config.js#L126-L139)
  apply *after* middleware — order is fine. **Do not** convert that
  `/auth/:path*` proxy to `beforeFiles`; the `/auth/callback` **page** survives
  only because the proxy is `afterFiles` (yields to filesystem pages).
- `runtime` defaults to the edge — keep it edge; this middleware uses no Node APIs.
- **Test the double-prefix guard** explicitly: `app.bassicology.com/app/store`
  must serve `/app/store`, NOT `/app/app/store`.
- **Test an apex-only route on the app host**: `app.bassicology.com/library` must
  308 → `bassicology.com/library`, NOT 404 and NOT `/app/library`.
- **Test a SHARED top-level route on the app host**: `app.bassicology.com/auth-demo`
  and `/dashboard` must 308 → apex (they're in `APEX_ONLY`), NOT render 200.
  `NextResponse.next()` does **not** 404 — it's filesystem pass-through, so any
  real top-level page omitted from `APEX_ONLY` leaks onto the paid app host.
- **Test an unknown path**: `app.bassicology.com/nonsense` should 404 (the
  explicit deny-by-default rewrite), not render `/app/nonsense`.
- **Preview-host caveat:** the middleware is a no-op on raw `*.vercel.app` preview
  URLs (host isn't in `APP_HOSTS`), and the apex branch 308s `/login` to the
  **production** `APP_ORIGIN`. For staging, exercise the migration via the
  `app-staging.bassicology.com` alias (in `APP_HOSTS`), not the bare preview URL,
  or gate `APP_ORIGIN`/`APEX_ORIGIN` on the deploy environment.
- **Stale internal-shape login link:** `app.bassicology.com/app/login` is caught
  by the double-prefix guard and served as `/app/login`, which 404s (login is
  top-level, not under `/app`). Harmless (no such link is emitted), but don't add
  one.

### Step 3 — The `useInternalPathname()` hook + nav-URL split (the core code change)

This is the work the *old* runbook wrongly rated "no change / low risk." It is the
**highest-effort item.** Two coordinated edits:

1. **Add the hook** `apps/frontend/src/lib/hooks/use-internal-pathname.ts` (code in
   "READ THIS FIRST part 2"). It re-prefixes `/app` so comparisons against the
   internal tree work on both hosts.
2. **Swap comparators** `usePathname()` → `useInternalPathname()` in the seven
   read-only consumers listed under "Consumers" above. These compare the path;
   re-prefixing is exactly right.
3. **Clean the writer sites** — drop `/app` from every `router.push` / `<Link
   href>` / nav target listed under "WRITER sites" above (`navigation.ts` urls,
   `AppSidebar`, `MobileHeader`, `DrillSessionFrame`, `CelebrationBlockView`,
   `BassmentJourneyView` push, `CollapsedJourneyPath` push, `store/[slug]` push).
   **Keep `navigation.ts` `activePatterns` as `/app/*`** — they feed the
   comparator, not the push.
4. **Cross-product links FROM the app tree TO apex routes** must be absolute apex
   URLs (or they 308-bounce, which flickers; a cross-origin `next/link` also won't
   client-navigate and will prefetch-308). Use the apex base from
   `NEXT_PUBLIC_MARKETING_URL` (Step 8), not a hardcoded literal:
   - [gym/page.tsx:228](../../apps/frontend/src/app/app/gym/page.tsx#L228) —
     `GymMembershipWall` "See membership". ⚠️ This is a **`next/link` `<Link
     href="/pricing">`**, not a plain `<a>`. A cross-origin `<Link>` won't
     client-navigate (and auto-prefetches the 308). **Change it to a plain
     `<a href={\`${MARKETING_URL}/pricing\`}>`** (or `prefetch={false}` + absolute
     href). Without this a non-member **cannot reach checkout** — revenue break.
   - [MainCard.tsx:143](../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/MainCard.tsx#L143)
     "Back to Library" → `/library` — absolute apex URL (it's a
     `navigateWithTransition`, so an absolute URL bails it to a full nav).
   - [YouTubeWidgetPage.tsx:1596](../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/YouTubeWidgetPage.tsx#L1596)
     `navigateWithTransition('/library')` — **second `/library` link in the
     tutorial tree**, same treatment. (Was missing from the first draft.)
   - `/admin/*` links in `settings` + `UserAccountSection` 308-flicker on the app
     host (admin is "recommended 308 → apex"). Lower stakes, but for a clean admin
     experience make those absolute apex URLs too, or keep admin reachable on the
     app host by moving `/admin` out of `APEX_ONLY`.
5. **Add a test** that drives `usePathname()` with real `/gym`, `/app/gym`,
   `/college` values and asserts highlight/panel/admin-gate behaviour. The unit
   harness currently mocks `usePathname()` → `/`
   ([setupRealTone.ts:19](../../apps/frontend/src/test/setupRealTone.ts#L19)), so
   **no existing test exercises any `/app/*` branch** — this change has zero test
   backstop until you add one.

> **Hydration:** server renders the internal `/app/*` tree; client URL is clean.
> Because both comparator (via the hook) and writer (clean) sides agree, the
> active-state markup matches. If a residual mismatch surfaces in dev, gate
> first-paint active state behind a `mounted` flag.

### Step 4 — Supabase Auth redirect allow-list (dashboard config, BOTH envs)

The frontend builds every auth redirect from `window.location.origin`:

- [auth.ts:272-275](../../apps/frontend/src/domains/user/api/auth.ts#L272-L275) (`signUp` → `${origin}/auth/callback`)
- [auth.ts:365,377](../../apps/frontend/src/domains/user/api/auth.ts#L365) (`signInWithGoogle` → `${origin}/auth/callback`)
- [auth.ts:451](../../apps/frontend/src/domains/user/api/auth.ts#L451) (`signInWithMagicLink` → `${origin}/auth/callback`)

So when the user is on `app.bassicology.com`, the generated redirect is correct
**with no code change** — BUT Supabase must allow-list the new origin or
magic-link/OAuth callbacks bounce. This is **fail-closed** (links break; not a
vulnerability), but it's a common breakage point.

In the Supabase dashboard, **Authentication → URL Configuration**, for **BOTH**
projects:

- **Staging** project `vraxryaaznpkvtkindpn`:
  - **Site URL** → `https://app-staging.bassicology.com` (or your staging alias)
  - **Redirect URLs** add: `https://app-staging.bassicology.com/**` and
    `https://app-staging.bassicology.com/auth/callback`
- **Production** project `iuuplfrktnzsbzibpfjm`:
  - **Site URL** → `https://app.bassicology.com`
  - **Redirect URLs** add: `https://app.bassicology.com/**` and
    `https://app.bassicology.com/auth/callback`

**Security:** keep the allow-list to YOUR exact origins. No over-broad wildcards
(`https://**` or `*.bassicology.com/**`). The `/**` suffix on your own host is fine.

> **PKCE cross-device caveat (pre-existing):** the magic-link/OAuth verifier is
> written to the *originating* origin's localStorage. Requesting a link on the
> app host but opening it on another device/browser cannot exchange the code
> (verifier absent). Unchanged by this migration, but the single-origin design
> makes it likelier to be hit; note it for support.

### Step 5 — Backend CORS (env only, no code; Railway, BOTH envs) — FAILS OPEN

The backend is Bearer-only but uses `credentials: true` CORS:

- [main.ts:62-66](../../apps/backend/src/main.ts#L62-L66) sets
  `ALLOWED_ORIGINS = ALLOWED_ORIGINS || FRONTEND_URL || '*'`.
- [security.config.ts:110-168](../../apps/backend/src/config/security.config.ts#L110-L168)
  does an **exact-string** `allow.has(origin)` match — BUT also has a
  `allowedEnv === '*'` branch that **reflects ANY origin** (L120-122) and a
  non-prod branch allowing `*.vercel.app` preview hosts.

> **⚠️ This fails OPEN, not closed.** If `FRONTEND_URL`/`ALLOWED_ORIGINS` is left
> blank on prod Railway, `main.ts` sets `ALLOWED_ORIGINS='*'`, and the CORS
> resolver then reflects **any** origin with `credentials: true`. Leaving it blank
> is a **security regression**, not a no-op. Setting it explicitly is mandatory.

**Action — Railway dashboard:**

- **Staging** Railway env: add `https://app-staging.bassicology.com` to
  `ALLOWED_ORIGINS` (comma-separated; a custom staging alias is NOT covered by
  the `*.vercel.app` preview regex, so it must be listed).
- **Production** Railway env: add `https://app.bassicology.com` to
  `ALLOWED_ORIGINS` **and ensure it is non-empty** (fail-open guard above).
- Set **`FRONTEND_URL`** on Railway to the app host — fallback base for
  backend-built auth redirects in
  [auth.controller.ts:234,291,301,309,327,377](../../apps/backend/src/domains/user/auth/auth.controller.ts#L234).
  The hardcoded fallback there is a **stale** `https://bassnotion-frontend.vercel.app`.
  **But note** these targets include `/dashboard` (L301) and `/reset-password`
  (L377) — **apex/nonexistent routes** (see Step 7); pointing `FRONTEND_URL` at
  the app host arms a 404 for those the moment the backend OAuth/reset path is
  enabled. Decide per-redirect where each should land.

> **Verify correctly:** most authenticated API traffic is **same-origin** via the
> `next.config.js /api/*` proxy, so a naive test passes even if cross-origin CORS
> is broken. Test a **direct** `NEXT_PUBLIC_API_URL` call (e.g. an admin upload)
> from the app subdomain; confirm `Access-Control-Allow-Origin:
> https://app.bassicology.com` and no CORS error.

### Step 6 — Stripe checkout / billing return URLs (MANDATORY code edits)

Stripe `success_url`/`cancel_url` are built **on the frontend** from
`window.location.origin` but **hardcode `/app/*`** segments. Under the subdomain
that yields `https://app.bassicology.com/app/store?success=true`. The
double-prefix guard renders it, but the URL bar shows the internal `/app/store`.
**These edits are MANDATORY (not optional) because of `replaceState`:**

- [store/page.tsx:31,34,53-54](../../apps/frontend/src/app/app/store/page.tsx#L31)
  — `window.history.replaceState({}, '', '/app/store')` fires on **BOTH** success
  (L31) and cancel (L34), so it **permanently** locks the internal URL on every
  post-checkout return. Change both `replaceState` targets **and** the
  success/cancel URLs to drop `/app` (`/app/store` → `/store`).
- [store/[slug]/page.tsx:57-58](../../apps/frontend/src/app/app/store/[slug]/page.tsx#L57)
  — success/cancel (cancel embeds the slug: `/app/store/<slug>` → `/store/<slug>`).
- [UpgradePitch.tsx:72-86](../../apps/frontend/src/domains/billing/components/UpgradePitch.tsx#L72)
  — `successUrl = ${appOrigin}/app/welcome?return=...` → drop `/app`. **Also:**
  the `return` param is `window.location.href` (the *current* page). See the
  cross-host hazard below.
- [welcome/page.tsx:56-73](../../apps/frontend/src/app/app/welcome/page.tsx#L56)
  — parses the `return` param; **keep** its same-origin guard. With clean writer
  URLs (Step 3), the captured `return` is already clean.

> **Cross-host upgrade hazard (HIGH) — the obvious fix does NOT work:**
> `UpgradePitchContent` is the live $24/mo CTA and renders on **apex**
> `/library/[tutorialId]` tutorials (which stay on the apex). There
> `window.location.origin` = `https://bassicology.com`, so `successUrl` is built
> against the **apex** and `return` captures the apex `/library/<slug>` URL.
> Stripe returns to `bassicology.com/app/welcome` → apex middleware 308 → app
> `/welcome` → [welcome/page.tsx:59-73](../../apps/frontend/src/app/app/welcome/page.tsx#L59)
> same-origin guard (`u.origin === window.location.origin`) **fails**
> (apex ≠ app) → the new paying member is dumped on `/app`.
>
> **⚠️ Building `successUrl`/`return` against `NEXT_PUBLIC_APP_URL` does NOT fix
> this** (the verification proved it): re-homing only the **base** leaves the
> `return` param legitimately pointing at the apex `/library/<slug>` (that tutorial
> genuinely lives on the apex — it has no `/app` twin and is in `APEX_ONLY`, so
> re-homing the return would 308-bounce it back to apex anyway). The capture is
> correct; the **guard** is what rejects it. **The fix that actually works:**
> relax `welcome/page.tsx`'s guard to ALSO accept the apex origin
> (`https://bassicology.com`) as a trusted return target (allow-list the two
> known origins instead of strict same-origin equality), so a member upgrading
> from an apex tutorial is returned to that apex `/library/<slug>` groove card.
> Keep rejecting any other origin (open-redirect hygiene). Build `successUrl`
> against `NEXT_PUBLIC_APP_URL` *as well* (so the `/welcome` landing is on the app
> host), but the guard relaxation is the load-bearing change. Don't ship Step 6
> without it.
>
> Note `cancelUrl` is the raw current href ([UpgradePitch.tsx:85](../../apps/frontend/src/domains/billing/components/UpgradePitch.tsx#L85)),
> so on the apex-`/library` upgrade it correctly returns to the apex tutorial — the
> "drop `/app`" rule simply doesn't apply there; no change needed for cancel.

> **Stripe Customer Portal (MEDIUM):**
> [SubscriptionManager.tsx:73](../../apps/frontend/src/domains/billing/components/SubscriptionManager.tsx#L73)
> passes `window.location.href` as the portal `return_url`; the backend forwards
> it verbatim ([stripe.service.ts:286-288](../../apps/backend/src/domains/billing/services/stripe.service.ts#L286)).
> Currently dormant (no JSX mount), but live reachable code — when a billing
> screen mounts it, the same clean-URL rule applies. Also: Stripe's
> dashboard-configured **default** portal return URL (Billing → Customer portal
> settings, per live/test mode) is independent of code — update it for the app
> host at launch.

> `PricingSection.tsx:46,50-51` builds `/pricing` URLs (apex marketing) — leave
> alone; pricing stays on the apex.

### Step 7 — Post-login landing & post-auth redirect targets (small code + config)

1. **Default post-login landing** is `/app`
   ([use-auth-redirect.ts:58](../../apps/frontend/src/domains/user/hooks/use-auth-redirect.ts#L58),
   [login/page.tsx:82](../../apps/frontend/src/app/login/page.tsx#L82)). For a
   clean URL, change the default to **`/`** (app host `/` rewrites to `/app`) or a
   clean route like `/gym`. AuthGuard's `redirectTo="/login"`
   ([app/app/layout.tsx:56](../../apps/frontend/src/app/app/layout.tsx#L56)) is
   relative same-origin — **no change.**
2. **Intermediate post-auth targets the old runbook missed** (these are NOT under
   `/app` and the middleware would 404 or bounce them — handle each):
   - `use-auth-redirect.ts:99` → `/verify-email` — **no page exists anywhere**
     (latent 404 today). Either create the page or stop redirecting there.
   - `use-auth-redirect.ts:110,142` → `/assessment` — real **apex** route; on the
     app host the middleware 308s it to apex (per Step 2). Confirm that's the
     intended landing, or route to an app route.
   - `register/page.tsx:75` → `/dashboard` (backend-auth branch) and
     `auth.controller.ts:301` (backend OAuth) → `/dashboard` — **apex** route.
     With `FRONTEND_URL`=app host, the backend OAuth lands on `app/dashboard` →
     bounced to apex; decide whether OAuth success should land in the app (e.g.
     point that redirect at `/` on the app host).
   - `auth.controller.ts:377` → `/reset-password` — **no page on either host**
     (pre-existing bug). Out of scope to fix here, but don't validate
     `FRONTEND_URL` as if it's a real landing.

   The `NEXT_PUBLIC_USE_BACKEND_AUTH` branches (`login:82`, `register:75`) are
   flag-gated **off** today; if ever enabled they re-introduce `/app` and
   `/dashboard` literals — fix both branches together.

### Step 8 — Canonical / base-URL env vars (small code + config)

1. **`NEXT_PUBLIC_APP_URL`** is only in `.env.example` (localhost:3001) and unset
   in prod, so
   [library/[tutorialId]/layout.tsx:21](../../apps/frontend/src/app/library/[tutorialId]/layout.tsx#L21)
   falls back to a **wrong** `https://bassnotion.com` canonical (a stale third
   domain — wrong **today**, independent of this migration). Set
   `NEXT_PUBLIC_APP_URL` per Vercel environment and fix the hardcoded fallback
   string. Use it as the **app base** for `UpgradePitch` (Step 6) and any app deep
   link.
2. **Add `NEXT_PUBLIC_MARKETING_URL`** (= `https://bassicology.com`) for the
   app→apex absolute links in Step 3.4 (gym wall `/pricing`, MainCard `/library`),
   so they don't hardcode the apex host.
3. **GitHub Actions smoke test.** `FRONTEND_URL_PROD` / `FRONTEND_URL_STAGING`
   repo **variables** drive the deploy smoke check
   ([deploy.yml:135-160](../../.github/workflows/deploy.yml#L135-L160)). The
   homepage `/` stays on the apex (waitlist), so leave these as the apex unless
   you also want to smoke the app host (the app `/` rewrites to AuthGuard-gated
   `/app`, which renders a 200 client shell — confirm 200, not a redirect, before
   relying on it).

### Step 9 — robots / SEO / indexability for the app host (NEW step)

The app `layout.tsx` is a **client** component with a client-side AuthGuard, so a
crawler GET of `app.bassicology.com/gym` returns **HTTP 200** with the rendered
shell (auth only redirects after hydration, which Googlebot doesn't do reliably).
Root metadata
([metadata/root.ts:22-29](../../apps/frontend/src/app/metadata/root.ts#L22-L29))
sets `robots: { index: true }` with no app-page override, and the **static**
[public/robots.txt](../../apps/frontend/public/robots.txt) is served identically
on **both hosts** with `Allow: /` (it does NOT disallow `/gym`, `/gigs`, `/store`,
`/settings`). **Net: the entire paid member surface becomes search-indexable on
the app host.**

> **⚠️ The naive fixes don't work in this setup** (the verification caught both):
> (a) `app/app/layout.tsx` is a **client** component (`'use client'`) and there
> are **no** `metadata`/`generateMetadata` exports under `app/app`, so "add
> `robots: { index: false }` to the app-segment metadata" requires first
> extracting a **server** layout — an unstated refactor. (b) A default
> `app/robots.ts` route handler receives **no host**, so it can't vary per-host;
> and adding it while `public/robots.txt` still exists is a Next.js
> public-file-vs-route **collision**.

**The approach that actually works** — do **BOTH** of the following (they cover
different threats; neither alone is sufficient, verified against this setup):

**(A) Host-aware `app/robots.ts` + delete the static file** — tells *compliant*
crawlers not to crawl the app host:
  1. **Delete `public/robots.txt`** (resolves the route-vs-public collision).
     ⚠️ Re-add **ALL** of its apex disallow rules into the apex branch below —
     don't silently drop any. The current file disallows **13** patterns:
     `/admin/`, `/debug/`, `/api/`, `/test-*`, `/diagnose-*`, `/detect-*`,
     `/fix-*`, `/emergency-*`, `/identify-*`, `/remove-*`, `/safe-*`, `/click-*`,
     `/disable-*`, plus `/auth/callback` — and its `Allow:` for `/library/`,
     `/login`, `/register`, `/dashboard`. Carry every one over.
  2. Add `apps/frontend/src/app/robots.ts` and read the host **inside** it via
     `headers()` (this makes the route **dynamic** — which is what lets it vary
     per host; the default static `robots()` cannot):
     ```ts
     // apps/frontend/src/app/robots.ts
     import type { MetadataRoute } from 'next';
     import { headers } from 'next/headers';

     export default async function robots(): Promise<MetadataRoute.Robots> {
       const host = (await headers()).get('host') ?? '';
       const isAppHost = host.startsWith('app.') || host.startsWith('app-staging.');
       if (isAppHost) {
         // The member surface must never be indexed.
         return { rules: [{ userAgent: '*', disallow: '/' }] };
       }
       return {
         rules: [{
           userAgent: '*',
           allow: '/',
           // Carry over ALL apex disallows from the deleted public/robots.txt (13).
           disallow: [
             '/admin/', '/debug/', '/api/', '/auth/callback',
             '/test-', '/diagnose-', '/detect-', '/fix-', '/emergency-',
             '/identify-', '/remove-', '/safe-', '/click-', '/disable-',
           ],
         }],
         sitemap: 'https://bassicology.com/sitemap.xml', // only if one exists; else omit
       };
     }
     ```

**(B) `noindex` meta on every app page** — covers crawlers that **ignore
robots.txt** (robots.txt is advisory; `noindex` is the real removal signal). This
is REQUIRED to satisfy Test #21 and the security checklist, because the app
`layout.tsx` is a client component returning **HTTP 200** to a crawler. Add a
**server** layout segment for the app tree that exports `noindex`:
  `app/app/layout.tsx` is `'use client'` and **cannot** export `metadata`. (A
  `(server)/` route-group layout would NOT help — a route group only wraps pages
  *moved into* it, and the app pages live directly under `app/app/{gym,bassment,
  …}`.) **The working fix: split the existing layout into a server wrapper that
  exports `metadata` and renders the current client shell:**
  ```ts
  // apps/frontend/src/app/app/layout.tsx  — now a SERVER component (no 'use client')
  import type { ReactNode } from 'react';
  import { AppClientLayout } from './AppClientLayout'; // the former client layout body

  export const metadata = { robots: { index: false, follow: false } };

  export default function AppLayout({ children }: { children: ReactNode }) {
    return <AppClientLayout>{children}</AppClientLayout>;
  }
  ```
  Move the current `'use client'` layout body (AuthGuard + shell) into
  `AppClientLayout.tsx` (keep its `'use client'`). The server layout now emits
  `<meta name="robots" content="noindex, nofollow">` on every `/app/*` page
  regardless of robots.txt. (Root metadata sets `index: true` at
  [root.ts:22-29](../../apps/frontend/src/app/metadata/root.ts#L22-L29); the
  app-segment metadata is merged last and **overrides** it for app pages.)

> **Why both:** (A) keeps well-behaved crawlers off the host entirely; (B)
> guarantees any page that *is* fetched is marked non-indexable. Shipping only (A)
> leaves the 200-OK indexable hole open to non-compliant crawlers — which is why
> the earlier "pick ONE" framing was wrong.

Also: the deleted static `robots.txt` had a **wrong** `Sitemap:
https://bassnotion.com/sitemap.xml` (stale domain, file doesn't exist — verified);
the `robots.ts` apex branch above only emits a `sitemap` if a real one exists.

**Test-matrix rows added** (below): `curl app.bassicology.com/robots.txt`
disallows the member surface; apex `robots.txt` keeps its normal rules.

### Step 10 — Email links (verify; mostly no change)

- The founder welcome email hardcodes only the **apex**
  `https://bassicology.com`
  ([resend.service.ts:124,252](../../apps/backend/src/domains/billing/services/resend.service.ts#L124))
  — correct, the apex stays. No change.
- Auth deep-links (signup confirm, reset-password, OAuth) are built from
  `FRONTEND_URL` in the backend — covered by Step 5/7. Confirm `FRONTEND_URL`
  points where you want those links to land (and remember `/dashboard`,
  `/reset-password` caveats).
- If you later send product deep-links via email, use `NEXT_PUBLIC_APP_URL` /
  a backend `APP_URL` — don't hardcode.

### Step 11 — Staging dry-run (gate before prod)

On `app-staging.bassicology.com` (or the preview alias), verify EVERY item in the
test matrix. **Only when all pass**, repeat steps 1, 4, 5, 9 for prod (prod
Supabase project, prod Railway env, prod Vercel domain, prod robots), merge the
code (middleware + the hook + Step 3/6/7/8/9 edits) through `develop` → `main`,
then flip prod DNS.

---

## Test matrix (run on staging, then prod)

| # | Test | Pass criteria |
|---|---|---|
| 1 | Cold-load `app.bassicology.com/gym` (not logged in) | Redirects to `app.bassicology.com/login` (same host); URL bar shows `/login` |
| 2 | Apex login redirect | `bassicology.com/login` 308 → `app.bassicology.com/login` (single-origin auth) |
| 3 | Log in (password) on the app subdomain | Session written to `app.bassicology.com` localStorage (`sb-<ref>-auth-token`); lands on clean app home (`/`, not `/app`) — **requires Step 7.1** (default landing is `/app` today, so this row fails until that one-line change ships) |
| 4 | Magic link | Email link points to `app.bassicology.com/auth/callback`; callback exchanges code; session set; lands in app |
| 5 | Google OAuth | Returns to `app.bassicology.com/auth/callback`; session set; OAuth-success landing is NOT a 404 |
| 6 | Deep link while logged in: `app.bassicology.com/gym` cold | Renders the gym; URL bar shows `/gym` (rewrite, not `/app/gym`) |
| 7 | **Clean URL after soft nav (all rooms)** | Click **Backstage, Gym, College, Gigs, Settings** + the logo + a tutorial → URL bar **stays clean** (`/`, `/gym`, `/college`, `/gigs`, `/settings`, `/tutorials/...`), never reverts to `/app/*`. Covers every writer site. |
| 8 | Nav highlighting (incl. no-`activePatterns` items) | Active item highlights on **every** room — **especially Backstage and Settings** (they have no `activePatterns` → must gain `['/app']` / `['/app/settings']`; the line-52 url-equality fallback otherwise fails). |
| 8b | **College room end-to-end** | Click College → renders the Bassment page, URL stays `/college`, College highlights, and the Bassment journey `DetailPanel` shows (proves the `/college`→`/app/bassment` hook+middleware reconciliation). |
| 9 | Detail panel / deep-route | `DetailPanel`/`isDeepAppRoute` behave correctly (proves the hook feeds them the internal path) |
| 10 | `/college` alias | `app.bassicology.com/college` serves the Bassment page (rewrite); URL stays `/college` |
| 11 | Legacy redirect | `bassicology.com/app/gym` → 308 → `app.bassicology.com/gym` |
| 12 | **Apex-only route on app host** | `app.bassicology.com/library` → 308 → `bassicology.com/library` (NOT 404, NOT `/app/library`) |
| 12b | **Shared top-level route on app host** | `app.bassicology.com/auth-demo` and `/dashboard` → 308 → apex (NOT served 200 — they must be in `APEX_ONLY`; `NextResponse.next()` is pass-through, not a 404) |
| 13 | **Gym wall → checkout (revenue path)** | Logged-in non-member on `/gym` → "See membership" → reaches `bassicology.com/pricing` (NOT a 404) |
| 14 | Authenticated **cross-origin** API call | Direct `NEXT_PUBLIC_API_URL` call (e.g. admin upload) from the subdomain: no CORS error; `Access-Control-Allow-Origin` echoes the subdomain |
| 15 | Stripe checkout (store + upgrade) | Returns to correct host; success/cancel land on the right page; URL clean (`/store`, `/welcome`), incl. the apex-`/library`-initiated upgrade landing on the right groove card |
| 16 | Apex still works | `bassicology.com/` waitlist loads; `/api/waitlist` POST works |
| 17 | TLS / HSTS | `app.bassicology.com` valid cert (green padlock); HTTP auto-upgrades to HTTPS |
| 18 | Static assets | `_next/*`, images, fonts load on the subdomain (matcher excludes them) |
| 19 | No double-prefix | `app.bassicology.com/app/store` serves `/app/store`, not `/app/app/store` |
| 20 | Unknown path | `app.bassicology.com/nonsense` → 404 (NOT a rewrite to `/app/nonsense`) |
| 21 | **robots / noindex** | `curl app.bassicology.com/robots.txt` disallows `/gym,/gigs,/store,/settings`; app pages emit `noindex` |
| 22 | Logout | Clears session on the app origin; redirects to `/login` (same host) |

---

## Security checklist (the rewrite itself is NOT the risk)

The **rewrite is cosmetic** — it resolves a clean URL to the same AuthGuard-gated
file. It cannot bypass the guard, and auth is enforced **server-side** (NestJS
validates the Supabase JWT on every request via
[auth.guard.ts](../../apps/backend/src/domains/user/auth/guards/auth.guard.ts) +
Supabase RLS) regardless of frontend host. The real risk lives in the
**subdomain split + auth storage**:

- [ ] **Single-origin auth (THE critical one).** Login, `/auth/callback`, and the
  app all live on `app.bassicology.com`; apex `/login`/`/register` **308 → app**
  so a session is never written to the apex origin. (The old runbook left apex
  login allowed — that strands users logged-out on the subdomain.)
- [ ] **Supabase redirect allow-list = your exact origins only.** No over-broad
  wildcards. Add app host to BOTH staging and prod projects.
- [ ] **Backend CORS FAILS OPEN.** `ALLOWED_ORIGINS`/`FRONTEND_URL` must be
  explicitly set & non-empty on prod Railway (blank → reflects any origin with
  `credentials:true`). Add the app host (both envs); test a **direct** cross-origin
  call, not a same-origin proxied one.
- [ ] **CSP = your own origins only; never `*`.** Verified origin-agnostic
  (`'self'` per host); no change needed unless you add cross-host fetches.
- [ ] **robots/noindex for the app host.** The member surface returns 200 to
  crawlers; add per-host `Disallow:/` + page `noindex` (Step 9).
- [ ] **HSTS `includeSubDomains; preload`** already commits subdomains to HTTPS —
  ensure the app cert is valid BEFORE launch; preload-list removal is slow.
- [ ] **`X-Frame-Options: DENY` / `frame-ancestors 'none'`** stay.
- [ ] **No new untrusted subdomains share auth.** Session is localStorage on
  `app.` only — strictly safer than a `.bassicology.com` cookie. Don't
  reintroduce a shared-cookie design.
- [ ] **Open-redirect hygiene.** The middleware's redirects use fixed host
  literals (`APP_ORIGIN`/`APEX_ORIGIN`) + only the request path/search — never a
  user-controlled host. The `welcome/page.tsx` `return`-param navigation guards
  same-origin — keep that guard (and note the cross-host upgrade case in Step 6).
- [ ] **`force-dynamic` apex homepage** ([app/page.tsx](../../apps/frontend/src/app/page.tsx))
  — confirm it still renders on the apex (apex branch leaves `/` untouched).

---

## Cost / risk summary (corrected)

| Area | Type | Risk | Notes |
|---|---|---|---|
| DNS + Vercel domain | config | low | dashboard only; watch the cert/HSTS |
| Host-rewrite middleware | 1 new file (~70 lines) | **medium** | explicit allow-list + apex-only 308s + double-prefix guard; a catch-all 404s apex routes |
| **`useInternalPathname()` hook + nav-URL split** | **~1 day code (hook + 7 comparators + ~8 writer sites + tests)** | **HIGH — the real work** | the old "no change" rating was wrong; `usePathname()` returns the clean path after a rewrite |
| Cross-product app→apex links (gym wall, MainCard) | small code | **medium — revenue path** | must be absolute apex URLs or non-members can't reach checkout |
| Supabase redirect/site URLs (×2 envs) | dashboard config | medium — usual breakage | fail-closed |
| Backend CORS `ALLOWED_ORIGINS`/`FRONTEND_URL` (×2 envs) | env config | **medium — FAILS OPEN** | blank → reflects any origin w/ credentials; must be set & non-empty |
| Single-origin auth (incl. apex login 308) | architecture + middleware | medium | localStorage is origin-scoped; keep the whole flow on app host |
| Stripe return URLs (store/upgrade/portal) | small code (mandatory) | medium | `replaceState` locks the ugly URL; cross-host upgrade strands the return |
| Post-auth targets (`/verify-email`,`/assessment`,`/dashboard`) | small code | medium | several land on apex/nonexistent routes; reconcile each |
| robots / noindex for the app host | small code + config | **medium — SEO/privacy** | member surface is 200 + indexable today |
| CSP | usually no change | low | only if cross-host calls added |
| Canonical / base-URL env vars | tiny code + env | low | `NEXT_PUBLIC_APP_URL` + `NEXT_PUBLIC_MARKETING_URL`; fix stale `bassnotion.com` |

**Net:** **2–4 focused days + a full staging dry-run** — NOT the original
"~half a day." Auth config (Supabase allow-list, Railway CORS, single-origin
flow) is a few hours. The real work is the `useInternalPathname()` hook + nav-URL
split (~1 day, the item the old runbook mis-rated as "no change"), plus the
explicit-allow-list middleware, the app→apex link fixes, robots/noindex, the
mandatory Stripe edits (incl. the cross-host upgrade case), and running the full
22-item matrix on staging before prod.

---

## Why this, not URL flattening to root (`bassicology.com/gym`)

Flattening to apex root collapses the product into the SAME namespace as future
public/marketing routes (`/pricing`, `/about`, `/blog`) — collisions + per-route
auth special-casing. The subdomain keeps the marketing/product wall clean (one
folder = one guard) and matches the Pickup `platform.` model. Park the
apex-flatten; do the subdomain at launch.

## Why the hook, not a folder rename of `app/app/`

Renaming the folder to drop the `/app` segment also delivers clean URLs but forces
editing ~20 hardcoded `/app/*` literals AND removes the AuthGuard-folder boundary.
The `useInternalPathname()` hook + clean-nav-URLs approach is lower churn: it
confines the change to (a) nav/link/`router.push` targets (drop `/app`) and (b)
seven comparator hooks (`usePathname()` → `useInternalPathname()`), while the
files stay at `app/app/*` behind the one shared AuthGuard. Lower risk than a rename,
and unlike the *original* "no change" plan, it actually keeps the URL bar clean on
in-app navigation.
