# Tutorial & Exercise System Migration Guide

## Overview

This guide explains how to deploy the database migrations and storage configuration for the Admin Tutorial & Exercise Creation System (Story 4.2).

## Prerequisites

1. Supabase project set up and linked
2. Supabase CLI installed (`npm install -g supabase`)
3. Admin user with appropriate privileges

## Migration Files

The following migration files need to be applied:

1. **Database Schema**: `supabase/migrations/20241223_create_tutorials_exercises.sql`
   - Creates `tutorials` table
   - Creates `exercises` table
   - Creates `tutorial_sections` table
   - Sets up RLS policies
   - Adds auto-slug generation
   - Adds updated_at triggers

2. **Storage Buckets**: `supabase/storage/buckets.sql`
   - Creates `exercise-files` bucket
   - Sets up storage policies for MIDI files

## Deployment Steps

### Option 1: Using Supabase CLI (Recommended)

```bash
# 1. Link your project (if not already linked)
supabase link --project-ref your-project-ref

# 2. Push database migrations
supabase db push

# 3. Apply storage bucket configuration manually via SQL Editor
# Copy contents of supabase/storage/buckets.sql and run in Supabase SQL Editor
```

### Option 2: Manual Deployment via Supabase Dashboard

1. **Database Migration**:
   - Go to Supabase Dashboard > SQL Editor
   - Copy the contents of `supabase/migrations/20241223_create_tutorials_exercises.sql`
   - Run the SQL

2. **Storage Configuration**:
   - Go to Supabase Dashboard > SQL Editor
   - Copy the contents of `supabase/storage/buckets.sql`
   - Run the SQL

### Option 3: Using Direct SQL Connection

```bash
# Set your database URL
export DATABASE_URL="postgresql://postgres:[password]@[host]:[port]/postgres"

# Apply migrations
psql $DATABASE_URL -f supabase/migrations/20241223_create_tutorials_exercises.sql
psql $DATABASE_URL -f supabase/storage/buckets.sql
```

## Verification Steps

After applying migrations, verify the setup:

### 1. Check Tables Created

```sql
-- Run in SQL Editor
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('tutorials', 'exercises', 'tutorial_sections');
```

Expected: Should return all three tables

### 2. Check RLS Policies

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('tutorials', 'exercises');
```

Expected: `rowsecurity` should be `true` for both tables

### 3. Check Storage Bucket

```sql
-- Check storage bucket exists
SELECT * FROM storage.buckets WHERE id = 'exercise-files';
```

Expected: Should return the exercise-files bucket configuration

### 4. Test Admin Access

```sql
-- Check if profiles table has role column
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'role';
```

If the role column doesn't exist, you need to add it:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'user';
```

## Setting Up Admin Users

To grant admin access to a user:

```sql
-- Grant admin role to a specific user
UPDATE profiles
SET role = 'admin'
WHERE id = 'user-uuid-here';
```

## Environment Variables

Ensure these are set in your `.env` files:

### Backend (.env)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://...
```

### Frontend (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Rollback Procedure

If you need to rollback the migration:

```sql
-- Drop tables (WARNING: This will delete all data!)
DROP TABLE IF EXISTS tutorial_sections CASCADE;
DROP TABLE IF EXISTS exercises CASCADE;
DROP TABLE IF EXISTS tutorials CASCADE;

-- Drop storage policies
DROP POLICY IF EXISTS "Public can read exercise files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload exercise files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update exercise files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete exercise files" ON storage.objects;

-- Remove storage bucket
DELETE FROM storage.buckets WHERE id = 'exercise-files';
```

## Troubleshooting

### Issue: RLS policies blocking access

**Solution**: Ensure the user has the `admin` role in the profiles table

### Issue: Storage upload failing

**Solution**:

1. Check that the bucket exists
2. Verify CORS settings if uploading from browser
3. Check file size limits (5MB max)

### Issue: Slug generation not working

**Solution**: Ensure the trigger functions were created successfully

### Issue: Foreign key constraint errors

**Solution**: Ensure tutorials are created before exercises, as exercises reference tutorial_id

## Testing the Migration

After successful migration, test the system:

1. **Create a Tutorial** (as admin):

```bash
curl -X POST http://localhost:3000/api/v1/tutorials \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Tutorial",
    "description": "Test Description",
    "difficulty": "beginner",
    "author_name": "Test Author"
  }'
```

2. **Create an Exercise**:

```bash
curl -X POST http://localhost:3000/api/v1/exercises \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tutorial_id": "tutorial-uuid-here",
    "title": "Test Exercise",
    "description": "Test Description",
    "bpm": 120,
    "duration": 60,
    "difficulty": "beginner"
  }'
```

3. **Upload a MIDI file**:

- Use the admin interface at `/admin/tutorials/[slug]/edit`
- Upload MIDI files through the drag-and-drop interface

## Next Steps

After successful migration:

1. Create admin user accounts for content creators
2. Begin creating tutorials and exercises through the admin interface
3. Test MIDI file uploads and playback
4. Monitor RLS policies for any access issues
5. Set up regular database backups
