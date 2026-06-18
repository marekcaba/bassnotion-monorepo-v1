# Production Dark-Launch Checklist — Gym + app.bassicology.com

> **What this is:** ship the Bass Gym product + app-subdomain migration to
> production **dark** (deployed but not publicly reachable), then flip to public
> later with a content change — no code uncomment, no `/beta` path.
>
> **Prepared:** 2026-06-18, after the staging dry-run passed (all infra checks
> green: middleware rewrite, host-aware robots, CORS not fail-open, login on the
> app origin). Prod values below mirror the verified staging config.
>
> **Status:** PREP DONE — execution (the `main` merge + migration approval) is
> the operator's to pull the trigger on.

---

## Why dark-launch is safe (verified)

The public cannot reach the gym even with the code live on prod, because **four
independent gates** already exist (all verified in code on 2026-06-18):

1. **Apex `/` = waitlist.** `app/page.tsx` renders `WaitlistClient`; no gym links.
2. **`/app/*` requires login.** `AppClientLayout` wraps everything in
   `<AuthGuard redirectTo="/login">`.
3. **Gym requires membership (UI).** `gym/page.tsx`: `if (!isMember) return
   <GymMembershipWall/>` — a hard gate *before* any gym content renders.
4. **Gym requires membership (API, server-side).** `training-engine.service.ts`
   throws `ForbiddenException('The Bass Gym is part of the membership …')` at
   enroll + today-rep. So a logged-in free user hitting the API directly still
   gets 403 — not just the frontend wall.

Plus: **`app.bassicology.com` is an unlinked subdomain** — the public is never
told it exists. Beta = grant specific people a membership; they log in; they're
in. **"Flip to public" later = change the apex homepage from waitlist →
marketing-with-gym-links (one content/env change, NOT a code edit).**

---

## Scope of this launch (be honest about size)

Shipping to prod = **259 commits** (the whole gym/training-engine/membership
product the subdomain rides on) **+ 1 prod DB migration**. Dark-launch removes
the *user-facing* risk; the code + schema + billing still go live on prod infra.
This is a real "go" — a safe one, but not a toggle.

**The 1 migration** (`20260617000001_repair_speed_goal_empty_topics.sql`) is a
**safe, idempotent single-row data repair** (clears empty `topics` on one goal so
it falls back to its valid block_set). Re-running is a no-op. Reviewed — low risk.

---

## EXACT PROD CONFIG VALUES (mirror of the verified staging config)

| Where | Setting | Value |
|---|---|---|
| **Vercel** (frontend project → Domains) | Add domain | `app.bassicology.com` → assign to **Production** (branch `main`) |
| **Vercel** env (Production scope) | `NEXT_PUBLIC_APP_URL` | `https://app.bassicology.com` |
| **Vercel** env (Production scope) | `NEXT_PUBLIC_MARKETING_URL` | `https://www.bassicology.com` |
| **Supabase** prod project `iuuplfrktnzsbzibpfjm` → Auth → URL Configuration | Site URL | `https://app.bassicology.com` |
| **Supabase** prod, Redirect URLs (add both) | redirect 1 | `https://app.bassicology.com/**` |
| **Supabase** prod, Redirect URLs | redirect 2 | `https://app.bassicology.com/auth/callback` |
| **Railway** `production` env | `FRONTEND_URL` | `https://app.bassicology.com` |
| **Railway** `production` env | `ALLOWED_ORIGINS` | `https://app.bassicology.com` (comma-list; add `https://www.bassicology.com` only if a marketing page calls the prod backend) |

> **`NEXT_PUBLIC_MARKETING_URL` = `www.bassicology.com`** (with `www`) — on
> staging, `/library` bounced apex → `www` (an extra 307 hop). Using `www`
> directly skips it.
>
> **`ALLOWED_ORIGINS` must be non-empty on prod Railway** — blank falls back to
> `'*'` and reflects any origin with credentials (a security regression). Verified
> on staging that a random origin is correctly rejected; replicate that.
>
> **Google OAuth:** if testing Google login on prod, add
> `https://app.bassicology.com/auth/callback` to the Google Cloud OAuth client's
> authorized redirect URIs too (password/magic-link don't need it).

---

## ORDER OF OPERATIONS (sequencing matters)

The middleware code must be on prod BEFORE the domain serves usefully (a domain
added before the code returns 404 on `/gym` — observed on staging). But the
domain/config is harmless to stage first since the middleware is a no-op on hosts
not in `APP_HOSTS`. Recommended order:

### 1. Ship the code to prod (the big step — OPERATOR)
```bash
# a) Land the whole chain on develop first (if not already)
#    feature/gym-goal-switch is the product; feature/app-subdomain adds the migration on top.
git checkout develop && git pull --ff-only origin develop
# Merge gym-goal-switch → develop (PR), then app-subdomain → develop (PR #164, un-draft it).
# OR merge app-subdomain → develop directly (it contains gym-goal-switch's 38 commits as ancestors).

# b) Release develop → main
gh pr create --base main --head develop --title "Release: Bass Gym + app-subdomain (dark launch)"
# Resolve any develop→main conflicts per CLAUDE.md "Release conflicts" recipe.
gh pr merge <pr#> --squash
```

### 2. Approve the prod Supabase migration (OPERATOR — gated)
The deploy workflow PAUSES at the `production` GitHub environment for manual
approval. **Actions tab → the running deploy → "Review deployments" → approve.**
The 1 migration runs (idempotent data repair). Then Railway + Vercel prod redeploy,
health-gate + smoke run.

### 3. Verify the public is STILL gated on prod (OPERATOR or me)
```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://www.bassicology.com/   # 200 waitlist
# Confirm NO gym links on the homepage; /app/* redirects to /login.
```

### 4. Do the 4 config steps above (OPERATOR — dashboards)
Vercel domain + env, Supabase prod Auth URLs, Railway prod CORS.

### 5. Verify the subdomain (me, via curl + Playwright — same as staging)
```bash
curl -sS -o /dev/null -w "%{http_code} %{url_effective}\n" https://app.bassicology.com/gym   # 200, stays /gym
curl -sS https://app.bassicology.com/robots.txt                                              # Disallow: /
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://app.bassicology.com/library # 308 → www apex
# CORS: app.bassicology.com origin echoed + credentials; random origin rejected.
```

### 6. Beta-invite test (OPERATOR + me)
Grant a test account an active membership → log in at `app.bassicology.com` →
confirm the gym loads for the member, nav URLs stay clean, login is single-origin.

---

## Rollback

- **Subdomain only:** remove `app.bassicology.com` from Vercel domains (the
  middleware is a no-op without the host; app stays reachable at `/app/*` on the
  apex). No code revert needed.
- **Whole launch:** revert the `main` release PR. The migration is data-only and
  idempotent; no schema rollback needed.
- **HSTS caveat:** `app.bassicology.com` inherits `includeSubDomains; preload`
  HTTPS-only — get the Vercel cert valid before announcing; can't fall back to
  HTTP to debug.

---

## What is NOT in this dark-launch (the real public flip, later)

- Apex homepage waitlist → marketing with gym links (the public "switch").
- Any beta→live billing levers (`BILLING_DEV_MODE`, etc.) per the
  BETA_TO_LIVE runbook (lives in the external docs folder, not this repo).
