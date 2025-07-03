-- Allow Supabase dashboard editing of tutorials table
-- This adds a policy to allow authenticated users (dashboard) to edit tutorials

-- Drop the specific policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Allow dashboard edit access to tutorials" ON tutorials;

-- Create policy for dashboard editing
-- Note: Supabase dashboard runs as authenticated user when you're logged in
CREATE POLICY "Allow dashboard edit access to tutorials"
ON tutorials FOR ALL
USING (
  -- Allow if user is authenticated (dashboard access)
  auth.role() = 'authenticated' OR 
  -- Or if it's service role (backend access)
  auth.role() = 'service_role' OR
  -- Or if it's anon role for public read
  (auth.role() = 'anon' AND current_setting('request.method', true) = 'GET')
)
WITH CHECK (
  -- For writes, only allow authenticated or service role
  auth.role() = 'authenticated' OR 
  auth.role() = 'service_role'
);

-- Add comment
COMMENT ON POLICY "Allow dashboard edit access to tutorials" ON tutorials IS 'Allows Supabase dashboard editing while maintaining security'; 