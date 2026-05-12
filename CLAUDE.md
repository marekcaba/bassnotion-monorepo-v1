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
| Backend | NestJS 11 + Fastify (NOT Express), TypeScript 5.7 |
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
