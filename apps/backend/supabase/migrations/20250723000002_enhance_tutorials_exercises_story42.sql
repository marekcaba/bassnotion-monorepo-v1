-- Story 4.2: Enhance tutorials and exercises for admin creation system
-- This migration adds missing fields and features needed for the admin interface

-- Add missing columns to tutorials table if they don't exist
ALTER TABLE tutorials
ADD COLUMN IF NOT EXISTS author_name VARCHAR,
ADD COLUMN IF NOT EXISTS category VARCHAR,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS order_index INTEGER,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add missing columns to exercises table if they don't exist
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS bpm INTEGER CHECK (bpm >= 40 AND bpm <= 200),
ADD COLUMN IF NOT EXISTS duration INTEGER, -- in seconds
ADD COLUMN IF NOT EXISTS time_signature JSONB DEFAULT '{"numerator": 4, "denominator": 4}',
ADD COLUMN IF NOT EXISTS key VARCHAR,
ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS order_index INTEGER,
ADD COLUMN IF NOT EXISTS has_metronome_midi BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_drums_midi BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_bass_midi BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_harmony_midi BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_filename VARCHAR,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Create tutorial sections table if it doesn't exist
CREATE TABLE IF NOT EXISTS tutorial_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id UUID REFERENCES tutorials(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  start_time INTEGER NOT NULL, -- in seconds
  end_time INTEGER NOT NULL, -- in seconds
  exercise_ids UUID[],
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_tutorials_is_active ON tutorials(is_active);
CREATE INDEX IF NOT EXISTS idx_tutorials_published_at ON tutorials(published_at);
CREATE INDEX IF NOT EXISTS idx_exercises_is_active ON exercises(is_active);
CREATE INDEX IF NOT EXISTS idx_tutorial_sections_tutorial_id ON tutorial_sections(tutorial_id);

-- Enable RLS if not already enabled
ALTER TABLE tutorial_sections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that conflict with new ones
DROP POLICY IF EXISTS "Allow public read access to active tutorials" ON tutorials;
DROP POLICY IF EXISTS "Allow authenticated users to create tutorials" ON tutorials;
DROP POLICY IF EXISTS "Allow authenticated users to update tutorials" ON tutorials;
DROP POLICY IF EXISTS "Allow authenticated users to delete tutorials" ON tutorials;

-- Create new RLS Policies for admin system

-- Public can read published tutorials
CREATE POLICY "Public can read published tutorials" ON tutorials
  FOR SELECT USING (is_active = true AND published_at IS NOT NULL);

-- Admins can do everything with tutorials
CREATE POLICY "Admins can manage tutorials" ON tutorials
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Public can read exercises for published tutorials
CREATE POLICY "Public can read exercises for published tutorials" ON exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tutorials
      WHERE tutorials.id = exercises.tutorial_id
      AND tutorials.is_active = true
      AND tutorials.published_at IS NOT NULL
    )
  );

-- Admins can manage exercises
CREATE POLICY "Admins can manage exercises" ON exercises
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Policies for tutorial_sections
DROP POLICY IF EXISTS "Public can read sections for published tutorials" ON tutorial_sections;
CREATE POLICY "Public can read sections for published tutorials" ON tutorial_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tutorials
      WHERE tutorials.id = tutorial_sections.tutorial_id
      AND tutorials.is_active = true
      AND tutorials.published_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Admins can manage tutorial sections" ON tutorial_sections;
CREATE POLICY "Admins can manage tutorial sections" ON tutorial_sections
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Create function to auto-generate slug from title (if not exists)
CREATE OR REPLACE FUNCTION generate_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          title,
          '[^a-zA-Z0-9\s-]', '', 'g'  -- Remove special characters
        ),
        '\s+', '-', 'g'  -- Replace spaces with hyphens
      ),
      '-+', '-', 'g'  -- Replace multiple hyphens with single hyphen
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate slug if not provided
CREATE OR REPLACE FUNCTION trigger_generate_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title) || '-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS auto_generate_tutorial_slug ON tutorials;
CREATE TRIGGER auto_generate_tutorial_slug
  BEFORE INSERT ON tutorials
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_slug();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers (drop if exists first)
DROP TRIGGER IF EXISTS set_tutorials_updated_at ON tutorials;
CREATE TRIGGER set_tutorials_updated_at
  BEFORE UPDATE ON tutorials
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_exercises_updated_at ON exercises;
CREATE TRIGGER set_exercises_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_tutorial_sections_updated_at ON tutorial_sections;
CREATE TRIGGER set_tutorial_sections_updated_at
  BEFORE UPDATE ON tutorial_sections
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- Mark existing tutorials as published if they're active
UPDATE tutorials
SET published_at = COALESCE(published_at, created_at)
WHERE is_active = true AND published_at IS NULL;