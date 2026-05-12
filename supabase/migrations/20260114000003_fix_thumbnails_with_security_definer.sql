-- Fix: Tutorial thumbnails policies using SECURITY DEFINER function
-- Storage policies can't always access other tables due to RLS context

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can upload tutorial thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update tutorial thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete tutorial thumbnails" ON storage.objects;

-- Create a SECURITY DEFINER function to check admin role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = user_id
    AND profiles.role = 'admin'
  );
END;
$$;

-- Recreate policies using the SECURITY DEFINER function
CREATE POLICY "Admins can upload tutorial thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tutorial-thumbnails'
    AND auth.role() = 'authenticated'
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Admins can update tutorial thumbnails" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'tutorial-thumbnails'
    AND auth.role() = 'authenticated'
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Admins can delete tutorial thumbnails" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tutorial-thumbnails'
    AND auth.role() = 'authenticated'
    AND public.is_admin(auth.uid())
  );
