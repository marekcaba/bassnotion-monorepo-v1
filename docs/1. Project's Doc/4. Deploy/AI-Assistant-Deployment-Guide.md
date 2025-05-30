# AI Assistant Deployment Guide

## 🤖 Overview

This guide provides specific instructions for AI assistants helping with BassNotion deployment. It's designed to prevent common mistakes and ensure AI assistants follow proven deployment patterns.

## 🎯 Core Principles for AI Assistants

### ✅ DO: Follow Existing Documentation

1. **Always read the deployment docs first** before making any changes
2. **Use the documented configuration patterns** - they were hard-earned through extensive debugging
3. **Preserve working solutions** - if something is documented as working, don't change it
4. **Follow the established file structure** - especially the `dist/src/` pattern for Railway

### ❌ DON'T: Common AI Assistant Mistakes

1. **Don't remove security features** to "fix" dependency injection issues
2. **Don't change working Docker configurations** to match "best practices"
3. **Don't simplify complex configurations** that solve specific monorepo issues
4. **Don't ignore the deployment documentation** and create new solutions

## 🏗️ Critical Configuration Patterns

### 1. Railway Backend Deployment

**Required Path Structure:**
```
libs/contracts/dist/src/index.js   ← MUST be dist/src/, not dist/
libs/contracts/dist/src/index.d.ts ← TypeScript definitions here
```

**Required TypeScript Configuration:**
```json
// tsconfig.base.json
{
  "paths": {
    "@bassnotion/contracts": ["libs/contracts/dist/src/index.d.ts"]
  }
}
```

**Required Package.json Exports:**
```json
// libs/contracts/package.json
{
  "main": "./dist/src/index.js",
  "types": "./dist/src/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/src/index.js",
      "types": "./dist/src/index.d.ts"
    }
  }
}
```

### 2. NestJS Dependency Injection

**Correct Pattern for AuthSecurityService:**

```typescript
// auth.module.ts - MUST include AuthSecurityService in providers
@Module({
  providers: [AuthService, AuthGuard, AuthSecurityService],  // ← Include all services
})

// auth.service.ts - Normal dependency injection
constructor(
  private readonly db: DatabaseService,
  private readonly authSecurity: AuthSecurityService,  // ← Required, not optional
) {}
```

**❌ WRONG: Don't use @Optional() to "fix" DI issues**
```typescript
// ❌ This is wrong - it removes security features
constructor(
  private readonly db: DatabaseService,
  @Optional() private readonly authSecurity?: AuthSecurityService,
) {}
```

### 3. Vercel Frontend Deployment

**Required Setup Script:**
```bash
# apps/frontend/setup-contracts.sh
#!/bin/bash
set -e
cd ../../libs/contracts
npm run build
cd ../../apps/frontend
mkdir -p node_modules/@bassnotion/contracts
cp -r ../../libs/contracts/* node_modules/@bassnotion/contracts/
```

**Required Vercel Configuration:**
```json
// vercel.json
{
  "installCommand": "chmod +x setup-contracts.sh && ./setup-contracts.sh",
  "buildCommand": "npm run build"
}
```

## 🛠️ Troubleshooting Guide for AI Assistants

### Problem: "Cannot find module '@bassnotion/contracts'"

**❌ Wrong Solution:**
- Remove the import
- Make it optional
- Change the path mapping

**✅ Correct Solution:**
1. Check if contracts are building to `dist/src/` structure
2. Verify path mappings point to `libs/contracts/dist/src/index.d.ts`
3. Ensure package.json exports use `./dist/src/index.js`

### Problem: "Nest can't resolve dependencies of AuthService"

**❌ Wrong Solution:**
- Remove AuthSecurityService from constructor
- Make AuthSecurityService optional with @Optional()
- Comment out security features

**✅ Correct Solution:**
1. Add AuthSecurityService to the module's providers array
2. Ensure AuthSecurityService has its own dependencies (DatabaseService) properly configured
3. Check that DatabaseModule is imported in AuthModule

### Problem: Docker build failures

**❌ Wrong Solution:**
- Simplify the Dockerfile
- Remove multi-stage build
- Copy fewer files

**✅ Correct Solution:**
1. Use the documented Dockerfile.final configuration
2. Ensure `--shamefully-hoist` flag is used
3. Verify symlink handling is correct

## 📋 AI Assistant Deployment Checklist

Before making any changes:

- [ ] Read the relevant deployment guide completely
- [ ] Understand why the current configuration exists
- [ ] Check the Common Issues guide for similar problems
- [ ] Verify the proposed solution preserves all functionality

When helping with deployment:

- [ ] Follow the documented patterns exactly
- [ ] Test locally before suggesting deployment
- [ ] Preserve security features and authentication
- [ ] Use the established path structures

When deployment fails:

- [ ] Check Common Issues guide first
- [ ] Look for configuration drift from documented patterns
- [ ] Verify environment variables are set correctly
- [ ] Don't remove functionality to "fix" issues

## 🔐 Security-First Approach

**Key Security Features to NEVER Remove:**

1. **AuthSecurityService** - Provides rate limiting and account lockout
2. **Login attempt tracking** - Records security events
3. **Rate limiting logic** - Prevents brute force attacks
4. **Account lockout mechanisms** - Progressive security measures

**If encountering dependency injection issues:**
- Fix the module configuration
- Add missing providers
- Don't make security services optional

## 📚 Required Reading for AI Assistants

Before helping with deployment, AI assistants MUST read:

1. [Common Issues & Solutions](./Common-Issues.md) - Critical troubleshooting knowledge
2. [Full-Stack Setup Guide](./Full-Stack-Setup.md) - Complete deployment overview
3. Platform-specific guide (Railway or Vercel)
4. This AI Assistant guide

## 🚨 Red Flags: When to Stop and Ask

Stop and ask the human developer if you encounter:

- Multiple dependency injection errors
- Need to remove security features
- Docker build failures not covered in docs
- Suggestion to change working configurations
- Complex path resolution issues

**Remember:** The deployment documentation exists because these exact issues were solved through extensive debugging. Trust the documented solutions.

---

_Created: May 30, 2025_
_For AI Assistants helping with BassNotion deployment_ 