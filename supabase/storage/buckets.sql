-- Create storage bucket for exercise files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-files',
  'exercise-files',
  true, -- Public read access
  5242880, -- 5MB limit per file
  ARRAY['audio/midi', 'audio/x-midi', 'application/x-midi']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['audio/midi', 'audio/x-midi', 'application/x-midi'];

-- Create storage policies

-- Allow public read access to all files
CREATE POLICY "Public can read exercise files" ON storage.objects
  FOR SELECT USING (bucket_id = 'exercise-files');

-- Only admins can upload/update/delete files
CREATE POLICY "Admins can upload exercise files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'exercise-files' AND
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Admins can update exercise files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'exercise-files' AND
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Admins can delete exercise files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'exercise-files' AND
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );