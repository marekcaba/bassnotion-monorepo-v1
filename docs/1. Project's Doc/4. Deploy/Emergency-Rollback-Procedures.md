# Emergency Rollback Procedures

## 🚨 Overview

This guide provides step-by-step procedures for quickly rolling back failed deployments and restoring service when things go wrong.

## ⚡ Quick Response Checklist

**If production is down (Execute immediately):**

1. [ ] **Check service status** - Verify what's actually down
2. [ ] **Execute rollback** - Use platform-specific procedures below
3. [ ] **Verify restoration** - Test critical functionality
4. [ ] **Communicate status** - Update team/users about restoration
5. [ ] **Document incident** - Record what happened for post-mortem

## 🎯 Service Status Check

### Quick Health Checks

```bash
# Frontend (Vercel)
curl -I https://bassnotion-frontend.vercel.app

# Backend (Railway)
curl -I https://backend-production-612c.up.railway.app/api/health

# Database (Supabase) - Check dashboard
# https://supabase.com/dashboard/project/[your-project-id]
```

### Expected Responses

**Frontend (200 OK):**
```
HTTP/2 200
content-type: text/html
```

**Backend Health Endpoint (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2025-05-30T...",
  "database": "connected",
  "version": "1.2.0"
}
```

## 🔄 Railway Backend Rollback

### Method 1: Git-based Rollback (Recommended)

1. **Identify last working commit:**
```bash
git log --oneline -10
# Find the last commit that was working
```

2. **Create rollback commit:**
```bash
# Replace WORKING_COMMIT_HASH with actual hash
git revert HEAD --no-edit
# OR if multiple bad commits:
git reset --hard WORKING_COMMIT_HASH
git push --force-with-lease origin main
```

3. **Railway auto-deploys from main branch** - wait 2-3 minutes

4. **Verify rollback:**
```bash
curl https://backend-production-612c.up.railway.app/api/health
```

### Method 2: Railway Dashboard Rollback

1. **Go to Railway Project Dashboard**
   - Navigate to: https://railway.app/project/[your-project-id]

2. **Find Deployments Tab**
   - Click on "Deployments" in the left sidebar

3. **Locate Last Working Deployment**
   - Look for the last deployment with "Success" status
   - Note the deployment ID and timestamp

4. **Rollback to Working Deployment**
   - Click on the working deployment
   - Click "Redeploy" or "Rollback" button
   - Confirm the action

5. **Monitor Deployment**
   - Watch the deployment logs
   - Wait for "Deployment successful" message

### Method 3: Railway CLI Rollback

```bash
# Install Railway CLI if not available
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link [PROJECT_ID]

# List recent deployments
railway logs --deployment

# Rollback to specific deployment
railway deploy --detach [DEPLOYMENT_ID]
```

## 🌐 Vercel Frontend Rollback

### Method 1: Vercel Dashboard Rollback

1. **Go to Vercel Dashboard**
   - Navigate to: https://vercel.com/[your-team]/bassnotion-frontend

2. **Find Deployments Tab**
   - Click on "Deployments" tab

3. **Locate Last Working Deployment**
   - Look for deployment with "Ready" status
   - Usually the second-to-last deployment

4. **Promote to Production**
   - Click on the working deployment
   - Click "Promote to Production" button
   - Confirm the promotion

5. **Verify Rollback**
   - Check https://bassnotion-frontend.vercel.app
   - Test critical user flows

### Method 2: Git-based Rollback

```bash
# Find last working commit
git log --oneline apps/frontend/

# Revert to working state
git revert HEAD --no-edit
git push origin main

# Vercel auto-deploys from main branch
```

### Method 3: Vercel CLI Rollback

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# List deployments
vercel ls bassnotion-frontend

# Promote specific deployment
vercel promote [DEPLOYMENT_URL] --scope=[your-team]
```

## 🗄️ Database Rollback (Supabase)

### ⚠️ Critical Warning

**Database rollbacks are DANGEROUS and can cause data loss. Only perform in extreme emergencies.**

### Method 1: Point-in-Time Recovery

1. **Access Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/[project-id]

2. **Navigate to Database Settings**
   - Click on "Settings" → "Database"

3. **Find Point-in-Time Recovery**
   - Look for "Point-in-Time Recovery" section
   - Note: Only available on paid plans

4. **Select Recovery Point**
   - Choose timestamp before the problematic deployment
   - **WARNING**: This will lose ALL data after this point

### Method 2: Migration Rollback

```bash
# Connect to your Supabase project
# Only if you have direct SQL access

# List recent migrations
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version DESC LIMIT 10;

# Manually reverse migrations (DANGEROUS)
# You would need to manually write reverse SQL commands
```

### Method 3: Database Restore from Backup

1. **Check if you have automated backups configured**
2. **Restore from the most recent backup before the issue**
3. **Apply any necessary data reconciliation**

**⚠️ This is a last resort and will cause data loss**

## 📋 Post-Rollback Verification Checklist

### Frontend Verification

- [ ] Homepage loads correctly
- [ ] Authentication flows work
- [ ] Critical user journeys function
- [ ] API connections are working
- [ ] No console errors in browser

### Backend Verification

- [ ] Health endpoint responds
- [ ] Database connections work
- [ ] Authentication endpoints function
- [ ] Rate limiting is operational
- [ ] Logs show no critical errors

### Full-Stack Integration

- [ ] Login/logout flow works
- [ ] Data fetching functions
- [ ] User registration works
- [ ] Security features operational

## 🚨 Emergency Contact Information

### Platform Support

**Railway Support:**
- Dashboard: https://railway.app/help
- Discord: https://discord.gg/railway
- Status Page: https://status.railway.app

**Vercel Support:**
- Dashboard: https://vercel.com/help
- GitHub: https://github.com/vercel/vercel/discussions
- Status Page: https://www.vercel-status.com

**Supabase Support:**
- Dashboard: https://supabase.com/dashboard/support
- Discord: https://discord.gg/supabase
- Status Page: https://status.supabase.com

### Team Escalation

1. **Technical Lead** - [Contact Info]
2. **DevOps Engineer** - [Contact Info]
3. **Product Owner** - [Contact Info]

## 📝 Incident Documentation Template

After resolving the emergency, document the incident:

```markdown
# Incident Report - [Date]

## Summary
[Brief description of what happened]

## Timeline
- [Time] - Issue first detected
- [Time] - Rollback initiated
- [Time] - Service restored
- [Time] - Root cause identified

## Root Cause
[What caused the issue]

## Impact
[What was affected and for how long]

## Resolution
[How it was fixed]

## Lessons Learned
[What can be improved]

## Action Items
- [ ] [Specific improvements to prevent recurrence]
- [ ] [Process improvements]
- [ ] [Documentation updates]
```

## 🔄 Prevention Best Practices

### Before Deploying

- [ ] Test in staging environment
- [ ] Have rollback plan ready
- [ ] Ensure team availability
- [ ] Check dependency status
- [ ] Verify environment variables

### During Deployment

- [ ] Monitor deployment logs
- [ ] Test critical functionality immediately
- [ ] Have rollback commands ready
- [ ] Monitor error rates and performance

### After Deployment

- [ ] Verify all functionality
- [ ] Monitor for 30 minutes minimum
- [ ] Check error logs and metrics
- [ ] Update team on success/issues

---

_Created: May 30, 2025_
_Emergency procedures for BassNotion deployment failures_ 