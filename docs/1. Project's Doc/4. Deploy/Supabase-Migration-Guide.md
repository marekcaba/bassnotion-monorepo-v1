# Supabase Migration Guide

## 📋 Overview

This guide documents the process for managing and deploying database migrations in the BassNotion project using Supabase.

## 🗄️ Migration File Structure

Migrations are stored in:

```
apps/backend/supabase/migrations/
```

Each migration file should follow the naming convention:

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Example:

```
20241228000001_create_login_attempts_table.sql
```

## 🚀 Deployment Process

### Method 1: Using MCP (Recommended)

1. **List Available Projects**

   ```typescript
   // Use MCP tools to list projects
   const projects = await supabase.listProjects();
   ```

2. **Apply Migration**

   ```typescript
   // Apply migration using MCP
   await supabase.applyMigration({
     projectId: 'your-project-id',
     name: 'migration-name',
     query: 'SQL content',
   });
   ```

3. **Verify Migration**
   ```typescript
   // List tables to verify
   const tables = await supabase.listTables({
     projectId: 'your-project-id',
   });
   ```

### Method 2: Using Supabase CLI

1. **Link Project**

   ```bash
   supabase link --project-ref your-project-ref
   ```

2. **Push Migration**
   ```bash
   supabase db push
   ```

## ✅ Migration Verification

After applying migrations, verify:

1. **Table Structure**

   - All tables exist
   - Columns have correct types
   - Default values are set
   - Comments are applied

2. **Indexes**

   - All specified indexes are created
   - Index names match migration
   - Composite indexes are properly ordered

3. **Security Policies**

   - RLS is enabled if specified
   - Policies are created with correct permissions
   - Service role access is configured

4. **Data Integrity**
   - Foreign key constraints work
   - Unique constraints are enforced
   - Check constraints are active

## 🔍 Common Issues

### 1. Migration Already Applied

**Problem**: Migration fails with "relation already exists"
**Solution**: Use IF NOT EXISTS in CREATE statements

### 2. Permission Issues

**Problem**: "permission denied" errors
**Solution**: Ensure you're using the service role key for migrations

### 3. Invalid SQL Syntax

**Problem**: SQL syntax errors in production
**Solution**: Test migrations locally first:

```sql
-- Local test
BEGIN;
-- Your migration SQL here
ROLLBACK;
```

## 🏗️ Creating New Migrations

1. **Create Migration File**

   ```bash
   # Generate timestamp
   timestamp=$(date +%Y%m%d%H%M%S)
   # Create file
   touch apps/backend/supabase/migrations/${timestamp}_description.sql
   ```

2. **Migration Template**

   ```sql
   -- Description of changes
   -- Dependencies: List any dependent migrations

   -- Reversible changes
   CREATE TABLE IF NOT EXISTS table_name (
     -- columns
   );

   -- Security
   ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

   -- Indexes
   CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);

   -- Comments
   COMMENT ON TABLE table_name IS 'Description';
   ```

3. **Test Locally**
   ```sql
   BEGIN;
   -- Migration SQL
   ROLLBACK;
   ```

## 🔄 Rolling Back Changes

While Supabase doesn't support automatic rollbacks, always write migrations that can be manually reversed:

1. **Create Rollback File**

   ```sql
   -- rollback_YYYYMMDDHHMMSS_description.sql
   DROP TABLE IF EXISTS table_name CASCADE;
   ```

2. **Apply Rollback**
   ```typescript
   // Using MCP
   await supabase.applyMigration({
     projectId: 'your-project-id',
     name: 'rollback_migration_name',
     query: rollbackSQL,
   });
   ```

## 📝 Best Practices

1. **Atomic Changes**

   - One logical change per migration
   - Include all related changes (tables, indexes, policies)

2. **Idempotent Migrations**

   - Use IF NOT EXISTS / IF EXISTS
   - Safe to run multiple times

3. **Security First**

   - Always include RLS policies
   - Set up appropriate access controls
   - Document security implications

4. **Documentation**

   - Clear descriptions in migration files
   - Document dependencies
   - Include example queries

5. **Testing**
   - Test migrations locally
   - Verify all constraints
   - Check security policies
   - Test rollback procedures

---

_Last Updated: May 30, 2025_
