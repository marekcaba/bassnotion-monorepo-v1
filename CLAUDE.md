# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

**IMPORTANT: PRE-PRODUCTION DEVELOPMENT PHASE**

This project is currently in **active development** with **NO production users or customers yet**. The sole user and tester is the project owner/developer.

**What this means for development:**

- ✅ Safe to experiment with new architectures and refactors
- ✅ Breaking changes are acceptable during feature development
- ✅ Focus on code quality and architecture over backward compatibility
- ✅ Can iterate quickly without formal rollout procedures
- ✅ Feature flags can be toggled freely for testing
- ⚠️ Still maintain good practices (tests, documentation, clean code)
- ⚠️ Prepare for production (implement monitoring, error handling, rollback plans)

**When production launch approaches:**

- Switch to formal staged rollout procedures
- Implement full monitoring and alerting
- Follow strict backward compatibility rules
- Execute comprehensive user acceptance testing

**Current Development Mode:** Rapid iteration with production-quality code preparation.

## Critical Rules

### Logger Configuration (CHECK BEFORE ADDING LOGS!)

**CRITICAL - HIGH PRIORITY**: Before adding console.log or logger statements, ALWAYS check logger configuration first!

**Current Logger Setup:**

- **Default Log Level**: ERROR (unless `NEXT_PUBLIC_LOG_LEVEL` is set in `.env.local`)
- **Two Logger Systems**:
  1. **Frontend Logger** (`apps/frontend/src/utils/logger.ts`) - Category-based with disabled list, defaults to ERROR
  2. **Structured Logger** (`libs/contracts/src/utils/structured-logger.ts`) - Defaults to ERROR in production, INFO in development

**Log Level Behavior:**

- Without `NEXT_PUBLIC_LOG_LEVEL` set: defaults to **ERROR** level
- With `NEXT_PUBLIC_LOG_LEVEL=INFO`: shows ERROR, WARN, INFO
- Log levels available: `ERROR`, `WARN`, `INFO`, `DEBUG`, `VERBOSE` (Frontend) / `TRACE` (Structured)
- Current calls in code:
  - `logger.error()` - ✅ ALWAYS SHOWS
  - `logger.info()` - ❌ WON'T SHOW unless level is INFO or higher
  - `logger.debug()` - ❌ WON'T SHOW unless level is DEBUG or higher

**How to Enable Debug Logs:**

```typescript
// Option 1: In browser console
window.logger.setLevel(window.LogLevel.DEBUG);

// Option 2: Update .env.local
NEXT_PUBLIC_LOG_LEVEL = DEBUG;
```

**When Adding Diagnostic Logs:**

1. ✅ **DO**: Use `console.log()` for critical diagnostics (always shows)
2. ✅ **DO**: Use `logger.info()` for important events (shows with INFO level)
3. ❌ **DON'T**: Use `logger.debug()` unless you know DEBUG is enabled
4. ✅ **DO**: Check disabled categories list in `logger.ts` (lines 32-48)
5. ✅ **DO**: Add context name to logs: `[CC64 DIAGNOSTIC]`, `[SUSTAIN DIAGNOSTIC]`

