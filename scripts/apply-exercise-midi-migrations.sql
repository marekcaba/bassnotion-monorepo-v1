-- Combined migration script for exercise MIDI fields
-- Run this script in the Supabase dashboard SQL editor

-- 1. Add MIDI URL columns to exercises table
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS drummer_midi_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS bassline_midi_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS harmony_midi_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS metronome_midi_url VARCHAR(500);

-- Add comments to document the columns
COMMENT ON COLUMN exercises.drummer_midi_url IS 'URL to the drummer MIDI file in Supabase storage';
COMMENT ON COLUMN exercises.bassline_midi_url IS 'URL to the bassline MIDI file in Supabase storage';
COMMENT ON COLUMN exercises.harmony_midi_url IS 'URL to the harmony MIDI file in Supabase storage';
COMMENT ON COLUMN exercises.metronome_midi_url IS 'URL to the metronome MIDI file in Supabase storage';

-- 2. Create storage bucket for exercise MIDI files (if not exists)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-midi-files',
  'exercise-midi-files',
  true, -- Public bucket for easy access
  false,
  5242880, -- 5MB limit
  ARRAY['audio/midi', 'audio/x-midi', 'application/x-midi']
) ON CONFLICT (id) DO NOTHING;

-- 3. Create RLS policies for the bucket
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view exercise MIDI files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload exercise MIDI files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update exercise MIDI files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete exercise MIDI files" ON storage.objects;

-- Create new policies
CREATE POLICY "Anyone can view exercise MIDI files"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise-midi-files');

CREATE POLICY "Authenticated users can upload exercise MIDI files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'exercise-midi-files'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update exercise MIDI files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'exercise-midi-files'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete exercise MIDI files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exercise-midi-files'
  AND auth.uid() IS NOT NULL
);

-- Verify the changes
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'exercises'
AND column_name IN ('drummer_midi_url', 'bassline_midi_url', 'harmony_midi_url', 'metronome_midi_url');