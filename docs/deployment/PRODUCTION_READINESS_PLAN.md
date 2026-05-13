# Production Readiness Plan — BassNotion

> **Goal:** Get BassNotion to a state where we can safely go LIVE and continue building new features without risking production stability.
>
> **Estimated timeline:** 2–3 weeks at part-time pace.
>
> **Status:** Pre-production. This is a living document — check off subtasks as you progress.

---

## Important context: How migrations work across Supabase / Railway / Vercel

A common source of confusion, so let's get it out of the way up front:

- **Supabase** = single source of truth for the database + auth. Migrations run here (`supabase db push`). Tables live inside the Supabase Postgres instance.
- **Railway** = hosts the NestJS backend. **It has no database of its own.** It just connects to Supabase via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env variables. You do **not** "upload" migrations to Railway — the backend simply reads/writes to Supabase.
- **Vercel** = hosts the Next.js frontend. **No database of its own.** It connects to Supabase via `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser-safe) and to the backend via `NEXT_PUBLIC_API_URL`.

**Bottom line:** If migrations are applied in Supabase and tables exist, **Railway and Vercel are already ready** as far as DB schema is concerned. The only things you need to verify are:
1. Env variables in Railway/Vercel point at the correct Supabase project (production vs staging)
2. RLS policies in Supabase work for server-side requests from Railway
3. Once you create staging, you'll have a **second Supabase project** (or at least a second schema) for staging data

---

## Phase 1: Security fixes (1–3 days)

> **"Don't break anything" principle:** Each change goes into its own commit and is tested locally before pushing. This phase is the riskiest — major version bumps can change behavior.

### 1.1 Snapshot before starting
- [x] Commit current state or create a safety tag: `git tag pre-production-audit-snapshot` (points to `a5626d2`)
- [x] Push tag: `git push origin pre-production-audit-snapshot` (used `-c http.version=HTTP/1.1` due to Apple Git 2.39.5 HTTP/2 multiplexing bug in non-TTY shells; workaround pinned globally)
- [x] Verify local dev works — PM2 backend + frontend both online; `localhost:3001` returns HTTP 200; `localhost:3000/api/health` returns `{"status":"healthy"}` with database + Supabase healthy (had to `pm2 restart bassnotion-backend` first; the existing process wasn't listening on 3000)

**Bonus fixes during 1.1 — repository cleanup completed:**
- [x] CI lockfile-mismatch fixed → PR #55 (`fix/ci-pnpm-version`). Bumped all 4 workflows from pnpm 8 → 10; pinned `packageManager: pnpm@10.11.0` in root `package.json`.
- [x] All 5 stale branches archived as `archive/<name>-2026-05-12` tags pushed to remote, then deleted locally (`feature/drum-pattern-editor`, `backup-before-cleanup-phase7`, `fix/downgrade-react-webkit-compatibility`, `refactor/region-processor-breakdown`, local stale `main`).
- [x] All 4 stashes archived as `archive/stash-*-2026-05-12` tags pushed to remote, then dropped. Stash list empty.
- [x] Repository hygiene: stopped tracking `.next/`, `logs/`, `tsconfig.tsbuildinfo`, `supabase/.temp/` (now properly gitignored); added `*.tsbuildinfo`, `supabase/.temp/`, `.claude/scheduled_tasks.lock` to `.gitignore`.
- [x] **NEW BASELINE on `main` (origin/main = `fc754b9`):** "chore: pre-production baseline snapshot" — bundles ~5 months of feature/drum-pattern-editor work (543 files: drum pattern editor, billing, widget refactor, assessment domain, 22 Supabase migrations, etc.). Force-pushed with `--force-with-lease`. Pre-snapshot state preserved at tag `pre-production-audit-snapshot`.

### 1.2 Critical CVE audit
- [x] Run `pnpm audit --audit-level critical` and save the output to `docs/security/audit-baseline.md`
- [x] Try `pnpm audit --fix` — quietly bumped Next.js to 16, Vite to 8 (broke both apps). Rolled back. **Lesson learnt:** `--fix` writes blanket overrides without regard for major-version compatibility. Targeted upgrades only.
- [x] **Test locally:** PM2 restart all → backend `/api/health` healthy (DB 212ms, Supabase 140ms); frontend HTTP 200
- [x] Documented version constraints in CLAUDE.md (Next.js 15.x, React 19, Fastify 4, Vite 6) so future auto-fixes don't repeat the mistake

### 1.3 Manual upgrade of critical CVEs (DONE — combined with 1.2)
- [x] `form-data` <4.0.4 → ≥4.0.4 (dev-only transitive via Nx > axios; pnpm-workspace.yaml override)
- [x] `fast-xml-parser` 5.3.3 → 5.8.0 (direct dep in 3 package.json files: root, apps/backend, apps/frontend; bumped range ^5.2.5 → ^5.3.5)
- [x] `@fastify/middie` 9.0.3 → 9.3.2 (transitive via @nestjs/platform-fastify; pnpm-workspace.yaml override)
- [x] **Test backend locally:** PM2 restart, `/api/health` returns healthy ✅
- [x] Committed as single Phase 1.2 commit: "fix(security): patch all 3 critical CVEs"

**Phase 1.2/1.3 results:**
- Before: 188 vulns (20 low | 70 moderate | 94 high | **4 critical**)
- After: 155 vulns (17 low | 58 moderate | 80 high | **0 critical**)
- 80 remaining high CVEs are mostly minimatch/picomatch ReDoS in dev tools — to be addressed alongside Next.js 15.5 bump in Phase 1.4

### 1.4 Next.js upgrade 15.3.8 → 15.5.18 (DONE)
- [x] Confirmed Next 15.5.18 is the latest stable 15.x and accepts React 19.1.0 as peer
- [x] Bumped `next` exact pin in 2 package.json files (root + apps/frontend)
- [x] `pnpm install` succeeded
- [x] `pnpm next build` succeeded — all routes built (static + dynamic), no compile errors
- [x] PM2 restart all → backend `/api/health` healthy, frontend HTTP 200
- [x] Patched RSC cache poisoning CVE GHSA-wfc6-r584-vfw7 (was `>=14.2.0 <15.5.16`)
- [ ] **Manual UI smoke check (USER):** open the frontend in a browser, test login → tutorial → audio playback → 3D fretboard → admin editor. PM2 says it's serving but only you can confirm the UX

Stayed on 15.x per CLAUDE.md constraint. Next 16 requires explicit `--turbopack`/`--webpack` flag and changes config schema — deferred to a separate explicit migration.

### 1.5 Re-audit (DONE)
- [x] `pnpm audit --audit-level critical` returns **0** (was 4)
- [x] Total: 188 → 135 vulnerabilities
- [ ] Remaining 72 highs are mostly transitive minimatch/picomatch ReDoS in build tooling — low real-world risk, but tracked. Address opportunistically (e.g. when Nx 21 lands a release that bumps them)

**Acceptance criteria for Phase 1:**
- `pnpm audit --audit-level critical` returns 0
- Local dev (PM2) works without regressions
- All commits have descriptive messages

---

## Phase 2: TypeScript and build integrity (1 day)

### 2.1 Backend production build (DONE — discovered live)
Triggered while setting up Railway env vars: `nx build @bassnotion/backend --prod`
had been failing for some time (silently, since Railway was already offline).
Eight blocking errors fixed in PR #56:

- [x] `*.d.ts` blanket gitignore in `apps/backend/.gitignore` was excluding
  the hand-written `src/types/cache-manager-ioredis.d.ts` ambient module
  declaration from git → Railway cloned without it → "Could not find a
  declaration file". Added negation `!src/types/**/*.d.ts`.
- [x] `cache-manager-ioredis.d.ts` only declared named export; cache.module
  imports it as default. Added default export shape.
- [x] `fetch().json()` returns `unknown` now (modern @types/node), not `any`.
  Three call sites cast explicitly:
  `creators.service.ts:116`, `admin-tutorials.controller.ts:472` + `:507`.
- [x] **Verified locally:** `pnpm nx build @bassnotion/backend --prod` succeeds.
- [ ] **Verify on Railway (USER):** redeploy from PR #56 / merged main, build
  reaches "Successfully ran target build", service comes online.

### 2.1b Frontend `ignoreBuildErrors` flag (TODO — separate from 2.1)
Still on the books — `apps/frontend/next.config.js` has
`typescript: { ignoreBuildErrors: true }` and `eslint: { ignoreDuringBuilds: true }`.
- [ ] Run `cd apps/frontend && npx tsc --noEmit` — count errors
- [ ] If > 50 errors → leave the flag, ensure CI has a separate typecheck step
- [ ] If < 50 errors → fix them, flip the flag to `false`
- [ ] Document the decision in `docs/security/tech-debt.md`

### 2.2 Clean up Railway placeholder credentials (DONE — moved into PR #56)
- [x] Removed `SUPABASE_URL` and `SUPABASE_KEY` placeholders from `railway.json`
- [x] Removed stale `DEPLOYMENT_TRIGGER` marker
- [x] **Verified in Railway dashboard:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `FRONTEND_URL`, `STRIPE_SECRET_KEY` (live restricted), `STRIPE_WEBHOOK_SECRET` (live) all set as Railway env secrets
- [ ] Still missing: `JWT_SECRET`, `NODE_ENV=production`, `ENABLE_SWAGGER=false` (added in same session)
- [x] Also deleted `scripts/fix-harmony5-exercise.sh` (one-off script that leaked the production Supabase project URL)

**Acceptance criteria for Phase 2:**
- CI typecheck step fails on real TS errors (not ignored)
- No credentials/placeholders in committed config

---

## Phase 3: Git workflow cleanup (mostly done — folded into Phase 1.1)

Most of this was completed during the Phase 1.1 cleanup session. Remaining tasks:

### 3.1 Branch inventory (DONE)
- [x] All 5 obsolete branches archived as `archive/<name>-2026-05-12` tags and deleted from local + remote
- [x] All 4 forgotten stashes archived as `archive/stash-*-2026-05-12` tags and dropped
- [x] `feature/drum-pattern-editor` merged into `main` via the "pre-production baseline snapshot" commit (`fc754b9`)
- [x] All work preserved at tags `pre-production-audit-snapshot` (a5626d2) and `archive/feature-drum-pattern-editor-2026-05-12`

### 3.2 Create the `develop` branch (TODO — first step of Phase 4)
- [ ] `git checkout main && git pull origin main`
- [ ] `git checkout -b develop && git push -u origin develop`
- [ ] This branch is the target for feature PRs going forward; auto-deploys to staging once Phase 4 is wired

### 3.3 Branch protection rules (TODO — set after Phase 4 lands)
In GitHub repo settings → Branches → Add rule for `main`:
- [ ] Require pull request before merging
- [ ] Require status checks: CI lint, typecheck, test, build, e2e
- [ ] Require branches to be up to date before merging
- [ ] Do not allow bypassing the above (even for yourself)
- [ ] Solo dev: approvals optional, but still self-review the diff

For `develop`: lighter — just require CI passing. PRs into develop don't need approval.

**Note:** Skipping branch protection until Phase 4 finishes is intentional. During Phase 4 we'll be merging staging setup PRs directly to `develop` without ceremony.

**Acceptance criteria for Phase 3:**
- [x] `main` is current and deployable
- [ ] `develop` exists as feature-PR target
- [ ] Branch protection blocks direct pushes to `main`

---

## Phase 4: Staging environment (sized for 1-engineer team, not FAANG)

> **The biggest gap before safe future feature work.** Right now there's only `main` → production. No way to test changes against a real deploy before they hit users. After Phase 4, the flow becomes: feature branch → PR → preview deploy → staging → production.
>
> **Architecture chosen:** Industry-standard pattern for 1–10 engineer teams (Linear, Cal.com, Resend, PostHog-pre-scale). FAANG patterns (canary, blue-green, traffic shifting) are deferred until you have real load to justify them.

### Target architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     One Railway project                         │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │  PRODUCTION env     │    │  STAGING env        │            │
│  │  (deploys main)     │    │  (deploys develop)  │            │
│  │  production vars    │    │  staging vars       │            │
│  └─────────────────────┘    └─────────────────────┘            │
└────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────┐    ┌─────────────────────┐
│  Production         │    │  Staging            │
│  Supabase project   │    │  Supabase project   │
│  (real users data)  │    │  (test data)        │
└─────────────────────┘    └─────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                          Vercel                                 │
│ • main branch    → production URL    (production env vars)     │
│ • develop branch → staging URL       (preview env vars)        │
│ • every PR       → preview URL       (preview env vars)        │
└────────────────────────────────────────────────────────────────┘
```

