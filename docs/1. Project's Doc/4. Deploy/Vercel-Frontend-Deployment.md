# Vercel Deployment Guide for AI Assistants

## 🎯 Purpose

This guide provides step-by-step instructions for AI assistants to successfully deploy the BassNotion monorepo to Vercel. Follow this checklist to avoid common pitfalls and ensure successful deployment.

## ✅ Pre-Deployment Checklist

### 1. **Verify Monorepo Structure**

Before attempting deployment, confirm the following structure exists:

```
bassnotion-monorepo-v1/
├── apps/
│   └── frontend/
│       ├── package.json
│       ├── setup-contracts.sh
│       └── src/
├── libs/
│   └── contracts/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
├── vercel.json
└── tsconfig.base.json
```

**AI Action**: Use `list_dir` to verify this structure exists.

### 2. **Check TypeScript Configuration Alignment**

#### A. Verify contracts tsconfig.json

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

#### B. Verify contracts package.json exports

```json
{
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

#### C. Verify tsconfig.base.json path mapping

```json
{
  "paths": {
    "@bassnotion/contracts": ["libs/contracts/dist/index.d.ts"]
  }
}
```

**🚨 CRITICAL**: These three configurations MUST align:

- TypeScript compiles: `src/index.ts` → `dist/index.js`
- Package exports: Points to `./dist/index.js`
- Path mapping: Points to `libs/contracts/dist/index.d.ts`

**AI Action**: Use `read_file` to check each configuration file and verify alignment.

### 3. **Verify Dependencies**

#### A. Check contracts dependencies

The `libs/contracts/package.json` must include:

```json
{
  "dependencies": {
    "zod": "^3.25.32",
    "typescript": "5.3.3"
  }
}
```

#### B. Check frontend dependencies

The `apps/frontend/package.json` should NOT include `@bassnotion/contracts` as a dependency (it's copied manually).

**AI Action**: Use `read_file` to verify dependencies are correctly configured.

### 4. **Validate Setup Script**

Check that `apps/frontend/setup-contracts.sh` contains:

✅ **Required Elements**:

- Executable permissions handling: `chmod +x setup-contracts.sh`
- File system checks instead of `npm list`
- Explicit fallback dependency installation
- Build verification
- Copy verification

✅ **Must NOT contain**:

- `npm list` commands (they fail in CI)
- Hardcoded version numbers that might become outdated
- Paths that assume specific working directories

**AI Action**: Use `read_file` to review the setup script and ensure it follows the working pattern.

### 5. **Test Contracts Library Locally**

Before deploying, verify the contracts library builds correctly:

```bash
cd libs/contracts
npm install
npm run build
ls -la dist/  # Should show index.js and index.d.ts
```

**AI Action**: Use `run_terminal_cmd` to test the build process locally.

### 6. **Verify Vercel Configuration**

Check `vercel.json` contains:

```json
{
  "installCommand": "chmod +x setup-contracts.sh && ./setup-contracts.sh",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

**AI Action**: Use `read_file` to verify vercel.json configuration.

## 🚀 Deployment Process

### Step 1: Pre-flight Check

Run this automated check before deployment:

```bash
# Check contracts build
cd libs/contracts && npm run build && ls -la dist/

# Check TypeScript compilation
cd ../../apps/frontend && npx tsc --noEmit

# Check for common issues
echo "Checking package.json exports..."
cat ../../libs/contracts/package.json | grep -A 10 '"exports"'
```

### Step 2: Deploy

Once all checks pass:

```bash
git add -A
git commit -m "Pre-deployment verification complete"
git push
```

Vercel will automatically deploy via GitHub integration.

## 🔍 Common Issues & Solutions

### Issue: "Cannot find module 'zod'"

**Check**: Are dependencies properly listed in `libs/contracts/package.json`?
**Fix**: Add missing dependencies to the contracts package.json

### Issue: "Cannot find module '@bassnotion/contracts'"

**Check**: Do the package.json exports match the actual build output?
**Fix**: Align exports, path mappings, and build output structure

### Issue: "npm list failed with ELSPROBLEMS"

**Check**: Is the setup script using `npm list`?
**Fix**: Replace with file system checks (`ls -la node_modules/`)

### Issue: Build fails silently

**Check**: Does the setup script have proper error handling?
**Fix**: Add explicit checks and verbose logging

## 📋 AI Assistant Decision Tree

```
1. Is monorepo structure correct?
   NO → Stop. Fix structure first.
   YES → Continue to step 2.

2. Are TypeScript configs aligned?
   NO → Fix tsconfig, package.json, and path mappings.
   YES → Continue to step 3.

3. Are dependencies correct?
   NO → Fix package.json dependencies.
   YES → Continue to step 4.

4. Does setup script follow best practices?
   NO → Update script to use file system checks.
   YES → Continue to step 5.

5. Does contracts library build locally?
   NO → Debug and fix build issues.
   YES → Safe to deploy!
```

## 🛠️ Debug Commands for AI Assistants

When troubleshooting, use these commands:

```bash
# Check current working directory structure
ls -la apps/frontend/
ls -la libs/contracts/

# Test contracts build
cd libs/contracts && npm install && npm run build

# Check TypeScript compilation without emit
cd apps/frontend && npx tsc --noEmit

# Verify package structure
cat libs/contracts/package.json | jq '.exports'

# Check path mappings
cat tsconfig.base.json | jq '.compilerOptions.paths'
```

## 🎯 Success Criteria

Before declaring deployment ready, verify:

✅ Contracts library builds without errors  
✅ TypeScript compilation succeeds  
✅ Package exports match build output  
✅ Path mappings align with exports  
✅ Dependencies are correctly specified  
✅ Setup script uses reliable patterns  
✅ No hardcoded assumptions about environment

## 📚 Reference: Working Configuration

### Contracts Package.json (Template)

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
  },
  "scripts": {
    "build": "npx --package=typescript tsc",
    "typecheck": "npx --package=typescript tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.25.32",
    "typescript": "5.3.3"
  }
}
```

### Setup Script Template

```bash
#!/bin/bash
set -e

echo "=== BassNotion Frontend Setup Script ==="
echo "Current directory: $(pwd)"

# Install frontend dependencies
npm install --no-optional --no-audit --no-fund

# Build contracts library
cd ../../libs/contracts
npm install --no-optional --no-audit --no-fund --verbose

# Verify dependencies with file system checks (NOT npm list)
if [ ! -d "node_modules/zod" ]; then
  npm install zod@^3.25.32 --no-optional --no-audit --no-fund
fi

if [ ! -d "node_modules/typescript" ]; then
  npm install typescript@5.3.3 --no-optional --no-audit --no-fund
fi

# Build and verify
npm run build
if [ ! -f "dist/index.js" ]; then
  echo "ERROR: Build failed"
  exit 1
fi

# Copy to frontend
cd ../../apps/frontend
mkdir -p node_modules/@bassnotion/contracts
cp -r ../../libs/contracts/* node_modules/@bassnotion/contracts/

echo "Setup complete!"
```

## 🚨 Red Flags - Stop and Fix These

❌ **Package exports pointing to `dist/src/`** (should be `dist/`)  
❌ **Using `npm list` in setup scripts** (use file system checks)  
❌ **Missing dependencies in contracts package.json**  
❌ **Misaligned TypeScript path mappings**  
❌ **Setup script without error handling**  
❌ **Hardcoded paths that assume specific environments**

---

**Last Updated**: May 2025  
**For**: AI Assistants & Development Team  
**Status**: Production Ready Guide