**Disabled Categories (won't log INFO/DEBUG/VERBOSE):**

- FretboardCard, useFretboard, useFretboardExercise
- youtube-widget, CoreServices, EventBus, CircuitBreaker
- CacheMonitor, WidgetSyncService, TransportClock, SyncedWidget
- (See `logger.ts` lines 32-48 for full list)

### Tool Call Concurrency (PREVENTS API 400 ERRORS)

**CRITICAL**: Limit parallel tool calls to avoid API rate limits and 400 errors:

1. **Maximum 3 parallel tool calls per response** - NO EXCEPTIONS
2. **For file operations**: Read max 2-3 files at once, then wait for next batch
3. **For edits**: Do 1-2 edits at a time maximum
4. **Complex operations** (Grep, Bash, Task): Do sequentially, ONE AT A TIME
5. **Large refactorings**: Split into multiple conversation turns
6. **When you get 400 error**: You tried to do too much - slow down dramatically

**Examples**:

```
❌ BAD: Reading 10 files in parallel
✅ GOOD: Read 2 files, get results, read 2 more

❌ BAD: 5 parallel Bash commands
✅ GOOD: Run 1-2 Bash commands, wait, then continue

❌ BAD: Grep + 3 Reads + 2 Edits in one response
✅ GOOD: Grep first, then in next response do reads, then edits
```

### Package Manager

**ALWAYS use pnpm** - This is a pnpm workspace project. NEVER use npm or yarn commands.

### Import Rules (MUST FOLLOW)

```typescript
// Relative imports: MUST include .js extension (ESM requirement)
import { AuthController } from './auth.controller.js';

// Alias imports (@/ or @bassnotion/): MUST NOT include extension
import { AuthUser } from '@/domains/user/auth/types/auth.types';

// Package imports: NEVER use extensions
import { Injectable } from '@nestjs/common';
```

### TypeScript Path Aliases

**Frontend (`apps/frontend/tsconfig.json`):**
```typescript
@/*                    → ./src/*
@/domains/*            → ./src/domains/*
@/shared/*             → ./src/shared/*
@bassnotion/contracts  → ../../libs/contracts/dist/src

// Playback module aliases (for internal playback domain imports)
@playback/shared       → ./src/domains/playback/modules/shared/index.js
@playback/audio-engine → ./src/domains/playback/modules/audio-engine/index.js
@playback/transport    → ./src/domains/playback/modules/transport/index.js
@playback/instruments  → ./src/domains/playback/modules/instruments/index.js
@playback/tracks       → ./src/domains/playback/modules/tracks/index.js
@playback/storage      → ./src/domains/playback/modules/storage/index.js
```

**Workspace (`tsconfig.base.json`):**
```typescript
@bassnotion/backend    → apps/backend/src/index.ts
@bassnotion/contracts  → libs/contracts/dist/src/index.d.ts
@bassnotion/frontend   → apps/frontend/src/index.ts
```

## Commands

### Development

⚠️ **IMPORTANT: THIS PROJECT USES PM2 FOR DEVELOPMENT SERVERS - DO NOT USE pnpm dev COMMANDS** ⚠️

```bash
# Install dependencies
pnpm install

# ❌ DO NOT USE THESE - We use PM2 instead:
# pnpm dev              # DON'T USE
# pnpm dev:frontend     # DON'T USE
# pnpm dev:backend      # DON'T USE

# ✅ CORRECT WAY - Using PM2:
pm2 status                        # Check status of all processes
pm2 restart bassnotion-frontend   # Restart frontend (port 3001)
pm2 restart bassnotion-backend    # Restart backend (port 3000)
pm2 logs bassnotion-frontend      # View frontend logs
pm2 logs bassnotion-backend       # View backend logs
pm2 restart all                   # Restart both frontend and backend
pm2 stop all                      # Stop all processes
pm2 start ecosystem.config.cjs    # Start all processes if not running
```

### Building

```bash
# Build all projects
pnpm nx run-many --target=build --all

# Build specific project
pnpm nx build @bassnotion/backend
pnpm nx build @bassnotion/contracts

# Frontend build workaround (due to nx/Next.js compatibility issue)
# The nx build for frontend may fail with "Html import" errors
# Use this direct Next.js build command instead:
cd apps/frontend && pnpm next build
```

**Note**: There's a known issue with @nx/next plugin and Next.js App Router that causes build failures through nx. The frontend builds successfully using Next.js directly.

### Testing with Vitest

```bash
# Run all tests
pnpm test

# Run tests by app (uses package.json scripts)
pnpm test:frontend              # All frontend tests
pnpm test:backend               # All backend tests

# Run domain-specific tests
pnpm test:frontend:playback     # Playback domain only
pnpm test:frontend:user         # User domain only
pnpm test:frontend:widgets      # Widgets domain only
pnpm test:frontend:shared       # Shared utilities

# Run a specific test file
pnpm vitest run apps/backend/src/domains/user/auth/auth.service.spec.ts

# Watch mode for development
pnpm vitest --watch
```

### Linting & Type Checking

```bash
# Lint all projects
pnpm lint

# Lint with auto-fix
pnpm lint:fix

# Type check specific apps
pnpm nx run @bassnotion/frontend:typecheck
pnpm nx run @bassnotion/backend:typecheck
```

### E2E Testing

```bash
# Run Playwright tests
pnpm nx e2e @bassnotion/frontend-e2e

# Open Playwright UI
pnpm nx e2e @bassnotion/frontend-e2e --ui
```

### Production Serving (PM2)

```bash
# Start with PM2
pm2 start ecosystem.config.cjs

# Manage processes
pm2 restart bassnotion-frontend
pm2 restart bassnotion-backend
pm2 logs bassnotion-frontend
pm2 logs bassnotion-backend
pm2 status
pm2 stop all
pm2 delete all
```

**Note**: The development servers are managed by PM2 using the ecosystem.config.cjs file. Backend runs on port 3000 and frontend runs on port 3001 as PM2 processes.

## Architecture Overview

### Monorepo Structure

```
bassnotion-monorepo-v1/
├── apps/
│   ├── backend/          # NestJS + Fastify API (Port 3000)
│   ├── frontend/         # Next.js 15 App Router (Port 3001)
│   └── frontend-e2e/     # Playwright E2E tests
├── libs/
│   └── contracts/        # Shared types, Zod schemas, utilities
├── docs/                 # Technical documentation
├── scripts/              # Build and utility scripts
├── supabase/             # Database migrations & config
├── bmad-agent/           # AI agent configurations
└── memory-bank/          # Project context & progress
```

### Technology Stack

- **Frontend**: Next.js 15.3.8 (App Router) + React 19.1.0 + TypeScript 5.7.3
- **Backend**: NestJS 11.0.0 + Fastify 4.24 + TypeScript 5.7.3 (NOT Express!)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **UI Components**: shadcn/ui + Radix UI + Tailwind CSS 3.4
- **State Management**: Zustand 5 + TanStack Query 5 + XState 5 (for complex flows)
- **3D Graphics**: Three.js 0.170 + React Three Fiber 9 + Drei 9
- **Audio Processing**: Tone.js 15 + Web Audio API + WebMIDI
- **Music Notation**: VexFlow 4 + OpenSheetMusicDisplay 1.9
- **Forms**: React Hook Form 7 + Zod 3.25 validation
- **Build Tools**: Nx 21.2 + Vite 6.3
- **Testing**: Vitest 3.1 (unit) + Playwright 1.52 (e2e)

### Domain Architecture

The project follows Domain-Driven Design with these core domains:

#### Frontend Domains (`apps/frontend/src/domains/`)

- **admin**: Admin features, drum pattern editor
- **creators**: Content creator features
- **exercises**: Practice materials, progress tracking
- **patterns**: Pattern selection & management
- **playback**: Audio/video playback, 3D fretboard visualization (largest domain - 33+ subdirectories)
- **tutorials**: Educational content, lessons
- **user**: Authentication, profiles, settings
- **widgets**: YouTube integration, interactive tools

#### Backend Domains (`apps/backend/src/domains/`)

- **audio-samples**: Audio file management
- **creators**: Content creator features
- **exercises**: Exercise data management
- **learning**: Learning/token services
- **tutorials**: Tutorial content management
- **user**: User management, authentication (with auth/, repositories/, entities/, value-objects/)
- **shared**: Cross-domain utilities

**Backend Architecture Notes:**
- Uses **CQRS pattern** (`@nestjs/cqrs`) for command/query separation
- Uses **Fastify** (not Express) - important for middleware/plugin compatibility
- Repository pattern with string tokens for DI (e.g., `'IResultExerciseRepository'`)

### Shared Contracts (`libs/contracts/src/`)

- Type-safe API contracts using Zod schemas
- Shared between frontend and backend
- Ensures type safety across the entire stack

**Key shared utilities:**
- `MusicalTimeConverter` - Musical timing calculations (bars, beats, ticks)
- `ProfessionalDrumProcessor` - Drum pattern processing
- `structured-logger` - Correlation-aware logging
- `correlation` - Request correlation ID utilities

**Structure:**
```
libs/contracts/src/
├── types/           # TypeScript interfaces (exercise, playback, musical-time, etc.)
├── validation/      # Zod schemas (auth, exercise, playback, etc.)
├── services/        # Shared services (MusicalTimeConverter, ProfessionalDrumProcessor)
└── utils/           # Utilities (structured-logger, correlation, parsers)
```

## Key Patterns & Conventions

### Component Structure (Frontend)

```typescript
// Components follow this pattern:
src/domains/[domain]/components/[ComponentName]/
├── [ComponentName].tsx           # Main component
├── [ComponentName].test.tsx      # Unit tests
├── [ComponentName].module.css    # Styles (if needed)
└── components/                   # Sub-components
```

### API Routes (Backend)

```typescript
// Controllers follow RESTful conventions:
@Controller('api/v1/users')
export class UserController {
  @Get(':id')
  findOne(@Param('id') id: string) {}

  @Post()
  create(@Body() dto: CreateUserDto) {}
}
```

### Testing Approach

- **Unit Tests**: Co-located with source files (`.test.ts` or `.spec.ts`)
- **Integration Tests**: In `test/` subdirectories within domains
- **E2E Tests**: Playwright tests in `apps/frontend-e2e/`
- **Test Data**: Use factories and fixtures for consistent test data

### Error Handling

- Frontend: Error boundaries + TanStack Query error states
- Backend: NestJS exception filters + custom error classes
- Validation: Zod schemas for runtime validation

## Environment Configuration

### Frontend (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3000

# Logging Configuration (optional)
# Log levels: ERROR, WARN, INFO, DEBUG, VERBOSE (Frontend) / TRACE (Structured)
# Default: ERROR (if not set)
# NEXT_PUBLIC_LOG_LEVEL=INFO  # Uncomment to see INFO logs

# Allow noisy logs (contexts like TransportClock, EventBus, etc.)
# Default: false - noisy contexts are suppressed
NEXT_PUBLIC_ALLOW_NOISY_LOGS=false

# Audio debugging
# NEXT_PUBLIC_DEBUG_AUDIO=true  # Uncomment to enable audio debug panel
```

### Backend (.env)

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
PORT=3000
LOG_LEVEL=INFO  # Backend log level
```

## Development Workflow

1. **Feature Development**:
   - Create feature branch from `main`
   - Follow domain-driven structure
   - Write tests alongside implementation
   - Ensure linting and type checking pass

2. **Testing Strategy**:
   - Unit tests for business logic
   - Integration tests for API endpoints
   - E2E tests for critical user flows
   - All tests must pass before merging

3. **Code Review Process**:
   - CI pipeline runs on every PR
   - Automated checks: lint, typecheck, tests, build
   - Manual review required for architecture changes

4. **Deployment**:
   - Frontend: Auto-deploys to Vercel on main branch
   - Backend: Deployable to Railway, Render, or similar
   - Database: Supabase managed PostgreSQL

## Common Gotchas

1. **ESM Module System**: Always use `.js` extension for relative imports
2. **Nx Caching**: Clear cache with `nx reset` if builds act strange
3. **Supabase Types**: Regenerate with `pnpm supabase gen types` after schema changes
4. **PM2 Logs**: Check `logs/` directory for application logs
5. **TypeScript Paths**: Use `@/` for app-specific imports, `@bassnotion/` for workspace libs
6. **React Fragment Wrapper**: ALWAYS wrap page component returns in `<>...</>` to prevent rendering issues:

   ```tsx
   // ❌ Can cause page freezing/click blocking
   return <ComplexComponent />;

   // ✅ Fragment prevents rendering boundary issues
   return (
     <>
       <ComplexComponent />
     </>
   );
   ```

## React Best Practices (CRITICAL)

### Preventing Infinite Render Loops and Page Freezing

These issues can make pages completely unresponsive. Follow these rules to prevent them:

1. **Always Memoize Event Handlers Passed as Props**:

   ```tsx
   // ❌ BAD: Creates new function every render
   <Widget onUpdate={() => setState(value)} />;

   // ✅ GOOD: Memoized with useCallback
   const handleUpdate = useCallback(() => {
     setState(value);
   }, [value]);
   <Widget onUpdate={handleUpdate} />;
   ```

2. **Never Include State Setters in useEffect Dependencies**:

   ```tsx
   // ❌ BAD: Causes infinite re-renders
   useEffect(() => {
     // some logic
   }, [transport, setCurrentPosition, currentPosition]);

   // ✅ GOOD: State setters are stable, exclude them
   useEffect(() => {
     // some logic
   }, [transport, currentPosition]);
   ```

3. **Always Include Dependency Arrays in useEffect**:

   ```tsx
   // ❌ BAD: Runs on every render
   useEffect(() => {
     setRenderCount((prev) => prev + 1);
   });

   // ✅ GOOD: Only runs once on mount
   useEffect(() => {
     setRenderCount((prev) => prev + 1);
   }, []);
   ```

4. **Wrap Page Components in React Fragments**:

   ```tsx
   // ❌ BAD: Can cause rendering boundary issues
   export default function Page() {
     return <AudioEnabledTutorial {...props} />;
   }

   // ✅ GOOD: Fragment ensures proper rendering
   export default function Page() {
     return (
       <>
         <AudioEnabledTutorial {...props} />
       </>
     );
   }
   ```

5. **Avoid Circular State Updates**:

   ```tsx
   // ❌ BAD: Setting state based on same state in render
   if (selectedExercise !== widgetState.selectedExercise) {
     widgetState.setSelectedExercise(selectedExercise);
   }

   // ✅ GOOD: Use effects with proper dependencies
   useEffect(() => {
     if (selectedExercise?.id !== widgetState.selectedExercise?.id) {
       widgetState.setSelectedExercise(selectedExercise);
     }
   }, [selectedExercise?.id]);
   ```

6. **Use Zustand's useShallow for Object Selectors**:

   ```tsx
   // ❌ BAD: Object reference changes every render
   const { isPlaying, tempo } = useTransportStore((state) => ({
     isPlaying: state.isPlaying,
     tempo: state.tempo,
   }));

   // ✅ GOOD: useShallow prevents unnecessary re-renders
   import { useShallow } from 'zustand/react/shallow';
   const { isPlaying, tempo } = useTransportStore(
     useShallow((state) => ({
       isPlaying: state.isPlaying,
       tempo: state.tempo,
     }))
   );
   ```

### Debugging Frozen Pages

If a page becomes unresponsive:

1. Check browser console for "Maximum update depth exceeded" errors
2. Look for components rendering 1000+ times
3. Search for unmemoized callbacks in component props
4. Check useEffect dependency arrays for state setters
5. Verify page components are wrapped in fragments

## Useful Resources

- Project Documentation: `/docs/` directory
- AI Agent System: `/bmad-agent/` for development workflows
- Memory Bank: `/memory-bank/` for project context and progress
- Component Inventory: `/docs/ui-component-inventory.md`
- 3D Fretboard Docs: `/docs/fretboard-3d-implementation.md`
- React Rendering Issues: `/docs/REACT-RENDERING-GOTCHAS.md`
- Click Blocking Debug: `/docs/CLICK-BLOCKING-DEBUG-PROGRESS.md`

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.

## Documentation Rules (CRITICAL)

### Before Creating ANY Documentation

1. **CHECK docs/INDEX.md FIRST** - Is there already a doc for this?
2. **NEVER create docs in root directory** - Only README.md and CLAUDE.md belong there
3. **Follow the structure**:
   ```
   docs/
   ├── INDEX.md                    # UPDATE THIS when adding docs
   ├── architecture/analysis/      # System analysis
   ├── implementations/            # Completed features
   ├── archived/fixes/            # Bug fixes
   ├── developer-handbook/         # How-to guides
   └── NEW STORIES/               # Active development
   ```

### When You MUST Create Documentation

- User explicitly asks for it
- Completing a major implementation
- Document goes in proper folder per structure above
- UPDATE docs/INDEX.md immediately after creating

### Common Mistakes to AVOID

- Creating test-\*.md files in root
- Creating multiple docs for same topic
- Not checking INDEX.md first
- Creating temporary debugging docs

See `/docs/DOCUMENTATION_GUIDELINES.md` for full rules.

## Debugging & Development Tools

### Correlation IDs (ALWAYS USE)

```typescript
// In React components
import { useCorrelation } from '@/shared/hooks/useCorrelation';
const { correlationId, logger } = useCorrelation('ComponentName');

// In API calls
await apiClient.get('/api/endpoint', { correlationId });

// Find issues across system
grep "correlation-id-here" logs/*.log
```

### Structured Logging (NEVER use console.log)

```typescript
// ❌ NEVER DO THIS
console.log('Something happened');

// ✅ ALWAYS DO THIS
logger.info('Action description', { data, correlationId });
logger.error('Error description', error, { context });
```

### Audio Debugging

```typescript
// Enable in .env.local
NEXT_PUBLIC_DEBUG_AUDIO = true;

// Use in components
import { useAudioDebug } from '@/shared/debug/AudioDebugger';
const debug = useAudioDebug('ComponentName');
debug.log('event-name', { data });
```

### Health Checks

- Backend: GET http://localhost:3000/health
- Frontend: Check bottom-left indicator (🟢 healthy, 🟡 degraded, 🔴 unhealthy)

## Critical Coding Standards

### Golden Rules

1. **NEVER exceed 3 parallel tool calls** (prevents 400 errors)
2. **Always use pnpm** (never npm or yarn)
3. **Always add correlation IDs** to API calls
4. **Always use structured logging** (never plain console.log)
5. **Always wrap page components in fragments** `<>...</>`
6. **Always memoize callbacks** passed as props

### Prevent Infinite Loops

```typescript
// ❌ CAUSES FREEZE
useEffect(() => {
  setState(value);
}); // Missing dependency array!

// ✅ CORRECT
useEffect(() => {
  setState(value);
}, [value]);

// ❌ UNMEMOIZED CALLBACK
<Component onUpdate={() => doSomething()} />

// ✅ MEMOIZED
const handleUpdate = useCallback(() => doSomething(), []);
<Component onUpdate={handleUpdate} />
```

### Import Rules

```typescript
// ✅ CORRECT IMPORTS
import { Something } from '@bassnotion/contracts'; // No extension for packages
import { Component } from '@/domains/user/types'; // No extension for aliases
import { Service } from './service.js'; // .js extension for relative imports
```

## Common Debugging Patterns

### When Something Breaks

1. Get correlation ID from error
2. Check health indicator (bottom-left)
3. Check Audio Debug Panel (bottom-right) if audio-related
4. Search logs: `grep "correlation-id" logs/*.log`
5. Add more logging before/after the problem area

### Page Frozen?

Check for:

- Missing useEffect dependencies
- Unmemoized callbacks in props
- setState during render
- Circular state updates

### Audio Not Playing?

1. Check Audio Debug Panel for events
2. Common issue: AudioContext suspended (needs user interaction)
3. Check Network tab for 404s on samples
4. Verify Supabase bucket is public

### API Errors?

1. Check health status indicator
2. Verify correlation ID is passed
3. Check pm2 logs: `pm2 logs bassnotion-backend`
4. Common: Missing env variables in production

## Project-Specific Patterns

### Audio Component Pattern

```typescript
export function AudioWidget() {
  const { correlationId, logger } = useCorrelation('AudioWidget');
  const debug = useAudioDebug('AudioWidget');

  const play = useCallback(async () => {
    debug.log('play-start', { time: Date.now() });
    try {
      await audioEngine.play();
      debug.log('play-success');
    } catch (error) {
      debug.log('play-error', { error: error.message });
      logger.error('Playback failed', error);
    }
  }, []);

  return <button onClick={play}>Play</button>;
}
```

### API Call Pattern

```typescript
async function fetchData() {
  const { correlationId, logger } = useCorrelation('DataFetcher');

  try {
    logger.info('Fetching data');
    const result = await apiClient.get('/api/data', { correlationId });
    logger.info('Data fetched', { count: result.length });
    return result;
  } catch (error) {
    logger.error('Failed to fetch data', error);
    throw error;
  }
}
```

## Emergency Commands

```bash
# Restart everything
pm2 restart all

# Complete reset
pm2 delete all && pm2 start ecosystem.config.cjs

# View logs
pm2 logs bassnotion-frontend
pm2 logs bassnotion-backend

# Find what's using ports
lsof -i :3000  # Backend
lsof -i :3001  # Frontend
```

## Current Technical Debt (from AUDIT_08_25.md)

1. **Playback domain**: 105 service files - needs breaking into smaller modules
2. **Test pages**: Recently cleaned 207 test variations - DO NOT create new test pages
3. **Widget versions**: Use V2 versions (HarmonyWidgetV2, DrummerWidgetV2)
4. **God objects**: UnifiedTransport has 3000+ lines - needs refactoring

## References

For detailed guides see `/docs/developer-handbook/`:

- DEVELOPER_GUIDE.md - Complete platform guide
- TROUBLESHOOTING_FLOWCHART.md - Step-by-step debugging
- DEBUGGING_EXAMPLES.md - Real-world scenarios
- CODING_STANDARDS.md - Full coding standards
