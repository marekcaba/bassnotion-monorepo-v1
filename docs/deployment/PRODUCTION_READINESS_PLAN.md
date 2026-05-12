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

### 1.4 Next.js upgrade 15.3.8 → 15.5.16+
**Risk:** Minor version bump, but Next.js sometimes changes App Router behavior.
- [ ] Read the changelog: https://github.com/vercel/next.js/releases
- [ ] `cd apps/frontend && pnpm update next@latest`
- [ ] Build locally: `cd apps/frontend && pnpm next build`
- [ ] If build fails → fix per the errors (often just typing)
- [ ] PM2 restart frontend → test:
  - [ ] Login flow
  - [ ] Tutorial loads
  - [ ] Audio playback works
  - [ ] 3D fretboard renders
  - [ ] Admin tutorial editor
- [ ] Commit: `fix(security): upgrade Next.js to X.Y.Z for CVE-XXXX`

### 1.5 Re-audit
- [ ] `pnpm audit --audit-level high` — target: 0 critical, ideally 0 high
- [ ] If some highs remain → file an issue/note but don't block (highs aren't production blockers)

**Acceptance criteria for Phase 1:**
- `pnpm audit --audit-level critical` returns 0
- Local dev (PM2) works without regressions
- All commits have descriptive messages

---

## Phase 2: TypeScript and build integrity (1 day)

### 2.1 Enable TypeScript checking in build
Currently `apps/frontend/next.config.js`:
```js
typescript: { ignoreBuildErrors: true }
eslint: { ignoreDuringBuilds: true }
```
- [ ] Run locally `cd apps/frontend && npx tsc --noEmit` — see how many errors there are
- [ ] If > 50 errors → **leave `ignoreBuildErrors: true`**, but add a separate typecheck step in CI (`npx nx affected -t typecheck` is already there, verify it runs)
- [ ] If < 50 errors → fix them, then set `ignoreBuildErrors: false`
- [ ] Either update `next.config.js`, or document in `docs/security/tech-debt.md` why it stays
- [ ] Commit

### 2.2 Clean up Railway placeholder credentials
- [ ] Open [railway.json](../../railway.json)
- [ ] Remove `SUPABASE_URL` and `SUPABASE_KEY` from `environments.production.variables`
- [ ] Verify in Railway dashboard that real values are in Railway env secrets (not in the repo)
- [ ] Commit: `chore(security): remove placeholder Supabase credentials from railway.json`

**Acceptance criteria for Phase 2:**
- CI typecheck step fails on real TS errors (not ignored)
- No credentials/placeholders in committed config

---

## Phase 3: Git workflow cleanup (1 day)

> **"Don't break anything" principle:** This phase doesn't affect production yet (you don't have one). The goal is to get the repo into a state where `main` is deployable.

### 3.1 Branch inventory
Currently:
- `feature/drum-pattern-editor` (current, 83 commits ahead of `origin/main`)
- `backup-before-cleanup-phase7`
- `fix/downgrade-react-webkit-compatibility`
- `refactor/region-processor-breakdown`
- `main` (outdated)

### 3.2 Decision for feature/drum-pattern-editor
- [ ] Is the current branch (drum-pattern-editor) ready to merge into main?
- [ ] If **yes**:
  - [ ] Open a PR from `feature/drum-pattern-editor` to `main`
  - [ ] Rebase/merge from main locally if needed (main is far behind)
  - [ ] Self-review the diff (`git diff main...HEAD --stat`)
  - [ ] Merge into main, delete the branch
- [ ] If **no** (something is unfinished):
  - [ ] Identify what's done vs WIP
  - [ ] Cherry-pick the done parts into a new branch `feature/drum-pattern-editor-stable`
  - [ ] Merge stable into main; drum-pattern-editor stays as WIP

### 3.3 Clean up other branches
- [ ] `backup-before-cleanup-phase7` — if obsolete, tag and delete: `git tag archive/backup-phase7 backup-before-cleanup-phase7 && git branch -D backup-before-cleanup-phase7`
- [ ] `refactor/region-processor-breakdown` — merge or delete
- [ ] `fix/downgrade-react-webkit-compatibility` — merge or delete

### 3.4 Branch protection rules
In GitHub repo settings → Branches → Add rule for `main`:
- [ ] Require pull request before merging
- [ ] Require status checks: CI lint, typecheck, test, build, e2e
- [ ] Require branches to be up to date before merging
- [ ] Do not allow bypassing the above (even for yourself)
- [ ] If you're a solo dev: approvals are optional, but still self-review in the PR

### 3.5 Create the `develop` branch
- [ ] `git checkout main && git pull origin main`
- [ ] `git checkout -b develop && git push -u origin develop`
- [ ] Branch protection for `develop` (lighter — just require passing CI)

**Acceptance criteria for Phase 3:**
- `main` is current and deployable
- `develop` exists and is the target for feature PRs
- Branch protection blocks direct pushes to main

---

## Phase 4: Staging environment (2–3 days)

> **This is your #1 priority for the future workflow.** Without staging you can't test a feature before LIVE.

### 4.1 Second Supabase project for staging
- [ ] In Supabase dashboard: New project → `bassnotion-staging`
- [ ] Apply migrations: `supabase link --project-ref <staging-ref>` → `supabase db push`
- [ ] **Verify all tables exist** in staging just like production
- [ ] Create a test user in staging Supabase for QA
- [ ] Save staging credentials to your password manager

### 4.2 Railway staging service
- [ ] In Railway dashboard, duplicate the backend service → `bassnotion-backend-staging`
- [ ] Set env vars to point at **staging** Supabase
- [ ] Set `NODE_ENV=staging`
- [ ] Wire it to the `develop` branch (auto-deploy from develop)
- [ ] Test the health endpoint: `curl https://<staging-url>/api/health`

### 4.3 Vercel staging
Vercel has built-in preview deploys for every PR — that may be enough.
- [ ] In Vercel project settings → Environment Variables
- [ ] Add **Preview** scope env vars pointing at staging Supabase + staging Railway URL
- [ ] Vercel auto-deploys each PR as a preview
- [ ] For the `develop` branch — configure it as a "staging" environment in Vercel (separate URL)

### 4.4 Test the end-to-end staging flow
- [ ] Make a small change on a feature branch (e.g., update homepage text)
- [ ] Push → PR against `develop` → verify the Vercel preview deploy works
- [ ] Merge into `develop` → verify staging deploy (Vercel + Railway)
- [ ] Open the staging URL → login → tutorial → audio
- [ ] If everything works, delete the test change

**Acceptance criteria for Phase 4:**
- Staging Supabase has the same schema as production
- Staging Railway is up with a healthy `/api/health`
- Staging Vercel deploy from `develop` works
- You can open the staging URL and use the app as a user

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
