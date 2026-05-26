# CLAUDE.md

## Project Overview

**BassNotion** - A music education platform for bass players with interactive tutorials, video sync (Bunny Stream), and 3D fretboard visualization.

**Status**: Pre-production development. No production users yet. Safe to experiment, refactor, and make breaking changes.

## Product Boundary — Bassicology vs Practice Bridge

This codebase contains two products that will eventually be separated. **Keeping them clean now prevents a painful rewrite later.**

**Bassicology** = content + learning (tutorials, exercises, fretboard, video sync, assessment, patterns)
**Practice Bridge** = practice infrastructure (sessions, scoring, streaks, teacher dashboard, classes, assignments)

They share: users, auth, billing. One Supabase database. One NestJS server. But the code must treat them as separate products.

### Domain Ownership (MUST FOLLOW)

```
BASSICOLOGY domains:                 PRACTICE BRIDGE domains (future):
  tutorials/                           practice/
  exercises/                           sessions/
  patterns/                            scoring/
  assessment/                          classes/
  creators/
  social/

SHARED domains:
  user/
  billing/
```

### The Service Boundary Rule

When Practice Bridge domains are created, Bassicology code MUST NOT query Practice Bridge tables directly (and vice versa). Use a service layer.

```typescript
// ✅ Service boundary — can become HTTP call later
const results = await practiceService.getStudentResults(studentId);

// ❌ Direct cross-query — creates coupling that blocks extraction
const results = await supabase.from('practice_results').select('*');
```

Shared tables (profiles, billing) are accessed through shared services (`userService`, `billingService`), never directly by either product's domain code.

### Why This Matters

At Week 34-42, Practice Bridge extracts into a standalone platform. If the service boundary is clean, the TypeScript function calls become HTTP calls — callers don't change. If Bassicology queries are scattered across Practice Bridge tables, it's a rewrite.

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 15.3 (App Router), React 19, TypeScript 5.7 |
| Backend | NestJS 11 + Fastify 4.x (NOT Express, NOT Fastify 5), TypeScript 5.7 |

### ⚠️ Version constraints (do not auto-bump)

Major-version bumps to these packages have known breakage. When `pnpm audit --fix`
or Dependabot proposes one, evaluate manually instead of accepting.

| Package | Pinned at | Why |
|---|---|---|
| `next` | `15.x` (currently `15.3.8`) | **Next 16** makes `--turbopack`/`--webpack` flag required and changes config schema. Stay on 15.x until we explicitly migrate. Next.js 15 minor bumps (e.g. 15.5.x) are safe. |
| `react` / `react-dom` | `19.1.0` | Was downgraded to 18.3.1 in Dec 2025 for WebKit/Safari audio compatibility, then re-upgraded to 19. Don't downgrade without checking Safari audio playback in WAM/Tone.js. |
| `fastify` (backend) | `4.x` | **Fastify 5** removes `request.routerPath` (use `request.routeOptions.url`) and changes the multipart `request.file` API. Multiple controllers use these. |
| `vite` | `6.x` | Vite 8 introduces ESM-only resolution changes that break some `@nx/*` plugins. Stay on 6 until Nx 21 fully supports Vite 8. |

For CVE patches that need overrides without breaking these constraints, add a
narrow `overrides:` entry in `pnpm-workspace.yaml` (see existing entries for
`@fastify/middie` and `form-data` as examples).

| Database | Supabase (PostgreSQL + Auth) |
| UI | shadcn/ui, Radix UI, Tailwind CSS 3.4 |
| State | Zustand 5, TanStack Query 5, XState 5 |
| Audio | Tone.js 15, Web Audio API, WebMIDI |
| 3D | Three.js 0.170, React Three Fiber 9 |
| Build | Nx 21, Vite 6, pnpm workspaces |
| Testing | Vitest 3 (unit), Playwright 1.52 (e2e) |

## Project Structure

```
bassnotion-monorepo-v1/
├── apps/
│   ├── backend/           # NestJS API (port 3000)
│   ├── frontend/          # Next.js app (port 3001)
│   └── frontend-e2e/      # Playwright tests
├── libs/contracts/        # Shared types, Zod schemas
├── docs/                  # Documentation
└── supabase/              # Database migrations
```

