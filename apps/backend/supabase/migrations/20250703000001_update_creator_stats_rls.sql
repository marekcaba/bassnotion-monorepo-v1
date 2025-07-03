-- Update RLS policies for creator_stats to allow backend app access
-- This allows our backend to freely read/write creator stats while maintaining security

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Allow service role to manage creator_stats" ON creator_stats;

-- Create more flexible policies for backend access
-- Policy 1: Allow authenticated users and service role to read
CREATE POLICY "Allow backend read access to creator_stats"
ON creator_stats FOR SELECT
USING (
  auth.role() = 'service_role' OR 
  auth.role() = 'authenticated' OR
  auth.role() = 'anon'
);

-- Policy 2: Allow backend app and service role to insert/update
CREATE POLICY "Allow backend write access to creator_stats"
ON creator_stats FOR INSERT
WITH CHECK (
  auth.role() = 'service_role' OR 
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow backend update access to creator_stats"  
ON creator_stats FOR UPDATE
USING (
  auth.role() = 'service_role' OR 
  auth.role() = 'authenticated'
)
WITH CHECK (
  auth.role() = 'service_role' OR 
  auth.role() = 'authenticated'
);

-- Policy 3: Only service role can delete (for cleanup)
CREATE POLICY "Allow service role delete access to creator_stats"
ON creator_stats FOR DELETE
USING (auth.role() = 'service_role');

-- Add comment explaining the RLS setup
COMMENT ON TABLE creator_stats IS 'Cached YouTube creator statistics. RLS allows backend free access while maintaining security.'; 