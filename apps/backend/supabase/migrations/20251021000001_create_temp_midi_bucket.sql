-- Story 4.4 - Task 2: Create temporary MIDI storage bucket
-- This bucket stores MIDI files temporarily before exercises are saved to database
-- Files are auto-cleaned after 2 hours by cleanup cron job

-- Create storage bucket for temporary MIDI files
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-midi-temp',
  'exercise-midi-temp',
  false, -- Private bucket (not publicly accessible)
  false,
  10485760, -- 10MB limit (larger than permanent bucket to allow bigger uploads)
  ARRAY['audio/midi', 'audio/x-midi', 'application/x-midi', 'application/octet-stream']
) ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the temp bucket
-- Only authenticated users can access temp files (using service role key for backend operations)

-- Authenticated users can upload temp MIDI files
CREATE POLICY "Authenticated users can upload temp MIDI files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'exercise-midi-temp'
  AND auth.uid() IS NOT NULL
);

-- Authenticated users can view temp MIDI files
CREATE POLICY "Authenticated users can view temp MIDI files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exercise-midi-temp'
  AND auth.uid() IS NOT NULL
);

-- Authenticated users can delete temp MIDI files (for cleanup)
CREATE POLICY "Authenticated users can delete temp MIDI files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exercise-midi-temp'
  AND auth.uid() IS NOT NULL
);

-- Authenticated users can update temp MIDI files (for move operations)
CREATE POLICY "Authenticated users can update temp MIDI files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'exercise-midi-temp'
  AND auth.uid() IS NOT NULL
);

-- Note: exercise-midi-temp bucket is auto-cleaned every hour (files older than 2 hours deleted)