### 4.1 Create the `develop` branch (5 min)
- [ ] `git checkout main && git pull origin main`
- [ ] `git checkout -b develop && git push -u origin develop`
- [ ] Verify it appears in GitHub branch list

### 4.2 Create staging Supabase project (15 min)
- [ ] Supabase dashboard → **New project** → name: `bassnotion-staging`
- [ ] Choose the same region as production (`eu-west-1` based on the production pooler hostname)
- [ ] Set a strong DB password — save it to password manager immediately (no recovery later)
- [ ] Wait for provisioning to finish
- [ ] Once ready, from the local repo: `supabase link --project-ref <staging-ref>` (staging-ref is in the project URL)
- [ ] Apply all migrations: `supabase db push`
- [ ] Verify all tables exist in staging (Supabase dashboard → Table Editor)
- [ ] **Optional:** Create a test user in staging Auth → Users (for QA logins)
- [ ] Save these 5 values to password manager:
  - Staging `SUPABASE_URL`
  - Staging `SUPABASE_ANON_KEY`
  - Staging `SUPABASE_SERVICE_ROLE_KEY`
  - Staging `DATABASE_URL` (Transaction pooler, port 6543)
  - Staging DB password (raw)
- [ ] **Re-link local repo back to production** so day-to-day `supabase` commands target prod: `supabase link --project-ref iuuplfrktnzsbzibpfjm`

