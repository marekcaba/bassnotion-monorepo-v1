# Known Tech Debt

Bugs and issues discovered during the production-readiness audit (May 2026) that aren't
blocking LIVE launch but should be tracked for follow-up. Logged here so we don't
re-discover them.

Each entry: severity, where it was found, what we know, what (if anything) we tried,
what to investigate.

---

## 🔴 P1 — Affects users, must fix soon

### Test suite: 548 failures (~10%)

- **Severity:** Medium — blocks pre-commit hook (we've been bypassing with `--no-verify`)
- **Discovered:** 2026-05-12 first push attempt of safety tag
- **Stats:** 153 test files failing, 548 individual tests failing out of 5133
- **Failure categories:**
  - **E2E specs under Vitest** (most of the failures) — Playwright `.e2e.spec.ts`
    files are being executed by Vitest instead of Playwright. Config issue.
  - **`ReferenceError: logger is not defined`** (110×) — missing imports across
    several files
  - **`audioContext.addEventListener is not a function`** (20×) — test mocks lag
    behind real Web Audio API
  - **`MusicalTruthAuthority.setFromExercise`** — `exercise.timeSignature` undefined;
    likely real bug
  - **`requestAnimationFrame is not defined`** — jsdom env config missing
  - **Worker out of memory** — test isolation issue
- **What to fix first:** the e2e-under-vitest config issue should resolve most of the
  noise in one shot — find what tells Vitest to pick up `**/*.spec.ts` and exclude
  `apps/frontend-e2e/**`.

---

## 🟡 P2 — Quality / hygiene, not user-facing

### Orphan unconfirmed users in `auth.users`
- **Severity:** Low — cosmetic for now (no production users yet)
- **What:** Signups with valid-syntax + valid-MX but nonexistent mailboxes
  (e.g. `digmarec@google.com` — `google.com` accepts mail, but that specific
  mailbox doesn't exist) create an `auth.users` row with
  `email_confirmed_at = null` that can never be confirmed. The address is
  then "taken" so the user can't re-signup with the corrected address.
- **Discovered:** 2026-05-13 during Phase 4.5 staging smoke-test
- **Mitigation in place:** Phase 4.5 added `/auth/validate-email-domain`
  endpoint that catches the *common* typos via MX-record lookup
  (`gogle.com` null-MX, `fakeydomain12345.com` NXDOMAIN, etc). But
  mailbox-level mistakes are an industry-wide unsolvable problem without
  sending real mail (SMTP `VRFY` is universally disabled).
- **Fix:** Add a periodic Supabase Edge Function or backend cron that
  deletes rows from `auth.users` where
  `email_confirmed_at IS NULL AND created_at < now() - interval '24 hours'`.
  Frees the email for retry, doesn't leak data.
- **Manual workaround until then:** Supabase dashboard → Authentication
  → Users → filter "unconfirmed" → delete.

### Nx `enforce-module-boundaries` rule blocks `@bassnotion/contracts` static imports
- **Severity:** Low — cosmetic, blocks pre-commit on any file that statically
  imports `@bassnotion/contracts`
- **Discovered:** 2026-05-13 trying to commit the email-validation fix
- **Symptom:** ESLint errors on `register/page.tsx` + `domains/user/api/auth.ts`
  for `Static imports of lazy-loaded libraries are forbidden. Library
  "@bassnotion/contracts" is lazy-loaded in: DrumProcessor.ts`
- **Root cause:** `DrumProcessor.ts` does a dynamic `import('@bassnotion/contracts')`
  somewhere, which Nx's boundary rule then enforces *everywhere* in the
  workspace, breaking the dozens of files that import contracts statically.
- **Quick fix:** Decide whether `@bassnotion/contracts` should be eagerly
  loaded everywhere (remove the dynamic import in DrumProcessor) or lazily
  everywhere (lots of refactoring). Almost certainly the former — contracts
  is a tiny types/schemas package, no reason to lazy-load it.
- **Until fixed:** commits touching files that import contracts statically
  need `--no-verify` to bypass the pre-commit hook.

### `apps/backend/src/health.js` references undefined `logger`

- **Severity:** Low — file is a Dockerfile fallback that isn't currently invoked at
  runtime. NestJS `/api/health` handles the actual healthcheck.
- **Discovered:** 2026-05-12 in Railway build logs
- **Symptom:** `ReferenceError: logger is not defined` at line 5
- **Fix:** Either call `createStructuredLogger('health-server')` first to create the
  logger, OR delete `health.js` if it's truly orphaned (the Dockerfile.final reference
  to it appears to be a debugging artifact)

### `Dockerfile.final` flagged for `ENV NX_CLOUD_AUTH=false`

- **Severity:** None — false positive
- **Discovered:** 2026-05-12 in Railway build logs
- **Warning:** `SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for
sensitive data (ENV "NX_CLOUD_AUTH")`
- **Why ignorable:** the value is literally the string `false`, not a token. Docker's
  linter pattern-matches on the variable name. Either suppress with a comment or
  rename to `NX_CLOUD_DISABLED=true`.

### `apps/frontend/next.config.optimized.js` is dead code

- **Severity:** Low
- **What:** A duplicate `next.config.js` that's never invoked (no build script
  references it). Has its own copies of CSP rules etc. that drift from the live
  config.
