# BassNotion Deployment Setup Guide

## 📋 Overview

This document provides a complete guide for deploying the BassNotion monorepo, including frontend (Next.js) and backend (NestJS) services. Follow this guide to ensure consistent and successful deployments.

## 🏗️ Architecture

### Current Deployment Stack

- **Frontend**: Next.js 15.3.2 deployed on Vercel
- **Backend**: NestJS deployed on Railway using Docker
- **Database**: Supabase (PostgreSQL)
- **Package Manager**: pnpm (development), npm (production builds)

### Live URLs

- **Frontend**: https://bassnotion-frontend.vercel.app
- **Backend**: https://backend-production-612c.up.railway.app
- **Database**: Supabase project (configured via environment variables)

## 🚀 Frontend Deployment (Vercel) - CRITICAL SETUP

### ⚠️ IMPORTANT: Monorepo Detection & Working Directory

**Vercel automatically detects monorepo structure and sets the working directory to `apps/frontend/`**. This is crucial to understand for proper configuration.

When Vercel runs:

- It automatically changes to the `apps/frontend/` directory
- All commands run from this directory, NOT from the repository root
- File paths are relative to `apps/frontend/`, not the monorepo root

### Prerequisites

- Vercel account with access to the project
- Repository access
- Environment variables configured in Vercel dashboard

### Configuration Files

#### 1. Root `vercel.json` (FINAL WORKING VERSION)

```json
{
  "installCommand": "chmod +x setup-contracts.sh && ./setup-contracts.sh",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "cleanUrls": true,
  "trailingSlash": false,
  "github": {
    "silent": true
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

#### 2. `apps/frontend/setup-contracts.sh` (CRITICAL FOR MONOREPO)

```bash
#!/bin/bash
set -e

echo "Installing npm dependencies..."
npm install

echo "Building contracts library..."
cd ../../libs/contracts
npm install
npm run build
cd ../../apps/frontend

echo "Setting up contracts library..."
mkdir -p node_modules/@bassnotion/contracts
cp -r ../../libs/contracts/* node_modules/@bassnotion/contracts/

echo "Contracts library setup complete!"
```

#### 3. `apps/frontend/package.json` Dependencies

```json
{
  "dependencies": {
    "@hookform/resolvers": "^5.0.1",
    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-tabs": "^1.1.12",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@supabase/supabase-js": "^2.49.8",
    "@tanstack/react-query": "^5.62.7",
    "@tanstack/react-query-devtools": "^5.62.7",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.263.1",
    "next": "15.3.2",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-hook-form": "^7.53.0",
    "tailwind-merge": "^2.2.0",
    "zod": "^3.25.32",
    "zustand": "^5.0.0"
  }
}
```

**CRITICAL**: `@bassnotion/contracts` is NOT listed in package.json dependencies because it's copied manually during the install phase.

#### 4. `libs/contracts/package.json` (FIXED EXPORTS)

```json
{
  "name": "@bassnotion/contracts",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

### Vercel Project Settings

#### Critical Settings in Vercel Dashboard:

1. **Root Directory**: Leave EMPTY (Vercel auto-detects `apps/frontend`)
2. **Framework**: Next.js (auto-detected)
3. **Build Command**: `npm run build` (from vercel.json)
4. **Install Command**: Custom script (from vercel.json)
5. **Output Directory**: `.next` (Next.js default)

### Environment Variables (Frontend)

Configure these in Vercel Dashboard (NOT in .env files):

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=your_backend_url
```

### 🚫 What DIDN'T Work (Troubleshooting History)

#### ❌ Attempt 1: Direct Nx Commands

```json
{
  "buildCommand": "npx nx build @bassnotion/contracts && npx nx build @bassnotion/frontend"
}
```

**Failed**: Nx not installed in Vercel's npm environment

#### ❌ Attempt 2: Workspace Dependencies

```json
{
  "dependencies": {
    "@bassnotion/contracts": "workspace:*"
  }
}
```

**Failed**: npm doesn't understand pnpm workspace syntax

#### ❌ Attempt 3: File Path Dependencies

```json
{
  "dependencies": {
    "@bassnotion/contracts": "file:../../libs/contracts"
  }
}
```

**Failed**: Path resolution issues when Vercel runs from frontend directory

#### ❌ Attempt 4: Registry Dependencies

```json
{
  "dependencies": {
    "@bassnotion/contracts": "0.1.0"
  }
}
```

**Failed**: Package doesn't exist in npm registry

#### ❌ Attempt 5: Long Install Commands

```json
{
  "installCommand": "npm install && mkdir -p node_modules/@bassnotion && cp -r ../../libs/contracts node_modules/@bassnotion/ && echo 'debug...' && ls -la..."
}
```

**Failed**: Vercel has 256 character limit for installCommand

#### ❌ Attempt 6: Wrong Package.json Exports

```json
{
  "main": "./dist/src/index.js",
  "types": "./dist/src/index.d.ts"
}
```

**Failed**: TypeScript compiler outputs to `./dist/index.js`, not `./dist/src/index.js`

### ✅ Final Working Solution

1. **Custom Install Script**: Use `setup-contracts.sh` to handle complex monorepo setup
2. **Manual Library Copy**: Copy built contracts library to `node_modules/@bassnotion/contracts`
3. **Correct Export Paths**: Package.json exports match actual TypeScript build output
4. **Simple Build Command**: Just `npm run build` since Vercel runs from frontend directory
5. **Missing Dependencies**: Added `@supabase/supabase-js` and `zod` to frontend package.json

### Deployment Process

#### Method 1: Git-based Deployment (Recommended)

- Push changes to main branch
- Vercel automatically deploys via GitHub integration
- Uses configuration from `vercel.json`

#### Method 2: CLI Deployment

```bash
# From monorepo root
npx vercel --prod
```

### Next.js 15 Compatibility Issues

#### Suspense Boundary Requirements

Next.js 15 requires Suspense boundaries for components using `useSearchParams()`:

```jsx
// apps/frontend/src/app/login/page.tsx
import { Suspense } from 'react';

function LoginPageContent() {
  // Component using useSearchParams()
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
```

### Common Issues & Solutions

#### Issue: "Module not found: Can't resolve '@bassnotion/contracts'"

**Cause**: Contracts library not properly built or copied
**Solution**:

1. Ensure `setup-contracts.sh` builds the library
2. Check package.json exports match actual file structure
3. Verify script has execute permissions

#### Issue: "installCommand should NOT be longer than 256 characters"

**Cause**: Vercel schema validation limit
**Solution**: Use external script file instead of inline commands

#### Issue: "No such file or directory: dist/src/"

**Cause**: Package.json exports pointing to wrong paths
**Solution**: Update exports to match actual TypeScript build output

#### Issue: Suspense boundary errors

**Cause**: Next.js 15 requirements
**Solution**: Wrap components using `useSearchParams()` in Suspense boundaries

## 🛠️ Backend Deployment (Railway)

### Prerequisites

- Railway account with project access
- Docker support enabled
- Environment variables configured

### Configuration Files

#### 1. `Dockerfile.final` (Multi-stage build)

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY libs/contracts/package.json ./libs/contracts/package.json

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build contracts library first
RUN pnpm nx build @bassnotion/contracts

# Build backend
RUN pnpm nx build @bassnotion/backend --prod

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/apps/backend/main.js"]
```

#### 2. `.dockerignore`

```
node_modules
.git
.nx
apps/frontend
docs
bmad-agent
deploy
tmp
*.log
.env.local
.env.development
```

#### 3. `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.final",
    "watchPatterns": [
      "apps/backend/**",
      "libs/**",
      "package.json",
      "pnpm-lock.yaml",
      "Dockerfile.final",
      "railway.json"
    ]
  },
  "deploy": {
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 180,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Environment Variables (Backend)

```bash
NODE_ENV=production
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
```

### Deployment Process

#### Automatic Deployment

- Push changes to main branch
- Railway automatically builds and deploys using Docker
- Health check endpoint: `/api/health`

#### Manual Deployment

```bash
# Using Railway CLI
railway deploy
```

### Health Check

The backend includes a health check endpoint at `/api/health` that Railway uses to verify deployment success.

## 🗄️ Database Setup (Supabase)

### Configuration

- **Provider**: Supabase (PostgreSQL)
- **Connection**: Via Supabase JavaScript client
- **Authentication**: Service role key for backend, anon key for frontend

### Environment Variables

```bash
# Backend (Service Role - Full Access)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key

# Frontend (Anonymous - Limited Access)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 🔄 CI/CD Pipeline

### GitHub Actions

- **Trigger**: Push to main branch
- **Frontend**: Automatic deployment via Vercel GitHub integration
- **Backend**: Automatic deployment via Railway GitHub integration

### Deployment Flow

1. Code pushed to main branch
2. Vercel builds and deploys frontend
3. Railway builds Docker image and deploys backend
4. Health checks verify successful deployment

## 🚨 Troubleshooting

### Frontend Issues

- **Build failures**: Check Next.js configuration and dependencies
- **Environment variables**: Verify `NEXT_PUBLIC_` prefix for client-side variables
- **Contracts library**: Ensure setup script builds and copies correctly

### Backend Issues

- **Docker build failures**: Check Dockerfile and dependency installation
- **Health check failures**: Verify `/api/health` endpoint is accessible
- **Database connection**: Verify Supabase credentials and network access

### Common Solutions

1. **Clear deployment cache**: Redeploy from scratch
2. **Check logs**: Use Vercel/Railway dashboards for detailed logs
3. **Environment variables**: Verify all required variables are set
4. **Dependencies**: Ensure all packages are properly installed

## 📊 Monitoring

### Health Checks

- **Frontend**: Vercel automatic monitoring
- **Backend**: Railway health check at `/api/health`
- **Database**: Supabase dashboard monitoring

### Logs

- **Frontend**: Vercel dashboard
- **Backend**: Railway dashboard
- **Database**: Supabase logs

## 🔐 Security

### Environment Variables

- Never commit sensitive keys to repository
- Use different keys for development/production
- Rotate keys regularly

### CORS Configuration

- Frontend and backend properly configured for cross-origin requests
- Supabase RLS (Row Level Security) policies in place

---

**Last Updated**: May 2025
**Status**: ✅ Production Ready
**Deployment URLs**:

- Frontend: https://bassnotion-frontend.vercel.app
- Backend: https://backend-production-612c.up.railway.app