### 4.3 Create staging Railway environment (15 min)
- [ ] Railway → project → top-nav environment dropdown ("production") → **+ New Environment**
- [ ] Name: `staging`
- [ ] When prompted "Duplicate from?" → choose **production** so service config carries over
- [ ] Once created, switch to `staging` environment in the dropdown
- [ ] Click into the backend service → **Settings** → **Source** → change branch from `main` → `develop`
- [ ] Click **Variables** → for each of these, override with the staging value (rather than inheriting from production):
  - `SUPABASE_URL` → staging value
  - `SUPABASE_ANON_KEY` → staging value
  - `SUPABASE_SERVICE_ROLE_KEY` → staging value
  - `DATABASE_URL` → staging value
  - `FRONTEND_URL` → will be set once Vercel staging URL is known (Step 4.4)
  - `STRIPE_SECRET_KEY` → consider using **Stripe TEST mode** (`sk_test_...`) for staging — generate one in Stripe dashboard via test-mode toggle
  - `STRIPE_WEBHOOK_SECRET` → create a new test-mode webhook in Stripe pointing at the staging Railway URL once known, paste its signing secret
  - `NODE_ENV` → `staging`
  - All other variables (`JWT_SECRET`, `ENABLE_SWAGGER`, `NX_REJECT_UNKNOWN_LOCAL_CACHE`) can inherit from production
