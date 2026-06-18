# App Subdomain Runbook — `app.bassicology.com/gym`

> **Purpose:** Move the authenticated product from a path prefix
> (`bassicology.com/app/*`) to a dedicated subdomain (`app.bassicology.com/*`),
> so members see clean URLs (`app.bassicology.com/gym`) that mirror the
> marketing/product split Pickup Music uses (`platform.pickupmusic.com`).
>
> **Status:** PLANNED — launch-time task, not now. Pre-launch (no users, no SEO
> pressure) the payoff is purely cosmetic, and the auth/cookie work wants real
> staging testing. Do the staging dry-run first, then prod.
>
> **Created:** 2026-06-18.

---

## The key idea — the `/app` segment DISAPPEARS, files DON'T move

A subdomain is **not** a routing-folder migration. The Next.js files stay at
`apps/frontend/src/app/app/gym/page.tsx` (→ internal path `/app/gym`). A host-aware
**rewrite** maps the clean public path onto the existing tree:

```
User types:    app.bassicology.com/gym
                     │  middleware: host = app.*  →  rewrite /gym → /app/gym  (server-side, invisible)
                     ▼
Next renders:  app/app/gym/page.tsx        (unmoved)
URL bar shows: app.bassicology.com/gym     ✅  (rewrite ≠ redirect: URL is unchanged)
```

A **rewrite** changes what's served without changing the URL the user sees — that's
the trick. (A *redirect* would change the URL; we use redirects only for the
reverse: old `/app/*` → new clean URL.)

### Public → internal mapping

| User sees | Internally serves |
|---|---|
| `app.bassicology.com` | `/app` (Backstage) |
| `app.bassicology.com/gym` | `/app/gym` |
| `app.bassicology.com/college` | `/app/bassment` |
| `app.bassicology.com/gigs` | `/app/gigs` |
| `app.bassicology.com/settings` | `/app/settings` |

Bonus: the middleware is also the natural place to make `/college` serve
`/app/bassment` — the URL matches the nav label without renaming the folder.

---

## The process, in order

### 1. DNS + Vercel domain — config (~10 min; propagation up to a few hrs)
- Add `app.bassicology.com` as a domain on the Vercel project (CNAME →
  `cname.vercel-dns.com`).
- Decide the split:
  - `bassicology.com` / `www` = **marketing** (public pages, pricing, login).
  - `app.bassicology.com` = **the product** (everything currently under `/app/*`).

### 2. Host-rewrite middleware — small code
- Add `apps/frontend/src/middleware.ts` (or extend the existing one) that, when
  `request.headers.host === 'app.bassicology.com'`, rewrites:
  - `/` → `/app`
  - `/:path*` → `/app/:path*`   (so `/gym` → `/app/gym`, etc.)
  - and the label alias `/college` → `/app/bassment`.
- Reverse guard on the apex: redirect `bassicology.com/app/*` →
  `app.bassicology.com/*` so old links + bookmarks keep working.
- Verify the middleware `matcher` doesn't catch static assets / `_next`.

### 3. Supabase Auth — dashboard config (~5 min, BOTH envs)
- Add `https://app.bassicology.com/**` and `https://app.bassicology.com/auth/callback`
  to **Redirect URLs** for the **staging** project (`vraxryaaznpkvtkindpn`) AND the
  **prod** project (`iuuplfrktnzsbzibpfjm`).