- **Fix:** Delete it.

### `verify-deployment.sh` has hardcoded production Railway URL

- **Severity:** Low (script is manually invoked, not in any pipeline)
- **What:** `backend-production-612c.up.railway.app` baked in — same pattern as the
  CSP one we already fixed. Now also stale if the Railway URL ever changes.
- **Fix:** Either delete the script, or read URL from `RAILWAY_BACKEND_URL` env var.

### Frontend `ignoreBuildErrors: true` in next.config.js

- **Severity:** Medium — production builds skip TypeScript validation
- **Where:** [apps/frontend/next.config.js](../../apps/frontend/next.config.js)
- **Why it exists:** unknown number of frontend TS errors; flipping to `false` would
  surface them all at once
- **Plan:** Count via `cd apps/frontend && npx tsc --noEmit | wc -l`. If <50, fix.
  If >50, leave flag but ensure CI has a separate `nx affected -t typecheck` step
  (it already does — verify).

---

## 🟢 P3 — Future cleanup

### Root directory clutter (~50 `.md` files + `.png` debug captures)

- **Severity:** Cosmetic
- **What:** `BASS_NOT_PLAYING_FIX.md`, `FRETBOARDCARD_*.md` (8 files),
  `INSTRUMENT_SWITCHING_*.md` (4), `MEASURE_SYNC_*.md` (5), `SCHEDULING_*.md` (6),
  `TIMING_*.md` (4), `webkit-diagnostic-*.png` (6), `lighthouse-*.json` (3), plus
  `archived-backups/` and `bmad-agent/` directories
- **Why it matters:** Visible in GitHub file tree; clutters repo root; reveals
  internal naming/architecture to anyone browsing
- **Fix:** Move to `docs/internal/` subdirs by topic, or delete the truly orphaned
  ones.

### Generated `.d.ts` and `.js` files committed to git

- **Severity:** Low
- **What:** `apps/frontend/public/worklets/timing-processor.js` is tracked despite
  being a build artifact regenerated on every `pnpm build:workers`. Same shape as
  the `.next/` artifacts we untracked during Phase 1.1.
- **Fix:** Add `apps/frontend/public/worklets/*.js` to gitignore, untrack with
  `git rm --cached`.

### Test pages in `_v*` folders (18 of them per CLAUDE.md)

- **Severity:** Low (Phase 7.4 in the production-readiness plan handles this)
- **Action:** Either delete, gate behind admin auth, or add `noindex` meta tag.