- [ ] Watch the first deploy succeed; grab the new staging URL from Settings → Networking → Public Networking
- [ ] Verify: `curl https://<staging-railway-url>/api/health` returns healthy

### 4.4 Wire Vercel staging (15 min)
- [ ] Vercel dashboard → bassnotion frontend project → **Settings** → **Environment Variables**
- [ ] For each existing var, you'll see it scoped to "Production" / "Preview" / "Development". Add **Preview**-scope copies pointing at staging:
  - `NEXT_PUBLIC_SUPABASE_URL` → staging `SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → staging `SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_API_URL` → staging Railway URL (from step 4.3)
  - Any other `NEXT_PUBLIC_*` vars: mirror with staging values
- [ ] **Settings** → **Git** → confirm `develop` branch is in the deploy list (Vercel deploys it automatically as a Preview)
- [ ] Push a no-op commit to `develop` to trigger first staging build, or wait for next merge
- [ ] Note the staging URL (something like `bassnotion-monorepo-v1-frontend-git-develop-<your-handle>.vercel.app`)
- [ ] **Go back to Railway staging env** → set `FRONTEND_URL` to this Vercel staging URL
- [ ] (Optional) Vercel → Domains → assign custom subdomain like `staging.bassnotion.com` for cleaner URL

### 4.5 End-to-end staging smoke test (10 min)
- [ ] Create test branch from `develop`: `git checkout -b test/staging-verification`
- [ ] Make trivial change (e.g., edit `apps/frontend/src/app/page.tsx` header text)
- [ ] Push → open PR against `develop`
- [ ] Vercel auto-creates PR preview deploy → click the URL in PR comments
- [ ] Verify preview page shows your change
- [ ] Merge PR → `develop` branch deploys to:
  - Vercel staging URL
  - Railway staging backend (auto-deploy from `develop`)
- [ ] Visit Vercel staging URL → confirm:
  - [ ] Homepage loads
  - [ ] Sign up new test user (in staging Supabase)
  - [ ] Login flow works
  - [ ] Load a tutorial
  - [ ] Audio playback works
  - [ ] 3D fretboard renders
- [ ] If all green, revert the test change: `git revert <commit> && git push origin develop`

### 4.6 Document the new workflow in CLAUDE.md (10 min)
Add a section explaining:
- [ ] Feature branches branch from `develop`, not `main`
- [ ] PRs target `develop`; PR preview URLs hit staging Supabase
- [ ] `develop` → staging on every merge
- [ ] `develop` → `main` PR is the production release; merge triggers production deploy
- [ ] Hot-fix path: PR directly to `main`, but still needs green CI

**Acceptance criteria for Phase 4:**
- [ ] `develop` branch exists and is the target for feature PRs
- [ ] Staging Supabase project exists with same schema as production
- [ ] Railway has `staging` environment deploying from `develop` with healthy `/api/health`
- [ ] Vercel deploys `develop` to a staging URL with correct preview env vars
- [ ] Every PR gets an automatic preview deploy
- [ ] End-to-end smoke test passes on staging
- [ ] Workflow documented in CLAUDE.md

**Total estimated time:** ~70 minutes of active work + waiting on builds.

---

## Phase 5: Deploy pipeline (2 days)

### 5.1 Activate backend deploy in the workflow
Currently [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml#L60-L66) has the backend step commented out.

- [ ] Uncomment the backend deploy step
- [ ] Use Railway CLI or Railway GitHub integration (prefer integration — fewer secrets in GitHub)
- [ ] **Order matters:** Backend must deploy BEFORE the frontend (frontend calls backend API)
- [ ] Add a health check gate: after backend deploy, `curl /api/health` before frontend deploy proceeds
- [ ] Test on the `develop` staging branch before merging into main

### 5.2 Migration step in deploy
- [ ] Add a `supabase db push --linked` step in deploy.yml before backend deploy
- [ ] Requires `SUPABASE_ACCESS_TOKEN` in GitHub secrets
- [ ] **For production runs:** require manual approval (`environment: production` already does this)
- [ ] **Important:** If you have destructive migrations (DROP COLUMN, ALTER TYPE), create a migration runbook in `docs/deployment/MIGRATION_RUNBOOK.md`

### 5.3 Sentry release tracking
- [ ] Add a step in deploy.yml to upload source maps to Sentry
- [ ] Enable `productionBrowserSourceMaps: true` in next.config.js, but don't ship source maps as public assets (the Sentry plugin handles this)
- [ ] You'll then get readable stack traces in Sentry

### 5.4 Smoke test after deploy
Create `apps/frontend-e2e/src/smoke.spec.ts`:
- [ ] Load the homepage — status 200
- [ ] Login flow with a test user
- [ ] Open a tutorial
- [ ] Backend health check `/api/health` = healthy

In the deploy workflow:
- [ ] After deploy run: `npx playwright test --grep @smoke` against the production URL
- [ ] If it fails → roll back

**Acceptance criteria for Phase 5:**
- Push to `main` → DB migration → backend deploy → health check → frontend deploy → smoke test
- Any failure halts the deploy
- Sentry shows readable stack traces tagged with the release

---

## Phase 6: Monitoring and observability (1 day)

### 6.1 Uptime monitoring
Pick one:
- [ ] **BetterStack** (recommended, free tier 10 monitors)
- [ ] UptimeRobot (free tier 50 monitors, fewer features)
- [ ] Pingdom (paid)

Setup:
- [ ] Monitor 1: Frontend `https://<vercel-url>/` — every 1 min
- [ ] Monitor 2: Backend `https://<railway-url>/api/health` — every 1 min
- [ ] Notifications: email and ideally push to phone

