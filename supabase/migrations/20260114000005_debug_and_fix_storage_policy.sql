-- Debug: Let's check what policies exist and recreate them cleanly

-- First, let's see all existing policies on storage.objects for tutorial-thumbnails
-- and drop ALL of them to start fresh

DROP POLICY IF EXISTS "Public can read tutorial thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload tutorial thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update tutorial thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete tutorial thumbnails" ON storage.objects;

-- Also drop any other potential policy names
DROP POLICY IF EXISTS "Authenticated users can upload tutorial thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update tutorial thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete tutorial thumbnails" ON storage.objects;

-- Ensure bucket exists and is public
UPDATE storage.buckets
SET public = true
WHERE id = 'tutorial-thumbnails';

-- Create fresh policies with very simple checks
-- Policy 1: Anyone can read (SELECT) from this bucket
CREATE POLICY "tutorial_thumbnails_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'tutorial-thumbnails');

-- Policy 2: Admins can insert
-- Using a direct subquery instead of function call
CREATE POLICY "tutorial_thumbnails_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'tutorial-thumbnails'
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) = 'admin'
  );

-- Policy 3: Admins can update
CREATE POLICY "tutorial_thumbnails_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'tutorial-thumbnails'
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) = 'admin'
  );

-- Policy 4: Admins can delete
CREATE POLICY "tutorial_thumbnails_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'tutorial-thumbnails'
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) = 'admin'
  );