### Frontend Domains (`apps/frontend/src/domains/`)

- **playback** - Audio engine, 3D fretboard, transport (largest: 699 files)
- **widgets** - Video sync (Bunny Stream, legacy YouTube), interactive components
- **billing** - Stripe integration, subscriptions
- **user** - Auth, profiles, settings
- **admin** - Admin features, drum pattern editor
- **tutorials**, **exercises**, **patterns**, **creators**, **social**

### Backend Domains (`apps/backend/src/domains/`)

- **billing**, **user**, **tutorials**, **exercises**, **patterns**, **audio-samples**, **creators**, **social**, **learning**
- Uses CQRS pattern (`@nestjs/cqrs`), Fastify, repository pattern with string tokens

## Commands

### Development (PM2)

```bash
# ⚠️ Use PM2, NOT pnpm dev
pm2 status                        # Check processes
pm2 restart bassnotion-frontend   # Restart frontend (port 3001)
pm2 restart bassnotion-backend    # Restart backend (port 3000)
pm2 logs bassnotion-frontend      # View logs
pm2 restart all                   # Restart both
pm2 start ecosystem.config.cjs    # Start if not running
```

### Build & Test

```bash
pnpm install                      # Install deps (always pnpm, never npm/yarn)
pnpm test                         # Run all tests
pnpm test:frontend                # Frontend tests only
pnpm lint:fix                     # Lint with auto-fix
cd apps/frontend && pnpm next build  # Build frontend (nx has issues)
```

## Git & Deploy Workflow

Set up May 2026 (production-readiness Phase 4). Pre-LIVE; one engineer + AI.

### Branch model

```
feature/* ──► PR ──► develop ──► PR ──► main
                       │                  │
                       ▼                  ▼
                    STAGING           PRODUCTION
```

- `main` = production. Protected (eventually). Direct pushes blocked.
- `develop` = staging. Default target for feature PRs.
- `feature/<short-name>` = your working branch, off `develop`.
- `fix/*`, `chore/*`, `docs/*` = same flow as feature branches.
- Hot-fixes: PR straight to `main`, must still pass CI.

### Per-environment infrastructure

| Layer | Production | Staging |
|---|---|---|
| Branch | `main` | `develop` |
| Database | Supabase project `iuuplfrktnzsbzibpfjm` | Supabase project `vraxryaaznpkvtkindpn` |
| Backend | Railway `production` env → `backend-production-612c.up.railway.app` | Railway `staging` env → `backend-staging-4d19.up.railway.app` |
| Frontend | Vercel **Production** scope | Vercel **Preview** scope (auto on every PR; persistent URL for `develop`) |
| Stripe | Live keys (`sk_live_...`) | Test mode keys (`sk_test_...`) |

### Day-to-day flow

```bash
# 1. Start a feature
git checkout develop && git pull --ff-only origin develop
git checkout -b feature/some-thing

# 2. Make changes, commit
git add <specific files>
git commit -m "feat(...): ..."   # lint-staged runs prettier/eslint here

# 3. Push and open PR against develop
git push -u origin feature/some-thing --no-verify   # see note below
gh pr create --base develop --title "..." --body "..."

# Vercel auto-builds a Preview deploy → URL appears in PR comments
# Preview hits staging Supabase + staging Railway

# 4. Self-review the diff, then merge
gh pr merge <pr#> --squash

# 5. After merge to develop, .github/workflows/deploy.yml runs unattended:
#    - Applies any new Supabase migrations to STAGING Supabase
#    - Railway redeploys staging backend
#    - Vercel updates the develop staging URL
#    - Waits for backend /api/health to return healthy
#    - Smoke-tests staging frontend + backend
# Test in browser. If happy:

# 6. Ship to production
gh pr create --base main --head develop --title "Release: ..."
# If gh reports "not mergeable" (conflicts vs. main): see "Release conflicts" below.

gh pr merge <pr#> --squash
# Triggers .github/workflows/deploy.yml against main:
#  → migrate job PAUSES at the `production` GitHub environment for
#    manual approval (open Actions tab, click "Review deployments")
#  → on approval: production Supabase migration runs
#  → Railway + Vercel production redeploys
#  → health-gate + smoke test
```

### The deploy workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))