### 6.2 Sentry alerts
- [ ] In Sentry dashboard: set an alert for **error rate spike** (>5 errors/min)
- [ ] Alert for **new issue type** in the production release
- [ ] Notifications to email

### 6.3 Logging audit
- [ ] Verify production does NOT have `NEXT_PUBLIC_LOG_LEVEL=INFO` (default ERROR is fine)
- [ ] Verify production does NOT have `NEXT_PUBLIC_DEBUG_AUDIO=true`
- [ ] Backend: verify structured logs flow into Railway logs (the default)

**Acceptance criteria for Phase 6:**
- If the backend goes down, you get a notification within 2 minutes
- Sentry alerts you to new errors

---

## Phase 7: Security and polish (1 day)

### 7.1 CSP and security headers
Extend [vercel.json](../../vercel.json) with:
- [ ] `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] CSP — start with `Content-Security-Policy-Report-Only` (just report violations, don't block)
- [ ] After a week of observation → switch to enforcing CSP

### 7.2 Rate limiting audit
- [ ] Find `rate-limit.decorator.ts` in the backend (I see it in modified files)
- [ ] Verify it's applied to: login, signup, password reset, file upload
- [ ] If missing → add it

### 7.3 Backup test
- [ ] In Supabase production: verify Daily Backup is enabled (free tier gives 7 days)
- [ ] **Try a restore into staging:** download backup → restore into staging Supabase
- [ ] If you're on a paid tier with longer retention, enable PITR

### 7.4 Clean up test pages
- [ ] CLAUDE.md mentions 18 `_v*` test pages
- [ ] Find them: `find apps/frontend/src/app -type d -name "*_v*"`
- [ ] For each: use only in dev or delete
- [ ] If you want to keep them: add `noindex` meta tag, or gate behind auth

**Acceptance criteria for Phase 7:**
- securityheaders.com test against the production URL → grade A
- Backup has been successfully restored at least once
- No publicly accessible _v* test pages

---

## Phase 8: Pre-launch checklist (the day before LIVE)

### 8.1 Final audits
- [ ] `pnpm audit --audit-level high` → 0 critical, 0 high
- [ ] CI pipeline on `main` is green across the board
- [ ] Local production build works: `cd apps/frontend && pnpm next build && pnpm next start`
- [ ] Backend build works: `pnpm build:backend && pnpm start:backend`

### 8.2 End-to-end manual QA on staging
Walk through all the main flows:
- [ ] Signup new user
- [ ] Login existing user
- [ ] Password reset
- [ ] Load a tutorial (full content load)
- [ ] Audio playback
- [ ] 3D fretboard interaction
- [ ] Video sync (Bunny Stream)
- [ ] Admin tutorial editor (if relevant for launch)
- [ ] Stripe checkout (test mode)
- [ ] Stripe webhook (test mode)
- [ ] Logout

### 8.3 Production env audit
- [ ] Vercel production env vars are set correctly (production Supabase, production Stripe live keys)
- [ ] Railway production env vars are set correctly
- [ ] Stripe webhook URL points at the production backend URL
- [ ] Supabase production URL config (Site URL = production domain, redirect URLs)
- [ ] DNS records are ready (if you have a custom domain)
- [ ] SSL cert valid (Vercel/Railway handle this automatically)

### 8.4 Rollback plan documented
Create `docs/deployment/ROLLBACK_RUNBOOK.md` with:
- [ ] How to roll back Vercel (instant rollback from the dashboard, document the exact steps)
- [ ] How to roll back Railway (redeploy previous build)
- [ ] How to roll back a DB migration (if reversible)
- [ ] Emergency contacts

---

## Workflow after LIVE — how we'll work together

```
1. You open/describe a feature (issue, message, plain text — whatever works)
2. I create a feature branch from `develop`:
   git checkout develop && git pull && git checkout -b feature/xyz
