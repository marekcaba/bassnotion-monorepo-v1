# Railway Deployment Guide for BassNotion Backend

## Overview
This guide documents the complete Railway deployment process for the BassNotion monorepo backend, including all critical configuration, common issues, and solutions learned through extensive debugging.

## Prerequisites

### Project Structure Requirements
```
bassnotion-monorepo-v1/
├── apps/backend/          # Main backend application
├── libs/contracts/        # Shared TypeScript contracts
├── Dockerfile.final       # Multi-stage Docker build
└── railway.json          # Railway configuration
```

### Key Configuration Files

#### 1. `railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "dockerfile",
    "dockerfilePath": "Dockerfile.final"
  },
  "deploy": {
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 180,
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 3
  }
}
```

#### 2. `tsconfig.base.json` - Path Mappings
```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "baseUrl": ".",
    "paths": {
      "@bassnotion/contracts": ["libs/contracts/dist/src/index.d.ts"]
    }
  }
}
```

#### 3. `libs/contracts/package.json` - Package Exports
```json
{
  "name": "@bassnotion/contracts",
  "type": "module",
  "main": "./dist/src/index.js",
  "types": "./dist/src/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/src/index.js",
      "require": "./dist/src/index.js", 
      "types": "./dist/src/index.d.ts"
    }
  }
}
```

## Docker Configuration

### Multi-Stage Dockerfile Structure

```dockerfile
# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY libs/contracts/package.json ./libs/contracts/package.json

# Install pnpm and dependencies with hoisting
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Copy source code
COPY . .

# Disable Nx Cloud to avoid authentication issues
ENV NX_CLOUD_NO_TIMEOUTS=true
ENV NX_CLOUD_AUTH=false
ENV NX_DAEMON=false

# Build contracts first (dependency)
RUN pnpm nx build @bassnotion/contracts
RUN cd libs/contracts && rm -rf dist tsconfig.tsbuildinfo && npm run build

# Build backend
RUN pnpm nx build @bassnotion/backend --prod

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Ensure contracts are available for runtime
COPY --from=builder /app/libs/contracts ./libs/contracts
RUN rm -rf node_modules/@bassnotion/contracts && \
    mkdir -p node_modules/@bassnotion/contracts && \
    cp -r libs/contracts/dist node_modules/@bassnotion/contracts/ && \
    cp libs/contracts/package.json node_modules/@bassnotion/contracts/

EXPOSE 3000
CMD ["node", "dist/apps/backend/src/main.js"]
```

## Critical Issues and Solutions

### 1. Module Resolution Issues

**Problem**: `Cannot find module '@bassnotion/contracts'`

**Root Causes**:
- TypeScript path mappings pointing to wrong location
- Runtime vs build-time resolution differences
- Symlink issues in Docker containers

**Solutions**:
- Align path mappings with actual build output: `libs/contracts/dist/src/index.d.ts`
- Use `--shamefully-hoist` to flatten dependencies
- Copy contracts directly to production `node_modules`

### 2. ES Module Compatibility

**Problem**: `ReferenceError: require is not defined in ES module scope`

**Root Cause**: Project has `"type": "module"` but using CommonJS syntax

**Solution**: Use ES import syntax:
```javascript
// ❌ Wrong
const { createServer } = require('http');

// ✅ Correct  
import { createServer } from 'http';
```

### 3. Path Structure Misalignment

**Problem**: Files built to `dist/src/` but configurations expecting `dist/`

**Root Cause**: TypeScript preserves directory structure from source

**Solution**: Update all configurations to use `dist/src/` structure:
- Package.json exports: `./dist/src/index.js`
- TypeScript paths: `libs/contracts/dist/src/index.d.ts`
- Setup scripts: Check for `dist/src/index.js`

### 4. Symlink Issues in Docker

**Problem**: `are the same file` errors during Docker build

**Root Cause**: pnpm creates symlinks that can't be copied in multi-stage builds

**Solutions**:
- Use `--shamefully-hoist` flag to create real files instead of symlinks
- Remove symlinks before copying: `rm -rf node_modules/@bassnotion/contracts`
- Copy source files directly rather than trying to copy symlinks

## Deployment Process

### 1. Pre-deployment Checklist
- [ ] All tests pass locally
- [ ] Local build succeeds: `pnpm nx build @bassnotion/backend`
- [ ] Contracts build correctly: `ls libs/contracts/dist/src/index.d.ts`
- [ ] No TypeScript errors: `cd apps/backend && npx tsc --noEmit`

### 2. Environment Variables
Required in Railway dashboard:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
NODE_ENV=production
PORT=8080
```

### 3. Build Process
1. Railway pulls from GitHub main branch
2. Docker build runs with multi-stage process
3. Contracts library built first
4. Backend application built with contracts dependency
5. Production image created with flattened dependencies
6. Health check validates deployment

### 4. Health Check Verification
Railway will ping `/api/health` endpoint:
- Timeout: 180 seconds
- Expected: HTTP 200 response
- Retry policy: 3 attempts on failure

## Troubleshooting Guide

### Build Failures

**"Cannot find module" during TypeScript compilation**
1. Check path mappings in `tsconfig.base.json`
2. Verify contracts build output: `libs/contracts/dist/src/index.d.ts`
3. Ensure contracts package.json exports are correct

**"same file" errors during Docker build**
1. Add `rm -rf` commands before copying
2. Verify `--shamefully-hoist` is used
3. Check for conflicting symlinks

### Runtime Failures

**Module resolution errors in production**
1. Verify contracts are copied to production `node_modules`
2. Check package.json exports syntax
3. Ensure ES module compatibility

**Health check failures**
1. Test health endpoint locally: `curl http://localhost:8080/api/health`
2. Check application logs for startup errors
3. Verify environment variables are set

## Best Practices

### Dependency Management
- Always use `--shamefully-hoist` for Docker builds
- Keep package-lock.yaml in sync
- Explicitly copy shared libraries to production

### Build Optimization
- Build contracts before backend
- Clean build artifacts between builds
- Use multi-stage Docker for smaller production images

### Monitoring
- Enable detailed logging for debugging
- Monitor health check endpoint
- Set appropriate timeout values

## Common Commands

```bash
# Local testing
pnpm nx build @bassnotion/contracts
pnpm nx build @bassnotion/backend
cd apps/backend && npx tsc --noEmit

# Docker testing
docker build -f Dockerfile.final -t bassnotion-backend .
docker run -p 8080:8080 bassnotion-backend

# Deployment
git push origin main  # Triggers Railway deployment
```

## File Structure Reference

### Required Build Output
```
dist/
├── apps/backend/src/main.js     # Application entrypoint
└── ...

libs/contracts/dist/src/
├── index.js                     # Runtime module
├── index.d.ts                   # TypeScript declarations
└── ...

node_modules/@bassnotion/contracts/
├── dist/                        # Built contracts
└── package.json                 # Package metadata
```

## Version History
- **v1.0**: Initial working configuration after 3-day debugging session
- Resolved module resolution, ES module compatibility, and Docker symlink issues
- Established stable build and deployment process

---

*This guide represents hard-won knowledge from extensive debugging. Follow these patterns to avoid deployment hell.* 