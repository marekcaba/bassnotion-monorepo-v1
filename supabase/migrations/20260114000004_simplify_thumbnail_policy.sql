-- Simplify: Remove auth.role() check, just use is_admin function
-- The is_admin function already handles authentication implicitly

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can upload tutorial thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update tutorial thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete tutorial thumbnails" ON storage.objects;

-- Simplified policies - just check is_admin
CREATE POLICY "Admins can upload tutorial thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tutorial-thumbnails'
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Admins can update tutorial thumbnails" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'tutorial-thumbnails'
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Admins can delete tutorial thumbnails" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tutorial-thumbnails'
    AND public.is_admin(auth.uid())
  );
