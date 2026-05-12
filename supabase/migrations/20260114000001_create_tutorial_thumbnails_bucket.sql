-- Migration: Create tutorial-thumbnails storage bucket for custom tutorial images
-- Date: 2026-01-14
-- Purpose: Allow admins to upload custom thumbnails instead of using YouTube thumbnails

-- Create storage bucket for tutorial thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tutorial-thumbnails',
  'tutorial-thumbnails',
  true, -- Public read access for displaying thumbnails
  5242880, -- 5MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Create storage policies

-- Allow public read access to all thumbnails
CREATE POLICY "Public can read tutorial thumbnails" ON storage.objects
  FOR SELECT USING (bucket_id = 'tutorial-thumbnails');

-- Only admins can upload thumbnails
CREATE POLICY "Admins can upload tutorial thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tutorial-thumbnails' AND
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Only admins can update thumbnails
CREATE POLICY "Admins can update tutorial thumbnails" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'tutorial-thumbnails' AND
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Only admins can delete thumbnails
CREATE POLICY "Admins can delete tutorial thumbnails" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tutorial-thumbnails' AND
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Add thumbnail_url column to tutorials table for storing Supabase storage URLs
-- This is separate from the existing 'thumbnail' column which stores emoji icons
ALTER TABLE tutorials ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN tutorials.thumbnail_url IS 'URL to custom thumbnail image in Supabase storage. If set, takes precedence over YouTube auto-generated thumbnails.';
