# OAuth Production Configuration Guide

## 🚨 Critical Issue: OAuth Redirecting to Localhost in Production

If you see OAuth callbacks redirecting to `http://localhost:3000` in production, this means the `FRONTEND_URL` environment variable is not set correctly.

## 🎯 Root Cause

The backend code has fallback localhost URLs for development:

```typescript
// This will use localhost if FRONTEND_URL is not set:
redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/callback`
```

## ✅ Solution: Set FRONTEND_URL Environment Variable

### Step 1: Configure Railway Backend Environment

1. **Go to Railway Dashboard**
   - Navigate to: https://railway.app/project/[your-project-id]

2. **Go to Variables Tab**
   - Click on "Variables" in the left sidebar

3. **Add FRONTEND_URL Variable**
   ```
   Variable Name: FRONTEND_URL
   Variable Value: https://bassnotion-frontend.vercel.app
   ```

4. **Redeploy the Backend**
   - Click "Deploy" or push a new commit to trigger deployment

### Step 2: Verify the Fix

1. **Test Google OAuth Flow**
   - Go to: https://bassnotion-frontend.vercel.app/login
   - Click "Sign in with Google"
   - Verify it redirects to Google (not localhost)

2. **Check OAuth Callback URL**
   - After Google authentication, verify the callback URL is:
   - `https://bassnotion-frontend.vercel.app/auth/callback?code=...`

## 🔧 Required Environment Variables Summary

### Railway Backend (Production)

```bash
# Critical for OAuth callbacks
FRONTEND_URL=https://bassnotion-frontend.vercel.app

# Database & Authentication
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# Application
NODE_ENV=production
PORT=8080
```

### Vercel Frontend (Production)

```bash
# API endpoints
NEXT_PUBLIC_API_URL=https://backend-production-612c.up.railway.app

# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Build configuration
NODE_ENV=production
```

## 🔍 Files Updated for Production URLs

The following files have been updated to use production URLs as fallbacks instead of localhost:

### Backend OAuth Controller
**File**: `apps/backend/src/domains/user/auth/auth.controller.ts`

```typescript
// ✅ Fixed: Now uses production URL as fallback
redirectTo: `${process.env.FRONTEND_URL || 'https://bassnotion-frontend.vercel.app'}/auth/callback`,

// OAuth error redirects also fixed:
res.redirect(`${process.env.FRONTEND_URL || 'https://bassnotion-frontend.vercel.app'}/login?error=oauth_failed`);
res.redirect(`${process.env.FRONTEND_URL || 'https://bassnotion-frontend.vercel.app'}/dashboard?oauth=success`);
```

### Frontend API Client
**File**: `apps/frontend/src/domains/user/api/auth.ts`

```typescript
// ✅ Fixed: Now uses production API URL as fallback
private get backendUrl() {
  return process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-612c.up.railway.app';
}
```

### Next.js Configuration
**File**: `apps/frontend/next.config.js`

```javascript
// ✅ Fixed: Now uses environment variable for API proxying
async rewrites() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-612c.up.railway.app';
  return [
    {
      source: '/api/:path*',
      destination: `${backendUrl}/api/:path*`,
    },
    {
      source: '/auth/:path*',
      destination: `${backendUrl}/auth/:path*`,
    },
  ];
}
```

## 🧪 Testing the Fix

### Manual Testing

1. **Clear browser cache and cookies**
2. **Go to production frontend**: https://bassnotion-frontend.vercel.app/login
3. **Click "Sign in with Google"**
4. **Verify OAuth flow**:
   - Should redirect to Google OAuth page
   - After authentication, should return to: `https://bassnotion-frontend.vercel.app/auth/callback`
   - Should NOT redirect to any localhost URLs

### Debugging OAuth Issues

If OAuth still doesn't work:

1. **Check Railway logs**:
   ```bash
   # Look for FRONTEND_URL in startup logs
   DEBUG: Loaded FRONTEND_URL: https://bassnotion-frontend.vercel.app
   ```

2. **Check browser network tab**:
   - Look for OAuth initiation request to `/auth/google`
   - Verify the redirect URL in the response

3. **Check Supabase Auth configuration**:
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Verify redirect URLs include: `https://bassnotion-frontend.vercel.app/**`

## 🔐 Google OAuth Configuration in Supabase

### Authorized Redirect URIs

Make sure these are configured in your Google OAuth app:

1. **Development**:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3001/auth/callback`

2. **Production**:
   - `https://bassnotion-frontend.vercel.app/auth/callback`

### Supabase Auth Settings

In Supabase Dashboard → Authentication → URL Configuration:

1. **Site URL**: `https://bassnotion-frontend.vercel.app`
2. **Redirect URLs**:
   - `https://bassnotion-frontend.vercel.app/**`
   - `http://localhost:3000/**` (for development)
   - `http://localhost:3001/**` (for development)

## 🚨 Prevention Checklist

To prevent this issue in the future:

- [ ] Always set `FRONTEND_URL` environment variable in Railway
- [ ] Use production URLs as fallbacks in code, not localhost
- [ ] Test OAuth flows in production after deployment
- [ ] Document all required environment variables
- [ ] Include OAuth testing in deployment checklists

---

_Created: May 30, 2025_
_Critical fix for OAuth production configuration_ 