**Migrations run automatically — do not `supabase db push --linked` by hand
for staging or production.** Doing so races the workflow and double-applies
(idempotent migrations make this a no-op, but non-idempotent ones won't).

The workflow has three jobs that run on every push to `main` or `develop`:

1. **`migrate`** — `supabase db push --linked` against the matching project
   (`SUPABASE_PROJECT_REF_STAGING` for develop, `SUPABASE_PROJECT_REF_PROD`
   for main). Reads creds from GitHub secrets. **Production-side is gated
   by the `production` GitHub environment's manual approval**; staging
   runs unattended.
2. **`health-gate`** — polls `$BACKEND_URL/api/health` every 10s for up to
   10 minutes waiting for top-level `"status":"healthy"`. Blocks the
   smoke job until the backend has finished redeploying.
3. **`smoke`** — `curl` of the homepage (expect 200) + backend `/api/health`
   (expect healthy). Replaces an older Playwright `@smoke` suite that
   was 30+ min on cold runners.

When you need to apply a migration manually (e.g. local backend pointing at
production needs the schema before the workflow has run), use
`supabase db push --linked` — but only after confirming via
`cat supabase/.temp/project-ref` which project is linked. The CLI shows an
interactive Y/n confirmation; approve via the IDE permission prompt.

### Release conflicts (develop → main)

Squash-merging features into `develop` produces commit hashes that don't
exist on `main`, so a release PR routinely shows merge conflicts even
when nothing semantically conflicts. Resolution recipe:

```bash
git checkout develop && git pull --ff-only origin develop
git fetch origin main
git merge origin/main --no-edit
# Conflicts will surface in files both branches touched (commonly the
# entry-point files: apps/frontend/src/app/page.tsx, the launch docs,
# whichever controller you extended).
# For the typical case where develop is strictly newer, prefer "ours":
git checkout --ours <path>
# Then dedupe any duplicate interface/import blocks the merge produced.
# Type-check both apps before committing the merge.
git add <files>
git commit --no-verify -m "chore: merge main into develop for PR #<release> release"
git push origin develop --no-verify
```

The release PR auto-updates with the merge commit and becomes mergeable.

### Known footguns

- **`git push` hangs from non-TTY shells (Apple Git HTTP/2 issue).** Pass
  `--no-verify` to skip the pre-push hook that triggers this stall, AND
  ensure `git config --global http.version HTTP/1.1` is set.
- **`develop` shows "1 ahead of origin" after a squash-merge.** Your local
  feature-branch commit is still on `develop` HEAD; the squashed version
  on origin has a different hash. If the local commit is content you don't
  need to preserve (e.g. docs that were folded into the squash),
  `git reset --hard origin/develop` is safe. Verify with
  `git show <local hash>` first.
- **Don't `git add .` blindly.** `docs/console.md` (runtime log capture),
  `.env.local*`, and untracked unrelated docs sneak in. Stage by name.
- **lint-staged rewrites files during `git commit`.** This is fine, but
  means `git diff --cached` before commit and the final committed content
  can differ in whitespace/formatting. Re-read with `git show HEAD` if
  you need the exact landed content.

### Local dev = production data

Local PM2 backend/frontend hit **production** Supabase via `apps/backend/.env.local`
and `apps/frontend/.env.local`. This is intentional — you develop against the
real data you've been building features around. Staging Supabase is empty.

If you ever need to point local at staging (destructive testing, etc.), override
the relevant `SUPABASE_*` env vars in a `.env.local.staging` file. Don't change
the committed defaults.

### Things that broke earlier and could break again

- **CSP hardcoded URLs**: [next.config.js](apps/frontend/next.config.js) reads
  `NEXT_PUBLIC_API_URL` for connect-src. If you ever add another backend host
  (analytics service, webhook receiver, etc.), add it to the CSP allowlist.
- **`.vercelignore` excluding pnpm files**: don't add `pnpm-lock.yaml` or
  `pnpm-workspace.yaml` to `.vercelignore` (was a pre-pnpm-migration hack).
- **`apps/backend/.gitignore` blanket `*.d.ts`**: keeps hand-written types in
  `src/types/` via a negation pattern — don't remove it.
- **Apple Git HTTP/2 hangs**: from non-TTY shells, `git push` over HTTPS can stall
  on the second multiplexed POST. Run `git config --global http.version HTTP/1.1`
  if pushes hang.

## Critical Rules

### Import Rules (MUST FOLLOW)

```typescript
// Relative imports: MUST include .js extension (ESM)
import { Controller } from './auth.controller.js';

// Alias imports: NO extension
import { User } from '@/domains/user/types';
import { Schema } from '@bassnotion/contracts';

// Package imports: NO extension
import { Injectable } from '@nestjs/common';
```

### Path Aliases

```typescript
// Frontend (tsconfig.json)
@/*                    → ./src/*
@bassnotion/contracts  → ../../libs/contracts/dist/src
@playback/*            → ./src/domains/playback/modules/*/index.js

// Workspace
@bassnotion/backend    → apps/backend/src/index.ts
@bassnotion/contracts  → libs/contracts/dist/src/index.d.ts
```

### React Anti-Patterns (Cause Page Freezes)

```tsx
// ❌ Unmemoized callback - causes infinite re-renders
<Widget onUpdate={() => setState(value)} />

// ✅ Memoize callbacks passed as props
const handleUpdate = useCallback(() => setState(value), [value]);
<Widget onUpdate={handleUpdate} />

// ❌ Missing dependency array - runs every render
useEffect(() => { doSomething(); });

// ✅ Include dependency array
useEffect(() => { doSomething(); }, [dep]);

// ❌ Object selector without useShallow
const { a, b } = useStore(state => ({ a: state.a, b: state.b }));

// ✅ Use useShallow for object selectors
import { useShallow } from 'zustand/react/shallow';
const { a, b } = useStore(useShallow(state => ({ a: state.a, b: state.b })));

// ✅ Always wrap page components in fragments
export default function Page() {
  return (
    <>
      <Component />
    </>
  );
}
```

### Logging

```typescript
// Use structured logging with correlation IDs
import { useCorrelation } from '@/shared/hooks/useCorrelation';
const { correlationId, logger } = useCorrelation('ComponentName');

logger.error('Failed', error);        // Always shows
logger.info('Event', { data });       // Shows if LOG_LEVEL >= INFO
// Default LOG_LEVEL is ERROR - set NEXT_PUBLIC_LOG_LEVEL=INFO in .env.local

// Audio debugging (set NEXT_PUBLIC_DEBUG_AUDIO=true)
import { logAudioEvent } from '@/shared/debug/AudioDebugger';
logAudioEvent('Service', 'action', { data }, correlationId);
```

## Common Gotchas

1. **PM2 not pnpm dev** - Development servers run via PM2
2. **ESM extensions** - Relative imports need `.js` extension
3. **Fastify not Express** - Backend uses Fastify for middleware
4. **Fragment wrapper** - Page components must wrap in `<>...</>`
5. **Nx cache** - Run `nx reset` if builds act strange
6. **Supabase types** - Run `pnpm supabase gen types` after schema changes

## Environment Variables

```bash
# Frontend (.env.local)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3000
# NEXT_PUBLIC_LOG_LEVEL=INFO        # Enable info logs
# NEXT_PUBLIC_DEBUG_AUDIO=true      # Enable audio debug panel

# Backend (.env)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
PORT=3000
```

## When in Doubt

| Task | Where to Look |
|------|---------------|
| New component | `apps/frontend/src/domains/[domain]/components/` |
| New API endpoint | `apps/backend/src/domains/[domain]/` |
| Shared types | `libs/contracts/src/types/` |
| State management | Check if Zustand store exists first |
| Audio issues | `logAudioEvent()`, check AudioContext state |
| Page frozen | Check useEffect deps, memoize callbacks |

## Documentation

Detailed guides in `/docs/developer-handbook/`:
- `DEVELOPER_GUIDE.md` - Complete platform guide
- `CODING_STANDARDS.md` - Full coding standards
- `REACT-RENDERING-GOTCHAS.md` - React performance issues
- `TROUBLESHOOTING_FLOWCHART.md` - Debugging steps

## Technical Debt

1. **Playback domain** - 699 files, needs modularization
2. **TransportController.ts** - 1000+ lines, needs splitting
3. **Test pages** - 18 versioned pages in `_v*` folders - don't create more
