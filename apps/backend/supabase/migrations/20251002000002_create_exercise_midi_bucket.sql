-- Create storage bucket for exercise MIDI files
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-midi-files',
  'exercise-midi-files',
  true, -- Public bucket for easy access
  false,
  5242880, -- 5MB limit
  ARRAY['audio/midi', 'audio/x-midi', 'application/x-midi']
) ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the bucket
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