3. I implement + tests
4. Push → PR against `develop`
   → Vercel preview deploy (each PR gets its own URL)
   → CI runs (lint, typecheck, test, build, e2e)
5. You test on the preview URL (mobile + desktop)
6. Merge into `develop` (after self-review)
   → Auto-deploys to STAGING (Vercel staging URL + Railway staging)
7. You confirm staging is OK
8. I open a PR `develop` → `main`
9. After merge → PRODUCTION deploy:
   - DB migration (if any)
   - Backend deploy
   - Health check gate
   - Frontend deploy
   - Smoke test
   - Sentry release tagged
10. Watch Sentry for 30 min after deploy
```

**Rules:**
- Never push directly to `main` (branch protection blocks it)
- Always a PR, always a preview deploy before staging
- If there's risk (large feature, breaking change) → wrap it in a feature flag
- Hot-fix flow: PR straight against `main`, but still goes through CI + smoke test

---

## What to do when something breaks

| Symptom | Action |
|---|---|
| CI fails on a PR | Don't ignore, fix locally, push again |
| Staging deploy fails | Check Railway/Vercel logs, fix in develop |
| Production deploy fails | Auto-rollback (the workflow should handle it); if not → manual rollback in Vercel/Railway dashboard |
| Errors in Sentry after deploy | If > 5 errors/min or > 1% of users → roll back, debug calmly |
| DB migration fails mid-way | Use `MIGRATION_RUNBOOK.md`; most migrations are in a transaction = auto-rollback |
| Supabase down | Nothing to do, wait (Supabase SLA), show users a status page |

---

## Time budget (realistic for part-time pace)

| Phase | Estimate | Depends on |
|---|---|---|
| 1. Security fixes | 1–3 days | — |
| 2. TS + build integrity | 1 day | after 1 |
| 3. Git workflow cleanup | 1 day | after 1 |
| 4. Staging environment | 2–3 days | after 3 |
| 5. Deploy pipeline | 2 days | after 4 |
| 6. Monitoring | 1 day | parallel with 5 |
| 7. Security polish | 1 day | after 5 |
| 8. Pre-launch | 0.5 day | last |
| **Total** | **8–12 days of work** | — |

At ~2h/day → **2–3 weeks to LIVE-ready state.**

---

## What to do RIGHT NOW (next action)

1. `git tag pre-production-audit-snapshot && git push origin pre-production-audit-snapshot` — safety net
2. Run Phase 1.2: `pnpm audit --audit-level critical > docs/security/audit-baseline.md`
3. Then proceed phase by phase, checking off subtasks

If you want, I can kick off Phase 1 (audit + Next.js upgrade) right away — just say the word.
