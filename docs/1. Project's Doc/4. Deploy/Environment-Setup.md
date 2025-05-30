# Environment Configuration Guide

## 📋 Overview

This guide covers all environment variable configuration for the BassNotion full-stack deployment.

## 🔑 Required Environment Variables

### Railway Backend

Configure these in Railway project dashboard:

```bash
# Database & Authentication
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# Frontend URL for OAuth callbacks (CRITICAL for Google OAuth)
FRONTEND_URL=https://bassnotion-frontend.vercel.app

# Application
NODE_ENV=production
PORT=8080

# Optional: Logging
LOG_LEVEL=info
```

### Vercel Frontend

Configure these in Vercel project dashboard:

```bash
# Public Variables (available to client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=https://backend-production-612c.up.railway.app

# Build Variables
NODE_ENV=production
```

## 🔧 Configuration Steps

### Supabase Setup

1. **Get your Supabase credentials:**
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Select your project
   - Go to Settings → API
   - Copy the URL and anon key

### Railway Configuration

1. **Access Railway dashboard:**

   - Go to [Railway](https://railway.app)
   - Select your backend project
   - Go to Variables tab

2. **Add environment variables:**
   ```
   SUPABASE_URL → https://your-project.supabase.co
   SUPABASE_KEY → your_supabase_anon_key
   FRONTEND_URL → https://bassnotion-frontend.vercel.app
   NODE_ENV → production
   PORT → 8080
   ```

### Vercel Configuration

1. **Access Vercel dashboard:**

   - Go to [Vercel](https://vercel.com)
   - Select your frontend project
   - Go to Settings → Environment Variables

2. **Add environment variables:**
   ```
   NEXT_PUBLIC_SUPABASE_URL → https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY → your_supabase_anon_key
   NEXT_PUBLIC_API_URL → https://backend-production-612c.up.railway.app
   ```

## ⚠️ Security Best Practices

### Do NOT commit sensitive variables to Git:

- Never add `.env` files with real credentials
- Use platform-specific environment configuration
- Keep anon keys separate from service role keys

### Variable Types:

- **Frontend**: Use `NEXT_PUBLIC_` prefix for client-accessible variables
- **Backend**: Regular environment variables (no prefix needed)

## 🧪 Local Development

For local development, create these files (NOT committed to Git):

### `apps/backend/.env.local`

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
NODE_ENV=development
PORT=3001
```

### `apps/frontend/.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🔍 Verification

### Check Backend Variables

```bash
# In Railway logs, you should see:
DEBUG: Loaded SUPABASE_URL: https://your-project.supabase.co
DEBUG: Loaded SUPABASE_KEY: your_key...
```

### Check Frontend Variables

```javascript
// In browser console:
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log(process.env.NEXT_PUBLIC_API_URL);
```

---

_Keep this guide updated as new environment variables are added._
