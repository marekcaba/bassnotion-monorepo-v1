-- Update pattern_library to use MIDI file storage instead of JSON
-- =================================================================

-- Drop the existing midi_data column and add file storage columns
ALTER TABLE pattern_library
  DROP COLUMN IF EXISTS midi_data,
  ADD COLUMN midi_file_url TEXT,
  ADD COLUMN midi_file_path TEXT, -- Path in storage bucket (e.g., 'patterns/drums/rock-beat.mid')
  ADD COLUMN file_size_bytes INTEGER,
  ADD COLUMN duration_ms INTEGER, -- Duration in milliseconds
  ADD COLUMN preview_url TEXT; -- Optional audio preview URL

-- Add index for faster lookups
CREATE INDEX idx_pattern_library_midi_path ON pattern_library(midi_file_path);

-- Update the pattern library with proper MIDI file paths
-- (These will need to be uploaded to Supabase storage)
UPDATE pattern_library SET
  midi_file_path = CASE slug
    WHEN 'basic-rock-beat' THEN 'patterns/drums/basic-rock-beat.mid'
    WHEN 'jazz-swing' THEN 'patterns/drums/jazz-swing.mid'
    WHEN 'funk-groove' THEN 'patterns/drums/funk-groove.mid'
    WHEN 'simple-chords' THEN 'patterns/harmony/simple-chords.mid'
    WHEN 'jazz-voicings' THEN 'patterns/harmony/jazz-voicings.mid'
    WHEN 'power-chords' THEN 'patterns/harmony/power-chords.mid'
    ELSE midi_file_path
  END,
  midi_file_url = CASE slug
    WHEN 'basic-rock-beat' THEN 'https://your-bucket.supabase.co/storage/v1/object/public/audio-samples/patterns/drums/basic-rock-beat.mid'
    WHEN 'jazz-swing' THEN 'https://your-bucket.supabase.co/storage/v1/object/public/audio-samples/patterns/drums/jazz-swing.mid'
    WHEN 'funk-groove' THEN 'https://your-bucket.supabase.co/storage/v1/object/public/audio-samples/patterns/drums/funk-groove.mid'
    WHEN 'simple-chords' THEN 'https://your-bucket.supabase.co/storage/v1/object/public/audio-samples/patterns/harmony/simple-chords.mid'
    WHEN 'jazz-voicings' THEN 'https://your-bucket.supabase.co/storage/v1/object/public/audio-samples/patterns/harmony/jazz-voicings.mid'
    WHEN 'power-chords' THEN 'https://your-bucket.supabase.co/storage/v1/object/public/audio-samples/patterns/harmony/power-chords.mid'
    ELSE midi_file_url
  END
WHERE slug IN ('basic-rock-beat', 'jazz-swing', 'funk-groove', 'simple-chords', 'jazz-voicings', 'power-chords');

-- Create a storage policy for pattern MIDI files using proper RLS
-- Note: This assumes you have a 'patterns' folder in your audio-samples bucket
-- Only create if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Public read access to pattern files'
  ) THEN
    CREATE POLICY "Public read access to pattern files"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'audio-samples' AND (storage.foldername(name))[1] = 'patterns');
  END IF;
END $$;

-- Function to get full storage URL for a pattern
CREATE OR REPLACE FUNCTION get_pattern_storage_url(pattern_path TEXT)
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
BEGIN
  -- Get the base URL from environment or config
  SELECT
    CONCAT(
      current_setting('app.supabase_url', true),
      '/storage/v1/object/public/audio-samples/',
      pattern_path
    ) INTO base_url;

  RETURN base_url;
END;
$$ LANGUAGE plpgsql;

-- Update pattern library entries to use the function
UPDATE pattern_library
SET midi_file_url = get_pattern_storage_url(midi_file_path)
WHERE midi_file_path IS NOT NULL;

-- Make columns NOT NULL after populating them
ALTER TABLE pattern_library
  ALTER COLUMN midi_file_url SET NOT NULL,
  ALTER COLUMN midi_file_path SET NOT NULL;

-- Add metadata columns for better organization
ALTER TABLE pattern_library
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false, -- Admin verification
  ADD COLUMN IF NOT EXISTS metadata JSONB; -- Store additional MIDI metadata

-- Create pattern upload tracking table
CREATE TABLE IF NOT EXISTS pattern_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID REFERENCES pattern_library(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  upload_status TEXT CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for upload tracking
CREATE INDEX idx_pattern_uploads_status ON pattern_uploads(upload_status);
CREATE INDEX idx_pattern_uploads_pattern ON pattern_uploads(pattern_id);