# Common Deployment Issues & Solutions

## 📋 Overview

This guide consolidates all deployment troubleshooting knowledge for the BassNotion full-stack application, covering both Railway (backend) and Vercel (frontend) deployment issues.

**Status**: ✅ **Current deployments working**

- **Backend**: https://backend-production-612c.up.railway.app
- **Frontend**: https://bassnotion-frontend.vercel.app

## 🎯 Critical Issues Resolved (v1.1.0)

### 1. **ES Module Compatibility** 🚨 **MOST COMMON**

**Error**:

```
ReferenceError: require is not defined in ES module scope
```

**Root Cause**: Project has `"type": "module"` but code uses CommonJS `require()` syntax.

**Solution**: Use ES import syntax:

```javascript
// ❌ Wrong
const { createServer } = require('http');

// ✅ Correct
import { createServer } from 'http';
```

### 2. **Module Resolution in Monorepo**

**Error**:

```
Cannot find module '@bassnotion/contracts' or its corresponding type declarations
```

**Root Causes**:

- TypeScript path mappings pointing to wrong location
- Runtime vs build-time resolution differences
- Symlink issues in Docker containers

**Solutions**:

```json
// tsconfig.base.json - Correct path mapping
{
  "paths": {
    "@bassnotion/contracts": ["libs/contracts/dist/src/index.d.ts"]
  }
}
```

```json
// libs/contracts/package.json - Correct exports
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

### 3. **Docker Symlink Issues**

**Error**:

```
cp: 'libs/contracts/dist' and 'node_modules/@bassnotion/contracts/dist' are the same file
```

**Root Cause**: pnpm creates symlinks that can't be copied in multi-stage builds.

**Solution**: Remove symlinks before copying:

```dockerfile
RUN rm -rf node_modules/@bassnotion/contracts && \
    mkdir -p node_modules/@bassnotion/contracts && \
    cp -r libs/contracts/dist node_modules/@bassnotion/contracts/
```

### 4. **Path Structure Misalignment**

**Error**: Files built to `dist/src/` but configurations expecting `dist/`

**Root Cause**: TypeScript preserves directory structure from source.

**Solution**: Update all configurations to use `dist/src/` structure:

- Package.json exports: `./dist/src/index.js`
- TypeScript paths: `libs/contracts/dist/src/index.d.ts`
- Setup scripts: Check for `dist/src/index.js`

## 🚀 Railway Backend Issues

### Build Failures

**Nx Cloud Authentication Errors**

```dockerfile
# Disable Nx Cloud in Docker
ENV NX_CLOUD_NO_TIMEOUTS=true
ENV NX_CLOUD_AUTH=false
ENV NX_DAEMON=false
```

**Docker Build Optimization**

```dockerfile
# Use shamefully-hoist to flatten dependencies
RUN pnpm install --frozen-lockfile --shamefully-hoist
```

### Runtime Failures

**Health Check Timeouts**

- Ensure health endpoint returns proper response
- Check that application starts without errors
- Verify environment variables are set

**Port Configuration**

```javascript
// Use Railway's PORT environment variable
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0');
```

## 🎨 Vercel Frontend Issues

### Build Failures

**Contracts Library Not Found**

- Verify `setup-contracts.sh` script is executable
- Check that script builds contracts correctly
- Ensure contracts are copied to `node_modules/@bassnotion/contracts`

**Workspace Dependencies**

```bash
# Don't use workspace syntax - npm doesn't understand it
# "dependencies": { "@bassnotion/contracts": "workspace:*" } ❌

# Use manual copy approach instead ✅
```

### Runtime Issues

**Environment Variables**

- Configure in Vercel dashboard, not in code
- Use `NEXT_PUBLIC_` prefix for client-side variables
- Verify Supabase URL and keys are correct

## 🔧 General Troubleshooting Steps

### 1. Local Testing First

```bash
# Test contracts build
pnpm nx build @bassnotion/contracts
ls libs/contracts/dist/src/index.d.ts

# Test backend build
pnpm nx build @bassnotion/backend
cd apps/backend && npx tsc --noEmit

# Test frontend build
cd apps/frontend && npm run build
```

### 2. Docker Testing (Railway)

```bash
# Build Docker image locally
docker build -f Dockerfile.final -t bassnotion-backend .

# Test locally
docker run -p 8080:8080 bassnotion-backend

# Check health endpoint
curl http://localhost:8080/api/health
```

### 3. Environment Variable Debugging

```bash
# Check if variables are loaded
echo $SUPABASE_URL
echo $SUPABASE_KEY
```

### 4. Clear Build Caches

```bash
# Clear Nx cache
rm -rf .nx/cache

# Clear node_modules
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf libs/*/node_modules

# Fresh install
pnpm install
```

## 📊 Deployment Checklist

**Before deploying:**

- [ ] Local build succeeds for both frontend and backend
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Contracts build correctly: `ls libs/contracts/dist/src/index.d.ts`
- [ ] Environment variables configured in platform dashboards
- [ ] Health endpoints working locally
- [ ] Database connections tested

**If deployment fails:**

1. Check platform logs (Railway/Vercel dashboard)
2. Verify environment variables are set
3. Test build process locally
4. Check for common issues in this guide
5. Verify file paths and exports

## 🏷️ Version History

- **v1.1.0** (May 29, 2025): All critical issues resolved, production deployments working
- **v1.0.0**: Initial deployment with basic troubleshooting

---

_This guide represents lessons learned from extensive debugging. Keep updated as new issues are discovered._
