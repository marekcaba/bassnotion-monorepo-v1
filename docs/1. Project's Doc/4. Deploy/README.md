# BassNotion Deployment Documentation

## 📋 Quick Reference

This folder contains all deployment guides for the BassNotion full-stack application.

### 🎯 Current Deployment Status

- ✅ **Frontend**: Next.js deployed on Vercel - [Live Site](https://bassnotion-frontend.vercel.app)
- ✅ **Backend**: NestJS deployed on Railway - [Live API](https://backend-production-612c.up.railway.app)
- ✅ **Database**: Supabase PostgreSQL with Authentication

### 📚 Documentation Structure

#### 🚀 **Primary Deployment Guides**

1. **[Full-Stack Deployment Setup](./Full-Stack-Setup.md)** ⭐ **START HERE** - End-to-end deployment for both services
2. **[Railway Backend Deployment Guide](./Railway-Backend-Deployment.md)** - Complete backend deployment process
3. **[Vercel Frontend Deployment Guide](./Vercel-Frontend-Deployment.md)** - Complete frontend deployment process
4. **[Supabase Migration Guide](./Supabase-Migration-Guide.md)** - Database migration process

#### 🔧 **Troubleshooting & Advanced**

5. **[Common Issues & Solutions](./Common-Issues.md)** ⚠️ **READ FIRST** - Frequently encountered problems and fixes
6. **[OAuth Production Configuration](./OAuth-Production-Configuration.md)** 🚨 **CRITICAL** - Fix OAuth localhost redirect issues
7. **[Environment Configuration](./Environment-Setup.md)** - Environment variables and configuration

#### 🏗️ **Development Support**

8. **[AI Assistant Deployment Guide](./AI-Assistant-Deployment-Guide.md)** 🤖 - Specific instructions for AI assistants helping with deployment
9. **[Emergency Rollback Procedures](./Emergency-Rollback-Procedures.md)** 🚨 - How to quickly rollback failed deployments

### 🎯 Quick Start

**For first-time deployment:**

1. ⭐ Start with [Full-Stack Deployment Setup](./Full-Stack-Setup.md)
2. ⚠️ Read [Common Issues](./Common-Issues.md) BEFORE deploying
3. Follow platform-specific guides as needed
4. Use troubleshooting docs if issues arise

**For updates to existing deployment:**

1. Check [Emergency Rollback Procedures](./Emergency-Rollback-Procedures.md) to prepare for rollback if needed
2. Check [Supabase Migration Guide](./Supabase-Migration-Guide.md) if database changes are needed
3. Use the specific platform guide (Railway or Vercel)
4. Check [Common Issues](./Common-Issues.md) if deployment fails

**For AI Assistants helping with deployment:**

1. Read [AI Assistant Deployment Guide](./AI-Assistant-Deployment-Guide.md) for specific instructions
2. Always follow existing documentation rather than improvising
3. Preserve security features - don't remove them to "fix" issues

### 📊 Pre-Deployment Checklist

**Development Readiness:**
- [ ] All tests pass locally (`pnpm test`)
- [ ] ESLint passes (`pnpm lint`)
- [ ] TypeScript compiles (`pnpm build`)
- [ ] E2E tests pass (if applicable)

**Database Preparation:**
- [ ] Database migrations verified:
  - [ ] Migration files exist in `apps/backend/supabase/migrations/`
  - [ ] Migrations are properly named (timestamp_description.sql)
  - [ ] Migrations have been tested locally
  - [ ] Migrations have been applied to production (see [Supabase Migration Guide](./Supabase-Migration-Guide.md))
  - [ ] Migration success verified (tables, indexes, policies exist)

**Configuration Verification:**
- [ ] Environment variables configured for target platform
- [ ] Secrets and API keys updated
- [ ] Health checks implemented and tested
- [ ] Build configuration verified

**Security Checklist:**
- [ ] Authentication flows tested
- [ ] Rate limiting configured
- [ ] Input validation in place
- [ ] SQL injection protection verified
- [ ] XSS protection headers configured

### 🚨 Emergency Procedures

**If deployment fails:**

1. Check [Common Issues](./Common-Issues.md) for immediate solutions
2. Use [Emergency Rollback Procedures](./Emergency-Rollback-Procedures.md) if needed
3. Verify environment variables and configuration
4. Check logs on the deployment platform

**If production is down:**

1. Immediately execute rollback procedures
2. Check service status pages (Railway, Vercel, Supabase)
3. Review deployment logs for error messages
4. Contact team/support if critical

### 📈 Monitoring & Maintenance

**Regular Tasks:**
- [ ] Check deployment logs weekly
- [ ] Monitor performance metrics
- [ ] Update dependencies monthly
- [ ] Review security configurations quarterly

**Health Checks:**
- Frontend: https://bassnotion-frontend.vercel.app
- Backend: https://backend-production-612c.up.railway.app/api/health
- Database: Check via Supabase dashboard

### 🏷️ Version History

- **v1.2.0** (May 30, 2025): AuthSecurityService fully restored - Complete auth security features deployed
- **v1.1.0** (May 29, 2025): Story 1.1 Complete - First production deployment with Zod contracts
- **v1.0.0**: Initial deployment setup with basic infrastructure

### 🧠 Knowledge Base

**Key Lessons Learned:**
- Always preserve security features rather than removing them
- ES Module compatibility requires careful attention to import/export syntax
- Monorepo dependencies need special handling in deployment environments
- Docker symlink issues require specific solutions
- Path structure alignment is critical for successful builds

**Critical Configuration Patterns:**
- Use `dist/src/` structure for Railway compatibility
- Use manual contract copying for Vercel compatibility
- Always test locally before deploying
- Use proper dependency injection patterns in NestJS

---

_Last Updated: May 30, 2025_
_Next Review: June 15, 2025_
