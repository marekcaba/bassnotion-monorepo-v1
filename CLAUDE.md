# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Rules

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

# Frontend build workaround (due to nx/Next.js 15.3.2 compatibility issue)
# The nx build for frontend may fail with "Html import" errors
# Use this direct Next.js build command instead:
cd apps/frontend && pnpm next build
```

**Note**: There's a known issue with @nx/next plugin and Next.js 15.3.2 App Router that causes build failures through nx. The frontend builds successfully using Next.js directly.

### Testing with Vitest

```bash
# Run tests for specific directories (ALWAYS use this format)
pnpm vitest run apps/backend/src/
pnpm vitest run apps/frontend/src/
pnpm vitest run libs/contracts/src/

# Run a specific test file
pnpm vitest run apps/backend/src/domains/user/auth/auth.service.spec.ts

# Watch mode for development
pnpm vitest apps/frontend/src/ --watch
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
│   ├── backend/          # NestJS API (Port 3000)
│   ├── frontend/         # Next.js app (Port 3001)
│   └── frontend-e2e/     # Playwright tests
├── libs/
│   └── contracts/        # Shared TypeScript types & Zod schemas
├── docs/                 # Technical documentation
├── bmad-agent/          # AI agent configurations
└── memory-bank/         # Project context & progress
```

### Technology Stack

- **Frontend**: Next.js 15.3.2 (App Router) + React 19.1.0 + TypeScript 5.7.2
- **Backend**: NestJS 11.0.0 + TypeScript 5.7.2
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **UI Components**: shadcn/ui + Radix UI + Tailwind CSS
- **State Management**: Zustand + TanStack Query
- **3D Graphics**: Three.js + React Three Fiber
- **Audio Processing**: Tone.js + Web Audio API
- **Forms**: React Hook Form + Zod validation
- **Build Tools**: Nx + Vite
- **Testing**: Vitest (unit) + Playwright (e2e)

### Domain Architecture

The project follows Domain-Driven Design with these core domains:

#### Frontend Domains (`apps/frontend/src/domains/`)

- **user**: Authentication, profiles, settings
- **playback**: Audio/video playback, 3D fretboard visualization
- **widgets**: YouTube integration, interactive tools
- **exercises**: Practice materials, progress tracking
- **tutorials**: Educational content, lessons
- **creators**: Content creator features

#### Backend Domains (`apps/backend/src/domains/`)

- **user**: User management, authentication
- **youtube**: YouTube API integration, batch processing
- **exercises**: Exercise data management
- **tutorials**: Tutorial content management

### Shared Contracts (`libs/contracts/src/`)

- Type-safe API contracts using Zod schemas
- Shared between frontend and backend
- Ensures type safety across the entire stack

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
```

### Backend (.env)

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
PORT=3000
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

## Useful Resources

- Project Documentation: `/docs/` directory
- AI Agent System: `/bmad-agent/` for development workflows
- Memory Bank: `/memory-bank/` for project context and progress
- Component Inventory: `/docs/ui-component-inventory.md`
- 3D Fretboard Docs: `/docs/fretboard-3d-implementation.md`