- Set **Site URL** per environment to the app subdomain.
- Note: the frontend builds auth redirects from `window.location.origin`
  (`auth.ts` uses `${window.location.origin}/auth/callback`), so the URL is
  generated correctly automatically — but Supabase must ALLOW-LIST the new origin
  or magic-link / OAuth callbacks bounce. This is fail-closed: the failure mode is
  breakage (links don't work), not a vulnerability.

### 4. CSP / security headers — small code (`next.config.js`)
- `next.config.js` builds `connect-src` / frame allowlists from
  `NEXT_PUBLIC_API_URL`. Add `app.bassicology.com` (and the apex) so
  cross-subdomain navigation + API calls aren't blocked.
- ⚠️ CLAUDE.md flags hardcoded CSP URLs as a known footgun — add the EXACT
  origins, never widen to `*`.

### 5. Cross-subdomain session cookies — verify (the subtle one)
- For a session set on the marketing apex to carry into `app.`, the Supabase auth
  cookie domain must be `.bassicology.com` (leading dot = all subdomains).
- If the marketing site does NOT need the session, prefer keeping the cookie
  **host-only on `app.`** — strictly safer (see Security below).
- Test on staging: log in, navigate apex ↔ app, confirm the session persists (or
  is intentionally isolated).

### 6. Login redirect target — tiny code
- After login, send users to `app.bassicology.com` (the product), not apex `/app`.
  One redirect string (see `auth-guard.tsx` `redirectTo` and the login flow).

### 7. Env vars — config
- Set `NEXT_PUBLIC_APP_URL=https://app.bassicology.com` per environment (currently
  unused on the frontend) and use it anywhere absolute app links are built (emails,
  Stripe return/success URLs, etc.). Audit Stripe checkout `success_url` /
  `cancel_url` and any transactional email links.

### 8. Staging dry-run → prod
- Do ALL of the above on a staging subdomain first (`app-staging.bassicology.com`
  or the Vercel preview). Verify: login, magic link, OAuth, a DEEP link
  (`app-staging.bassicology.com/gym` cold-loaded), and the gym itself.
- Only then replicate on prod and flip DNS.

---

## Security checklist (get these right; the rewrite itself is not the risk)

The **rewrite is cosmetic** — it resolves a clean URL to the same AuthGuard-gated
file; it cannot bypass the guard, and auth is enforced server-side (NestJS +
Supabase RLS) regardless of frontend host. The risk lives entirely in the
**subdomain split**:

- [ ] **Cookie domain scope.** Broadening to `.bassicology.com` lets EVERY
  subdomain read the auth cookie. Only do it if you genuinely need cross-subdomain
  SSO. If you might ever host untrusted content on a subdomain
  (`blog.`, `status.`, a third-party-hosted `*.bassicology.com`), keep the cookie
  **host-only on `app.`** instead.
- [ ] **Cookie flags** stay `HttpOnly` + `Secure` + `SameSite=Lax` (Supabase
  default). Do NOT downgrade to `SameSite=None` without a specific reason — that's
  the flag that enables cross-site cookie sending.
- [ ] **Supabase redirect allow-list** = your domain only; no over-broad wildcard.
- [ ] **CSP** = your own origins only; never `*`.
- [ ] **CSRF posture.** Apex (marketing) ↔ subdomain (product) makes some requests
  cross-subdomain; `SameSite=Lax` keeps normal navigation safe. Re-verify on
  staging.

---

## Cost / risk summary

| Area | Type | Risk |
|---|---|---|
| DNS + Vercel domain | config | low |
| Host-rewrite middleware | ~1 small file | low |
| Supabase redirect/site URLs (×2 envs) | dashboard config | **medium — usual breakage point** |
| Cross-subdomain auth cookies | verify/config | **medium — test on staging** |
| CSP allowlist | small code | low |
| Login redirect + env | tiny code | low |
| Internal `/app` links | mostly origin-relative; few hardcoded | low |

**Net:** ~half a day with careful staging testing. The code is small; the care
goes into auth (Supabase allow-list + cookie domain) and doing it on staging first.

---

## Why this, not URL flattening to root (`bassicology.com/gym`)

Flattening to apex root collapses the product into the SAME namespace as future
public/marketing routes (`/pricing`, `/about`, `/blog`) — collisions + per-route
auth special-casing. The subdomain keeps the marketing/product wall clean (one
folder = one guard) and matches the Pickup `platform.` model you were emulating.
Park the apex-flatten; do the subdomain at launch.
